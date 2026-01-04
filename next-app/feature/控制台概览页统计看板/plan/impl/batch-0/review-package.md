---
schema: review_package_v2
task:
  name: "控制台概览页统计看板"
  dir: "feature/控制台概览页统计看板"
batch:
  id: "0"
meta:
  timestamp: "2026-01-04 11:03"
  owner: "主人"
goal:
  summary: "把 / 控制台页从占位升级为过去 24h 概览驾驶舱：A 成本/用量态势 → B 稳定性摘要 → C 配置健康度；10 秒内回答‘花了多少、谁最贵、是否异常、该点哪里处理’。"
scope:
  in:
    - "替换 app/(app)/page.tsx 的占位内容为 Dashboard 概览页 UI（按 UI设计.md v4 推荐稿）"
    - "新增聚合端点 GET /api/dashboard/overview（推荐单端点返回概览所需数据，避免前端并发拼装）"
    - "支持过滤：时间窗（utc-today/last-24h/last-7d/last-30d）+ 渠道（all/cliproxy/codex）"
    - "概览模块：KPI<=6、主趋势（Cost 默认，可切 Tokens/Requests）、Top Models、稳定性卡、配置健康卡、Action Center"
    - "i18n：新增 dashboard.* 文案 key"
  out:
    - "不重做用量/日志页深度分析（概览只做摘要 + 跳转）"
    - "不引入告警规则编辑器/通知系统"
acceptance_criteria:
  - id: "AC1"
    text: "默认进入 / 显示过去 24h 概览（A/B/C），信息层级清晰且美观（首屏<=6 KPI + 1 主趋势 + Top + Action Center）。"
    verify: "手动打开 /，核对布局结构与 UI设计.md v4 一致；首屏模块齐全。"
  - id: "AC2"
    text: "切换时间窗/渠道后 KPI、趋势、Top Models、摘要与 Action Center 同步更新。"
    verify: "分别切换 4 个时间窗与 3 个渠道，观察所有模块一致刷新且无错乱。"
  - id: "AC3"
    text: "覆盖 loading/empty/error/disconnected/auth 状态，并且每个区块至少一个有效跳转入口。"
    verify: "模拟无数据/接口失败/断连/未登录，确认 UI 提示与跳转（/usage /pipeline /logs /system /settings /pricing）。"
constraints:
  tech_stack: "Next.js(App Router) + TypeScript + Tailwind + shadcn/ui"
  dependencies:
    forbidden: []
    allowed: []
  performance:
    - "概览页首屏尽量单请求完成（/api/dashboard/overview）"
    - "trend/topModels 控制点数与数量（例如 24–60 点、Top5）"
  code_rules:
    max_single_file_lines: 600
  security:
    - "所有数据必须经过现有会话鉴权（requireSession / guards），不得泄露敏感配置明文"
    - "允许局部降级：某数据源失败不阻塞整个首页"
current_state:
  pain_points:
    - "当前 / 为占位内容：app/(app)/page.tsx:1"
    - "关键信息分散在 Usage/Logs/Pipeline/Settings 等 Tab，需要来回切页：feature/控制台概览页统计看板/需求分析.md:6"
data:
  entities:
    - name: "DashboardOverviewRequest"
      fields:
        - "timeWindow: utc-today | last-24h | last-7d | last-30d"
        - "channel: all | cliproxy | codex"
    - name: "DashboardOverviewResponse（草案）"
      fields:
        - "kpis: costUsd, totalTokens, cachedTokens, requestCount, latestEventTime"
        - "trend: buckets[{ts, costUsd?, totalTokens?, requestCount?}]"
        - "topModels: [{model, costUsd, shareCost?, totalTokens?}]"
        - "pipeline: {pending, running?, failed, recentFailedJobs[]?}"
        - "system: {connected, serverVersion, serverBuildDate?}"
        - "configHealth: {apiKeysCount, providersSummary, pricingCoverage, settingsSummary}"
        - "actionCenter: [{kind, severity, title, description?, href, primaryActionLabel?}]"
apis:
  endpoints:
    - "GET /api/dashboard/overview（新增，聚合返回概览页所需数据）"
    - "GET /api/system/health（复用）"
    - "GET /api/usage（复用）"
    - "GET /api/usage/by-model（复用 TopModels 口径或作为来源）"
    - "GET /api/usage/aggregate/jobs（复用管线健康与失败列表）"
    - "GET /api/providers（复用配置健康）"
    - "GET /api/api-keys（复用配置健康）"
    - "GET /api/model-pricing（复用价格表覆盖）"
    - "GET /api/settings（复用关键开关摘要）"
    - "GET /api/logs（复用：v1 仅做跳转或最小摘要；是否新增 /api/logs/stats 见未决问题）"
open_questions:
  - "Q1：Requests/Events 口径 v1 取 UsageEvent count 是否足够？与现有 /usage 口径需如何对齐？"
  - "Q2：日志摘要 v1 是否需要新增轻量 /api/logs/stats？还是只在概览做跳转不做统计？"
  - "Q3：trend 分桶粒度：last-24h 默认按小时？last-7d/30d 按天？"
---

# 方案评审包（Review Package）— 控制台概览页统计看板 / Batch 0

## 1. 关键信息与入口
- 任务计划：feature/控制台概览页统计看板/任务计划.md:1
- 需求分析：feature/控制台概览页统计看板/需求分析.md:1
- UI 设计（已定稿 v4）：feature/控制台概览页统计看板/UI设计.md:1
- 当前占位首页：app/(app)/page.tsx:1

## 2. UI 目标形态（实现必须对齐）
- 采用 UI设计.md 的 v4 推荐稿：
  - 顶部过滤：时间窗 + 渠道 + 新鲜度 + 刷新
  - KPI<=6：Cost / Total Tokens / Requests(Events) / Cached% / Pipeline(pending/failed) / Health(connected+version)
  - 主趋势：单图 + Tabs（Cost 默认，可切 Tokens/Requests）
  - 右侧：Action Center（3–5 可行动，明确排序规则）+ Top Models（Top5）
  - 底部：稳定性卡（管线/日志/系统）+ 配置健康卡（providers/api keys/pricing/settings）

## 3. 实现重点（Pro 施工图需要输出）
- 聚合端点：/api/dashboard/overview 的查询策略（并行/超时/降级）、DTO 设计、错误处理
- 过滤状态：timeWindow/channel 如何贯穿 API 与 UI（URL state / store / hooks）
- Action Center 生成规则：来源、排序、去重、条数上限与跳转映射
- i18n keys：dashboard.* 的结构与落点（与现有 i18n 体系对齐）