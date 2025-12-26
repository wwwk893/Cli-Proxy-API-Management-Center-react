# Cli-Proxy-API-Management-Center 重构方案（Next.js + TS + shadcn + Postgres）

> 目标：
> 把当前的纯 HTML/JS WebUI ([GitHub][1]) 重构成一套 **Next.js + TypeScript + shadcn/ui + Postgres** 的全栈应用，同时新增：
>
> * 更丰富的 Usage 图表（按时间、模型、API、缓存）
> * 持久化存储 token 使用数据到 Postgres
> * 基于模型单价计算 token 花费
> * 图表展示实际消耗、缓存节省与费用

文档采用「阶段 → Task」的形式，方便你用 Codex CLI 一条条下指令。

---

## 0. 重构总览

### 0.1 当前项目现状

仓库结构（简化）：([GitHub][1])

```txt
.
├── index.html
├── styles.css
├── app.js
├── i18n.js
├── src/                # 核心逻辑、模块和工具
├── build.cjs           # Webpack 打包脚本
├── bundle-entry.js
├── build-scripts/
│   └── prepare-html.js
└── dist/               # 打包输出 (单文件 index.html)
```

特性（和重构直接相关的）([GitHub][1])：

* 登录 & 管理地址探测、本地加密存储、主题/语言切换
* 基础设置、Keys & Providers 管理
* OAuth/Auth 文件管理
* Logs 实时查看
* Usage Analytics：用 Chart.js 展示小时/天的使用情况
* Config YAML 在线编辑
* System Info / Preferences 等

### 0.2 重构后的目标架构

新项目建议结构：

```txt
cli-proxy-management/
  app/
    layout.tsx
    page.tsx                  # Dashboard 总览
    login/
      page.tsx
    settings/
      basic/page.tsx
      providers/page.tsx
    auth-files/
      page.tsx
    logs/
      page.tsx
    usage/
      page.tsx                # Token & 费用图表
    config/
      page.tsx
    system/
      page.tsx
    api/
      usage/route.ts          # 图表查询 API
      usage/ingest/route.ts   # 从 CLIProxyAPI /usage 拉取并落库
  components/
    layout/
      sidebar.tsx
      topbar.tsx
    charts/
      usage-main-chart.tsx
      usage-model-bar-chart.tsx
    usage/
      usage-filters.tsx
      usage-summary-cards.tsx
    ui/                       # shadcn 生成的组件
  lib/
    db.ts                     # Prisma + Postgres 客户端
    pricing.ts                # 模型计价配置 & 计算函数
    cliproxy-client.ts        # 调用 Management API 的封装
    usage-ingest.ts           # usage 数据解析 & 入库
    usage-service.ts          # 图表查询 & 聚合逻辑
    i18n.ts                   # 基于旧 i18n.js 的 Next 版本
    theme.ts                  # 主题切换逻辑
  prisma/
    schema.prisma             # 数据模型
  .env
  package.json
```

---

## 1. 基础搭建：新分支 + Next.js + shadcn

### Task 1.1：创建重构分支

目的：保证老 UI 可用，同时在新分支上重构。

**建议步骤：**

1. 从 `main` 拉新分支：

   ```bash
   git checkout -b nextjs-rewrite
   ```

2. （可选）在根目录新建子目录 `next-app/`，用于新 Next 项目，后面再考虑是否完全替换旧代码。

**Codex 指令示例：**

> 在仓库根目录新建名为 `nextjs-rewrite` 的 git 分支，并创建子目录 `next-app/`（如果不存在）。

---

### Task 1.2：在 `next-app/` 初始化 Next.js + TS

1. 进入仓库根目录：

   ```bash
   cd Cli-Proxy-API-Management-Center-react
   ```

2. 创建 Next 应用（TS + App Router）：

   ```bash
   npx create-next-app@latest next-app --ts --eslint
   ```

3. 选择:

   * App Router: Yes
   * Tailwind: 可以选 Yes（shadcn 依赖 Tailwind）
   * src/ 目录: 随意（下文假设默认结构，不用 `src`）

**Codex 指令示例：**

> 在 `Cli-Proxy-API-Management-Center-react` 仓库下新建 `next-app` 目录，并使用 `create-next-app` 初始化一个 TypeScript + App Router 的 Next.js 项目，启用 Tailwind 和 ESLint。

---

### Task 1.3：集成 shadcn/ui

参考 shadcn 官方文档（Next + Tailwind 场景）([GitHub][1])：

