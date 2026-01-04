---
schema: plan_pro_v1
task:
  name: "控制台概览页统计看板"
  dir: "feature/控制台概览页统计看板"
batch:
  id: "0"
meta:
  timestamp: "2026-01-04 11:03"
  author: "gpt-5.2-pro"
---

# Plan.Pro — 控制台概览页统计看板 / Batch 0

## 0. 结论摘要（给执行者看的 TL;DR）

* 目标与范围：

  * 把 `/`（`/Users/wenlong/wt-next-migration/next-app/app/(app)/page.tsx`）从占位页升级为「过去 24h 概览驾驶舱」，按 A 成本/用量态势 → B 稳定性摘要 → C 配置健康度 的信息层级组织，首屏包含：KPI<=6 + 1 主趋势 + Top Models + Action Center，并覆盖 loading/empty/error/disconnected/auth 状态（对齐 AC1/AC2/AC3）。
  * 新增聚合端点 `GET /api/dashboard/overview`（单端点返回概览数据，避免前端并发拼装），支持过滤：`timeWindow`（utc-today/last-24h/last-7d/last-30d）+ `channel`（all/cliproxy/codex）（对齐 scope.in + performance 约束）。
  * i18n：新增 `dashboard.*` 文案 key，并同时修复现有 `i18n-context.tsx` 超 600 行问题（对齐 constraints.code_rules）。

* 核心改动点（<= 8 条）：

  1. ✅ 新增 `/Users/wenlong/wt-next-migration/next-app/app/api/dashboard/overview/route.ts`：聚合查询 + 局部降级（symbol：`GET`、`withTimeout`、`buildDashboardOverview`）。
  2. ✅ 新增 `next-app/lib/dashboard/overview/*`：时间窗解析、DB 聚合查询、管理端（management）探活/配置摘要、Action Center 规则生成（symbols：`resolveDashboardRange`、`queryOverviewUsage`、`queryTopModels`、`queryPipelineHealth`、`buildActionCenter`）。
  3. ✅ 修改 `/Users/wenlong/wt-next-migration/next-app/app/(app)/page.tsx`：替换占位为 `<DashboardOverviewPage />`（symbol：`Home`）。
  4. ✅ 新增 Dashboard UI 组件集（拆分避免单文件 >600）：FiltersBar / KPI / Trend / TopModels / ActionCenter / Stability / ConfigHealth（symbols：`DashboardOverviewPage`、`useDashboardOverview` 等）。
  5. ✅ 过滤状态采用 URL query 作为单一事实来源（`timeWindow`/`channel`），切换即触发数据刷新（对齐 AC2；用 `useSearchParams`/`useRouter` 实现）。
  6. ✅ 数据获取支持竞态治理：AbortController 取消旧请求 + requestId 防止乱序覆盖（对齐 AC2 “无错乱”）。
  7. ✅ Action Center：3–5 条可执行项，明确来源、排序、去重、上限，并映射到 `/usage /pipeline /logs /system /settings /pricing`（对齐 AC3）。
  8. ✅ i18n 文件拆分：`i18n-context.tsx` 仅保留 Provider/Hook，messages 按 locale 拆到新文件（对齐 code_rules）。

* 关键风险与兜底（<= 6 条）：

  1. DB 聚合查询在大事件量下变慢 → 只做聚合 SQL（group by + limit）、点数上限、必要时对 last-24h 强制小时桶（<=24）并加超时；超时则该模块降级但页面仍可用。
  2. 管理端（management）断连 → `system.connected=false` + Action Center 给出“去 System 页处理”；其余（DB）模块仍展示（对齐 security: 局部降级）。
  3. URL 状态实现不当导致频繁导航/闪烁 → 仅在选择变化时更新 query；用 AbortController + requestId 保证 UI 不乱序（客户端侧兜底）。
  4. i18n 重构影响全站文案 → 保持 `useI18n().t(key)` 兼容；只移动 messages，Provider API 不变；回归验证所有已有页面主路径。
  5. “Requests/Events 口径”与 /usage 不一致 → 后端复用与 `/api/usage` 同类策略：历史用 UsageDaily.totalRequests + 当天用 UsageEvent.count（明确写入说明与 tooltip）。
  6. Feature 回滚难 → 增加简单 Feature Flag（前端渲染开关 + API 开关），可一键回退到旧占位 UI。

---

## 1. 总体架构与数据流

### 模块划分（职责边界）

1. **页面入口（UI Shell）**

   * `/Users/wenlong/wt-next-migration/next-app/app/(app)/page.tsx` / `Home`
   * 仅负责渲染 `<DashboardOverviewPage />`，不承载复杂逻辑，避免膨胀 >600 行。

2. **Dashboard 页面（Client）**

   * 建议新增：`/Users/wenlong/wt-next-migration/next-app/app/(app)/_components/dashboard/DashboardOverviewPage.tsx` / `DashboardOverviewPage`（`'use client'`）
   * 负责：

     * 从 URL query 解析 filters（timeWindow/channel）
     * 调用 `useDashboardOverview(filters)` 获取数据
     * 控制 loading/empty/error/auth/disconnected 渲染
     * 组织布局：KPI、趋势、Top Models、Action Center、稳定性、配置健康

3. **数据 Hook / Service（Client）**

   * 建议新增：`.../hooks/useDashboardOverview.ts` / `useDashboardOverview`
   * 负责：

     * 构造请求 URL
     * AbortController 取消旧请求（避免竞态）
     * 轻量缓存（可选，Map + TTL）与手动刷新
     * 统一错误归一（401 => auth-required；>=500 => error；ok 但 partialErrors => banner）

