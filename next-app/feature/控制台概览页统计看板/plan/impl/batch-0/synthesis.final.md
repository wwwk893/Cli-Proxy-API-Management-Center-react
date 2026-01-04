---
schema: synthesis_final_v2
task:
  name: "控制台概览页统计看板"
  dir: "feature/控制台概览页统计看板"
batch:
  id: "0"
meta:
  timestamp: "2026-01-04 11:09"
  author: "plan-docs"
sources:
  - plan.pro.md
  - review.xhigh.md
  - UI设计.md
---

# Final Synthesis — 控制台概览页统计看板 / Batch 0

> 本文件把 `plan.pro.md`（Pro 施工图）与 `review.xhigh.md`（xhigh 审阅闸门）收敛为“可落地、可执行、可回滚”的最终实现方案素材。
> 后续会回填/转写到任务根目录 `实现方案.md`，并等待主人确认。

## What We Will Build
- 目标概述：
  - 替换 `/`（`app/(app)/page.tsx`）占位内容为「过去 24h 概览驾驶舱」，信息层级 A 成本/用量 → B 稳定性 → C 配置健康度。
  - 新增聚合端点 `GET /api/dashboard/overview`，单请求返回概览页所需数据，支持过滤：`timeWindow`（utc-today/last-24h/last-7d/last-30d）+ `channel`（all/cliproxy/codex）。
  - 覆盖状态：loading/empty/error(discrete partial degrade)/disconnected/auth；每块提供至少一个有效跳转入口覆盖 `/usage /pipeline /logs /system /settings /pricing`。
- Non-goals：不重做用量/日志深度分析；不引入告警规则/通知系统；不在概览页内做配置编辑。
- Done 定义：对齐 `plan/impl/batch-0/review-package.md` 的 AC1/AC2/AC3 且通过手动验证 checklist。

## DATA_STRUCTURES
- 统一共享 DTO/类型文件（建议）：`lib/dashboard/overview/types.ts`（client/server 共用 types-only；不加 server-only）。
- 关键输入：
  - `DashboardTimeWindow = "utc-today" | "last-24h" | "last-7d" | "last-30d"`
  - `DashboardChannel = "all" | "cliproxy" | "codex"`
- 关键输出：`DashboardOverviewResponse`（核心字段：kpis/trend/topModels/pipeline/system/configHealth/actionCenter/partialErrors）。
- 审阅 P1 收敛（必须落地）：局部降级不得误导为 0
  - 决策：对可降级模块使用可空（推荐实现）：
    - `pipeline: DashboardPipelineHealth | null`
    - `configHealth: DashboardConfigHealth | null`
    - `logs: { latestTimestamp: string | null; lineCount: number | null } | null`
    - `topModels: DashboardTopModelRow[] | null`
    - `trend: { metricDefault: ...; buckets: DashboardTrendBucket[] | null }`
  - UI 规则：当模块为 `null` 或 `partialErrors` 含该 source 时，该卡片显示“—/不可用 + 跳转”，不得展示误导性 0。
- Action Center 规则表（最小可落地）
  - 规则按优先级（高→低），同 kind 去重，最多 5 条；若异常不足则用“导航型低优先级”补齐到 3 条。
  - `system.connected=false` → severity=critical → `/system`
  - `pipeline.failed>0` → high → `/pipeline`
  - `pricingCoverage.missingModelsCount>0` → medium → `/pricing`
  - `apiKeysCount===0` → high → `/settings/api-keys`
  - `providersSummary.totalUpstreamKeysCount===0`（或所有 provider=0）→ high → `/settings/providers`
  - `settingsSummary.usageStatisticsEnabled=false` → medium → `/settings`
  - 补齐：`/usage`、`/logs`（low）

## FILE_CHANGES
- 新增（核心）：
  - `app/api/dashboard/overview/route.ts`：聚合端点（requireSession + query validate + allSettled + timeout + partialErrors）。
  - `lib/dashboard/overview/*`：range/usage/top-models/pipeline/management/action-center/types。
- 新增（UI，按 repo 现状收敛目录；审阅 P1）：
  - `app/(app)/components/dashboard/DashboardOverviewPage.tsx`
  - `app/(app)/components/dashboard/hooks/useDashboardOverview.ts`
  - `app/(app)/components/dashboard/components/*`（FiltersBar/KpiGrid/TrendCard/TopModelsCard/ActionCenterCard/StabilityCards/ConfigHealthCard）
  - `app/(app)/components/dashboard/utils/*`（formatters/link builders）
