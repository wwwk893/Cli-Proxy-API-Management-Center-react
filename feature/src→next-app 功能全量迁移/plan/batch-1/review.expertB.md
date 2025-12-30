---
schema: review_expertB_v1
task:
  name: "src→next-app 功能全量迁移"
  dir: "feature/src→next-app 功能全量迁移"
batch:
  id: "1"
meta:
  timestamp: "2025-12-29 10:12"
  author: "expertB"
  stance: "against"
---

# Expert B Review (Critical) — OAuth 登录中心增量 / Batch 1

## Executive Verdict
- 最可能翻车点 Top3：
  1) 轮询机制：若用 `setInterval` 且请求>2s，会堆积并产生“重叠轮询”，触发上游限流与 UI 抖动
  2) 竞态条件：切换 provider / 卸载页面时，若不 abort 在途请求或忽略旧响应，会出现“幽灵状态覆盖新状态”
  3) 安全日志：`/api/providers/iflow-cookie` 若错误日志打印 request body 或 error 全貌，可能把 cookie 明文写入日志

## Acceptance Gaps
- Gap1：超时策略若只依赖 timer 计数，在后台 Tab timer 会被降频，可能导致 5min 超时失效（应以 `Date.now()` 为准）
- Gap2：轮询需“串行化”（上一轮返回后再等待 2s），否则会出现重叠请求与状态错乱
- Gap3：离页/切换时必须同时 stop timer 与 abort fetch，否则 React 可能在 unmounted 上 setState 或污染新流程

## Minimal Fixes (≤10)
1) `next-app/components/oauth/use-oauth-flow.ts` / `deadlineAt` — 超时用挂钟时间 `Date.now()` 判断（不依赖后台 timer 精度）
2) `next-app/components/oauth/use-oauth-flow.ts` / `pollOnce` — 弃用 `setInterval`，改为串行 `setTimeout`（避免重叠）
3) `next-app/components/oauth/use-oauth-flow.ts` / `abortRef` — 引入 `AbortController`，在 stop/unmount/provider 切换时 abort 在途请求
4) `next-app/components/oauth/use-oauth-flow.ts` / `resetTimerRef` — error→3s reset 需可取消，防止多次 error 叠加触发多次 reset
5) `next-app/app/api/providers/iflow-cookie/route.ts` / `POST` — catch 块错误脱敏：不要打印 body；不要把上游 error 原样透传
6) `next-app/components/oauth/provider-grid.tsx` / `onSelectProvider` — 切换确认通过后必须先 `stopPolling+reset` 再切 provider，避免串扰
7) `next-app/components/oauth/types.ts` / `IflowCookieResult` — 对上游字段做白名单提取（email/expired/path/type），其余仅作为可选扩展展示
8) `next-app/components/oauth/auth-flow-panel.tsx` / `securityTip` — 复制/打开 URL 前后给出“state 敏感勿分享”的可见提示与 toast

## RISKS_AND_ROLLBACK
- R1 后台 Timer 冻结：回到前台后显示的剩余时间与真实超时不一致（rollback：`visibilitychange` 校准或改为手动刷新状态）
- R2 Cookie 格式变更：上游变化导致校验/解析失败（rollback：前端仅做非空校验，后端验证为准）
- R3 3s reset 过快：用户来不及看错误（rollback：错误态加“暂停自动重置/手动重置”交互）
- R4 API 泛洪：轮询 bug 导致死循环请求（rollback：前端断路器 + 降级为手动“检查状态”按钮）