4. **聚合 API（Server Route Handler）**

   * 新增：`/Users/wenlong/wt-next-migration/next-app/app/api/dashboard/overview/route.ts` / `GET`
   * 负责：

     * `requireSession()` 鉴权（对齐 security）
     * parse & validate query（timeWindow/channel）
     * 并行拉取：usage 聚合、topModels、pipeline、system health、configHealth、logsMeta
     * 使用 `Promise.allSettled` + per-source timeout 实现“局部降级不阻塞首页”
     * 组装 `DashboardOverviewResponse`（含 `partialErrors`）

5. **聚合实现库（Server-only 逻辑）**

   * 新增目录建议：`/Users/wenlong/wt-next-migration/next-app/lib/dashboard/overview/`
   * 文件建议：

     * `types.ts`（纯类型，可 client 共享）
     * `range.ts`（时间窗转 date range + bucket 粒度）
     * `usage.ts`（KPI+trend 聚合 SQL）
     * `top-models.ts`（Top5 聚合 + shareCost）
     * `pipeline.ts`（聚合任务健康）
     * `management.ts`（/debug、/api-keys、providers、/config、/logs meta）
     * `action-center.ts`（规则生成 + 排序 + 去重）

### 端到端数据流（从入口到 API/缓存/状态再到 UI）

1. 用户打开 `/`
2. `DashboardOverviewPage` 读取 URL：`?timeWindow=...&channel=...`（没有则默认 last-24h + all）
3. `useDashboardOverview` 生成 cacheKey `dashboardOverview:${timeWindow}:${channel}`，进入 loading，发起 `fetch(/api/dashboard/overview?... )`
4. API `GET /api/dashboard/overview`

   * `requireSession()`，失败则 401
   * `resolveDashboardRange(timeWindow)` 得到 `{ from,to, trendGranularity }`
   * 并发拉取数据源（allSettled + timeout）
   * 组装响应：`{ data: DashboardOverviewResponse }`
5. Client 收到结果：

   * 401 => 进入 `auth-required` 状态（展示“去登录”）
   * ok => 渲染模块；若 `partialErrors` 非空，显示“部分数据不可用”提示
   * 若 `kpis.requestCount===0` 且无错误 => empty 状态（但仍显示配置健康/引导）

### 关键时序（用文字步骤或简短伪代码）

**Filter 变更时序（避免竞态）**：

```ts
// /app/(app)/_components/dashboard/hooks/useDashboardOverview.ts
let requestSeq = 0;
let currentAbort: AbortController | null = null;

async function runFetch(filters) {
  requestSeq += 1;
  const seq = requestSeq;

  currentAbort?.abort(); // 取消旧请求 
  const ac = new AbortController();
  currentAbort = ac;

  setState({ kind: "loading", filters });

  try {
    const res = await fetch(buildUrl(filters), { signal: ac.signal });
    if (seq !== requestSeq) return; // 丢弃乱序响应（UI 不错乱）
    // ... handle 401 / error / ok
  } catch (e) {
    if (e?.name === "AbortError") return;
    if (seq !== requestSeq) return;
    setState({ kind: "error", ... });
  }
}
```

**聚合 API 并行与局部降级**：

```ts
// /app/api/dashboard/overview/route.ts
const results = await Promise.allSettled([
  withTimeout(queryOverviewUsage(...), 1200, "usage"),
  withTimeout(queryTopModels(...), 1200, "topModels"),
  withTimeout(queryPipelineHealth(...), 800, "pipeline"),
  withTimeout(fetchSystemHealth(...), 800, "system"),
  withTimeout(fetchConfigHealth(...), 1500, "config"),
  withTimeout(fetchLogsMeta(...), 800, "logs"),
]); // allSettled: 某个失败不影响其它 
```

---

## 2. 数据结构与状态模型（必须尽量完整）

> 建议新增共享类型文件：`/Users/wenlong/wt-next-migration/next-app/lib/dashboard/overview/types.ts`
> 该文件**不得**包含 `server-only`，以便 Client/Server 共享类型。

### 2.1 关键实体（DTO/VO/Model）

