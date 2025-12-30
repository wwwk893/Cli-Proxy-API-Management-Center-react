---
schema: synthesis_final_v1
task:
  name: "src→next-app 功能全量迁移"
  dir: "feature/src→next-app 功能全量迁移"
batch:
  id: "1"
meta:
  timestamp: "2025-12-29 10:12"
  author: "codex"
---

# Final Synthesis — OAuth 登录中心增量 / Batch 1

## What We Will Build
- 目标概述：在 `next-app/` 新增独立 OAuth 登录中心页面（`/oauth`），补齐旧 `src/modules/oauth.js` 的登录中心体验：URL OAuth（生成/复制/打开/轮询/超时/失败恢复/成功引导）+ iFlow Cookie 登录（高级折叠区）。
- Non-goals：不引入账号/RBAC；不改后端 management API 语义；不把 state/cookie 持久化（localStorage/sessionStorage/DB 均禁止）。
- Done 定义：满足 `plan/batch-1/review-package.md` 的 AC1-AC4；浏览器 Network 仅 `/api/*`；轮询边界齐（2s/5min/3s reset/confirm/unmount cleanup）。

## DATA_STRUCTURES
- (1) `next-app/components/oauth/types.ts` / `OAuthProvider`
- (2) `next-app/components/oauth/types.ts` / `OAuthPhase`
- (3) `next-app/components/oauth/types.ts` / `OAuthFlow`（仅内存态，包含 `deadlineAt`）
- (4) `next-app/components/oauth/types.ts` / `OAuthUrlData`（对齐 `/api/providers/oauth-url`）
- (5) `next-app/components/oauth/types.ts` / `OAuthStatusData`（对齐 management `get-auth-status`）
- (6) `next-app/components/oauth/types.ts` / `IflowCookiePayload`
- (7) `next-app/components/oauth/types.ts` / `IflowCookieResult`（白名单字段 + 宽松扩展）
- (8) `next-app/components/oauth/use-oauth-flow.ts` / `PollingPolicy`

## FILE_CHANGES
- `next-app/app/oauth/page.tsx` (add) — OAuth 登录中心页面入口（组装 ProviderGrid/FlowPanel）
- `next-app/components/oauth/types.ts` (add) — OAuth 类型与 Provider 配置（URL/Cookie tags）
- `next-app/components/oauth/use-oauth-flow.ts` (add) — 状态机 + 串行轮询（setTimeout）+ deadline 超时（Date.now）+ abort/cleanup
- `next-app/components/oauth/provider-grid.tsx` (add) — Provider 卡片栅格 + 切换 confirm
- `next-app/components/oauth/auth-flow-panel.tsx` (add) — URL 展示/Copy/Open + 状态 Badge/倒计时/重试/成功 CTA
- `next-app/components/oauth/iflow-cookie-login.tsx` (add) — iFlow Cookie 登录（折叠高级区，必填校验/提交/结果展示）
- `next-app/app/api/providers/iflow-cookie/route.ts` (add) — 代理 `POST /iflow-auth-url`（cookie 不回显、不写日志）
- `next-app/components/layout/sidebar.tsx` (modify) — 增加 `/oauth` 导航入口（保持旧模块颗粒度）
- `next-app/components/i18n-context.tsx` (modify) — 增补 `oauth.*` 文案 key（en/zh）
- （可选）`next-app/app/settings/providers/page.tsx` (modify) — 增加“打开 OAuth 登录中心”快捷入口