1. 在 `next-app` 下安装 CLI：

   ```bash
   cd next-app
   npx shadcn-ui@latest init
   ```

2. 选择：

   * TypeScript: Yes
   * Tailwind: Already yes
   * 路径：`components` / `lib` 保持默认

3. 安装常用组件：

   ```bash
   npx shadcn-ui@latest add button card input table select tabs dropdown-menu dialog tooltip skeleton chart
   ```

   > 注：`chart` 组件会帮你拉一个基于 `recharts` 的封装，正好可用于使用统计图。

**Codex 指令示例：**

> 在 `next-app` 中集成 shadcn/ui，并添加 `button`, `card`, `input`, `table`, `select`, `tabs`, `dropdown-menu`, `dialog`, `tooltip`, `skeleton`, `chart` 组件。

---

## 2. Postgres + Prisma 设计与接入

### Task 2.1：准备 Postgres 实例

可以用 Docker 快速起一个开发实例：

```yaml
# docker-compose.db.yml 示例
version: '3.9'
services:
  postgres:
    image: postgres:15
    restart: unless-stopped
    environment:
      POSTGRES_USER: cliproxy
      POSTGRES_PASSWORD: cliproxy
      POSTGRES_DB: cliproxy_mgmt
    ports:
      - "5432:5432"
    volumes:
      - ./_data/postgres:/var/lib/postgresql/data
```

```bash
docker compose -f docker-compose.db.yml up -d
```

**Codex 指令示例：**

> 在仓库根目录下创建 `docker-compose.db.yml`，内容为一个 Postgres 15 服务（用户 cliproxy / 密码 cliproxy / 数据库 cliproxy_mgmt），并启动该服务。

---

### Task 2.2：在 Next 项目中配置数据库连接

在 `next-app/.env.local` 中添加：

```env
DATABASE_URL="postgresql://cliproxy:cliproxy@localhost:5432/cliproxy_mgmt?schema=public"

# CLIProxyAPI Management API
CLIPROXY_MANAGEMENT_BASE="http://localhost:8317/v0/management"
CLIPROXY_MANAGEMENT_KEY="your-management-key-here"
```

**Codex 指令示例：**

> 在 `next-app/.env.local` 中添加 `DATABASE_URL`、`CLIPROXY_MANAGEMENT_BASE`、`CLIPROXY_MANAGEMENT_KEY` 环境变量，Postgres 连接串指向本地 docker 实例。

---

### Task 2.3：接入 Prisma（使用 Postgres）

1. 安装依赖：

   ```bash
   cd next-app
   npm install @prisma/client
   npm install -D prisma
   ```

2. 初始化 Prisma：

   ```bash
   npx prisma init
   ```

3. 将 `prisma/schema.prisma` 的 provider 改为 `postgresql`，同时定义 usage 相关模型：

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model UsageEvent {
  id             String   @id @default(cuid())
  createdAt      DateTime @default(now())

  // 原始事件时间（从 /usage details.timestamp）
  eventTime      DateTime

  // 维度信息
  apiPath        String
  model          String
  proxyHost      String?   // 方便后续多实例管理

  // Token 细节
  inputTokens      Int
  outputTokens     Int
  reasoningTokens  Int
  cachedTokens     Int
  totalTokens      Int

  // 费用
  costUsd        Decimal   @db.Decimal(12, 6)

  // 用于去重，格式：proxyHost-apiPath-model-timestamp
  rawKey         String    @unique
}

// 可选：每日聚合表，后续做性能优化时再用到
model UsageDaily {
  id              String   @id @default(cuid())
  date            DateTime

  apiPath         String
  model           String
  proxyHost       String?

  totalRequests   Int
  inputTokens     Int
  outputTokens    Int
  reasoningTokens Int
  cachedTokens    Int
  totalTokens     Int

  costUsd         Decimal  @db.Decimal(12, 6)
}
```

4. 生成 client & 迁移：

```bash
npx prisma migrate dev --name init_usage_tables
npx prisma generate
```

5. 创建 `lib/db.ts`：

```ts
// next-app/lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

**Codex 指令示例：**

> 在 `next-app` 中集成 Prisma，使用 Postgres 作为 provider，定义 `UsageEvent` 和 `UsageDaily` 两个模型（包含 token 字段、costUsd、rawKey 去重字段），生成 client 并创建 `lib/db.ts` 用于全局复用 PrismaClient。

---

## 3. Management API 客户端封装

### Task 3.1：封装 CLIProxyAPI 管理端 HTTP 客户端

