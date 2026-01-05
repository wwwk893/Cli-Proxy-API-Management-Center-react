---
schema: context_snapshot_v1
task:
  dir: "feature/用量统计-增加opencode渠道"
  name: "用量统计：增加渠道 opencode"
meta:
  created_at: "2026-01-05 10:17"
  author: "codex"
mode: "A"
---

# 驾驶舱（INDEX）— 用量统计：增加渠道 opencode

## 上下文快照（Context Snapshot）

### Intent
- 目标：在用量统计体系中新增渠道 `opencode`，实现本地用量采集→入库→后端过滤→前端筛选展示的全链路支持。
- 当前意图：把已确认事实压缩成锚点，方便主人接下来开启新任务时快速恢复上下文。

### Constraints（已确认硬约束）
- 沟通语言：全中文；我必须称呼你为“主人”。
- 变更边界：最小 diff；只改与 `opencode` 渠道接入强相关文件。
- 禁止高风险命令：不做 `git reset --hard` / `git clean -fdx` / `rm -rf` 等不可逆操作（除非主人明确授权）。
- 测试/构建：不做 CI/CD 自动化；验证命令由主人手动执行（我只提供命令与步骤）。
- OpenCode cost 字段可能为 0：不能把 cost=0 当作“没有消耗”的唯一真相，需要兜底估算。

### Decisions（已确认决策）
- 数据源：OpenCode 用量来自本机 message JSON（默认目录 `~/.local/share/opencode/storage/message/{sessionId}/*.json`），而不是 Codex 的 rollout jsonl。
- 表结构：不新增表，复用现有 `UsageEvent`。
- 事件粒度：每条 `role=assistant` message → 生成 1 条 `UsageEvent`。
- 幂等去重：`rawKey = opencode:<sessionID>:<messageID>`。
- 字段映射（核心）：
  - `sourceType="opencode"`，`apiPath="opencode-cli"`
  - `eventTime`：优先 `time.completed`，否则 `time.created`（兼容 epoch ms / epoch seconds / ISO）
  - tokens：`input/output/reasoning/cache.read+cache.write` → `inputTokens/outputTokens/reasoningTokens/cachedTokens`，并计算 `totalTokens`
  - cost：优先用 message `cost > 0`；否则按定价表估算（与现有统计口径一致）
- Cursor 策略：用 `UsageIngestCursor.id = opencode:<deviceId>`（默认 hostname，可用 `OPENCODE_DEVICE_ID` 覆盖），存“最大文件 mtime”；若因 maxEvents 截断，cursor 写入 `mtime-1ms` 防漏扫。

### Current State（当前进度）
- 代码已完成：新增 `lib/opencode-ingest.ts`、`scripts/opencode-ingest.ts`、`scripts/opencode-ingest-loop.ts`，并接入 API/UI/i18n/聚合过滤。
- 验证进度：
  - 主人已在本机确认 `npm run test` 通过。
  - `opencode` one-shot ingest 已验证可落库且幂等（重复运行无重复插入）。
- 默认采集周期：5 分钟（loop）；可用 `OPENCODE_INGEST_LOOP_INTERVAL_SEC` 覆盖。

### Next Steps（下一步 3-7 条，可执行）
1)（可选）主人确认是否将任务状态改为「待验证/已完成」，并按流程冻结基线（避免后续改乱计划文档）。
2)（可选）主人跑 `npm run opencode:ingest:loop` 观察 2–3 个周期，确认长期运行稳定（无重入/无错误）。
3)（可选）主人跑 `npm run usage:aggregate`，确认 day 粒度聚合在 `opencode` 渠道下口径正确。
4) 进入新任务前：主人直接描述新目标/范围/验收点；我会按 `lite-plan-exec` 重新 Brainstorm→Plan→Exec（与本任务隔离）。

### Open Questions（仍需主人确认）
- 是否需要把本任务「基线冻结」？（目前 `feature/用量统计-增加opencode渠道/任务计划.md` 仍是进行中）
- `opencode` 的统计口径是否只算 assistant messages？是否需要同时统计 user messages（通常不需要，但需主人确认）？
- cost 口径是否以“OpenCode 文件中的 cost”为主，还是统一按项目定价表估算为主（目前策略：cost>0 用原值，否则估算）？
- 是否需要适配 OpenCode message 存储目录的更多变体（例如按 project 分目录的情况）？

### Evidence Pointers（证据指针）
- 任务计划：`feature/用量统计-增加opencode渠道/任务计划.md`
- OpenCode ingest：`lib/opencode-ingest.ts`
- OpenCode ingest CLI：`scripts/opencode-ingest.ts`
- OpenCode ingest loop：`scripts/opencode-ingest-loop.ts`
- 渠道过滤：`lib/usage/aggregation-filters.ts`
- API schema：`lib/api/schemas.ts`
- npm scripts：`package.json`

