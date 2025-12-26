# 1. 背景与目标

你现在的链路是：**定时拉取 cliproxyapi 的 usage API → 解析明细 → 写入 UsageEvent → 再聚合 UsageDaily**。

新增目标：把 **Codex CLI 本地会话（session）** 的用量也采集进来，并支持多维度统计，例如：

* 按 **session**、**repo/cwd**、**originator（CLI / VSCode）**、**model**、**时间** 统计
* 展示 **cached_input_tokens**、**reasoning_output_tokens**（展示用）、**costUsd**
* 与现有 UsageDaily/UsageAggregateJob 复用同一套聚合体系

---

# 2. Codex CLI 数据源选择

## 2.1 主要数据源：session JSONL（强烈建议作为“真账本”）

Codex 会把配置、日志等存放在 `$CODEX_HOME`（默认 `~/.codex`），并说明日志等信息也会存放在这里。([GitHub][1])
同时社区也明确提到它会把聊天历史保存为 `~/.codex/sessions` 下的 `rollout-<timestamp>-<uuid>.jsonl`。([GitHub][2])

最关键的是：session JSONL 里有 `token_count` 事件，包含你要的全量字段：

* `total_token_usage`: input/cached/output/reasoning/total
* `last_token_usage`: 本次增量（非常适合当 UsageEvent）([GitHub][3])

## 2.2 辅助数据源：`codex exec --json`（可选，用于“任务型 exec”流水）

`codex exec --json` 会输出 JSONL 事件流，`turn.completed` 里带 token usage（input/cached/output）。([GitHub][4])
但它**缺 reasoning token**，而 reasoning 在 session 文件里是有的。([GitHub][3])

结论：**以 session JSONL 为主，exec --json 为辅（以后想做实时看板再接）。**

---

# 3. 总体架构

**核心思路：把 Codex session JSONL 解析成 UsageEvent，一切聚合逻辑复用现有体系。**

### 3.1 运行形态（非常关键）

因为 Codex session 文件在“你跑 Codex 的那台机器”上：

* 如果你的 Next.js/Prisma 也运行在同一台机器（本地或自托管服务器），可以在服务端直接读文件入库。
* 如果你的 Next.js 部署在 Vercel 这类 serverless 环境，服务端读不到你本机 `~/.codex`，需要一个 **本地 sidecar ingest agent**（node 脚本）把数据推到你的 API 或直连 DB。

建议你先走最稳的：**本地 agent 直连 DB 入库**（复用 Prisma client），实现成本最低。

---

# 4. 数据模型设计

你现有表已经足够承载“事件级用量”。建议做两层改动：

## 4.1 最小改动（推荐先上）

不改 Prisma schema，直接用现有字段表达 Codex：

* `apiPath`: 固定 `"codex-cli"`（或 `"codex"`）
* `proxyHost`: 用 `hostname`/`deviceId`（区分多台机器）
* `status`: `"completed"` / `"failed"`（可从 turn/错误事件映射，先默认 completed 也行）
* `authSource/authIndex/authFailed`: 对 Codex 可置空

缺点：多维度（session/repo/model切换）只能靠 `rawKey` 或未来扩展，不够爽。

## 4.2 生产可用改动（建议）

给 `UsageEvent` 增加几个可选字段，直接解锁你说的“多维度统计”：

* `sourceType String?`：`"cliproxy" | "codex"`
* `sessionId String?`：来自 session meta
* `cwd String?`：repo 维度（可脱敏）
* `originator String?`：CLI/VSCode 等
* `cliVersion String?`
* `effort String?`：如果你想按推理强度看消耗

并加索引：`@@index([sourceType, eventTime])`、`@@index([sessionId, eventTime])`、`@@index([cwd, eventTime])`

---

# 5. 采集与入库流程设计

## 5.1 文件扫描

* 根目录：`CODEX_HOME`（默认 `~/.codex`）([GitHub][1])
* 扫描：`$CODEX_HOME/sessions/**/rollout-*.jsonl`（社区已确认该命名形式）([GitHub][2])

策略：

* 每次 ingest：列出所有 rollout 文件，按 mtime 排序
* 只处理“上次 cursor 之后有变更”的文件，避免全量扫爆

## 5.2 JSONL 解析（流式）

逐行 `JSON.parse`，维护一个 session 上下文：

* `session_meta` 行里拿到：`sessionId / cwd / originator / cliVersion`（字段名以实际日志为准）
* 遇到 `turn_context` 更新当前 `model`/`effort`（如果存在）
* 遇到 `payload.type == "token_count"` 且 `payload.info` 非空：

  * 用 `payload.info.last_token_usage` 作为**本次增量 event**
  * 若某些版本缺 `last_token_usage`，再做 `total - prevTotal` 的差分兜底

`token_count` 结构示例（你要的字段都在里面）：([GitHub][3])

## 5.3 事件生成与去重

把一次 `token_count(info!=null)` 转成一条 `UsageEventInput`：