```ts
// /lib/dashboard/overview/types.ts
export type DashboardTimeWindow = "utc-today" | "last-24h" | "last-7d" | "last-30d";
export type DashboardChannel = "all" | "cliproxy" | "codex";

export type DashboardOverviewRequest = {
  timeWindow: DashboardTimeWindow;
  channel: DashboardChannel;
};

export type DashboardKpis = {
  costUsd: number;        // 估算成本（USD）
  totalTokens: number;
  cachedTokens: number;
  requestCount: number;   // v1 口径：UsageEvent 条数 + UsageDaily.totalRequests（见 Q1 处理）
  latestEventTime: string | null; // ISO
};

export type DashboardTrendMetric = "costUsd" | "totalTokens" | "requestCount";
export type DashboardTrendBucket = {
  ts: string;             // bucket 起始 ISO（UTC）
  costUsd?: number;
  totalTokens?: number;
  requestCount?: number;
};

export type DashboardTopModelRow = {
  model: string;
  costUsd: number;
  shareCost: number;      // 0..1（costUsd / kpis.costUsd）
  totalTokens: number;
  requestCount: number;
  pricingConfigured?: boolean;
};

export type DashboardPipelineHealth = {
  pending: number;
  running: number;
  failed: number;
  recentFailedJobs: Array<{
    id: string;
    kind: string;         // "daily" 等
    rangeFrom: string;    // ISO
    rangeTo: string;      // ISO
    lastError: string | null;
  }>;
};

export type DashboardSystemHealth = {
  connected: boolean;
  managementBase?: string;
  serverVersion: string | null;
  serverBuildDate: string | null;
};

export type DashboardConfigHealth = {
  apiKeysCount: number; // 仅数量，不返回明文/掩码（安全约束）
  providersSummary: {
    geminiCount: number;
    codexCount: number;
    claudeCount: number;
    openaiCompatCount: number;
    totalUpstreamKeysCount: number; // openaiCompat keys + 其它 provider key entries 的总数（仅数量）
  };
  pricingCoverage: {
    configuredModelsCount: number;
    usedModelsCount: number;
    missingModelsCount: number;
    missingModelsTop: string[]; // top 5（按成本或字母序，v1 建议按成本）
  };
  settingsSummary: {
    usageStatisticsEnabled: boolean;
    requestLog: boolean;
    wsAuth: boolean;
    loggingToFile: boolean;
    requestRetry: number;
  };
};

export type DashboardActionSeverity = "critical" | "high" | "medium" | "low";
export type DashboardActionKind =
  | "system_disconnected"
  | "pipeline_failed"
  | "pipeline_backlog"
  | "missing_api_keys"
  | "missing_providers"
  | "missing_pricing"
  | "usage_stats_disabled"
  | "cost_concentrated"
  | "view_usage"
  | "view_logs";

export type DashboardActionItem = {
  kind: DashboardActionKind;
  severity: DashboardActionSeverity;
  title: string;              // i18n key 或直接文案（v1 推荐 i18n key）
  description?: string;
  href: string;               // 必须是有效跳转（对齐 AC3）
  primaryActionLabel?: string;
};

export type DashboardPartialError = {
  source: "usage" | "topModels" | "pipeline" | "system" | "config" | "logs";
  code: string;               // 内部约定，如 "TIMEOUT" / "MANAGEMENT_ERROR" / "DB_ERROR"
  message: string;
  httpStatus?: number;
  retryable?: boolean;
};

export type DashboardOverviewResponse = {
  request: DashboardOverviewRequest;
  generatedAt: string; // ISO
  kpis: DashboardKpis;
  trend: {
    metricDefault: DashboardTrendMetric; // "costUsd"
    buckets: DashboardTrendBucket[];     // 点数限制：24-60
  };
  topModels: DashboardTopModelRow[];     // Top5
  pipeline: DashboardPipelineHealth;
  system: DashboardSystemHealth;
  configHealth: DashboardConfigHealth;
  logs: {
    latestTimestamp: string | null;
    lineCount: number | null;
  };
  actionCenter: DashboardActionItem[];  // 3-5
  partialErrors: DashboardPartialError[]; // 局部降级可见性
};
```

### 2.2 页面状态（loading/empty/error/权限/分页/筛选）

```ts
// /app/(app)/_components/dashboard/types.ts
import type { DashboardOverviewResponse, DashboardTimeWindow, DashboardChannel, DashboardTrendMetric } from "@/lib/dashboard/overview/types";

export type DashboardFilters = {
  timeWindow: DashboardTimeWindow;
  channel: DashboardChannel;
  metric: DashboardTrendMetric; // UI 选中的趋势指标（Cost/Tokens/Requests）
};

export type DashboardPageState =
  | { kind: "loading"; filters: DashboardFilters }
  | { kind: "ready"; filters: DashboardFilters; data: DashboardOverviewResponse }
  | { kind: "empty"; filters: DashboardFilters; data: DashboardOverviewResponse }
  | { kind: "auth-required"; next?: string }
  | { kind: "error"; filters: DashboardFilters; message: string; httpStatus?: number; canRetry: boolean };
```

> 备注：本页没有分页；TopModels 固定 Top5；Action Center 固定 3–5（无需分页）。

### 2.3 表单/编辑态（dirty/校验/提交/回滚）

本 Batch 0 的 Dashboard 不包含“编辑配置”的表单（scope.out），但包含 filters（时间窗/渠道）与趋势 tab（metric）。它们属于**轻量交互态**：

```ts
export type DashboardUiEphemeralState = {
  // filters 由 URL 决定，属于“可分享的状态”
  // metric 属于页面内部状态（可选：也写入 URL，v1 不强制）
  metric: DashboardTrendMetric;

  // 手动刷新按钮的瞬时态
  refreshing: boolean;

  // 局部错误展示（基于 data.partialErrors）
  dismissedPartialErrorSources: Set<string>;
};
```

### 2.4 缓存键/索引（如果有）

```ts
// /app/(app)/_components/dashboard/hooks/useDashboardOverview.ts
export type DashboardCacheKey = `dashboardOverview:${DashboardTimeWindow}:${DashboardChannel}`;

export type DashboardCacheEntry = {
  at: number; // Date.now()
  data: DashboardOverviewResponse;
};

// v1：仅内存缓存（Map），TTL 建议 10s，避免用户来回切换造成抖动与重复请求
```

---

## 3. 接口与副作用（API/Service/Hook）

### 3.1 API 列表（路径/方法/入参/出参/错误码假设）

#### 新增（本 Batch 必做）

1. `GET /api/dashboard/overview`

* 文件：`/Users/wenlong/wt-next-migration/next-app/app/api/dashboard/overview/route.ts`
* 入参（Query）：

  * `timeWindow?: "utc-today" | "last-24h" | "last-7d" | "last-30d"`（默认 `last-24h`）
  * `channel?: "all" | "cliproxy" | "codex"`（默认 `all`）
* 出参：

  * `200`：`{ data: DashboardOverviewResponse }`
  * `400`：`{ error: "Validation failed" }`
  * `401`：`{ error: "未登录" | "会话无效或已过期" }`（由 `requireSession` 决定）
  * `500`：`{ error: "Internal server error" }`（仅灾难级；常规数据源失败走 `partialErrors`）
* 安全：

  * 必须 `requireSession()`（对齐 security）
  * 响应中不得包含任何 API key 明文或可逆密文（configHealth 仅返回数量/布尔/覆盖率）

> Route Handler 缓存：为避免被意外缓存，建议在 `route.ts` 顶部显式 `export const dynamic = "force-dynamic"`（Route Handlers 默认不缓存，但显式写更安全）。

