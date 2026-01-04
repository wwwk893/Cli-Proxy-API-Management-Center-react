# UI 设计（控制台概览页统计看板）

- 时间戳：2026-01-04
- 默认时间窗：过去 24h
- 信息优先级：A（成本/用量态势）→ B（稳定性/告警）→ C（配置健康度）
- 当前采用：Batch 0 `v4（综合推荐稿）` √

## Batch 0（zen-ui-polish）产物索引
- `feature/控制台概览页统计看板/plan/ui/batch-0/review-package.md`
- `feature/控制台概览页统计看板/plan/ui/batch-0/relevant_files.txt`
- `feature/控制台概览页统计看板/plan/ui/batch-0/v2.gemini.md`
- `feature/控制台概览页统计看板/plan/ui/batch-0/v3.claude.md`
- `feature/控制台概览页统计看板/plan/ui/batch-0/v4.final.md`
- `feature/控制台概览页统计看板/plan/ui/batch-0/disputes.md`

## Batch 0 relevant_files（绝对路径）
- `/Users/wenlong/wt-next-migration/next-app/app/(app)/page.tsx`
- `/Users/wenlong/wt-next-migration/next-app/components/layout/sidebar.tsx`
- `/Users/wenlong/wt-next-migration/next-app/app/(app)/usage/usage-client.tsx`
- `/Users/wenlong/wt-next-migration/next-app/app/(app)/usage/components/usage-content.tsx`
- `/Users/wenlong/wt-next-migration/next-app/app/(app)/pipeline/aggregation/jobs-view.tsx`
- `/Users/wenlong/wt-next-migration/next-app/app/(app)/system/page.tsx`
- `/Users/wenlong/wt-next-migration/next-app/app/(app)/logs/logs-client.tsx`
- `/Users/wenlong/wt-next-migration/next-app/components/common/page-header.tsx`
- `/Users/wenlong/wt-next-migration/next-app/components/ui/card.tsx`
- `/Users/wenlong/wt-next-migration/next-app/components/i18n-context.tsx`

---

## v2（专家A：Gemini）— 草图稿
> 同步文件：`feature/控制台概览页统计看板/plan/ui/batch-0/v2.gemini.md`

# v2（专家A：Gemini）— 控制台概览页统计看板 / Batch 0

## A1：经典网格（Efficiency Cockpit）
设计主旨：标准化仪表盘，强调信息密度的均衡分布，适合快速扫描全局态势。

```text
[ 📅 Last 24h v ] [ 🏷️ All Channels v ]           (Updated 1m ago) [↻]
+-------+ +-------+ +-------+ +-------+
| 💰Cost | | 🪙Tokn | | ⚡Reqs | | 🎯Cach |
| $12.4 | | 1.2M  | | 4.5k  | | 35%   |
+-------+ +-------+ +-------+ +-------+
+-----------------------+ +-----------+
| 📈 Trend (Cost/Req)   | | 🚨Actions |
|      /--\             | | [!] Pipe  |
|  ___/    \            | | [i] Price |
| /         \           | | [i] Upd   |
+-----------------------+ +-----------+
+-----------------------+ +-----------+
| 🏆 Top Models         | | 🏥 Health |
| 1. gpt-4o    $8.2     | | ● Connect |
| 2. claude-3  $3.1     | | ✓ API Keys|
+-----------------------+ +-----------+
```

### 1) 信息架构（IA）
- Top Bar：时间窗/渠道 + 数据新鲜度 + 刷新。
- Zone A（KPIs）：4 列等宽核心指标（Cost/Tokens/Requests/Cache）。
- Zone B（Insight）：2:1 比例。左侧主趋势图（大），右侧 Action Center（强交互）。
- Zone C（Details）：2:1 比例。左侧 Top Models，右侧 Health/Config 摘要。

### 2) 视觉层级与密度
- 高密度：使用网格对齐 + 卡片一致高度，最大化首屏信息量。
- 半透明质感：卡片 `bg-card/50` + 轻边框，呼应现有风格。
- 强调色：只用于语义（增长/失败/告警），避免装饰性用色。

