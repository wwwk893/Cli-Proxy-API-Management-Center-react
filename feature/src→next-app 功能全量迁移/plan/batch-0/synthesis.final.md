---
schema: synthesis_final_v1
task:
  name: "src→next-app 功能全量迁移"
  dir: "feature/src→next-app 功能全量迁移"
batch:
  id: "0"
meta:
  timestamp: "2025-12-26 15:11"
  author: "codex"
---

# Final Synthesis — src→next-app 功能全量迁移 / Batch 0

## What We Will Build
- 目标概述：在 `next-app/` 补齐旧版 `src/` 剩余模块能力（按旧侧边栏颗粒度），统一入口与 UI/交互规范（以 `UI设计.md` v4 √ 为准）。
- Non-goals：不删除旧 `src/`；不引入账号/权限系统；不改后端管理 API 语义；不新增 CI/CD。
- Done 定义：新路由无断链；关键操作具备 loading/empty/error/confirm/toast；i18n 覆盖；默认密钥不暴露到客户端。

## DATA_STRUCTURES
- (1) `next-app/lib/management/types.ts` / `ApiResult<T>` — `{ data?: T; error?: ManagementError }`
- (2) `next-app/lib/management/types.ts` / `ManagementError` — `{ message; status; code?; details? }`（强制脱敏）
- (3) `next-app/lib/management/system/types.ts` / `ConnectionStatus` — `{ ok; managementBase; keyPresent; serverVersion?; serverBuildDate? }`
- (4) `next-app/lib/management/settings/types.ts` / `SettingsKey` — 覆盖 debug/proxy-url/request-retry/... 的 key union
- (5) `next-app/lib/management/settings/types.ts` / `SettingsSnapshot` — `Record<SettingsKey, unknown>`
- (6) `next-app/lib/management/api-keys/types.ts` / `ApiKeyEntry` — `{ keyMasked; keyRaw?; headers?: Record<string,string> }`
- (7) `next-app/lib/management/providers/types.ts` / `ProviderId` — `\"gemini\"|\"codex\"|\"claude\"|...`
- (8) `next-app/lib/management/auth-files/types.ts` / `AuthFile` — `{ name; type; modtime; size; authIndex?; runtimeOnly? }`
- (9) `next-app/lib/management/auth-files/types.ts` / `AuthFileStats` — `{ success; failure; ... }`
- (10) `next-app/lib/management/config/types.ts` / `ConfigDocument` — `{ text; format: \"yaml\"|\"text\"; etag?: string }`

## FILE_CHANGES
- `next-app/lib/management/client.ts` (add) — `callManagementJson`（`server-only` + no-store + 错误脱敏）
- `next-app/lib/management/types.ts` (add) — `ApiResult`/`ManagementError` 等共享类型
- `next-app/lib/management/settings/index.ts` (add) — settings 读聚合 + 按 key 写入适配
- `next-app/lib/management/api-keys/index.ts` (add) — api-keys 读写适配
- `next-app/lib/management/providers/index.ts` (add) — providers key + oauth-url 适配
- `next-app/lib/management/auth-files/index.ts` (add) — auth-files 列表/下载/删除适配（含 limit/cap）
- `next-app/lib/management/config/index.ts` (add) — config get/save/download（含 etag 可选）
- `next-app/lib/management/system/index.ts` (add) — health/info 适配（best-effort）
- `next-app/app/api/settings/route.ts` (add) — settings 代理（GET/PATCH）
- `next-app/app/api/api-keys/route.ts` (add) — api-keys 代理（GET/POST/PUT/DELETE）
- `next-app/app/api/providers/` (add) — providers routes（key 管理 + oauth url）
- `next-app/app/api/auth-files/` (add) — auth-files routes（list/download/delete）
- `next-app/app/api/config/` (add) — config routes（get/save/download）
- `next-app/app/api/system/` (add) — system routes（health/info/diagnostics）
- `next-app/app/login/` (add) — Connect & Health 页面（无账号）
- `next-app/app/settings/` (add) — Settings 页面 + `/settings/providers` 子页
- `next-app/app/auth-files/` (add) — Auth Files 页面（表格 + Drawer）
- `next-app/app/config/` (add) — Config Editor 页面（SaveBar + DirtyGuard）
- `next-app/app/system/` (add) — System 页面（版本/诊断/复制）
- `next-app/components/common/` (add) — PageHeader/EmptyState/ErrorState/CopyButton/ConfirmDialog/DirtyGuard
- `next-app/components/layout/sidebar.tsx` (modify) — 导航与路由对齐（最小变更）
- `next-app/components/i18n-context.tsx` (modify) — 增补新页面 key（en/zh）

