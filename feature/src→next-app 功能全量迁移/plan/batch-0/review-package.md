---
schema: review_package_v2
task:
  name: "src→next-app 功能全量迁移"
  dir: "feature/src→next-app 功能全量迁移"
batch:
  id: "0"
meta:
  timestamp: "2025-12-26 14:40"
  owner: "主人"
goal:
  summary: "将旧版 src 静态 WebUI 剩余能力（settings/keys/providers/auth-files/config/system/oauth/login 等）迁移到 next-app，统一入口与架构边界，并提升 UI/交互与 i18n 完整度。"
scope:
  in:
    - "补齐 next-app 缺失路由：/login、/settings、/settings/providers、/auth-files、/config、/system（避免侧边栏断链）"
    - "迁移旧版 settings/api-keys/ai-providers/auth-files/config/system/oauth/login 等模块到 next-app（等价能力）"
    - "统一数据访问边界：优先 server-only 代理访问 management API；允许 Next 增加 API+DB（B）"
    - "统一 UI 与交互：完善 loading/empty/error/confirm/disabled；文案全量 i18n（en/zh）"
  out:
    - "删除旧版 src（按主人要求保留但不作为入口）"
    - "引入账号/角色权限体系（本任务不做）"
    - "改动后端管理 API 语义/权限规则（本任务不做）"
acceptance_criteria:
  - id: "AC1"
    text: "next-app 覆盖旧版 src 剩余模块能力（按旧侧边栏颗粒度），且侧边栏无断链。"
    verify: "手动逐页验证：/login、/settings、/settings/providers、/auth-files、/config、/system；现有 /usage /logs /pipeline /pricing 不回归。"
  - id: "AC2"
    text: "管理密钥默认不暴露到客户端；页面通过 Next /api/* 访问后端管理 API。"
    verify: "代码审查：数据访问集中在 next-app/app/api/* 与 next-app/lib/*；客户端请求不携带明文 key；运行期通过 env 注入。"
  - id: "AC3"
    text: "新增/修改用户可见文案全部 i18n 化（en/zh），无新增硬编码。"
    verify: "代码审查 + 手动切换语言：页面标题/按钮/提示/错误信息均随语言切换。"
constraints:
  tech_stack: "Next.js App Router + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui + Prisma(Postgres)"
  dependencies:
    forbidden:
      - "第二套 UI 框架（如 AntD/MUI 全量引入）"
    allowed:
      - "复用 next-app 现有依赖（Radix/shadcn/ui、recharts、zod、prisma 等）"
  performance:
    - "日志/列表类页面避免一次性渲染过多 DOM；需要 limit/分页/增量策略"
  code_rules:
    max_single_file_lines: 600
  security:
    - "敏感密钥默认仅存在于服务端 env；避免落库与前端暴露"
current_state:
  pain_points:
    - "双入口/双实现，功能割裂，维护与使用成本高"
    - "Next 侧边栏已有导航但缺页面，存在断链"
    - "数据访问边界不统一，存在把密钥推到前端的风险"
data:
  entities:
    - "Settings（debug/proxy-url/request-retry/...）"
    - "API Keys"
    - "Provider Keys（gemini/codex/claude/openai-compatibility）"
    - "Auth Files（含 stats）"
    - "Config 文本/YAML"
    - "System 信息（版本/连接状态）"
apis:
  endpoints:
    - "/debug"
    - "/proxy-url"
    - "/request-retry"
    - "/usage-statistics-enabled"
    - "/request-log"
    - "/ws-auth"
    - "/logging-to-file"
    - "/quota-exceeded/*"
    - "/api-keys"
    - "/auth-files"
    - "/usage"
    - "/logs"
    - "/gemini-api-key"
    - "/codex-api-key"
    - "/claude-api-key"
    - "/openai-compatibility"
    - "/codex-auth-url / anthropic-auth-url / gemini-cli-auth-url / qwen-auth-url / iflow-auth-url ..."
open_questions:
  - "旧版 login 的“自定义 base/key”能力在 Next 版是否需要保留（默认采用服务端 env；如需临时覆盖如何安全落地）？"
  - "旧静态 UI 入口如何在部署侧下线（不删除代码，仅切换默认入口）？"
---

# 方案评审包（Review Package）— src→next-app 功能全量迁移 / Batch 0

## 1. 目标（Goals）
- 目标1：next-app 覆盖旧版 src 剩余模块能力（同颗粒度），并保持现有 next-app 模块不回归。
- 目标2：统一入口到 next-app；旧 src 保留但不作为入口。
- 目标3：UI/交互与 i18n 质量达到可长期维护的标准（统一风格 + 完整状态 + 无硬编码）。

## 2. 范围
### In Scope
- 补齐 Next 路由与页面骨架（/login、/settings、/settings/providers、/auth-files、/config、/system）。
- 接入 management API 的读写能力，并封装为 Next API route（server-only）。
- 把旧版模块能力迁移为 Next 页面/组件（保持“功能颗粒度”）。
### Out of Scope
- 删除旧 src 静态 UI（不做）。
- 引入账号/权限系统（不做）。

## 3. 验收标准（可验证）
- [ ] AC1 路由补齐 + 等价能力 + 无断链
- [ ] AC2 密钥不落前端（server-only 访问 management API）
- [ ] AC3 i18n 全覆盖（en/zh，无硬编码）

## 4. 现状与痛点（带证据锚点）
| 问题 | 影响 | 证据锚点（路径+符号/位置） | 备注 |
|---|---|---|---|
| Next 侧边栏有导航但缺页面 | 断链/用户不可用 | `next-app/components/layout/sidebar.tsx` + `next-app/app/` 路由目录缺失 | 需优先补齐骨架 |
| 旧版仍承载关键能力 | 双维护成本高 | `index.html` + `src/modules/*` | 以旧侧边栏颗粒度为迁移基线 |
| 密钥/数据边界易跑偏 | 安全风险/实现反复 | `next-app/lib/cliproxy-client.ts`（server env） vs 旧版浏览器存储 | 迁移期需统一策略 |

## 5. 关键约束
- 技术栈/依赖：Next.js App Router + Tailwind + shadcn/ui；尽量复用现有依赖，避免引入第二套 UI 框架。
- 性能/体验：日志与列表类页面必须有分页/limit/增量策略；交互反馈完整（toast/confirm/disabled）。
- 单文件>600行拆分规则：页面层只做编排；复杂逻辑下沉到 `lib/` / 复用组件，必要时拆成模块目录。
- 权限/安全：无账号体系；管理密钥默认只存在于服务端 env，不落库、不暴露到客户端。
- 其他：未获得《实现方案.md》“主人确认”前，不进入业务实现阶段。

## 6. 数据对象/状态流（草案）
- 实体：Settings / API Keys / Provider Keys / Auth Files / Config / System Info / Logs / Usage
- 状态：loading / empty / error / success + confirm（危险操作）+ dirty（config editor）
- 关键边界：management API 调用失败必须可恢复；长列表/长日志必须有上限与增量；i18n 无硬编码

## 7. 未决问题（需要主人确认）
- Q1：旧版 login 的“自定义连接地址/管理密钥”是否在 Next 版保留为“开发模式能力”（默认 env）？
- Q2：入口切换的部署策略（仅文档说明 vs 同仓提供简单指引）？