### 3) 关键组件清单（按模块）
- `DashboardFiltersBar`：时间窗/渠道/新鲜度/刷新。
- `KpiGrid`：KPI 卡（统一 value/secondary/trend slot）。
- `PrimaryTrendCard`：趋势图 + Tabs（Cost/Tokens/Requests）。
- `ActionCenterCard`：3–5 条 action（icon + title + chevron）。
- `TopModelsCard`：Top5 列表（name + cost + share）。
- `HealthConfigCard`：connected/version + keys/providers/pricing/settings 摘要。

### 4) 交互与状态
- Loading：全局 Skeleton（保持布局不跳动）。
- Empty：KPI 显示 0/—；趋势与 Top/Action 给空态提示 + “去用量统计/去配置”引导。
- Error（局部降级）：单卡 `--` + tooltip + retry，不阻塞其他区域。
- Disconnected/Auth：Health 卡进入错误态；Action Center 置顶提示“需要登录/系统断连”，并给 `/system` 跳转。

### 5) 移动端折叠规则
- KPI 改为 2×2（或 2×3）栅格；趋势、Top、Action 上下堆叠。
- Action Center 在移动端顺序上提（更符合救火/处理场景）。

---

## A2：非对称侧栏（Focus & Action）
设计主旨：左侧沉浸式看数（Read），右侧聚焦行动与状态（Act），明确区分“发生了什么”与“该做什么”。

### 1) 布局结构（IA）
采用 3:1 非对称布局。
- Left（主内容 75%）：Hero Cost（超大数值 + 迷你趋势）+ 趋势/Top 组合大卡。
- Right（控制面板 25%）：Action Center 置顶 + Health/Config 紧凑列表。

### 2) 视觉策略
- Heroism：强化 Cost 作为视觉锚点，其余指标降权。
- Grouping：右侧栏用略深的 `bg-muted/30` 区分功能区。
- Action Oriented：右侧 item 更强调按钮态（Fix/View），左侧强调阅读。

### 3) 组件差异
- `HeroCostCard`：无 header，纯数字排版（更像“计价器”）。
- `UsageCombinedCard`：趋势/Top 通过 Tabs 切换，减少首屏占用。
- `RightRail`：Action + Status 全部收纳，便于“扫一眼+动手”。

### 4) 移动端折叠规则
- 顺序：Action（右）→ Hero Cost（左）→ Usage（左）→ Status（右）。
- 逻辑：移动端场景“处理异常”优先级高于“看报表”。

---

## 推荐选择与理由
推荐：A1（经典网格）。理由：扩展性强、符合管理后台用户心智模型；A2 的 Hero 过强可能掩盖稳定性/配置类异常。

---

## v3（专家B：Claude）— 草图稿
> 同步文件：`feature/控制台概览页统计看板/plan/ui/batch-0/v3.claude.md`

# v3（专家B）— 交互逻辑与可用性视角（精简版）

## B1：任务导向型（Task-First）
核心：Action Center 置于视觉焦点（右上），用户先看“要处理什么”，KPI/趋势作为决策背景。

```
┌───────────────────────────────────────────────────────────────────────┐
│ 控制台概览                          [过去24h▾] [全部渠道▾] [↻刷新]   │
│ ● 已连接 · 数据延迟 2m                                                │
├───────────────────────────────────────────┬───────────────────────────┤
│ ┌─ KPI Strip ───────────────────────────┐ │ ⚠ 待处理 (3)             │
│ │ $12.34  43.2M   18.2k  27%   ●OK     │ │ ─────────────────────────│
│ │ Cost    Tokens  Reqs   Cache System  │ │ 🔴 聚合失败 job#a2f [重试]│
│ │ ↑12%    ↓3%     ↑8%    ─      ─      │ │ 🟡 价格缺失 6模型 [补齐] │
│ └───────────────────────────────────────┘ │ 🟡 错误升高 +20% [查看]  │
├───────────────────────────────────────────┤ ─────────────────────────│
│ 趋势 [Cost|Tokens|Reqs]    Top 5 模型    │ ✓ 无更多待处理项         │
│ ▁▂▃▄▅▆▇█▇▆▅▄              gpt-4o  $5.12 │ [展开全部]               │
│ ──────────────             mini   $2.01 ├───────────────────────────┤
│ [查看完整用量统计→]        claude $1.77 │ 配置健康                 │
├───────────────────────────────────────────┤ ✓Keys 4 ✓Providers 2    │
│ 稳定性摘要                                │ ⚠价格覆盖 78%           │
│ 管线 pending:3 failed:1 │ 日志 err:12    │ [设置] [提供商] [价格表] │
└───────────────────────────────────────────┴───────────────────────────┘
```