新建 `next-app/lib/cliproxy-client.ts`：

```ts
// lib/cliproxy-client.ts
const MANAGEMENT_BASE =
  process.env.CLIPROXY_MANAGEMENT_BASE ??
  'http://localhost:8317/v0/management';

const MANAGEMENT_KEY = process.env.CLIPROXY_MANAGEMENT_KEY;

if (!MANAGEMENT_KEY) {
  console.warn('CLIPROXY_MANAGEMENT_KEY is not set');
}

async function callManagement(path: string, init: RequestInit = {}) {
  const res = await fetch(`${MANAGEMENT_BASE}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${MANAGEMENT_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(
      `Management API error: ${res.status} ${res.statusText}`,
    );
  }
  return res.json();
}

export async function fetchUsageRaw() {
  return callManagement('/usage');
}

// 后续可以扩展：fetchConfig, updateConfig, fetchLogs, etc.
```

**Codex 指令示例：**

> 在 `next-app/lib` 下创建 `cliproxy-client.ts`，封装对 `CLIPROXY_MANAGEMENT_BASE` 的调用，并暴露 `fetchUsageRaw()` 函数从 `/usage` 获取原始使用数据。

---

## 4. 模型计价逻辑（token → 费用）

### Task 4.1：实现 `pricing.ts`

新建 `next-app/lib/pricing.ts`，维护模型价格表（示例使用 OpenAI 模型，你可以按自己情况调整，价格参考官方文档）：([GitHub][2])

```ts
// lib/pricing.ts
export type ModelPricing = {
  inputPerMillion: number;
  outputPerMillion: number;
};

const PRICING: Record<string, ModelPricing> = {
  'gpt-4.1-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'gpt-4.1': { inputPerMillion: 5.0, outputPerMillion: 15.0 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  // TODO: 根据 CLIProxyAPI 中实际使用模型继续补充
};

export function calcCostUsd(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
}): number {
  const cfg = PRICING[params.model];
  if (!cfg) return 0;

  const input =
    (params.inputTokens / 1_000_000) * cfg.inputPerMillion;
  const output =
    (params.outputTokens / 1_000_000) * cfg.outputPerMillion;

  return Number((input + output).toFixed(6));
}
```

**Codex 指令示例：**

> 创建 `lib/pricing.ts`，定义 `ModelPricing` 类型、模型价格表和 `calcCostUsd` 函数，按输入/输出 token 数量计算美元成本。

---

## 5. /usage 数据采集与持久化

### Task 5.1：解析 /usage JSON 并写入 UsageEvent

> 说明：/usage 的结构在 MANAGEMENT_API 文档中给出，大致为：
> `usage.apis[apiPath].models[model].details[]`，每个 detail 有 `timestamp` 和 `tokens`（`input_tokens` / `output_tokens` / `reasoning_tokens` / `cached_tokens` / `total_tokens`）。形态可能略有变动，以实际接口为准。

在 `next-app/lib/usage-ingest.ts` 中实现：

```ts
// lib/usage-ingest.ts
import { prisma } from './db';
import { fetchUsageRaw } from './cliproxy-client';
import { calcCostUsd } from './pricing';

export async function ingestUsageFromProxy(proxyHost: string) {
  const payload = await fetchUsageRaw();
  const usage = payload.usage;
  if (!usage || !usage.apis) return;

  const events: {
    rawKey: string;
    eventTime: Date;
    apiPath: string;
    model: string;
    proxyHost: string;
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    cachedTokens: number;
    totalTokens: number;
    costUsd: number;
  }[] = [];

  for (const [apiPath, apiStats] of Object.entries<any>(usage.apis)) {
    for (const [model, modelStats] of Object.entries<any>(
      apiStats.models || {},
    )) {
      const details = modelStats.details || [];
      for (const d of details) {
        const ts: string = d.timestamp;
        const t = d.tokens || {};

        const inputTokens = t.input_tokens ?? 0;
        const outputTokens = t.output_tokens ?? 0;
        const reasoningTokens = t.reasoning_tokens ?? 0;
        const cachedTokens = t.cached_tokens ?? 0;
        const totalTokens = t.total_tokens ?? 0;

        const costUsd = calcCostUsd({
          model,
          inputTokens,
          outputTokens,
        });

        const rawKey = `${proxyHost}-${apiPath}-${model}-${ts}`;

        events.push({
          rawKey,
          eventTime: new Date(ts),
          apiPath,
          model,
          proxyHost,
          inputTokens,
          outputTokens,
          reasoningTokens,
          cachedTokens,
          totalTokens,
          costUsd,
        });
      }
    }
  }

  for (const e of events) {
    try {
      await prisma.usageEvent.create({ data: e });
    } catch (err: any) {
      // 利用 rawKey 唯一约束避免重复
      if (!String(err.message).includes('Unique constraint')) {
        console.error('insert UsageEvent failed', err);
      }
    }
  }
}
```

**Codex 指令示例：**

> 创建 `lib/usage-ingest.ts`，编写 `ingestUsageFromProxy(proxyHost: string)`，从 `fetchUsageRaw()` 拿到的 JSON 中遍历 `usage.apis[apiPath].models[model].details[]`，解析 token 字段和时间，用 `calcCostUsd` 计算费用，并写入 Prisma 的 `UsageEvent`，通过 `rawKey` 去重。

---

### Task 5.2：提供一个手动触发的 Ingest API

在 `next-app/app/api/usage/ingest/route.ts`：

```ts
// app/api/usage/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ingestUsageFromProxy } from '@/lib/usage-ingest';