#### 复用（作为 overview 聚合来源，不新增，按需调用/查询）

* `/Users/wenlong/wt-next-migration/next-app/app/api/system/health/route.ts`：探活逻辑参考（symbol：`GET`）
* `/Users/wenlong/wt-next-migration/next-app/app/api/usage/route.ts`：UsageDaily/UsageEvent 切分与 channel 过滤参考（symbol：`GET`）
* `/Users/wenlong/wt-next-migration/next-app/app/api/usage/by-model/route.ts`：model 维度聚合与 pricingConfigured 参考（symbol：`GET`）
* `/Users/wenlong/wt-next-migration/next-app/app/api/usage/aggregate/jobs/route.ts`：管线 job 表结构与 status 参考（symbols：`GET`）
* `/Users/wenlong/wt-next-migration/next-app/app/api/logs/route.ts`：日志 meta 字段（latest-timestamp/line-count）参考（symbols：`GET`）
* `/Users/wenlong/wt-next-migration/next-app/app/api/providers/route.ts`、`/api/api-keys`、`/api/settings`：配置健康的取数口径参考（symbols：`readAllProviders`、`pickSettings` 等）

> 注意：overview **不建议**在 Server 内部再 HTTP 调用这些 API（会遇到 cookie/绝对 URL/重复鉴权/额外开销问题）。推荐直接复用其内部“查询/转换”逻辑或在 `lib/dashboard/overview/` 内实现等价聚合。

### 3.2 Service 层职责（请求、重试、取消、并发、缓存）

* 建议文件：`/Users/wenlong/wt-next-migration/next-app/app/(app)/_components/dashboard/hooks/useDashboardOverview.ts`
* 职责清单：

  1. **请求构造**：`/api/dashboard/overview?timeWindow=...&channel=...`
  2. **取消**：filter 改变/刷新时 abort 前一个 fetch，避免旧响应覆盖新状态（AbortController）。
  3. **竞态治理**：`requestSeq`/`requestId`，只 accept 最新请求响应
  4. **并发控制**：同一 key 的连续请求可做“正在请求则复用 Promise”（可选）
  5. **缓存**：内存 Map + TTL（10 秒），改善来回切换体验（可选）
  6. **错误归一**：

     * 401 => `auth-required`
     * 400 => 视为开发错误/提示用户重置 filters
     * > =500 => `error`（可 Retry）
  7. **刷新**：刷新按钮触发 `force=true` 参数（可选）或绕过 cache

### 3.3 副作用与一致性策略（竞态、刷新、轮询、WebSocket 等）

* 竞态：Abort + requestSeq 双保险（上文伪代码）
* 刷新：

  * “刷新”按钮：触发 `refresh()`，强制重新请求
  * 切换时间窗/渠道：更新 URL query 后自动触发 fetch
* 轮询：v1 不强制（避免对 management 施压）；若 UI 设计要求“新鲜度自动更新”，可只更新“相对时间显示”而不轮询数据
* WebSocket：v1 不引入（scope.out）

---

## 4. 文件/目录改动清单（尽量到文件级）

### 新增：

1. `/Users/wenlong/wt-next-migration/next-app/app/api/dashboard/overview/route.ts`

* 为什么改：新增聚合端点，满足 performance “单请求完成” + scope.in “新增 /api/dashboard/overview”
* 关键 symbol：

  * `export const dynamic = "force-dynamic"`
  * `export async function GET(req: NextRequest)`
  * `withTimeout<T>(promise, ms, source)`
  * `buildDashboardOverview(session, request)`

2. `/Users/wenlong/wt-next-migration/next-app/lib/dashboard/overview/types.ts`

* 为什么改：统一 DTO/类型，前后端共享，减少漂移
* 关键 symbol：`DashboardOverviewResponse`、`DashboardPartialError`、`DashboardActionItem`

3. `/Users/wenlong/wt-next-migration/next-app/lib/dashboard/overview/range.ts`

* 为什么改：时间窗解析与分桶粒度决策（回答 Q3）
* 关键 symbol：`resolveDashboardRange(timeWindow): { from,to, granularity }`

4. `/Users/wenlong/wt-next-migration/next-app/lib/dashboard/overview/usage.ts`

* 为什么改：封装 KPI + trend 的 DB 聚合查询，复用 `/api/usage` 的口径（回答 Q1）
* 关键 symbol：`queryOverviewUsage(prisma, range, channel): { kpis, trendBuckets }`

5. `/Users/wenlong/wt-next-migration/next-app/lib/dashboard/overview/top-models.ts`

* 为什么改：Top5 模型成本/占比/Token 聚合，满足 scope.in “Top Models（Top5）”
* 关键 symbol：`queryTopModels(prisma, range, channel, totalCostUsd): DashboardTopModelRow[]`

6. `/Users/wenlong/wt-next-migration/next-app/lib/dashboard/overview/pipeline.ts`

* 为什么改：聚合任务健康度（pending/running/failed + 最近失败），用于稳定性卡与 Action Center
* 关键 symbol：`queryPipelineHealth(prisma): DashboardPipelineHealth`

7. `/Users/wenlong/wt-next-migration/next-app/lib/dashboard/overview/management.ts`

* 为什么改：读取 management 侧的 system/logs/config/providers/apiKeys（只返回安全摘要）
* 关键 symbol：

  * `fetchSystemHealth(config): DashboardSystemHealth`
  * `fetchLogsMeta(config): { latestTimestamp, lineCount }`
  * `fetchConfigHealth(config, prisma, range, channel): DashboardConfigHealth`

8. `/Users/wenlong/wt-next-migration/next-app/lib/dashboard/overview/action-center.ts`

* 为什么改：生成 3–5 可行动项，明确排序规则与去重，满足 scope.in “Action Center”
* 关键 symbol：`buildActionCenter(input): DashboardActionItem[]`

