---
schema: plan_codex_v1
task:
  name: "src→next-app 功能全量迁移"
  dir: "feature/src→next-app 功能全量迁移"
batch:
  id: "0"
meta:
  timestamp: "2025-12-26 14:40"
  author: "codex"
---

# Codex Baseline Plan — src→next-app 功能全量迁移 / Batch 0

## Summary
- What：把旧版 `src/` 静态 WebUI 的剩余模块（settings/api-keys/providers/auth-files/config/system/oauth/login 等）迁移到 `next-app/`（Next.js App Router），统一入口与架构边界，并按 UI 设计稿（v4 √）统一视觉与交互。
- Why：消除双入口维护成本与断链风险；把“数据访问/状态/交互”收敛到可扩展的 Next 架构；减少密钥暴露风险（默认 server env）。
- Success：新路由全部可用无断链；关键操作有一致的 loading/empty/error/confirm/toast；i18n 覆盖；并且实现方案可按模块分批落地、可回滚。

## DATA_STRUCTURES
- (1) ConnectionStatus（path: next-app/lib/management/types.ts / symbol: ConnectionStatus）
- (2) ManagementError（path: next-app/lib/management/types.ts / symbol: ManagementError）
- (3) SettingsKey & SettingsValueMap（path: next-app/lib/management/settings/types.ts / symbol: SettingsKey）
- (4) SettingsSnapshot（path: next-app/lib/management/settings/types.ts / symbol: SettingsSnapshot）
- (5) ApiKeyEntry（path: next-app/lib/management/api-keys/types.ts / symbol: ApiKeyEntry）
- (6) ProviderId & ProviderKeyPayload（path: next-app/lib/management/providers/types.ts / symbol: ProviderId）
- (7) AuthFile & AuthFileStats（path: next-app/lib/management/auth-files/types.ts / symbol: AuthFile）
- (8) ConfigDocument（path: next-app/lib/management/config/types.ts / symbol: ConfigDocument）
- (9) SystemInfo（path: next-app/lib/management/system/types.ts / symbol: SystemInfo）
- (10) ApiResult<T>（path: next-app/lib/management/types.ts / symbol: ApiResult）

## FILE_CHANGES
- `next-app/lib/management/*` (add) — 新增 server-only 的管理 API 访问层（按领域拆：settings/api-keys/providers/auth-files/config/system）
- `next-app/app/api/settings/*` (add) — Settings 读写代理（对接 management endpoints）
- `next-app/app/api/api-keys/*` (add) — API Keys 代理（list/create/update/delete）
- `next-app/app/api/providers/*` (add) — Provider keys + OAuth URL 代理
- `next-app/app/api/auth-files/*` (add) — Auth files 列表/下载/删除代理
- `next-app/app/api/config/*` (add) — Config 拉取/保存/下载代理
- `next-app/app/api/system/*` (add) — System 信息与健康检查代理
- `next-app/app/login/page.tsx` (add) — Connect & Health 页面（不做账号）
- `next-app/app/settings/page.tsx` (add) — Settings 页面（分组 Tabs）
- `next-app/app/settings/providers/page.tsx` (add) — Providers 页面
- `next-app/app/auth-files/page.tsx` (add) — Auth Files 页面
- `next-app/app/config/page.tsx` (add) — Config Editor 页面
- `next-app/app/system/page.tsx` (add) — System 页面
- `next-app/components/common/*` (add) — PageHeader/EmptyState/ErrorState/CopyButton/ConfirmDialog/DirtyGuard 等
- `next-app/components/layout/sidebar.tsx` (modify) — 确保导航与路由一致；必要时调整层级（保持最小变更）
- `next-app/components/i18n-context.tsx` (modify) — 增补新页面文案 key（en/zh）

## IMPLEMENTATION_CHECKLIST
- [ ] 1) 落地管理 API 访问层（files: next-app/lib/cliproxy-client.ts 或 next-app/lib/management/*）
- [ ] 2) 落地 Settings API 代理与页面骨架（files: next-app/app/api/settings/*, next-app/app/settings/page.tsx）
- [ ] 3) 落地 Providers API 代理与页面骨架（files: next-app/app/api/providers/*, next-app/app/settings/providers/page.tsx）
- [ ] 4) 落地 Auth Files API 代理与列表页（files: next-app/app/api/auth-files/*, next-app/app/auth-files/page.tsx）
- [ ] 5) 落地 Config API 代理与编辑器页（files: next-app/app/api/config/*, next-app/app/config/page.tsx）
- [ ] 6) 落地 System API 代理与页面（files: next-app/app/api/system/*, next-app/app/system/page.tsx）
- [ ] 7) 落地 Login/Health 页面（files: next-app/app/login/page.tsx, next-app/app/api/system/health*）
- [ ] 8) 统一交互组件（confirm/toast/empty/error/dirty/copy）（files: next-app/components/common/*）
- [ ] 9) 全量补齐 i18n key（files: next-app/components/i18n-context.tsx）
- [ ] 10) 对齐 Sidebar 导航与可访问性/响应式（files: next-app/components/layout/sidebar.tsx）

## VERIFICATION_CHECKLIST
- [ ] V1 `/login`：env 缺失/连接失败/连接成功三态可见（how: 手动切换 env 或模拟 500）
- [ ] V2 `/settings`：开关/输入项保存成功；失败会回滚（how: 手动操作 + mock 失败）
- [ ] V3 `/settings/providers`：新增/编辑/删除流程有 confirm/toast（how: 手动）
- [ ] V4 `/auth-files`：筛选/搜索/分页、下载、删除 confirm（how: 手动）
- [ ] V5 `/config`：dirty 拦截；保存失败不丢内容；下载可用（how: 手动）
- [ ] V6 `/system`：版本/连接信息可复制；缺失项提示清晰（how: 手动）
- [ ] V7 day/night 主题可读（how: 手动切换 theme）
- [ ] V8 中英切换覆盖新页面（how: 手动切换语言）
- [ ] V9 回归：/usage /logs /pipeline /pricing 不回归（how: 手动浏览 + 核心操作）

## RISKS_AND_ROLLBACK
- R1 端点/字段不一致（signal: API 500/字段缺失；rollback: 保持旧 src 入口可回切 + 分批回退）
- R2 密钥泄漏风险（signal: 客户端网络请求出现明文 key；rollback: 立即改为 server-only 代理 + 复查日志）
- R3 列表/日志性能问题（signal: 卡顿/崩溃；rollback: limit/分页/增量 + 降级渲染）
- R4 UI 风格碎片化（signal: 页面风格不一致；rollback: 抽共用组件并统一 PageHeader/Card）
- R5 i18n 漏网（signal: 出现硬编码/缺 key；rollback: 补齐字典 + 增加检查清单）