export async function POST(req: NextRequest) {
  const proxyBase =
    process.env.CLIPROXY_MANAGEMENT_BASE ??
    'http://localhost:8317/v0/management';

  const url = new URL(proxyBase);
  const proxyHost = url.host; // 仅用于记录

  await ingestUsageFromProxy(proxyHost);

  return NextResponse.json({ ok: true });
}
```

现在你可以：

```bash
curl -X POST http://localhost:3000/api/usage/ingest
```

来同步一次 usage 到数据库。

**Codex 指令示例：**

> 在 `app/api/usage/ingest/route.ts` 中实现 POST 处理器，调用 `ingestUsageFromProxy` 并返回 `{ ok: true }` 的 JSON 响应。

---

## 6. 给图表用的 Usage 查询 API

### Task 6.1：实现 `/api/usage` 聚合接口

在 `next-app/app/api/usage/route.ts`：

```ts
// app/api/usage/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const from = searchParams.get('from'); // ISO 字符串
  const to = searchParams.get('to');
  const model = searchParams.get('model');
  const apiPath = searchParams.get('apiPath');

  const where: any = {};
  if (from || to) {
    where.eventTime = {};
    if (from) where.eventTime.gte = new Date(from);
    if (to) where.eventTime.lte = new Date(to);
  }
  if (model) where.model = model;
  if (apiPath) where.apiPath = apiPath;

  // 按日期聚合
  const rows = await prisma.$queryRaw<
    {
      date: string;
      totalTokens: number;
      cachedTokens: number;
      costUsd: number;
      requestCount: number;
    }[]
  >`
    SELECT
      DATE("eventTime") AS date,
      SUM("totalTokens") AS "totalTokens",
      SUM("cachedTokens") AS "cachedTokens",
      SUM("costUsd")::float AS "costUsd",
      COUNT(*) AS "requestCount"
    FROM "UsageEvent"
    WHERE
      (${from}::timestamp IS NULL OR "eventTime" >= ${from}::timestamp)
      AND (${to}::timestamp IS NULL OR "eventTime" <= ${to}::timestamp)
      AND (${model}::text IS NULL OR "model" = ${model})
      AND (${apiPath}::text IS NULL OR "apiPath" = ${apiPath})
    GROUP BY DATE("eventTime")
    ORDER BY DATE("eventTime")
  `;

  return NextResponse.json({ data: rows });
}
```

> 说明：也可以使用 Prisma 的 `groupBy`，这里用原生 SQL 是因为 Postgres 上的日期聚合比较直接。

**Codex 指令示例：**

> 在 `app/api/usage/route.ts` 中实现 GET 处理器，支持 `from`, `to`, `model`, `apiPath` 查询参数，按日期聚合 `UsageEvent`，返回每天的 `totalTokens`, `cachedTokens`, `costUsd`, `requestCount`。

---

## 7. 前端布局与导航迁移

### Task 7.1：定义主布局和侧边导航

在 `next-app/app/layout.tsx` 中：

* 使用 shadcn 的 `Sidebar`/`Button`/`ThemeToggle`（可自建）
* 从原项目的导航结构迁移菜单项：Dashboard、基础设置、Keys & Providers、Auth Files、Logs、Usage、Config、System 等([GitHub][1])

示意：

```tsx
// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import { Sidebar } from '@/components/layout/sidebar';