9. Dashboard UI 组件（拆分避免 >600）

* `/Users/wenlong/wt-next-migration/next-app/app/(app)/_components/dashboard/DashboardOverviewPage.tsx`

  * symbol：`DashboardOverviewPage`
* `/Users/wenlong/wt-next-migration/next-app/app/(app)/_components/dashboard/hooks/useDashboardOverview.ts`

  * symbol：`useDashboardOverview`
* `/Users/wenlong/wt-next-migration/next-app/app/(app)/_components/dashboard/components/*`

  * `FiltersBar` / `KpiGrid` / `TrendCard` / `TrendChart` / `TopModelsCard` / `ActionCenterCard` / `StabilityCards` / `ConfigHealthCard`
* `/Users/wenlong/wt-next-migration/next-app/app/(app)/_components/dashboard/utils/format.ts`

  * symbol：`formatUsd`、`formatCompactInt`、`formatPercent`

10. i18n messages 拆分（为满足 code_rules）

* `/Users/wenlong/wt-next-migration/next-app/components/i18n/messages/en.ts`
* `/Users/wenlong/wt-next-migration/next-app/components/i18n/messages/zh.ts`

### 修改：

1. `/Users/wenlong/wt-next-migration/next-app/app/(app)/page.tsx`

* 为什么改：替换占位内容为 Dashboard 概览页 UI（scope.in）
* 关键 symbol：`export default function Home()`

2. `/Users/wenlong/wt-next-migration/next-app/components/i18n-context.tsx`

* 为什么改：

  * 新增 `dashboard.*` key（scope.in）
  * 现文件 1083 行，违反 code_rules，需要拆 messages（constraints.code_rules）
* 关键 symbol：

  * `messages`（将移除到独立文件）
  * `I18nProvider` / `useI18n`（保持 API 不变）

> 可选修改（若团队要彻底对齐 code_rules）：

* `/Users/wenlong/wt-next-migration/next-app/app/api/providers/route.ts` 当前 658 行；建议后续提炼工具函数（本 Batch 0 不强制触碰，以降低回归风险）。
* `/Users/wenlong/wt-next-migration/next-app/app/api/usage/route.ts` 当前 605 行；建议后续拆分（同上）。

### 删除（如有）：

* 无（v1 不删旧页面/旧 API）

---

## 5. 组件拆分与 >600 行策略

### 哪些文件可能超 600 行？如何拆（子组件/Hook/Utils/Types）

1. `DashboardOverviewPage.tsx`（最容易膨胀）

* 拆分建议：

  * `components/FiltersBar.tsx`：时间窗/渠道/新鲜度/刷新
  * `components/KpiGrid.tsx`：<=6 KPI 卡
  * `components/TrendCard.tsx`：Tabs + Chart 容器（不放复杂绘图）
  * `components/TrendChart.tsx`：纯展示 SVG/Canvas（无业务逻辑）
  * `components/TopModelsCard.tsx`：Top5 列表 + 占比条
  * `components/ActionCenterCard.tsx`：3–5 actions 列表
  * `components/StabilityCards.tsx`：pipeline/logs/system 三小卡
  * `components/ConfigHealthCard.tsx`：apiKeys/providers/pricing/settings 摘要
  * `hooks/useDashboardOverview.ts`：数据获取与状态机
  * `utils/format.ts`：格式化与 UI 小工具
  * `types.ts`：页面状态与 filters

2. `components/i18n-context.tsx` 当前 1083 行（已超）

* 解决：把 `messages` 拆到 `components/i18n/messages/{en,zh}.ts`，`i18n-context.tsx` 只保留 Provider/Hook（预计 <120 行），并在 `en.ts/zh.ts` 增加 `dashboard.*` key。
* 这样既满足本需求，又把 i18n 的后续增量变成“改两份 locale 文件”，可控且不继续撑大 Provider 文件。

### 拆分后的依赖方向（避免循环依赖）

* UI 层（Client）依赖方向：

  * `DashboardOverviewPage.tsx` → `hooks/useDashboardOverview.ts` → `lib/dashboard/overview/types.ts`（类型-only）
  * `DashboardOverviewPage.tsx` → `components/*` → `utils/format.ts`（纯函数）
  * `components/*` **不得**反向 import `DashboardOverviewPage.tsx`
* Server 聚合层依赖方向：

  * `app/api/dashboard/overview/route.ts` → `lib/dashboard/overview/*`
  * `lib/dashboard/overview/*` → `prisma` / `management client` / `auth/session`（仅 route.ts 调用 requireSession，lib 尽量不直接读 cookies）
* i18n：

  * `components/i18n-context.tsx` → `components/i18n/messages/{en,zh}.ts`
  * `messages/*` 只导出 plain object，不 import 任何 React/组件，避免循环与 bundle 膨胀

---

## 6. 分步实现 Checklist（尽量详细，可直接照做）

> 使用 `- [ ]`，每一项必须注明涉及文件路径。

### A. 后端聚合端点

* [ ] 新增类型文件：创建 `/Users/wenlong/wt-next-migration/next-app/lib/dashboard/overview/types.ts`，写全 `DashboardOverviewRequest/Response` 等类型（symbols：见第 2 节）。
* [ ] 新增时间窗解析：创建 `/Users/wenlong/wt-next-migration/next-app/lib/dashboard/overview/range.ts`（symbol：`resolveDashboardRange`）

  * [ ] 实现 Q3 决策：`utc-today/last-24h => hour`；`last-7d/last-30d => day`
  * [ ] 输出 `{ from: Date; to: Date; granularity: "hour" | "day" }`
