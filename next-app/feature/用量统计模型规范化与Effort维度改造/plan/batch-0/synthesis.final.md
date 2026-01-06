---
schema: synthesis_final_v1
task:
  name: "用量统计模型规范化与Effort维度改造"
  dir: "feature/用量统计模型规范化与Effort维度改造"
batch:
  id: "0"
meta:
  timestamp: "2026-01-05"
  author: "codex"
---

# Final Synthesis — 用量统计模型规范化与Effort维度改造 / Batch 0

> 说明：主人已回填 `plan.pro.md`，本文件用于复审收敛；最终采用稿已回写到 `feature/用量统计模型规范化与Effort维度改造/实现方案.md`（待主人确认）。

## What We Will Build
- 目标概述：
  - 将模型字符串中的 `-high/-xhigh/-medium/-low` 或 `(high)` 等后缀拆出为独立维度 `effort`，默认按 `modelCanonical` 汇总（解决模型排行“分裂成多行”）。
  - 提供三种 View Mode：`基础模型（canonical）` / `基础模型+Effort（canonical_effort）` / `原始模型（raw，仅排错）`。
  - 保留追溯能力：保留 `modelRaw`（以及现有 `model` 字段）用于排错与定价匹配；成本口径不变。
- Non-goals：
  - 不改计费规则与 costUsd 口径（仍按现有聚合/定价表逻辑计算/展示）。
  - 不做历史价格回溯与按时间点重算。
  - 不新增数据源（仅规范化现有用量数据）。
- Done 定义（对齐 AC1-AC3）：
  - AC1：默认聚合按 `modelCanonical`；`gpt-5.2-codex*` 与 `gpt-5.2` 永不合并；`gpt-5.2-max` 不被误判为 effort。
  - AC2：effort 支持 `low/medium/high/xhigh + 未标注(null)` 的筛选与下钻；Raw 视图显示警告且禁用 effort 控件。
  - AC3：迁移前后在同时间窗/同筛选条件下，`SUM(requestCount/totalTokens/costUsd)` 一致（仅分组维度变化）。
- UI 采用：`feature/用量统计模型规范化与Effort维度改造/UI设计.md`（当前采用：Batch 0 v3 √）。

## DATA_STRUCTURES
- (1) 规范化核心（TS 类型 + 单一口径函数）
  - path：`lib/usage/model-normalize.ts`
  - symbols：`EFFORT_LEVELS`, `EffortLevel`, `EffortFilterValue`, `UsageModelGroupBy`, `normalizeModel()`, `parseEffortSuffix()`
- (2) DB 字段（B-完整）
  - `UsageEvent`：新增 `modelRaw`, `modelCanonical`；沿用并统一写入 `effort`
  - `UsageDaily`：新增 `modelCanonical`, `effort`
  - 约束：`UsageDaily` upsert 依赖 expression unique index（现有 `UsageDaily_composite_key_nnd` 需要扩展包含 `COALESCE(effort,'')`）
- (3) API 维度
  - query：`groupBy=canonical|canonical_effort|raw`；`efforts=low|medium|high|xhigh|unspecified`（raw 视图禁用/忽略）
  - response（核心字段）：`modelRaw`, `modelCanonical`, `effort`, `requestCount`, `totalTokens`, `costUsd`, `failureCount?`
  - 定价提示（可选）：`pricingConfigured`, `pricingConflict`, `pricingModelIds`（canonical 聚合后用于解释“定价缺失/冲突”）
- (4) 前端状态
  - path：`lib/usage/usage-filters-context.tsx` + `lib/usage/url-state.ts`
  - state：`modelGroupBy`, `selectedEfforts`
- (5) UsageModelTable 渲染模型（3 层/3 视图）
  - path：`components/charts/usage-model-table.tsx`（拆分后：`components/charts/usage-model-table/*`）
  - symbols：`buildTableModel()`, `ViewModeToggle`, `EffortFilter`, `RawWarningBanner`, `EffortSparkBar`, `CanonicalRow/EffortRow/SourceRow`

## ALGORITHMS
- Flow1：`normalizeModel`（严格尾部解析 + 显式 effort 兼容）
  - 规则：仅解析末尾 `-(low|medium|high|xhigh)` 或 `(low|medium|high|xhigh)`；统一小写；`-max` 不视为 effort
  - 显式 effort：存在则优先；与 suffix 不一致时记录 warning（不改变成本口径）
- Flow2：三类 ingest 写入一致字段
  - cliproxy：`modelRaw=model`，`modelCanonical/effort=normalizeModel(model)`
  - codex：若日志有显式 effort：`normalizeModel({ model, effort })`
  - opencode：update 分支也要同步写入新字段（保证幂等）
- Flow3：`UsageDaily` 聚合与 upsert 扩展
  - SELECT/GROUP BY 增加 `modelCanonical, effort`
  - ON CONFLICT 目标与 unique expression index 同步增加 `COALESCE(effort,'')`
- Flow4：`/api/usage/by-model` 三视图
  - canonical：按 `COALESCE(modelCanonical, model)` 聚合
  - canonical_effort：按 `COALESCE(modelCanonical, model), COALESCE(effort,NULL)` 聚合
  - raw：按 `COALESCE(modelRaw, model)` 聚合；此视图忽略 effort 过滤
- Flow5：UI 交互（对齐 v3）
  - 切 raw：清空展开状态 + 显示 warning banner + 禁用 effort 控件（但保留其选择以便回切恢复）