export const metadata: Metadata = {
  title: 'CLIProxy Management Center',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex">
        <Sidebar />
        <main className="flex-1 bg-background text-foreground">
          {children}
        </main>
      </body>
    </html>
  );
}
```

`components/layout/sidebar.tsx` 按原 UI 的菜单结构实现。

**Codex 指令示例：**

> 在 `next-app` 中创建统一布局：`app/layout.tsx` + `components/layout/sidebar.tsx`，侧边栏包含 Dashboard、Settings、Providers、Auth Files、Logs、Usage、Config、System 等导航项，样式使用 shadcn/ui 组件。

---

## 8. Usage 页面：更丰富的图表与统计

这是你这次重构的重头戏。

### Task 8.1：Usage 页面骨架

`app/usage/page.tsx`：

```tsx
// app/usage/page.tsx
import { UsageSummaryCards } from '@/components/usage/usage-summary-cards';
import { UsageFilters } from '@/components/usage/usage-filters';
import { UsageMainChart } from '@/components/charts/usage-main-chart';
import { UsageModelBarChart } from '@/components/charts/usage-model-bar-chart';

export default function UsagePage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usage Analytics</h1>
      </div>

      <UsageFilters />

      <UsageSummaryCards />

      <div className="grid gap-6 md:grid-cols-2">
        <UsageMainChart />
        <UsageModelBarChart />
      </div>
    </div>
  );
}
```

---

### Task 8.2：筛选控件（时间 & 模型）

`components/usage/usage-filters.tsx`：

* 时间区间：使用 shadcn 的日期选择器（或简单 Input + type="date"）
* 模型选择：`Select` 或 `Combobox`
* 变化时更新 URL search params，前端根据 query 参数去请求 `/api/usage`

**Codex 指令示例：**

> 创建 `UsageFilters` 组件，包含时间区间选择和模型选择，变更时更新前端状态并在调用 `/api/usage` 时带上 `from`, `to`, `model` 参数。

---

### Task 8.3：汇总卡片（总 token / 费用 / 缓存节省）

`components/usage/usage-summary-cards.tsx`：

* 从 `/api/usage` 拿到的数据进行二次聚合：

  * 总 `totalTokens`
  * 总 `cachedTokens`
  * 总 `costUsd`
  * 缓存节省百分比 = `cachedTokens / (cachedTokens + totalTokens)`（约等于原始理论总量）

用 shadcn 的 `Card` 展示几个 KPI 卡片。

**Codex 指令示例：**

> 创建 `UsageSummaryCards` 组件，从 `/api/usage` 获取的数据中计算总 token、总缓存 token、总费用，并显示为三个统计卡片。

---

### Task 8.4：主折线图：token + 缓存 + 费用

`components/charts/usage-main-chart.tsx`：

* 使用 shadcn chart 封装 / 或直接用 `recharts`：

  * X 轴：日期
  * 左 Y 轴：`totalTokens`, `cachedTokens`
  * 右 Y 轴：`costUsd`

示例（用 `recharts`）：

```tsx
'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/card';

type UsagePoint = {
  date: string;
  totalTokens: number;
  cachedTokens: number;
  costUsd: number;
};

export function UsageMainChart() {
  const [data, setData] = useState<UsagePoint[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/usage');
      const json = await res.json();
      setData(json.data);
    })();
  }, []);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Token & Cache & Cost
        </h2>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="totalTokens"
              name="Total Tokens"
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="cachedTokens"
              name="Cached Tokens"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="costUsd"
              name="Cost (USD)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