### 交互状态机
- `idle` → mount → `loading`（全局 skeleton）
- `loading` → 成功 → `ready`；超时 → `partial`（已返回渲染，未返回 skeleton+retry）
- `ready` → 刷新/过滤 → `refreshing`（保留旧数据+spinner）→ 成功 `ready` / 失败 `stale`
- 任意状态 → 401 → `auth-required`；网络断 → `disconnected`（横幅+重连倒计时）

### 异常/降级策略
- 单 KPI 失败：显示 `--` + tooltip，整体刷新可恢复
- 趋势图失败：骨架屏 + Retry 按钮
- Action 失败：显示“暂无法获取” + 管线/日志跳转链接
- 全部失败：ErrorBoundary 保留过滤条 + 刷新按钮

### 可用性细节
- Tab 顺序：过滤条 → KPI → Action 列表 → 趋势/Top → 底部链接
- Action 条目 `role="listitem"` + `aria-label` 描述操作
- 状态色满足 WCAG AA；“重试”按钮防连点（inline spinner）

### 移动端策略
- Action Center 上移至 KPI 上方（最优先）
- KPI 改 2×3 网格；趋势全宽单列；Top 改水平滚动 pill
- 过滤条折叠入 Sheet；稳定性/配置合并为手风琴

### Action 排序规则
1. failed jobs（severity=3）：按 updatedAt 倒序，最多 2 条
2. error spike（severity=2）：1h 错误率环比 >20%
3. price missing（severity=1.5）：缺价格 >3 模型，汇总 1 条
4. config warning（severity=1）：关键开关关闭
5. 上限 5 条，超出折叠

---

## B2：态势感知型（Situation-First）
核心：趋势图+KPI 占主体，用户先“看懂全局”再决定行动，Action 作为底部通知条。

```
┌───────────────────────────────────────────────────────────────────────┐
│ 控制台 · 过去24h                      [今日|24h|7d|30d] [渠道▾] [↻]  │
├───────────────────────────────────────────────────────────────────────┤
│  $12.34      43.2M       18.2k      27%        96        ● Connected │
│  总成本↑12%  Tokens↓3%   请求↑8%    缓存占比   会话       v1.2.3     │
├─────────────────────────────────────────┬─────────────────────────────┤
│  ▁ ▂ ▃ ▅ ▇ █ █ ▇ ▅ ▄ ▃ ▂ ▂ ▃ ▄ ▅ ▆   │ Top 模型（按成本）         │
│  ─────────────────────────────────────  │  ● gpt-4o      $5.12  41%  │
│  Cost [切换: Tokens | Requests]         │  ● mini        $2.01  16%  │
│  hover 显示时间点+top3贡献              │  ● claude      $1.77  14%  │
│                                         │  [查看用量详情 →]          │
├───────────────┬─────────────────────────┴─────────────────────────────┤
│ 管线&日志     │ 配置健康                                              │
│ ✓98% ⚠3待 🔴1 │ Keys✓4 Providers✓2 价格覆盖⚠78% 开关✓                │
│ [管线] [日志] │ [设置] [提供商] [价格表]                              │
├───────────────┴───────────────────────────────────────────────────────┤
│ 💡 3项待处理：聚合失败[重试] · 6模型缺价格[补齐] · 错误+20%[→]       │
└───────────────────────────────────────────────────────────────────────┘
```

### 交互状态机
- `initial` → `skeleton`（全部 Shimmer）→ 数据到达 → `hydrated`（逐块渲染：KPI→趋势→其余）
- `hydrated` → 过滤变更 → `updating`（趋势渐隐+新线，KPI 数字动画）→ `hydrated`
- `hydrated` → 网络失败 → `stale-banner`（黄条“数据更新于 5m 前”）
- `hydrated` → 会话过期 → `session-expired-modal`（不可关闭，必须重登）

