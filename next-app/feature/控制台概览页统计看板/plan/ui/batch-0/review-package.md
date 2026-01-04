---
schema: ui_review_package_v1
task:
  name: "控制台概览页统计看板"
  dir: "feature/控制台概览页统计看板"
batch:
  id: "0"
  dir: "feature/控制台概览页统计看板/plan/ui/batch-0"
meta:
  timestamp: "2026-01-04"
  owner: "主人"
---

# UI评审包（Dashboard 概览页）

## 目标 / 价值
- 把 `/` 的“控制台”从占位页升级为“过去 24h 统计概览驾驶舱”。
- 信息优先级：A 成本/用量态势 → B 稳定性/告警 → C 配置健康度。
- 10 秒内回答：花了多少钱、谁最贵、是否异常、我该点哪里处理。

## 范围 / 非目标
- 范围：概览信息展示 + 过滤（时间窗/渠道）+ Action Center（可行动）。
- 非目标：不做深度分析（由用量统计/日志页承担）；不做告警规则编辑器。

## 核心场景（3-6）
1) 管理员进入首页：先看连接状态/管线失败/待处理事项 → 跳转处理。
2) 成本负责人：先看过去 24h 成本、Top 模型贡献、趋势 → 跳转用量统计深挖。
3) 新环境自检：配置健康度提示缺失（providers/api keys/pricing/settings）。
4) 异常排查：错误升高或管线失败 → 跳转日志/系统诊断。

## 页面结构（信息架构 IA）
- 顶部过滤条：时间窗（默认 last-24h）+ 渠道（全部/cliproxy/codex）+ 数据新鲜度 + 刷新。
- 首屏 KPI（<=6 张卡）：Cost、Total Tokens、Requests/Events、Cached%、Active Sessions（可选）、Health（connected+version）。
- 主图区：趋势图（默认 Cost，可切 Tokens/Requests）
- 侧区：Top Models（按 Cost）+ “查看用量统计”跳转
- 摘要区：稳定性卡（管线/日志/系统）+ 配置健康卡（providers/api keys/pricing/settings）
- Action Center：3–5 条“可行动”事项（必须带跳转/动作）。

## 核心数据对象与字段（只列关键）
- 概览 KPI：costUsd、totalTokens、cachedTokens、requestCount、latestEventTime。
- Trend：bucket + (costUsd/totalTokens/requestCount)（last-24h 推荐按小时分桶）。
- Top Models：model + costUsd + shareCost + tokens。
- 管线健康：pendingRunning、failed、recentFailedJobs(id/range/lastError/updatedAt)。
- 系统健康：connected、serverVersion、serverBuildDate。
- 配置健康：apiKeysCount、providersSummary、pricingCoverage、settingsSummary。

## 状态矩阵（必须覆盖）
- loading：Skeleton（KPI/图表/列表骨架）。
- empty：过去 24h 无数据 → KPI 显示 0 + 提示“暂无数据”，保留过滤条与跳转。
- error（部分失败）：允许降级（例如配置健康失败不影响趋势图）。
- disconnected / auth：未登录或连接不可用 → 显示系统卡错误态 + Action Center 首条提示跳转 `/system`。

## 交互规则
- 时间窗切换：utc-today / last-24h(默认) / last-7d / last-30d。
- 渠道切换：全部/cliproxy/codex；渠道口径与现有 usage API 保持一致。
- KPI 卡点击：Cost/Tokens/Top → `/usage`；Pipeline → `/pipeline`；Health → `/system`。
- Action Center：每条要么有 `href`，要么有明确按钮（例如“查看/重试”）。

## 视觉与组件约束
- 技术栈：Next.js + Tailwind + shadcn/ui（Card/Tabs/Badge/Button 等），现有整体风格是“半透明卡片 + 轻边框 + muted 背景”。
- 密度：信息多但不拥挤；强制留白与分区，避免表格占满首页。
- 强调色：只用于状态与关键数值（connected/failed/增长），避免全页彩虹。
- i18n：所有新增文案走 `t(key)`，建议 key 前缀 `dashboard.*`。

## 验收标准（可验证）
- 默认进入 `/` 显示过去 24h 的 A/B/C 概览信息，布局美观且信息层级清晰。
- 切换时间窗/渠道后，KPI/趋势/Top 列表同步更新。
- 明确的 loading/empty/error/disconnected 状态。
- 至少提供到 `/usage`、`/pipeline`、`/logs`、`/system`、`/settings`、`/pricing` 的有效跳转。

## Frontend Design Rubric（<=12 条，可执行）
1) KPI 卡强制一致高度与网格对齐（避免视觉跳动）。
2) 数字格式统一：货币 `$x.xxx`、tokens 使用 compact、百分比显示 0–100%（保留 0–1 位小数）。
3) 首屏信息层级：标题/过滤条/主 KPI / 主图优先，次要信息（配置细节）放下方。
4) 使用 Skeleton 而不是 “Loading...” 文本占位。
5) 空态必须给出“下一步动作”（例如去用量统计/检查连接）。
6) 每个卡片/列表都要有 clickable affordance（hover/underline/arrow）。
7) 颜色只表达语义（success/warn/error），不用于装饰。
8) 图表不超过 1 个主视觉；其余用简洁条形/列表表达。
9) 移动端优先保证可读性：2 列 KPI + 图表折叠为 1 列。
10) 文案短句化（<=16 字），避免段落堆叠。
11) 保留“数据新鲜度”与“最后刷新”两种时间概念（避免误导）。
12) 组件命名与拆分遵循现有结构，避免单文件>600 行。
