---
schema: review_expertB_v1
task:
  name: "src→next-app 功能全量迁移"
  dir: "feature/src→next-app 功能全量迁移"
batch:
  id: "0"
meta:
  timestamp: "2025-12-26 14:40"
  author: "expertB"
  stance: "against"
---

# Expert B Review (Critical) — src→next-app 功能全量迁移 / Batch 0

## Verdict on Baseline
- 方案覆盖路由与模块颗粒度基本正确，但缺少 API route 错误边界与重试规范
- `ApiResult<T>` 未定义 error code 枚举，易导致前端容错不一致
- Settings 保存失败回滚逻辑未在 checklist 中细化，验收缺口明显
- i18n key 命名规范未强制约束，后续易出现命名碎片

## DATA_STRUCTURES
- ConnectionStatus: connected/disconnected/error + serverVersion + apiBase
- ManagementError: code + message + retryable
- SettingsKey: 枚举 debug/proxy-url/request-retry 等
- SettingsSnapshot: Record<SettingsKey, unknown> + lastUpdated
- ApiKeyEntry: id + maskedKey + createdAt + customHeaders?
- ProviderKeyPayload: providerId + apiKey + oauthUrl?
- AuthFile: name + type + size + modtime + stats?
- ConfigDocument: content + format + dirty + lastSaved

## FILE_CHANGES
- `next-app/lib/management/types.ts` — add
- `next-app/lib/management/settings/client.ts` — add
- `next-app/lib/management/providers/client.ts` — add
- `next-app/lib/management/auth-files/client.ts` — add
- `next-app/lib/management/config/client.ts` — add
- `next-app/lib/management/system/client.ts` — add
- `next-app/app/api/settings/route.ts` — add
- `next-app/app/api/providers/route.ts` — add
- `next-app/app/api/auth-files/route.ts` — add
- `next-app/app/api/config/route.ts` — add
- `next-app/app/api/system/route.ts` — add
- `next-app/app/login/page.tsx` — add
- `next-app/app/settings/page.tsx` — add
- `next-app/app/settings/providers/page.tsx` — add
- `next-app/app/auth-files/page.tsx` — add
- `next-app/app/config/page.tsx` — add
- `next-app/app/system/page.tsx` — add
- `next-app/components/i18n-context.tsx` — modify

## IMPLEMENTATION_CHECKLIST
- [ ] 定义 ManagementError 包含 retryable 字段
- [ ] callManagement 统一 try-catch 包装返回 ApiResult
- [ ] Settings API route 实现读写并捕获非 2xx
- [ ] Settings 页面保存失败时回滚 UI 状态并 toast
- [ ] Providers API route 代理 key 与 OAuth URL
- [ ] Auth Files route 支持 list/delete/download
- [ ] Auth Files 删除走 AlertDialog 且含"不可逆"
- [ ] Config route 支持 GET/PUT/download
- [ ] Config Editor 实现 DirtyGuard + SaveBar
- [ ] System route 返回版本与健康状态
- [ ] Login 页面区分 env 缺失/连接失败/成功
- [ ] 统一 PageHeader/EmptyState/ErrorState 组件
- [ ] 补齐 i18n key（settings/providers/auth-files/config/system）
- [ ] Sidebar 增加 active 子路由高亮逻辑
- [ ] Auth Files 列表分页 limit≤100/次
- [ ] 危险操作 confirm 统一使用 ConfirmDialog

## VERIFICATION_CHECKLIST
- [ ] `/login` env 缺失显示修复指引
- [ ] `/settings` 开关切换后刷新值一致
- [ ] `/settings` 保存失败 toast 且值回滚
- [ ] `/settings/providers` OAuth URL 获取失败可重试
- [ ] `/auth-files` 删除弹 confirm 含"不可逆"
- [ ] `/auth-files` 大列表分页无卡顿
- [ ] `/config` dirty 离开拦截弹窗
- [ ] `/config` 保存失败内容不丢失
- [ ] `/system` 版本信息可复制
- [ ] 中英切换新页面无硬编码
- [ ] Network 无明文 managementKey
- [ ] 现有 /usage /logs /pipeline /pricing 不回归

## RISKS_AND_ROLLBACK
- R1 端点字段变动：信号=500/字段缺失；回滚=保留旧 src 入口+分批回退
- R2 密钥泄漏：信号=请求携带明文 key；回滚=立即改 server-only+审计日志
- R3 列表性能：信号=DOM 过多卡顿；回滚=强制 limit+虚拟列表降级
- R4 i18n 漏网：信号=硬编码文案；回滚=补 key+增加 lint 规则
- R5 Config 覆盖写入丢失：信号=保存后内容不一致；回滚=本地缓存+冲突提示
- R6 UI 碎片化：信号=页面风格不一致；回滚=抽共用组件统一样式