* [ ] 新增 usage 聚合查询：创建 `/Users/wenlong/wt-next-migration/next-app/lib/dashboard/overview/usage.ts`（symbol：`queryOverviewUsage`）

  * [ ] 复用 `/Users/wenlong/wt-next-migration/next-app/app/api/usage/route.ts` 的 channel 过滤逻辑（events 用 sourceType，daily 用 apiPath + CODEX_API_PATHS）
  * [ ] 输出 `kpis`（sum + max(eventTime)）与 `trend.buckets`（点数<=60，必要时补齐缺失 bucket）
* [ ] 新增 TopModels 聚合：创建 `/Users/wenlong/wt-next-migration/next-app/lib/dashboard/overview/top-models.ts`（symbol：`queryTopModels`）

  * [ ] 仅 Top5（limit 5），并计算 `shareCost`
  * [ ] 可选：查询 `ModelPricing` 是否配置（`pricingConfigured`）
* [ ] 新增 Pipeline 健康：创建 `/Users/wenlong/wt-next-migration/next-app/lib/dashboard/overview/pipeline.ts`（symbol：`queryPipelineHealth`）

  * [ ] 统计 `pending/running/failed`
  * [ ] 拉取最近 3 条失败任务（`recentFailedJobs`）
  * [ ] 若 Prisma delegate 缺失（参考 jobs route 的 defensive fallback），返回全 0 并写入 partialErrors（source=pipeline）
* [ ] 新增 management 摘要：创建 `/Users/wenlong/wt-next-migration/next-app/lib/dashboard/overview/management.ts`

  * [ ] `fetchSystemHealth`：参考 `/Users/wenlong/wt-next-migration/next-app/app/api/system/health/route.ts` 的 `/debug` + header 解析（symbols：`pickHeader` 逻辑等）
  * [ ] `fetchLogsMeta`：调用 management `/logs?limit=1`，读取 `latest-timestamp`/`line-count`（参考 `/Users/wenlong/wt-next-migration/next-app/app/api/logs/route.ts` 的返回类型）
  * [ ] `fetchConfigHealth`：

    * [ ] apiKeysCount：调用 management `/api-keys`，只数数量
    * [ ] providersSummary：调用 `/gemini-api-key` `/codex-api-key` `/claude-api-key` `/openai-compatibility`，只数数量（不返回明文/掩码）
    * [ ] pricingCoverage：基于 `ModelPricing` 与“范围内使用过的 model distinct”计算覆盖率 + missingTop5
    * [ ] settingsSummary：调用 management `/config`，提取与 `/Users/wenlong/wt-next-migration/next-app/app/api/settings/route.ts` `pickSettings` 一致的布尔开关（不返回敏感字段）
* [ ] 新增 Action Center 规则：创建 `/Users/wenlong/wt-next-migration/next-app/lib/dashboard/overview/action-center.ts`（symbol：`buildActionCenter`）

  * [ ] 输入：`system/pipeline/configHealth/topModels/kpis/partialErrors`
  * [ ] 输出：3–5 actions；排序规则写死（severity 优先：critical > high > medium > low；同级按 priority 数字升序）；kind 去重；limit=5
* [ ] 新增聚合 API：创建 `/Users/wenlong/wt-next-migration/next-app/app/api/dashboard/overview/route.ts`

  * [ ] `export const dynamic = "force-dynamic"`（避免缓存歧义）。
  * [ ] `GET(req)`：

    * [ ] `requireSession()`（/Users/wenlong/wt-next-migration/next-app/lib/auth/session.ts: symbol `requireSession`）
    * [ ] parse query：默认 last-24h + all
    * [ ] `Promise.allSettled` 并行执行各数据源 + `withTimeout`（source 标记）。
    * [ ] 组装 `DashboardOverviewResponse` + `partialErrors`
    * [ ] 返回 `NextResponse.json({ data })`

### B. i18n（必须做，且解决 >600 行）

* [ ] 新增 messages 文件：

  * [ ] `/Users/wenlong/wt-next-migration/next-app/components/i18n/messages/en.ts`（导出 `messagesEn`）
  * [ ] `/Users/wenlong/wt-next-migration/next-app/components/i18n/messages/zh.ts`（导出 `messagesZh`）
* [ ] 修改 `/Users/wenlong/wt-next-migration/next-app/components/i18n-context.tsx`

  * [ ] 移除内联 `messages` 大对象，改为 import `messagesEn/messagesZh`
  * [ ] `I18nProvider` / `useI18n` 对外 API 不变（symbol 不变）
* [ ] 在 `en.ts`/`zh.ts` 增加 `dashboard.*` keys（至少覆盖：标题/过滤/各模块标题/KPI 文案/状态页文案/Action Center 文案）

### C. 前端 Dashboard UI

* [ ] 修改入口页：`/Users/wenlong/wt-next-migration/next-app/app/(app)/page.tsx`

  * [ ] `Home` 改为渲染 `<DashboardOverviewPage />`（不再渲染占位文案）
* [ ] 新增页面主组件：`/Users/wenlong/wt-next-migration/next-app/app/(app)/_components/dashboard/DashboardOverviewPage.tsx`

  * [ ] `'use client'`
  * [ ] 使用 `useSearchParams` 读取 `timeWindow/channel`，默认值 last-24h + all。
  * [ ] 使用 `useRouter` 写回 query（选择变化时更新 URL）。
  * [ ] 组合布局：KPI + Trend + (Action Center + Top Models) + (Stability + Config Health)
* [ ] 新增 hook：`/Users/wenlong/wt-next-migration/next-app/app/(app)/_components/dashboard/hooks/useDashboardOverview.ts`

  * [ ] 实现 AbortController + requestSeq，避免竞态与错乱（AC2）。
  * [ ] 处理状态机：loading/ready/empty/error/auth-required
  * [ ] 支持 refresh（按钮触发）