### 异常/降级策略
- 单 KPI 失败：显示 `—`，点击仍可跳转目标页
- 趋势失败：区域显示 `⚠暂无法加载` + 重试链接
- Action 失败：底部栏显示“无法获取待处理项”，不阻塞主体
- 全部失败：友好错误页 + 重试

### 可用性细节
- KPI 大字号（32px）+ 趋势图占 50%+ 高度，强化“先看数据”
- 趋势图支持 `←/→` 切换时间点焦点，`Enter` 展开 tooltip
- `prefers-reduced-motion` 时关闭数字滚动和折线动画

### 移动端策略
- KPI 改 2×3 + 横向滑动 indicator
- 趋势高度减半；Top 模型折叠为 Accordion
- 稳定性/配置合并为 icon+数字，点击展开 BottomSheet
- Action 条吸底固定，左右滑动切换（Carousel）

### Action 排序规则
1. 系统离线（urgency=∞）：置顶红色，遮挡其他
2. failed jobs：最多 1 条摘要+数量
3. error spike：环比 >30% 才触发
4. price gap：缺失成本占比 >10% 才显示
5. 上限 3 条（强调不打扰），更多收入侧边抽屉

---

## B1 vs B2 速查
- 视觉焦点：B1 Action 右上醒目 / B2 趋势+KPI 占主体
- 适用角色：B1 运维每日巡检 / B2 成本负责人/管理层
- Action 位置：B1 顶部右侧卡片(5条) / B2 底部通知条(3条)
- 移动端 Action：B1 顶部优先 / B2 吸底 Carousel
- 降级容忍：B1 高（局部失败不阻塞 Action）/ B2 中（趋势失败影响体验）
- 综合建议：可采用 B2 主体布局 + B1 的 Action 排序逻辑

---

## v4（综合推荐稿）— 推荐实现参考 √
> 同步文件：`feature/控制台概览页统计看板/plan/ui/batch-0/v4.final.md`

```text
+-----------------------------------------------------------------------+
|  Dashboard / Overview   [Last 24h v] [Ch: All v]  (Updated 1m ago) (R)|
+-----------------------------------------------------------------------+
|  [ Cost $124 ] [ Tokens 850k ] [ Reqs 1.2k ] [ Cache 42% ]            |
|  [ Pipe: 2 Pend / 0 Fail ] [ Health: Connected (v1.0.2) ]             |
+-----------------------------------------------------------------------+
|  +-------------------------------------+  +-------------------------+ |
|  | Main Trend (Tabs: Cost/Tok/Req)     |  | Action Center (3/5)     | |
|  | [Cost]  Tokens  Requests            |  | [!] 1 Pipeline Failed > | |
|  |                                     |  | [!] API Key Expiring  > | |
|  |           ||      ||      ||        |  | [i] Pricing Missing   > | |
|  |           ||      ||      ||        |  +-------------------------+ |
|  | [X-Axis: Time]                      |  | Top Models (Top 5)      | |
|  +-------------------------------------+  | 1. gpt-4 ...... $45     | |
|  +-------------------------------------+  | 2. claude-3 ... $30     | |
|  | Stability Summary                   |  | 3. text-emb ... $10     | |
|  | [Logs] [System] [Pipeline]          |  | 4. gemini-p ... $05     | |
|  | Config Health                       |  | 5. dall-e-3 ... $02     | |
|  | [Providers] [API Keys] [Pricing]    |  +-------------------------+ |
|  +-------------------------------------+                              |
+-----------------------------------------------------------------------+
```

### 1) 核心布局策略
采用“网格骨架（v2 A1）+ 右侧行动导向（v3 B1）”的融合结构：
- 顶部：过滤条 + KPI（<=6）
- 中间：左侧主趋势；右侧 Action Center + Top Models
- 底部：稳定性摘要 + 配置健康度摘要（更像运维兜底检查清单）

### 2) 关键组件分区

