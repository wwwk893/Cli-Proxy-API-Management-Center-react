---
schema: plan_codex_v1
task:
  name: "src→next-app 功能全量迁移"
  dir: "feature/src→next-app 功能全量迁移"
batch:
  id: "1"
meta:
  timestamp: "2025-12-29 10:12"
  author: "codex"
---

# Codex Baseline Plan — OAuth 登录中心增量 / Batch 1

## Summary
- What：在 `next-app/` 新增独立 OAuth 登录中心页面（建议路由 `/oauth`），补齐旧 `src/modules/oauth.js` 的“登录中心”体验：URL OAuth（生成/复制/打开/轮询/超时/失败恢复/成功引导）+ iFlow Cookie 登录（高级折叠区）。
- Why：当前 Next 仅有 `/settings/providers` 的简化 OAuth Tab，缺少完整登录中心体验与边界处理；迁移后保持旧模块颗粒度并提升可用性。
- Success：满足 `review-package.md` 的 AC1-AC4（全链路、边界齐、安全、UI v4 √）。

## DATA_STRUCTURES
- (1) `next-app/components/oauth/types.ts` / `OAuthProvider` — `"codex"|"anthropic"|"antigravity"|"gemini-cli"|"qwen"|"iflow"`
- (2) `next-app/components/oauth/types.ts` / `OAuthFlowPhase` — `"idle"|"generating"|"polling"|"success"|"error"|"timeout"`
- (3) `next-app/components/oauth/types.ts` / `OAuthFlowState` — `{ provider; url; state; phase; startedAt; timeLeftSec; errorMessage? }`
- (4) `next-app/components/oauth/types.ts` / `OAuthUrlData` — `{ provider; url; state }`（对应 `/api/providers/oauth-url`）
- (5) `next-app/components/oauth/types.ts` / `OAuthStatusData` — `{ status: "ok"|"wait"|"error"; error?: string }`（对应 `/api/providers/oauth-status`）
- (6) `next-app/components/oauth/types.ts` / `IflowCookiePayload` — `{ cookie: string }`
- (7) `next-app/components/oauth/types.ts` / `IflowCookieResult` — `{ email?: string; expired?: string|boolean; path?: string; type?: string; [k:string]:unknown }`
- (8) `next-app/components/oauth/use-oauth-flow.ts` / `OAuthPollingConfig` — `{ pollIntervalMs=2000; timeoutMs=300000; errorResetMs=3000 }`

## FILE_CHANGES
- `next-app/app/oauth/page.tsx` (add) — OAuth 登录中心页面（PageHeader + 两列布局，移动端堆叠）
- `next-app/components/oauth/types.ts` (add) — OAuth 相关类型（provider/phase/result）
- `next-app/components/oauth/use-oauth-flow.ts` (add) — 状态机 + 轮询 + timeout + cleanup（页面卸载 stop polling）
- `next-app/components/oauth/provider-grid.tsx` (add) — Provider 卡片栅格（URL/Cookie tags，选中态）
- `next-app/components/oauth/auth-flow-panel.tsx` (add) — URL 显示/Copy/Open/状态 Badge/进度/倒计时/结果卡片
- `next-app/components/oauth/iflow-cookie-login.tsx` (add) — iFlow Cookie 登录折叠区（校验/提交/结果展示）
- `next-app/app/api/providers/iflow-cookie/route.ts` (add) — 代理 `POST /iflow-auth-url`（body `{cookie}`），返回 `ApiResult<IflowCookieResult>`
- `next-app/components/layout/sidebar.tsx` (modify) — 新增 `/oauth` 导航入口（保持旧模块颗粒度）
- `next-app/components/i18n-context.tsx` (modify) — 增补 `oauth.*` 文案 key（en/zh）
- （可选）`next-app/app/settings/providers/page.tsx` (modify) — OAuth Tab 增加“打开 OAuth 登录中心”快捷入口