* [ ] 新增 FiltersBar：`.../components/FiltersBar.tsx`

  * [ ] 时间窗选择（4 项）+ 渠道选择（3 项）
  * [ ] 新鲜度展示：基于 `data.kpis.latestEventTime` 与 `data.generatedAt`
  * [ ] 刷新按钮（调用 `refresh()`）
* [ ] 新增 KPI Grid：`.../components/KpiGrid.tsx`

  * [ ] <=6 卡：Cost / Total Tokens / Requests / Cached% / Pipeline(pending/failed) / Health(connected+version)
  * [ ] 每张卡有 “查看详情” Link（对齐 AC3：至少覆盖 /usage /pipeline /system）
* [ ] 新增 Trend：`.../components/TrendCard.tsx` + `TrendChart.tsx`

  * [ ] Tabs：Cost 默认，可切 Tokens/Requests（对齐 scope.in）
  * [ ] Chart v1 用纯 SVG 折线（避免引入新依赖）；点数来自后端 buckets
  * [ ] 提供跳转 Link → `/usage`
* [ ] 新增 TopModelsCard：`.../components/TopModelsCard.tsx`

  * [ ] Top5 列表：model + costUsd + shareCost
  * [ ] Link → `/usage`
* [ ] 新增 ActionCenterCard：`.../components/ActionCenterCard.tsx`

  * [ ] 3–5 条 action，按 severity 排序
  * [ ] 每条 action 显示 primaryActionLabel，并可点击跳转（对齐 AC3）
* [ ] 新增 StabilityCards：`.../components/StabilityCards.tsx`

  * [ ] Pipeline：pending/running/failed + recent failed job（Link → `/pipeline`）
  * [ ] Logs：latestTimestamp/lineCount（Link → `/logs`）
  * [ ] System：connected/version（Link → `/system`）
* [ ] 新增 ConfigHealthCard：`.../components/ConfigHealthCard.tsx`

  * [ ] API Keys count（Link → `/settings` 或 `/settings/api-keys`）
  * [ ] Providers summary（Link → `/settings/providers`）
  * [ ] Pricing coverage（Link → `/pricing`）
  * [ ] Settings summary（Link → `/settings`）
* [ ] 补齐状态页（AC3 必做）：

  * [ ] auth-required：显示“未登录” + Link `/login`
  * [ ] disconnected：当 `data.system.connected=false` 时显示顶部 Callout + Link `/system`
  * [ ] empty：当 `kpis` 为 0 且无 usage 错误时，显示空态 + Link `/usage`/`/settings`
  * [ ] error：接口非 401 且 fetch 失败，显示错误 + “重试”
  * [ ] partialErrors：展示“部分数据不可用”提示（不阻塞）

---

## 7. 验证 Checklist（手动验证 + 边界 + 回归）

> 使用 `- [ ]`，并尽量给具体操作与预期结果。

### 对齐验收标准（AC1/AC2/AC3）

* [ ] **AC1**：默认进入 `/` 显示过去 24h 概览（A/B/C）

  * 操作：直接打开 `/`
  * 预期：Filters 默认 `timeWindow=last-24h`、`channel=all`；首屏可见 KPI<=6 + 主趋势 + Top Models + Action Center；下方可见稳定性卡 + 配置健康卡；整体布局符合 UI设计.md v4 的模块结构（不要求像素级，但模块齐全、层级清晰）。
  * 涉及文件：`/Users/wenlong/wt-next-migration/next-app/app/(app)/page.tsx`、`.../DashboardOverviewPage.tsx`

* [ ] **AC2**：切换时间窗/渠道后所有模块同步更新且无错乱

  * 操作：分别切换 4 个 timeWindow（utc-today/last-24h/last-7d/last-30d）和 3 个 channel（all/cliproxy/codex）
  * 预期：

    * KPI、趋势、TopModels、Action Center 同步更新
    * 不出现“旧数据覆盖新数据”的闪回（Abort + requestSeq 生效）
    * Network 面板看到每次切换只打 1 个请求：`/api/dashboard/overview?...`
  * 涉及文件：`.../useDashboardOverview.ts`、`/Users/wenlong/wt-next-migration/next-app/app/api/dashboard/overview/route.ts`

* [ ] **AC3**：覆盖 loading/empty/error/disconnected/auth，并且每个区块至少一个有效跳转入口

  * loading：

    * 操作：在 DevTools 网络限速下打开 `/`
    * 预期：各模块 skeleton/占位出现，不卡死
  * empty：

    * 操作：选择一个无数据时间窗（例如 utc-today 且系统无用量），或在测试库清空 UsageEvent
    * 预期：显示空态文案 + 引导跳转 `/usage` 或 `/settings`
  * error：

    * 操作：让 `/api/dashboard/overview` 返回 500（临时 throw 或断 DB 连接）
    * 预期：显示错误态 + “重试”
  * disconnected：

    * 操作：让 management 不可达（断管理服务/改端口），但保持已登录 cookie
    * 预期：显示“断连/不可用”提示；system 卡显示 disconnected；Action Center 给出 `/system` 跳转
  * auth：

    * 操作：清除登录 cookie 后打开 `/` 或直接访问 `/api/dashboard/overview`
    * 预期：前端显示“未登录”态并提供 `/login`；接口返回 401
  * 跳转入口：

    * 操作：逐个区块点击“查看详情/去处理”
    * 预期：至少覆盖并可到达：`/usage /pipeline /logs /system /settings /pricing`
  * 涉及文件：`DashboardOverviewPage.tsx`、各 cards 组件

### 约束对齐验证（constraints）

* [ ] tech_stack：只用 Next.js(App Router)+TS+Tailwind+shadcn/ui（不新增重量依赖）

  * 操作：检查新增组件 import，仅来自现有组件库/React/Next