#### A. 顶部控制与 KPI
- 过滤器：时间窗（utc-today/last-24h/last-7d/last-30d）+ 渠道（all/cliproxy/codex）。
- 数据新鲜度：区分“最后事件时间 / 最后刷新时间”（避免误导）。
- KPI（建议 6 个槽位）：
  1) Cost（主指标）
  2) Total Tokens
  3) Requests/Events
  4) Cached %
  5) Pipeline（`pending/failed` 简版）
  6) Health（connected + version）

#### B. 主趋势图（左侧）
- 单图表 + Tabs：默认 Cost，可切 Tokens/Requests。
- Tooltip：时间桶 + 值（可选再加 Top1 模型贡献，P1）。
- 点击趋势/维度跳转：`/usage`（带时间窗/渠道参数）。

#### C. 右侧栏（行动 + 头部贡献）
- Action Center（置顶，桌面端 3 条，最多 5 条）：
  - 每条必须可行动：要么整行可点击跳转，要么带明确按钮（例如“查看/重试”）。
  - “查看全部”跳转到对应页（`/pipeline`、`/settings/api-keys`、`/pricing`、`/logs`、`/system`）。
- Top Models（Top5）：
  - 展示 model + cost（默认）+ share（可选）
  - “查看用量统计”跳转 `/usage`

#### D. 底部摘要（稳定性 + 配置健康度）
- 稳定性卡（B）：管线 pending/failed + 系统 connected +（可选）日志 error/warn 概览；每块有跳转。
- 配置健康卡（C）：providers/api keys/pricing/settings 覆盖度与缺失提示；每块有跳转。

### 3) 交互规则
- 过滤联动：时间窗/渠道变更必须同步驱动 KPI/趋势/Top/摘要/Action。
- 刷新：仅手动刷新（Batch 0 默认）；刷新时保留旧数据并显示 `refreshing` 状态，避免闪烁。
- 点击规则：
  - KPI：Cost/Tokens/Reqs/Top → `/usage`；Pipeline → `/pipeline`；Health → `/system`
  - Action item：按类型跳转到对应页面（或触发轻量“重试”动作，P1 再做）

### 4) 状态矩阵（必须覆盖）
- Loading：Skeleton（KPI/图表/列表骨架），布局稳定；过滤可用（变更会触发重新加载）。
- Empty：过去 24h 无数据 → KPI 归零/—；趋势与列表为空态；提供“去用量统计/去检查配置”引导。
- Error（局部降级）：单模块失败只影响自身卡片，显示“加载失败/重试”；其它区域可正常渲染。
- Disconnected：顶部 banner + 冻结最后快照；Action Center 提示“检查系统连接”，跳 `/system`。
- Auth：遮罩提示需要登录，提供跳转 `/login`。

### 5) 移动端策略
- KPI：2 列栅格（2×3），保证数值可读。
- 模块顺序：Action Center（高优先级）→ Cost KPI → Trend → Top Models → Stability → Config。
- 摘要区在移动端默认折叠（仅异常时展开），避免首屏过长。

### 6) 为什么选它（<=6条）
1) 同时照顾“看趋势/Top”的成本负责人与“看任务/健康”的运维。
2) Action Center 置顶且不打扰主图，符合 v1 目标“每块信息都可行动”。
3) 主趋势不做双轴叠加，降低读图门槛并贴合 v1 范围。
4) 默认手动刷新 + 局部降级，风险更低、实现更稳。
5) 结构清晰，后续扩展 KPI/摘要块不会破坏整体布局。

---

## 争议点清单（disputes）
> 同步文件：`feature/控制台概览页统计看板/plan/ui/batch-0/disputes.md`

- P0：Action Center 位置与权重（右侧栏置顶；桌面 3 条最多 5；移动端顺序上提；提供“查看全部”）
- P0：主趋势图形态（单图 + Tabs，默认 Cost）
- P0：交互形态（v1 只做跳转；抽屉/内联操作放 P1）
- P1：自动刷新（Batch 0 默认手动刷新；P1 再加可选自动刷新）
- P1：Action 条数上限（桌面默认 3；最多 5；移动端默认 3）

---

## 历史草稿（v1，已被 Batch 0 取代）
> 这是早期单稿，用于保留设计演进痕迹；实现请以 v4 推荐稿为准。

（略）