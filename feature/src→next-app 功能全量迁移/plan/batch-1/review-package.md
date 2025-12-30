---
schema: review_package_v2
task:
  name: "src→next-app 功能全量迁移"
  dir: "feature/src→next-app 功能全量迁移"
batch:
  id: "1"
meta:
  timestamp: "2025-12-29 10:12"
  owner: "主人"
goal:
  summary: "补齐旧版 src/modules/oauth.js 的 OAuth 登录中心界面到 next-app，并按 UI设计 Batch 1 v4 √ 落地更美观/更好用的交互。"
scope:
  in:
    - "新增 Next OAuth 登录中心页面（建议路由 `/oauth`，保持旧模块颗粒度）"
    - "覆盖 URL OAuth：生成 URL / Copy+Open / 轮询状态 / 5min 超时 / error 后 3s reset / success 引导到 Auth Files"
    - "覆盖 iFlow Cookie 登录：提交 cookie → 展示结果字段 → 成功引导"
    - "新增/补齐必要的 Next `/api/*` 代理路由（仅 server 侧调用 management API）"
    - "补齐 i18n key（en/zh）与导航入口（如需）"
  out:
    - "不引入账号体系/RBAC"
    - "不把 OAuth state/cookie 写入 localStorage/sessionStorage/数据库"
    - "不改后端 management API 语义（仅前端迁移与适配）"
acceptance_criteria:
  - id: "AC1"
    text: "OAuth 登录中心页面可完成 URL OAuth 全流程（WAIT/OK/ERROR/TIMEOUT），并覆盖 confirm/禁用/清理轮询等边界。"
    verify: "手动：选择 provider → 生成 URL → Copy/Open → 轮询直到 ok/error/timeout；切换 provider/重置时 confirm；离开页面不再轮询。"
  - id: "AC2"
    text: "iFlow Cookie 登录可提交/校验/展示结果字段（email/expired/path/type 等），失败可恢复。"
    verify: "手动：在 iFlow 下展开高级区，提交 cookie，观察成功/失败与结果字段展示；重复提交不串状态。"
  - id: "AC3"
    text: "安全边界正确：浏览器仅请求 Next `/api/*`，不直连 management API；不暴露 `CLIPROXY_MANAGEMENT_KEY`。"
    verify: "手动：浏览器 Network 面板检查请求；确认无明文 key/Authorization 泄漏。"
  - id: "AC4"
    text: "视觉与交互符合 UI设计 Batch 1 v4 √：暗色玻璃拟态 + shadcn/ui；状态反馈清晰（倒计时/进度/成功 CTA）。"
    verify: "手动：暗色主题下检查对比度与布局；移动端无横向滚动；成功后 CTA 明确。"
constraints:
  tech_stack: "Next.js App Router + React + TypeScript + Tailwind + shadcn/ui"
  dependencies:
    forbidden:
      - "引入新的 OAuth 前端 SDK（保持与后端 management API 合作的模式）"
    allowed:
      - "在 next-app 内新增少量通用组件/hook（<600 行拆分）"
  performance:
    - "轮询默认 2s；页面卸载必须清理 timer，避免幽灵请求"
  code_rules:
    max_single_file_lines: 600
  security:
    - "浏览器只打 Next `/api/*`；server-only 读取管理密钥"
    - "state/cookie 属于敏感信息：仅内存态，不持久化"
current_state:
  pain_points:
    - "Next 侧仅在 `/settings/providers` 提供简化 OAuth Tab，缺少旧版“登录中心”体验与边界处理"
    - "旧版 iFlow Cookie 登录能力未迁移"
data:
  entities:
    - "OAuthProvider（codex/anthropic/antigravity/gemini-cli/qwen/iflow）"
    - "OAuthFlowState（idle/generating/polling/success/error/timeout）"
    - "IflowCookieResult（email/expired/path/type/…）"
apis:
  endpoints:
    - "GET /api/providers/oauth-url?provider=...（已存在）"
    - "GET /api/providers/oauth-status?state=...（已存在）"
    - "POST /api/providers/iflow-cookie（待新增，代理 POST /iflow-auth-url）"
open_questions:
  - "是否需要在 Sidebar 增加独立入口 `/oauth`？（建议：需要，保持旧模块颗粒度）"
---

# 方案评审包（Review Package）— OAuth 登录中心增量 / Batch 1

## 1. 目标（Goals）
- 目标1：补齐旧版 OAuth 登录中心界面到 Next，并保持旧模块颗粒度（src 侧边栏级别）。
- 目标2：体验升级：更清晰的信息层级、更完整的边界状态、更好的成功闭环（Auth Files 引导）。
- 目标3：安全合规：前端只打 `/api/*`，敏感信息不持久化。

## 2. 范围
### In Scope
- 新增 `/oauth` 页面（或等价入口），按 UI v4 结构：ProviderGrid + AuthFlowPanel + iFlow Cookie 折叠高级区。
- URL OAuth：生成 URL / Copy/Open / 轮询 / 超时 / 错误恢复 / 切换确认 / 卸载清理。
- iFlow Cookie 登录：cookie 提交 + 结果展示 + 成功引导。
### Out of Scope
- 账号/权限系统
- DB 持久化 state/cookie

## 3. 验收标准（可验证）
- [ ] AC1 URL OAuth 全链路 + 边界齐全
- [ ] AC2 iFlow Cookie 登录可用且可恢复
- [ ] AC3 安全边界正确（仅 `/api/*`）
- [ ] AC4 UI/交互符合 Batch 1 v4 √

## 4. 现状与痛点（带证据锚点）
| 问题 | 影响 | 证据锚点（路径+符号/位置） | 备注 |
|---|---|---|---|
| Next 缺少 OAuth 登录中心体验 | 用户需要在 providers tab 手动理解流程，边界不齐 | `src/modules/oauth.js`（旧版 UI 行为基线） | 需要迁移 + 体验升级 |
| iFlow Cookie 登录未迁移 | 旧能力缺失 | `src/modules/oauth.js`（cookie login 段） | 需要新增 Next API 代理 |
| 轮询/超时/切换确认未统一 | 易出现幽灵轮询/状态串扰 | `next-app/app/settings/providers/page.tsx`（简化轮询） | 新页需用 hook 统一 |

## 5. 关键约束
- 技术栈/依赖：Next App Router + shadcn/ui + Tailwind（不引入新的 OAuth SDK）
- 性能/体验：轮询 2s；超时 5min；离开页面必须 stop polling
- 单文件>600行拆分规则：页面/组件/hook 拆分
- 权限/安全：密钥 server-only；state/cookie 不持久化；敏感提示可见

## 6. 数据对象/状态流（草案）
- 实体：OAuthProvider / OAuthFlowState / IflowCookieResult
- 状态：按 provider 隔离；切换 provider 需确认并清理当前流程
- 关键边界：timeout/error reset/unmount cleanup/confirm when losing state

## 7. 未决问题（需要主人确认）
- Q1：OAuth 登录中心入口是否采用独立路由 `/oauth` 并在 Sidebar 展示？（我建议：是）
- Q2：iFlow Cookie 登录是否必须在本增量一并落地？（我建议：是，旧版已具备）