## IMPLEMENTATION_CHECKLIST
- [ ] 1) 新增 `/oauth` 页面骨架与布局（files: `next-app/app/oauth/page.tsx`）
- [ ] 2) 定义 OAuth 类型与 Provider 配置表（files: `next-app/components/oauth/types.ts`）
- [ ] 3) 新增 Cookie API：POST `/api/providers/iflow-cookie`（zod 校验 + 错误脱敏）（files: `next-app/app/api/providers/iflow-cookie/route.ts`）
- [ ] 4) 实现 `useOAuthFlow`：phase/url/state/deadlineAt/error（files: `next-app/components/oauth/use-oauth-flow.ts`）
- [ ] 5) 生成 URL：按 `ApiResult<T>` 解析 `.error`；state 缺失进入 error（files: `next-app/components/oauth/use-oauth-flow.ts`）
- [ ] 6) 串行轮询：`setTimeout` + AbortController；2s 一次；ok/error/timeout 任一 stop（files: `next-app/components/oauth/use-oauth-flow.ts`）
- [ ] 7) deadline 超时：用 `Date.now()` 判断 5min（后台 tab 也可靠）（files: `next-app/components/oauth/use-oauth-flow.ts`）
- [ ] 8) error→3s reset：可取消 timer，避免竞态误伤新流程（files: `next-app/components/oauth/use-oauth-flow.ts`）
- [ ] 9) ProviderGrid：切换 provider/重置流程均需 confirm（files: `next-app/components/oauth/provider-grid.tsx`）
- [ ] 10) AuthFlowPanel：URL 单行展示 + Copy/Open + 状态/倒计时 + CTA（files: `next-app/components/oauth/auth-flow-panel.tsx`）
- [ ] 11) iFlow Cookie UI：必填/提交禁用/成功后清空输入/展示白名单字段（files: `next-app/components/oauth/iflow-cookie-login.tsx`）
- [ ] 12) 安全提示：URL 含 state 与 cookie 敏感提示可见（files: `next-app/components/oauth/auth-flow-panel.tsx`，`next-app/components/oauth/iflow-cookie-login.tsx`）
- [ ] 13) i18n：补齐 `oauth.*` en/zh（files: `next-app/components/i18n-context.tsx`）
- [ ] 14) Sidebar 增加入口并回归验证不影响现有页面（files: `next-app/components/layout/sidebar.tsx`）
- [ ] 15) 文档回写与门禁：把增量计划写入 `实现方案.md`，并生成本批次证据包（files: `feature/src→next-app 功能全量迁移/实现方案.md`）

## VERIFICATION_CHECKLIST
- [ ] V1 `/oauth` 可访问、暗色主题可读、移动端无横向滚动
- [ ] V2 生成 URL：各 provider 可生成 url/state；Copy/Open 可用
- [ ] V3 轮询：约 2s 一次且不重叠；ok/error/timeout 都会 stop
- [ ] V4 timeout：5min 到期进入 timeout 且可重试（可临时缩短 timeout 验证）
- [ ] V5 error：显示错误并在 ~3s 后自动 reset 回 idle
- [ ] V6 切换 provider/重置：进行中必须 confirm；取消不丢状态；确认清理旧轮询
- [ ] V7 离开页面：Network 不再出现 oauth-status 请求（无幽灵轮询）
- [ ] V8 iFlow Cookie：必填校验生效；提交成功展示 email/expired/path/type；不回显 cookie
- [ ] V9 安全：Network 仅 `/api/*`，无管理端 URL/Authorization/key 泄漏
- [ ] V10 i18n：en/zh 切换覆盖 OAuth 页主要文案

## RISKS_AND_ROLLBACK
- R1 轮询幽灵请求/重叠：串行轮询 + abort + cleanup；必要时降级为手动“检查状态”
- R2 后台 timer 降频导致超时不准：deadline 用 `Date.now()`；可选 `visibilitychange` 校准
- R3 3s reset 太快：必要时提供“暂停自动重置/手动重置”交互
- R4 iFlow cookie 字段漂移：白名单字段 + 宽松扩展展示；不因缺字段崩溃
- R5 敏感信息泄漏：禁止持久化与日志；错误脱敏；输入提交后清空
- R6 新增 `/oauth` 导航影响信息架构：回滚仅移除 sidebar 项；保留 `/settings/providers` 简版

## Diff From Plans
- 相比 baseline：采纳 expertB 的“串行轮询 + deadline( Date.now ) + abort + reset 可取消”，避免重叠与竞态。
- 相比专家意见的吸收点：保留 expertA 的“独立 `/oauth` + 复用现有 endpoints + 仅新增 iflow-cookie route + Provider 配置表驱动”。