## FILE_CHANGES
> 备注：`plan.pro.md` 中路径带 `next-app/` 前缀；在本仓实现时以当前仓根（next-app 子项目）为准，路径可省略该前缀。

- `prisma/schema.prisma` — 新增字段与索引：`UsageEvent.modelRaw/modelCanonical`、`UsageDaily.modelCanonical/effort`
- `prisma/migrations/<ts>_usage_model_canonical_effort/migration.sql` — 新增列 + 新索引；更新/新增 `UsageDaily` expression unique index（包含 `COALESCE(effort,'')`）
- `lib/usage/model-normalize.ts` — 新增：规范化口径（单一事实来源）
- `lib/usage-ingest.ts` / `lib/codex-ingest.ts` / `lib/opencode-ingest.ts` — 写入新字段（不改 cost 计算口径）
- `lib/usage-aggregate.ts` — `runUsageDailyAggregation` 按 effort 切分并 upsert
- `scripts/backfill-usage-model-normalization.ts` — 新增：回填 UsageEvent + 按天重建 UsageDaily（可重入）
- `app/api/usage/by-model/route.ts` — 支持 groupBy/efforts；返回维度字段；（可选）定价冲突提示字段
- `lib/usage/usage-filters-context.tsx` + `lib/usage/url-state.ts` — 新增筛选状态与 URL 同步
- `app/(app)/usage/components/usage-content.tsx` + `components/usage/filter-popover.tsx` — view/effort 控件与模型搜索别名命中
- `components/charts/usage-model-table.tsx`（拆分）+ `components/charts/usage-model-table/*`（新增）— 三视图渲染 + effort 分布条
- `app/(app)/components/dashboard/components/TopModelsCard.tsx` — 默认口径对齐 canonical

## IMPLEMENTATION_CHECKLIST
- [ ] 1) 落地 `normalizeModel`（files：`lib/usage/model-normalize.ts`；output：边界用例覆盖）
- [ ] 2) Prisma schema + migration（files：`prisma/schema.prisma`、`prisma/migrations/**`；output：新增列与索引可用）
- [ ] 3) 三类 ingest 写入新字段（files：`lib/usage-ingest.ts`、`lib/codex-ingest.ts`、`lib/opencode-ingest.ts`）
- [ ] 4) `UsageDaily` 聚合按 effort 切分（files：`lib/usage-aggregate.ts`）
- [ ] 5) Backfill：回填 UsageEvent + 重建 UsageDaily（files：`scripts/backfill-usage-model-normalization.ts`）
- [ ] 6) by-model API：三视图 + effort 筛选（files：`app/api/usage/by-model/route.ts` + `lib/api/*`）
- [ ] 7) UI：View Mode / Effort filter / 分布条 / Raw 警告（files：`components/charts/usage-model-table*` 等）
- [ ] 8) Dashboard Top Models 口径对齐（files：`app/(app)/components/dashboard/components/TopModelsCard.tsx` + 数据层）
- [ ] 9) 对账验证（AC3）并记录结果（output：对账 SQL/截图/记录）

## VERIFICATION_CHECKLIST
- [ ] V1 规范化边界用例（`-max` 不误判；`(high)` 解析；codex-max-xhigh 解析）
- [ ] V2 DB schema/索引检查：新列存在；`UsageDaily` upsert 不报 ON CONFLICT 错误
- [ ] V3 Backfill 完整性：`modelRaw/modelCanonical` 缺失率约为 0；effort 值域正确
- [ ] V4 重建 UsageDaily 对账：按天对齐 `UsageEvent` 三项 SUM 一致
- [ ] V5 API 对账：`groupBy=canonical|canonical_effort|raw` 的 SUM 一致
- [ ] V6 UI 验收：按 `UI设计.md(v3)` 的验收点逐条走通（含 Raw warning/禁用）
- [ ] V7 Dashboard 对齐：Top5 与 `/usage` 默认视图一致（允许格式化差异）

## RISKS_AND_ROLLBACK
- R1 误解析导致合并错误：提供 Raw 视图回退；必要时加入例外表；可重跑 backfill
- R2 UsageDaily 重建期间短暂不一致：低峰执行；必要时 UI 显示“回填中”提示；可暂停/回滚到旧口径
- R3 ON CONFLICT 目标与 unique index 不匹配：migration 强校验；出现错误立即回滚 SQL/补 migration
- R4 canonical 聚合导致定价提示增多：API 返回冲突来源用于解释；必要时先隐藏冲突提示（不影响总成本）

## Diff From Plans
- 1) 路径规范：`plan.pro.md` 使用 `next-app/` 前缀描述；本仓实现以当前仓根为准（提交到 monorepo 根时 git diff 仍会带 `next-app/` 前缀）。
- 2) `UsageDaily` 已存在 expression unique index：`UsageDaily_composite_key_nnd`；本任务需要在 migration 中扩展包含 `COALESCE(effort,'')` 并同步更新 `runUsageDailyAggregation` 的 ON CONFLICT 目标。
- 3) 测试建议：若新增 `normalizeModel` 用例，优先复用仓库现有测试框架（vitest）；不额外引入新依赖。
- 4) 流程护栏：在 Phase 关键节点使用 `guardrail_checkpoint.py` 自动把校验结果追加写回 `plan/INDEX.md`，降低漏跑风险。