## IMPLEMENTATION_CHECKLIST
- [ ] 1) 逐 endpoints 验证 method/payload/response（files: feature/.../plan/batch-0/review-package.md；output: 映射表/差异记录）
- [ ] 2) 实现 server-only 管理 client（files: next-app/lib/management/client.ts；output: callManagementJson + 脱敏错误）
- [ ] 3) 落地共享类型（files: next-app/lib/management/types.ts；output: ApiResult/ManagementError）
- [ ] 4) 落地 system/health 代理（files: next-app/app/api/system/**/route.ts；output: ConnectionStatus/diagnostics）
- [ ] 5) 落地 `/login`（Connect & Health）页面（files: next-app/app/login/page.tsx；output: env 缺失/失败/成功三态）
- [ ] 6) 落地 Settings 代理（files: next-app/app/api/settings/route.ts；output: GET/PATCH + 回滚友好错误）
- [ ] 7) 落地 `/settings` 页面分组与保存回滚（files: next-app/app/settings/page.tsx；output: Tabs + toast + 失败回滚）
- [ ] 8) 落地 API Keys 代理与 UI（files: next-app/app/api/api-keys/route.ts；output: CRUD + mask/copy）
- [ ] 9) 落地 Providers 代理与 UI（files: next-app/app/api/providers/**/route.ts；output: key 管理 + oauth url）
- [ ] 10) 落地 Auth Files 代理与 UI（files: next-app/app/api/auth-files/**/route.ts；output: list/download/delete + confirm）
- [ ] 11) 落地 Config 代理与 Editor UI（files: next-app/app/api/config/**/route.ts；output: SaveBar + DirtyGuard）
- [ ] 12) 落地 System 页面（files: next-app/app/system/page.tsx；output: 版本/诊断复制）
- [ ] 13) 抽公共组件（files: next-app/components/common/*；output: PageHeader/Empty/Error/Confirm/Copy/Dirty）
- [ ] 14) 补齐 i18n key（files: next-app/components/i18n-context.tsx；output: en/zh 字典完整）
- [ ] 15) 对齐 Sidebar 导航（files: next-app/components/layout/sidebar.tsx；output: 无断链）
- [ ] 16) 回写文档与证据包（files: feature/.../实现方案.md；output: plan/batch-0/zen-batch-0-*.zip）

## VERIFICATION_CHECKLIST
- [ ] V1 安全：Network 面板仅请求 `/api/*`，无明文 key/Authorization（expected: 不泄漏）
- [ ] V2 `/login`：env 缺失/失败/成功三态可见且可重试（expected: 状态清晰）
- [ ] V3 `/settings`：保存成功 toast；失败回滚（expected: 刷新后一致）
- [ ] V4 `/settings/providers`：OAuth URL 获取失败可恢复（expected: Retry 可用）
- [ ] V5 `/auth-files`：筛选/搜索/分页可用；删除 confirm（expected: cancel 不动作）
- [ ] V6 `/config`：dirty 拦截；保存失败不丢内容（expected: 文本保留）
- [ ] V7 `/system`：诊断可复制；缺字段可容错（expected: 不白屏）
- [ ] V8 i18n：新页面中英切换覆盖（expected: 无硬编码）
- [ ] V9 theme：day/night/system 可读（expected: 表单/卡片对比度 OK）
- [ ] V10 回归：`/usage` `/logs` `/pipeline` `/pricing` 可用（expected: 核心交互正常）

## RISKS_AND_ROLLBACK
- R1 密钥泄漏（signal: 客户端出现 Authorization/key；rollback: 回滚 + 轮换 `CLIPROXY_MANAGEMENT_KEY` + 临时 503 管理 routes）
- R2 端点不一致（signal: 4xx/字段缺失；rollback: adapter 层 hotfix + 页面降级只读）
- R3 不可逆操作误触（signal: 误删/误清空；rollback: 强制 confirm；无法恢复则明确提示并引导旧 UI 对照）
- R4 Config 覆盖/丢数据（signal: 保存失败清空文本；rollback: 保存失败不丢内容 + DirtyGuard；严重时提示 SSH 恢复）
- R5 列表/日志性能（signal: 卡顿/崩溃；rollback: limit/cap/分页/增量 + 降级渲染）
- R6 i18n 漏网（signal: 显示 key/硬编码；rollback: 补齐字典 + 增加检查清单）
- R7 UI 碎片化（signal: 各页风格不一致；rollback: 抽共用组件 + 统一 PageHeader/Card）
- R8 回归已有模块（signal: /usage 等异常；rollback: 分批合并 + 快速 revert 单批）

## Diff From Plans
- 相比 baseline：保留整体分层，但将 Batch 0 relevant_files 收敛为“docs + 关键 Next 文件”，避免专家上下文过大导致失败。
- 吸收点：采纳 expertA 的 server-only + endpoint 验证 + list cap；采纳 expertB 的 dirty guard + 不可逆保护 + 逐页骨架先行。