```

**Codex 指令示例：**

> 创建 `UsageMainChart` 组件，使用 `recharts` 或 shadcn chart 封装，把 `/api/usage` 返回的 `date`, `totalTokens`, `cachedTokens`, `costUsd` 画成双 Y 轴折线图。

---

### Task 8.5：模型维度柱状图 / 表格

为了「更丰富」：

* 梯度 1：柱状图按模型展示当前筛选区间内各模型的总 token / 费用
* 梯度 2：下方一个 `Table`，展示：

  * model
  * totalTokens
  * cachedTokens
  * costUsd
  * requestCount

可以基于 `/api/usage` 再补一个 `/api/usage/by-model` 接口（复用 `UsageEvent` 表的聚合），这里就不展开代码细节了，逻辑类似第 6 步的聚合。

**Codex 指令示例：**

> 增加 `/api/usage/by-model` 接口，按模型聚合 UsageEvent，返回每个模型在当前筛选条件下的总 token、缓存 token 和总费用。创建 `UsageModelBarChart` + `UsageModelTable` 组件展示这些数据。

---

## 9. 老功能页面的迁移路线图

Usage 部分是新增 &重构，其他功能基本是「1:1 迁移 + UI 升级」。可以按照如下阶段安排：

### Task 9.1：登录页 & 管理地址探测

* 查看旧项目中 `app.js` / `src` 下负责：

  * 管理地址自动探测
  * 管理 key 输入 & 验证
  * 本地存储加密逻辑（localStorage）
* 在 Next 中实现：

  * `app/login/page.tsx`：表单 + 状态
  * `lib/storage.ts`：把加密存储逻辑迁移过来（或者用更简单的加密方案）
  * 全局 `AuthContext` 或基于 cookie/session 的登陆态

**Codex 指令示例：**

> 阅读老项目 `app.js` 中处理登录和管理地址探测的代码，将该逻辑拆分为 `lib/management-address.ts` 和 `app/login/page.tsx` 的表单逻辑，实现加密 localStorage 存储与自动登录。

---

### Task 9.2：基础设置、Providers、Auth Files、Logs、Config、System…

可以按模块拆分：

1. **Settings / Providers**

   * 映射旧的「Basic Settings」 & 「Keys & Providers」逻辑到 `app/settings/*`
   * 使用 shadcn 的 `Form`、`Table`、`Dialog` 来管理 form 和列表

2. **Auth Files & OAuth**

   * 旧项目是对 Management API 上传/下载 JSON 凭证
   * 新项目中做成支持分页、搜索、类型过滤的表格 + 上传弹窗

3. **Logs**

   * 保留旧项目轮询 `/logs` 的逻辑
   * 可用 `Server Actions` 或前端轮询实现
   * 可以追加简单的关键字过滤 UI

4. **Config 编辑器**

   * 旧项目用 CodeMirror，在 Next 中可以继续使用 React 版 CodeMirror
   * `app/config/page.tsx`：调用 Management API 的 `/config.yaml` GET/PUT
   * 保留保存/重载按钮和状态提示

5. **System Info & Preferences**

   * 新项目用 shadcn Card 展示 server version、build date、UI version 等信息（从原接口读取）([GitHub][1])
   * 主题/语言偏好可以保留在 localStorage 或 cookie

**Codex 指令示例总模板：**

> 对于老项目中每一个导航模块（Basic Settings、Keys & Providers、Auth Files、Logs、Config、System），按以下步骤迁移：
>
> 1. 查找老项目 `app.js` 和 `src/` 下与该模块相关的 DOM 和逻辑代码。
> 2. 将 DOM 模板翻译为 React + shadcn 组件结构，创建对应的 `app/<模块>/page.tsx`。
> 3. 将调用 Management API 的 fetch 逻辑提取为 `lib/<模块>-service.ts`。
> 4. 保持与老 UI 相同的字段和交互行为，并改用 TypeScript 声明数据类型。

---

## 10. 渐进式替换与收尾

### Task 10.1：为新 Next-app 添加独立启动命令

在仓库根目录添加一个新的 `package.json` 或在当前基础上追加 script：

```jsonc
{
  "scripts": {
    "dev-next": "cd next-app && next dev",
    "build-next": "cd next-app && next build",
    "start-next": "cd next-app && next start"
  }
}
```

### Task 10.2：联调流程

1. 启动 CLIProxyAPI 服务（≥6.5.0）([GitHub][3])
2. 启动 Postgres docker
3. 启动 Next app：

   ```bash
   npm run dev-next
   ```
4. 使用 curl 或前端按钮调用 `/api/usage/ingest`，确认 `UsageEvent` 表有数据
5. 打开 `http://localhost:3000/usage`，确认图表显示正常、费用计算合理

---

## 11. 总结：这次重构完成后的能力

完成以上 Task，大致会得到：

* ✅ 一个基于 **Next.js + TS + shadcn** 的现代管理面板
* ✅ 使用数据从 **CLIProxyAPI /usage** 定期拉取 → **Postgres 持久化**
* ✅ Usage 页面可以按时间/模型/API 维度展示：

  * 实际消耗的 token（input/output/reasoning/total）
  * 缓存命中的 token（`cached_tokens`）
  * 对应的美元花费
  * 缓存节省比例和金额
* ✅ 旧有功能（登录、设置、Keys/Providers、Auth Files、Logs、Config、System）逐步迁移到新的路由结构中，UI 更统一、更易扩展

---