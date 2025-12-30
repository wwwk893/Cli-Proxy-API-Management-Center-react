---
task:
  name: "src→next-app 功能全量迁移"
  type: "feature"  # feature|fix
meta:
  created_at: "2025-12-26 14:40"
  status: "进行中（OAuth 登录中心增量 big-dev-apply）"
  next: "主人手动验证：`/settings/providers` 已移除 OAuth Tab（Callout 引导到 `/oauth`），并确认 `/settings/api-keys` 与 `/settings/providers` 互链文案清晰；继续验证 `/oauth` 认证文件表格操作与倒计时"
git:
  branch: "feat/next-migration"
  worktree: "/Users/wenlong/wt-next-migration"
  base: "83b13894bfd71f5ab9c404918f8468df6aa58bc1"
---

# INDEX｜src→next-app 功能全量迁移

## Status
- 当前状态：进行中（OAuth 登录中心增量 big-dev-apply）
- Next：主人手动验证：`/settings/providers` 已移除 OAuth Tab（Callout 引导到 `/oauth`），并确认 `/settings/api-keys` 与 `/settings/providers` 互链文案清晰；继续验证 `/oauth` 认证文件表格操作与倒计时

## Links
- 任务计划：../任务计划.md
- 需求分析：../需求分析.md
- UI 设计：../UI设计.md（Batch 0 v4 √；Batch 1 OAuth 登录中心 v4 √）
- 实现方案：../实现方案.md（Batch 0 已确认；Batch 1 OAuth 登录中心增量已确认）
- 上下文摘要：../plan/prompt-202512261737.txt

## Batches
### Impl plan (zen-impl-plan)
- Batch 0：../plan/batch-0/（证据包：../plan/batch-0/zen-batch-0-202512261603.zip）
- Batch 1：../plan/batch-1/（证据包：../plan/batch-1/zen-batch-1-202512291041.zip）

### UI (zen-ui-polish)
- Batch 0：../plan/ui/batch-0/（证据包：../plan/ui/batch-0/zen-ui-batch-0-202512261510.zip）
- Batch 1：../plan/ui/batch-1/（证据包：../plan/ui/batch-1/zen-ui-batch-1-202512261803.zip）

### Execution evidence
- 执行证据包：../plan/evidence/exec-20251226-173624.zip

## Risk & Rollback (summary)
- 风险：多模块迁移易出现断链/行为差异；管理密钥处理不当会造成泄漏风险；UI 风格容易碎片化
- 回滚：保留旧版 src 作为对照与入口回切；按模块分批落地，单模块可独立回退