## IMPLEMENTATION_CHECKLIST
- [ ] 1) 定稿路由与入口：采用 `/oauth` 并在 Sidebar 展示（files: `next-app/components/layout/sidebar.tsx`）
- [ ] 2) 新增 OAuth 类型定义（files: `next-app/components/oauth/types.ts`）
- [ ] 3) 实现 `useOAuthFlow`：状态机 + 2s 轮询 + 5min 超时 + error 3s reset + unmount cleanup（files: `next-app/components/oauth/use-oauth-flow.ts`）
- [ ] 4) ProviderGrid：卡片栅格（icon/name/tags），切换时若丢状态则 confirm（files: `next-app/components/oauth/provider-grid.tsx`）
- [ ] 5) AuthFlowPanel：生成 URL / Copy/Open / WAIT/OK/ERROR/TIMEOUT 展示 + 进度/倒计时（files: `next-app/components/oauth/auth-flow-panel.tsx`）
- [ ] 6) iFlow Cookie 登录 UI：Accordion + 必填校验 + 提交状态 + 结果字段展示（files: `next-app/components/oauth/iflow-cookie-login.tsx`）
- [ ] 7) 新增 Next API：`POST /api/providers/iflow-cookie` → 代理 management `POST /iflow-auth-url`（files: `next-app/app/api/providers/iflow-cookie/route.ts`）
- [ ] 8) 页面组装：`/oauth` page 组装 PageHeader + ProviderGrid + AuthFlowPanel + Cookie 区（files: `next-app/app/oauth/page.tsx`）
- [ ] 9) i18n 补齐：新增 `oauth.*`（title/desc/actions/status/security tips/confirm）并补 en/zh（files: `next-app/components/i18n-context.tsx`）
- [ ] 10) 成功闭环：成功后 CTA 跳转 `/auth-files`，并提供“复制状态信息”（files: `next-app/components/oauth/auth-flow-panel.tsx`）
- [ ] 11) 手动回归：确认 `/settings/providers` 现有 OAuth tab 不受影响（steps: 手动）
- [ ] 12) 回写文档与证据包：更新 `实现方案.md` 增量章节 + 打包本批次证据（files: `feature/.../实现方案.md` + `plan/batch-1/*`）

## VERIFICATION_CHECKLIST
- [ ] V1 `/oauth` 可访问，暗色主题可读，移动端无横向滚动（how: 手动）
- [ ] V2 生成 URL 成功：Input 显示 URL，Copy/Open 可用（how: 手动）
- [ ] V3 轮询策略：2s 轮询；ok/error/timeout 都会停止轮询（how: 手动 + mock/断网）
- [ ] V4 超时：5min 到期进入 timeout，并提示可重试（how: 手动等/改 timeout 为短时间验证）
- [ ] V5 error：展示错误摘要 + 3s 自动 reset（how: 手动 + mock error）
- [ ] V6 切换 provider / reset：会 confirm（how: 手动）
- [ ] V7 页面离开：不再继续轮询请求（how: Network 面板观察）
- [ ] V8 iFlow Cookie 登录：必填校验/提交/结果展示可用（how: 手动）
- [ ] V9 安全：Network 仅 `/api/*`，无明文 key/Authorization（how: 手动审计）
- [ ] V10 i18n：en/zh 切换覆盖 OAuth 页面（how: 手动）

## RISKS_AND_ROLLBACK
- R1 上游 iFlow cookie 返回字段不稳定（signal: UI 字段缺失；rollback: 宽松展示 `Record<string,unknown>` + 仅展示已知字段）
- R2 轮询导致幽灵请求/内存泄漏（signal: 离开页面仍请求；rollback: 强制 cleanup + 单例 timer）
- R3 状态串扰（切换 provider 后旧 state 仍在轮询）（signal: UI 混乱；rollback: provider 变更即 stop + reset + confirm）
- R4 敏感信息泄漏（state/cookie）风险（signal: 被持久化/日志输出；rollback: 禁止持久化 + 错误脱敏 + 删除 debug log）
- R5 UI 与现有风格不一致（signal: 视觉突兀；rollback: 复用现有 PageHeader/Card/Button + Tailwind tokens）
- R6 `/settings/providers` 行为回归（signal: OAuth tab 异常；rollback: 保持原实现不动，仅新增 `/oauth`）

