---
schema: plan_expertA_v1
task:
  name: "src→next-app 功能全量迁移"
  dir: "feature/src→next-app 功能全量迁移"
batch:
  id: "1"
meta:
  timestamp: "2025-12-29 10:12"
  author: "expertA"
  stance: "for"
---

# Expert A Plan (Implementation-First) — OAuth 登录中心增量 / Batch 1

## Verdict on Baseline
- 路线可落地：新增独立 `/oauth` 页面更符合旧模块颗粒度与 UI v4 √，不污染 `/settings/providers` 的简版体验。
- 复用优先：继续复用现有 `GET /api/providers/oauth-url` 与 `GET /api/providers/oauth-status`；仅新增 `POST /api/providers/iflow-cookie` 覆盖旧版 Cookie 登录。
- 风险集中在轮询：必须把 2s 轮询、5min 超时、error 后 3s reset、切换 confirm、unmount stop polling 全部收敛到 `useOAuthFlow`，避免状态串扰与幽灵请求。
- 安全必须硬约束：state/cookie 仅内存态，不持久化，不写日志；浏览器仅请求 Next `/api/*`。

## DATA_STRUCTURES
- `next-app/components/oauth/types.ts` / `OAuthProvider` — `"codex"|"anthropic"|"antigravity"|"gemini-cli"|"qwen"|"iflow"`
- `next-app/components/oauth/types.ts` / `OAuthPhase` — `"idle"|"generating"|"polling"|"success"|"error"|"timeout"`
- `next-app/components/oauth/types.ts` / `OAuthFlow` — `{ provider,url,state,phase,startedAt,deadlineAt,errorMessage? }`
- `next-app/components/oauth/types.ts` / `OAuthUrlResult` — `ApiResult<{ provider,url,state:null|string }>`
- `next-app/components/oauth/types.ts` / `OAuthStatusResult` — `ApiResult<{ status:"ok"|"wait"|"error"; error?:string }>`
- `next-app/components/oauth/types.ts` / `IflowCookiePayload` — `{ cookie: string }`
- `next-app/components/oauth/types.ts` / `IflowCookieResult` — `ApiResult<{ email?; expired?; path?; type?; [k:string]:unknown }>`
- `next-app/components/oauth/use-oauth-flow.ts` / `PollingPolicy` — `{ intervalMs:2000; timeoutMs:300000; errorResetMs:3000 }`

## FILE_CHANGES
- `next-app/app/oauth/page.tsx` (add) — OAuth 登录中心页面（ProviderGrid + AuthFlowPanel + iFlow Advanced）
- `next-app/components/oauth/types.ts` (add) — provider/phase/result 类型与常量（驱动 UI）
- `next-app/components/oauth/use-oauth-flow.ts` (add) — 状态机 + 轮询/超时 + cleanup（含 AbortController）
- `next-app/components/oauth/provider-grid.tsx` (add) — Provider 卡片栅格 + 切换 confirm
- `next-app/components/oauth/auth-flow-panel.tsx` (add) — URL/Copy/Open + 状态 Badge/倒计时/重试/成功 CTA
- `next-app/components/oauth/iflow-cookie-login.tsx` (add) — Cookie 校验/提交/结果字段展示（仅 iFlow）
- `next-app/app/api/providers/iflow-cookie/route.ts` (add) — 代理 POST management `/iflow-auth-url`（JSON `{cookie}`）
- `next-app/components/i18n-context.tsx` (modify) — 新增 `oauth.*` 文案 key（en/zh）
- `next-app/components/layout/sidebar.tsx` (modify, optional) — 增加 `/oauth` 导航入口（保持旧颗粒度）
- `next-app/app/settings/providers/page.tsx` (modify, optional) — 增加“打开 OAuth 登录中心”快捷入口