* [ ] performance：首屏尽量单请求完成

  * 操作：打开 `/` 看 network；应只有 `/api/dashboard/overview`
* [ ] performance：trend/topModels 点数与数量控制

  * 操作：选择 last-30d，检查 trend buckets <= 31 左右；TopModels 固定 5
* [ ] code_rules：单文件 <=600 行（至少本次新增/修改文件全部满足）

  * 操作：`wc -l` 检查新增文件；`i18n-context.tsx` 重构后应 <600
* [ ] security：所有数据经过现有会话鉴权，不泄露敏感配置明文

  * 操作：抓包看 `/api/dashboard/overview` 响应，不应包含任何 key 明文（apiKeys/providers 仅数量/摘要）
* [ ] security：允许局部降级

  * 操作：让 logs 或 providers 拉取失败，确认页面仍能展示 usage 与其余模块，并出现 partialErrors 提示

---

## 8. 风险与回滚（必须可操作）

### 风险点 → 触发条件 → 监控/发现方式 → 回滚步骤

1. **DB 聚合慢导致首页变慢**

* 触发：UsageEvent 量大，last-24h 的 group by hour 仍耗时
* 发现：RUM/日志中 `/api/dashboard/overview` p95 上升；用户反馈首页卡
* 兜底：

  * 后端：每个数据源 `withTimeout`（usage 可给更高预算，例如 1500ms），超时写入 `partialErrors` 且返回空趋势/0 KPI（避免整页挂）
  * 前端：出现 “部分数据不可用” 提示，仍给跳转 `/usage`
* 回滚：

  1. 临时开启 Feature Flag 关闭 Dashboard（见下）
  2. 或在 API 内对 last-24h 退化为仅 KPI（不返回 trend/topModels），并提示用户去 `/usage`

2. **management 断连导致大量模块不可用**

* 触发：管理服务不可达或密钥失效
* 发现：system.connected=false；Action Center 出现 critical
* 兜底：仍展示 DB 侧 usage（若有）；配置健康与日志可降级为空并提示
* 回滚：Feature Flag 关闭 Dashboard；或仅隐藏 stability/config 区域

3. **i18n 重构引发全站文案丢失**

* 触发：messages 导出/导入错误，t(key) 回退为 key 字符串
* 发现：页面出现大量 `nav.xxx` 原样 key
* 回滚：

  1. 立即 revert `components/i18n-context.tsx` 与 `components/i18n/messages/*` 提交
  2. Dashboard 仍可跑（但文案退化），必要时 Feature Flag 关闭 Dashboard

4. **URL 状态引发路由频繁刷新**

* 触发：每次输入/点击都 push 路由导致 rerender 过多
* 发现：性能差、交互卡
* 兜底：仅在选择 commit 时更新 query（Select onValueChange 即一次）；避免在渲染中写 URL
* 回滚：把 filters 改为 local state（不写 URL），但保留默认 last-24h/all

### 需要 Feature Flag 吗？如何默认关闭/灰度？

建议需要（便于回滚），实现最小化：

* 前端 flag（建议）：

  * 文件：`/Users/wenlong/wt-next-migration/next-app/app/(app)/page.tsx` / `Home`
  * 规则：`const enabled = process.env.NEXT_PUBLIC_DASHBOARD_OVERVIEW_V1 !== "0";`
  * enabled=true（默认开启）；若置 0，则渲染旧占位 UI（或显示“Dashboard 暂停”）
* 后端 flag（可选）：

  * 文件：`/Users/wenlong/wt-next-migration/next-app/app/api/dashboard/overview/route.ts`
  * 若关闭则返回 404 或 503（前端据此展示降级文案）

灰度方式：

* 由于是管理控制台内部使用，最简单灰度是环境变量分环境开启（dev/staging 先开，prod 后开）。
* 若需要按用户灰度：可在后端基于 session.id 做 hash 分桶（但本 Batch 0 不建议加复杂度）。

---

## 9. 最小缺失信息（若需要）

> 控制在 <= 6 条，并给出保守默认假设（确保在缺信息下仍能落地）。

1. **UI设计.md v4 的具体布局细节（间距/组件样式/颜色规则）未包含在 bundle**

* 默认假设：严格按 review-package 的模块清单与层级实现，使用 shadcn `Card/Tabs/Select/Button/Skeleton/Badge` + Tailwind 网格，做到“模块齐全 + 层级清晰”，像素级差异后续按 UI 稿微调。

2. **`/usage /pipeline /logs /system /settings /pricing` 的实际路由文件结构未提供**

* 默认假设：这些路由均以同名 path 存在且可访问（AC3 明确列出），Dashboard 先用“裸跳转”到这些 path；如实际路径不同，集中在 `action-center.ts` 与各 Card 的 link builder 里统一修正。

3. **`@/lib/management/types` 的 `ok/fail` envelope 具体结构未提供**

* 默认假设：Dashboard 新 API 采用 `{ data: ... }` 的简单响应，避免耦合 `ok/fail`；前端只依赖 HTTP 状态码 + `data.partialErrors`。

4. **是否已有图表库（recharts/visx 等）未给出**

* 默认假设：v1 使用纯 SVG 折线图实现趋势图（无新依赖），后续若项目已有图表库再替换为统一风格。

5. **UsageEvent/UsageDaily 的索引与数据规模未知**

* 默认假设：`eventTime` 有索引（常见），聚合 SQL 使用时间范围 + group by bucket；趋势点数严格控制在 24–60；并为每个数据源设置 timeout，避免拖垮首页。

6. **management `/logs` 返回的 meta 字段（latest-timestamp/line-count）在所有版本是否稳定未知**

* 默认假设：若字段缺失则 logsMeta 设为 null，并在 `partialErrors` 记录 `logs`；UI 仍提供 `/logs` 跳转，不阻塞首页。