- i18n（满足 <=600 行约束）：
  - 新增：`components/i18n/messages/en.ts`、`components/i18n/messages/zh.ts`
  - 修改：`components/i18n-context.tsx`（仅保留 Provider/Hook；messages 外置导入；新增 dashboard.* keys）
- 修改：
  - `app/(app)/page.tsx`：渲染 `DashboardOverviewPage` 替换占位。
- 可选：Feature Flag
  - 决策：仅作为可选项（默认不强制）；若做，优先只做前端渲染开关，避免双端开关引入额外分支。

## COMPONENT_BOUNDARIES
- 页面容器：`DashboardOverviewPage` 只负责布局与组合；不做数据聚合逻辑。
- 数据获取：`useDashboardOverview` 只负责 fetch/abort/竞态/状态机；不包含格式化与渲染细节。
- 展示组件：各 Card 只消费 `DashboardOverviewResponse`（或子结构），不得发起自己的请求。
- Server 聚合：`route.ts` 负责鉴权与并发/超时/降级；具体查询逻辑下沉 `lib/dashboard/overview/*`。

## IMPLEMENTATION_CHECKLIST
- [ ] 修订施工图实现约束（P1）：将计划中的 `app/(app)/_components/dashboard/**` 路径统一收敛为 `app/(app)/components/dashboard/**`（文档层）。涉及：`plan/impl/batch-0/plan.pro.md`（可选）或直接以本 synthesis 为准。
- [ ] 后端：新增 `app/api/dashboard/overview/route.ts`（鉴权 + validate + allSettled + timeout + partialErrors）。
- [ ] 后端：实现 `withTimeout` 为“可 abort 的工厂函数 + AbortSignal”（仅对 fetch 生效；Prisma 查询靠范围控制）。
- [ ] 后端：实现 `lib/dashboard/overview/*` 的聚合：usage/trend/topModels/pipeline/system/configHealth/logs。
- [ ] 后端：Action Center 规则表按本 synthesis 固化（含补齐策略）。
- [ ] 前端：实现 URL filter 作为单一事实来源（timeWindow/channel），切换后所有模块同步刷新（Abort+requestSeq 防竞态）。
- [ ] 前端：按 UI v4 模块结构落地布局；覆盖 loading/empty/error/disconnected/auth。
- [ ] i18n：拆分 messages，并新增 dashboard.* keys；保持 `useI18n().t(key)` API 不变。

## VERIFICATION_CHECKLIST
- [ ] AC1：打开 `/`，默认 `last-24h/all`；首屏 KPI<=6 + 主趋势 + TopModels + ActionCenter；结构对齐 `UI设计.md`。
- [ ] AC2：切换 4×timeWindow 与 3×channel，无旧数据闪回；Network 每次仅 1 个 `/api/dashboard/overview`。
- [ ] AC3：验证 loading/empty/error/disconnected/auth；逐块跳转覆盖 `/usage /pipeline /logs /system /settings /pricing`。
- [ ] 局部降级不误导：让 logs/providers/pipeline 任一源失败，失败模块显示“—/不可用”而不是 0，并出现 partialErrors 提示。
- [ ] 安全：overview 响应不包含任何 key 明文/可逆信息（只数量/布尔/覆盖率）。
- [ ] 性能：overview 内不 HTTP 自调 `/api/*`；只走 Prisma + management client。
- [ ] 代码规则：新增/修改文件 <=600 行（i18n 拆分后尤其关注）。

## RISKS_AND_ROLLBACK
- 风险：聚合查询慢 → 触发：UsageEvent 大量数据；发现：overview p95 上升；兜底：点数上限 + timeout + 局部降级；回滚：回退 `app/(app)/page.tsx` 为占位。
- 风险：management 断连 → 兜底：system=false + Action 引导 `/system`；其余（DB）模块可用。
- 风险：i18n 拆分导致全站文案 key 泄露 → 兜底：保持 Provider API 不变；如回归则 revert i18n 拆分相关提交。

## OWNER_CONFIRM_BLOCK
- 主人确认：
  - 状态：未确认
  - 记录：无
