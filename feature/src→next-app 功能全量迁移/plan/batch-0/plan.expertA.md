---
schema: plan_expertA_v1
task:
  name: "src→next-app 功能全量迁移"
  dir: "feature/src→next-app 功能全量迁移"
batch:
  id: "0"
meta:
  timestamp: "2025-12-26 14:40"
  author: "expertA"
  stance: "for"
---

# Expert A Plan (Implementation-First) — src→next-app 功能全量迁移 / Batch 0

## Verdict on Baseline
- 路线可行：沿用 `next-app/lib/cliproxy-client.ts` 的 server env 思路，用 Next `/api/*` 代理可守住 management key server-only
- 与 v4 方向一致，但必须把通用组件（PageHeader/States/Confirm/Dirty）前置，否则会快速风格碎片化
- 颗粒度建议按旧模块落地为 6 块：Login、Settings(含 API Keys)、Providers(OAuth)、Auth Files、Config、System，并支持分批交付/回退
- 关键缺口：输入校验/错误归一、分页/limit、i18n 门禁流程、以及“默认入口切换到 next-app”的部署落地说明

## DATA_STRUCTURES
- `ApiResult<T>`：统一返回体
- `ManagementError`：统一错误模型
- `ConnectionStatus`：连接/健康态
- `SettingsSnapshot`：设置快照
- `ApiKeyEntry`：API Key 行模型
- `ProviderCredential`：Provider 凭据模型
- `AuthFileEntry`：Auth File 行模型
- `ConfigDocument`：配置文档模型

## FILE_CHANGES
`next-app/lib/management/client.ts` — add  
`next-app/lib/management/types.ts` — add  
`next-app/lib/cliproxy-client.ts` — modify  
`next-app/app/api/settings/*` — add  
`next-app/app/api/api-keys/*` — add  
`next-app/app/api/providers/*` — add  
`next-app/app/api/auth-files/*` — add  
`next-app/app/api/config/*` — add  
`next-app/app/api/system/*` — add  
`next-app/app/login/page.tsx` — add  
`next-app/app/settings/page.tsx` — add  
`next-app/app/settings/providers/page.tsx` — add  
`next-app/app/auth-files/page.tsx` — add  
`next-app/app/config/page.tsx` — add  
`next-app/app/system/page.tsx` — add  
`next-app/components/common/*` — add  
`next-app/components/layout/sidebar.tsx` — modify  
`next-app/components/i18n-context.tsx` — modify  

## IMPLEMENTATION_CHECKLIST
- [ ] 管理调用统一封装并强制 server-only
- [ ] 统一 `ApiResult/错误码` 与消息脱敏策略
- [ ] 落地 `/api/settings` 读写代理
- [ ] 落地 `/api/api-keys` CRUD 代理
- [ ] 落地 `/api/providers` 与 OAuth URL 代理
- [ ] 落地 `/api/auth-files` 列表/下载/删除代理
- [ ] 落地 `/api/config` 拉取/保存/下载代理
- [ ] 落地 `/api/system` health/诊断代理
- [ ] 实现 `/login`：三态 + Retry + 诊断复制
- [ ] 实现 `/settings`：v4 骨架 + Tabs 编排
- [ ] Settings 表单：disabled/confirm/失败回滚
- [ ] API Keys：遮罩/复制/危险操作 confirm
- [ ] Providers：连通性提示 + OAuth 回填指引
- [ ] Auth Files：表格 + 搜索/分页 + Drawer 详情
- [ ] Config：DirtyGuard + SaveBar（失败不丢内容）
- [ ] i18n：新增 key en/zh 同步 + 禁止硬编码审查

## VERIFICATION_CHECKLIST
- [ ] Sidebar 全部链接可达且无 404
- [ ] `/login`：env 缺失/失败/成功三态正确
- [ ] `/settings`：读取与保存后刷新一致
- [ ] `/settings`：写入失败会回滚并可重试
- [ ] API Keys：增删改有 confirm/toast 且复制正确
- [ ] Providers：OAuth URL 成功/失败均可恢复
- [ ] Auth Files：空态/错误态有 CTA（刷新/重试）
- [ ] Auth Files：分页/limit 生效且不卡顿
- [ ] Config：dirty 拦截生效，保存失败不丢编辑内容
- [ ] System：诊断信息可复制且缺失字段友好提示
- [ ] en/zh 切换覆盖新页面全部用户文案
- [ ] 浏览器 Network/HTML/日志中无明文 management key/Authorization 回显

## RISKS_AND_ROLLBACK
- 上游 management API 字段/语义漂移 → 适配层集中在 `lib/management/*`，按页面分批上线
- server-only 模块被 client 误引用 → 强制 `server-only` + 代码审查阻断
- i18n 漏 key/硬编码回流 → 建立 key 清单与发布前语言切换走查
- 列表规模超预期导致卡顿 → 默认 limit/分页，必要时降级渲染与手动刷新
- Config 覆盖写入不可逆 → 保存前 confirm + 草稿保留 + 提供下载备份
- 默认入口切换不彻底仍走旧静态 UI → 部署侧回滚开关保留旧入口（src 仅对照）