## IMPLEMENTATION_CHECKLIST
- [ ] 1) 新增 `/oauth` 页面骨架并按 v4 √ 两列布局组装（files: `next-app/app/oauth/page.tsx`）
- [ ] 2) 定义 OAuth 类型与 Provider 配置表（URL/Cookie tags）（files: `next-app/components/oauth/types.ts`）
- [ ] 3) 实现 `useOAuthFlow`：统一管理 phase/url/state/error/deadline（files: `next-app/components/oauth/use-oauth-flow.ts`）
- [ ] 4) 生成 URL：GET `/api/providers/oauth-url?provider=...`，按 `ApiResult<T>` 解析并处理 `.error`（files: `next-app/components/oauth/use-oauth-flow.ts`）
- [ ] 5) state 缺失：直接进入 error（不启动轮询），给出可复制诊断（files: `next-app/components/oauth/auth-flow-panel.tsx`）
- [ ] 6) 轮询实现：串行 `setTimeout`（不重叠）+ AbortController；2s 一次（files: `next-app/components/oauth/use-oauth-flow.ts`）
- [ ] 7) stop 条件：ok/error/timeout/手动取消/切换 provider 均 stopPolling（files: `next-app/components/oauth/use-oauth-flow.ts`）
- [ ] 8) 超时 5min：到期进入 timeout，停止轮询并提示重试（files: `next-app/components/oauth/use-oauth-flow.ts`）
- [ ] 9) error→3s reset：展示错误摘要后自动 reset；新 start/切换/手动 reset 必须清理旧 timer（files: `next-app/components/oauth/use-oauth-flow.ts`）
- [ ] 10) ProviderGrid：进行中切换 provider 弹 confirm；确认后 stop+reset 再切换（files: `next-app/components/oauth/provider-grid.tsx`）
- [ ] 11) AuthFlowPanel：URL 单行展示 + Copy/Open + WAIT/OK/ERROR/TIMEOUT（含倒计时/进度）（files: `next-app/components/oauth/auth-flow-panel.tsx`）
- [ ] 12) 成功闭环：成功 CTA 跳转 `/auth-files`（可选“复制状态信息”）（files: `next-app/components/oauth/auth-flow-panel.tsx`）
- [ ] 13) iFlow Cookie UI：仅 iflow 展示；必填校验；提交中禁用；提交后清空输入（files: `next-app/components/oauth/iflow-cookie-login.tsx`）
- [ ] 14) 新增 Cookie API：POST `/api/providers/iflow-cookie` 代理管理端 POST `/iflow-auth-url`（files: `next-app/app/api/providers/iflow-cookie/route.ts`）
- [ ] 15) Cookie 安全：不记录 cookie；错误不回显敏感内容；返回统一 `ApiResult`（files: `next-app/app/api/providers/iflow-cookie/route.ts`）
- [ ] 16) i18n：补齐 oauth 页全部文案（en/zh）（files: `next-app/components/i18n-context.tsx`）
- [ ] 17) Unmount cleanup：离开 `/oauth` 不再轮询（files: `next-app/components/oauth/use-oauth-flow.ts`）
- [ ] 18) 文档与证据：回写实现方案增量 + 打包 Batch 1 证据（files: `feature/src→next-app 功能全量迁移/实现方案.md`，`feature/src→next-app 功能全量迁移/plan/batch-1/*`）

## VERIFICATION_CHECKLIST
- [ ] V1 `/oauth` 可访问；暗色主题可读；移动端无横向滚动
- [ ] V2 生成 URL：各 provider 能返回 url/state；Copy/Open 可用
- [ ] V3 轮询：约每 2s 请求一次；ok/error/timeout 任一出现即停止轮询
- [ ] V4 timeout：5min 到期进入 timeout 并可重试（可临时缩短 timeout 验证）
- [ ] V5 error：展示错误并在 ~3s 后自动 reset 回 idle
- [ ] V6 切换 provider：进行中必须 confirm；取消不丢状态；确认清理旧轮询
- [ ] V7 重置：进行中必须 confirm；确认后清空并停止轮询
- [ ] V8 离开页面：Network 不再出现 oauth-status 请求（无幽灵轮询）
- [ ] V9 iFlow Cookie：空值校验生效；提交成功展示 email/expired/path/type 等字段
- [ ] V10 安全：浏览器 Network 仅 `/api/*`；无 `CLIPROXY_MANAGEMENT_KEY`/Authorization 泄漏
- [ ] V11 i18n：en/zh 切换覆盖 OAuth 页主要文案

## RISKS_AND_ROLLBACK
- R1 iFlow cookie 返回字段不稳定：宽松渲染 + 已知字段优先
- R2 轮询重叠/幽灵请求：串行轮询 + abort + cleanup 强制 stop
- R3 provider 切换串扰：切换前 confirm 并 reset；旧 state 不再轮询
- R4 敏感信息泄漏：禁止持久化/禁止日志输出/错误脱敏
- R5 timeout 体验不一致：统一 PollingPolicy 常量并驱动倒计时展示
- R6 新代理路由异常：可临时隐藏 iFlow Advanced 区（不影响 URL OAuth）
- R7 UI 风格不一致：复用现有 shadcn/ui Card/Button/Badge 与 Tailwind tokens
- R8 providers 页回归：保持原逻辑不动，仅可选增加链接

## Deep Dive Top5 (optional)
1) `next-app/components/oauth/use-oauth-flow.ts` / `stopPolling` — 三清：clearInterval/clearTimeout/abort in-flight
2) `next-app/app/api/providers/iflow-cookie/route.ts` / `POST` — zod 校验 + 错误脱敏 + 不回显 cookie
3) `next-app/components/oauth/auth-flow-panel.tsx` / `renderStatus` — WAIT/OK/ERROR/TIMEOUT 统一映射与可复制诊断
4) `next-app/components/oauth/provider-grid.tsx` / `onSelectProvider` — confirm 丢状态 + reset 竞态清理
5) `next-app/components/i18n-context.tsx` / `oauth.*` — 文案 key 粒度与复用（common.* 可抽取）