* `eventTime` ← `timestamp`
* `model` ← 当前上下文 model（或 `payload.info` 里没有就沿用 turn_context）
* `inputTokens/cachedTokens/outputTokens/reasoningTokens/totalTokens` ← last_token_usage
* `rawKey` 建议：`codex:${deviceId}:${sessionId}:${timestamp}:${seq}`（seq 是文件行号或递增计数）

入库仍然用你现在的套路：

* `createMany({ skipDuplicates: true })`
* 事务内更新 cursor

## 5.4 Cursor 方案

你现有 `UsageIngestCursor(lastEventAt)` 可以直接复用：

* `id = "codex:<deviceId>"`（避免和 cliproxy 冲突）
* `lastEventAt` = 本次成功写入的最大 eventTime

注意：只靠时间做 cursor 会遇到“同一毫秒多条”边界，rawKey 去重能兜住，但为了性能，建议 cursor 条件用 `<` 并且允许少量重复解析（靠 skipDuplicates 消化）。

---

# 6. 成本计算规则（和 cliproxy 共用 calcCostUsd，但有一个关键点）

`exec --json` 的 `turn.completed` 只给 input/cached/output；reasoning token 计数在 session 的 `token_count` 里有。([GitHub][4])

并且从 `token_count` 示例能看出来：`total_tokens` 已经包含 input+output，reasoning 是 output 的一个子统计，更适合“展示”，不要二次计费。([GitHub][3])

所以对 Codex 的 cost 建议：

* input 计费：`(inputTokens - cachedTokens)` 按 input 单价
* cached 计费：`cachedTokens` 按 cached 单价（如果你有）
* output 计费：`outputTokens` 按 output 单价
* reasoningTokens 仅展示维度

你的 `ModelPricing` 表正好适配。

---

# 7. 聚合与展示（复用现有体系 + 新增 session 视图）

## 7.1 复用 UsageDaily

Codex 的事件进 `UsageEvent` 后：

* 你的 `UsageAggregateJob(kind=daily)` 直接覆盖到 codex 数据（apiPath=codex-cli, proxyHost=deviceId）
* Daily 的 unique key 已经包含 apiPath/model/proxyHost，很稳

## 7.2 新增“Session 报表”页（对标 ccusage）

ccusage 的 `session` 报表会按 session 聚合，并在 JSON 输出里包含 per-model breakdown、cached token、lastActivity 等信息。([ccusage][5])
你可以做类似 UI（shadcn table + filters）：

* 维度：date range、model、repo(cwd)、originator、deviceId
* 指标：input/cached/output/reasoning/total/cost、model switch 次数、session 时长

---

# 8. 给 Codex CLI 的实现任务拆解（你可以直接逐条喂给它）

1. [x] **Schema 设计与迁移**

* 为 UsageEvent 增加 `sourceType/sessionId/cwd/originator/cliVersion/effort`（可选）
* Prisma migration + backfill（sourceType=cliproxy/codex）

2. [x] **实现 codex session 扫描器**

* env：`CODEX_HOME`（默认 `~/.codex`）([GitHub][1])
* glob 扫描 `sessions/**/rollout-*.jsonl`([GitHub][2])
* 记录 mtime，增量处理

3. [x] **实现 JSONL 解析与事件提取**

* 支持 `token_count` 的 `last_token_usage/total_token_usage` 结构([GitHub][3])
* 维护 turn_context 来绑定 model（没有就用 last known model）

4. [x] **实现 ingestUsageFromCodex(options)**

* 复用你现有 pricingMap/calcCostUsd/createMany/transaction/cursor 模式
* cursor id：`codex:<deviceId>`

5. **调度方式**

* 与现在的 usage-ingest-loop.ts的方式相同

6. **页面与 API**

* 新增 `GET /api/usage/sessions?source=codex...`（按 sessionId 聚合）
* 新增 shadcn 页面：Session 列表 + 点击进 session 明细（按事件展开）

7. **验收与对账**

由我来手动验收
* 用 Codex 自带 exec --json 生成样本日志（turn.completed 有 usage）([GitHub][4])
* 核对 session 文件 token_count（含 reasoning/cached）([GitHub][3])
* 与 ccusage session 视图输出的 totals 做人工抽样比对([ccusage][5])

---

# 9. 风险与兼容性清单

* 不同 Codex CLI 版本的 session JSONL 事件结构可能演进（ccusage 也明确它是 experimental）。([ccusage][5])
* serverless 环境无法读取本机 `~/.codex`，必须用本地 agent 或自托管。
* 可能出现重复 token_count 行（用 rawKey + skipDuplicates + cursor 容错解决）。

[1]: https://raw.githubusercontent.com/openai/codex/main/docs/config.md "raw.githubusercontent.com"
[2]: https://github.com/openai/codex/discussions/1572 "Add input/output/cached token info and timestamp info to saved chat history · openai codex · Discussion #1572 · GitHub"
[3]: https://github.com/openai/codex/issues/5276 "Add reasoning token usage on json output · Issue #5276 · openai/codex · GitHub"
[4]: https://raw.githubusercontent.com/openai/codex/main/docs/exec.md "raw.githubusercontent.com"
[5]: https://ccusage.com/guide/codex/session "Codex Session Report (Beta) | ccusage"
