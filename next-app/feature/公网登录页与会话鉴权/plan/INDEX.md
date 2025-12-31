---
schema: plan_index_v2
task:
  name: "公网登录页与会话鉴权"
  type: "feature"  # feature|fix
  dir: "feature/公网登录页与会话鉴权"
meta:
  created_at: "2025-12-30 12:12"
  updated_at: "2025-12-30 15:49"
git:
  branch: "feat/next-migration"
  worktree: ""
  base_commit: "83b13894bfd71f5ab9c404918f8468df6aa58bc1"
status:
  phase: "Apply"
  state: "进行中"
next: "手动验证清单（登录/拦截/CSRF/到期）"
---

# Plan Index — 公网登录页与会话鉴权

> 目标：把“恢复上下文”成本降到接近 0。跨天/多批次/并行 worktree 时尤其重要。

## 1) Current Status
- Phase：Apply
- State：进行中
- Next：手动验证清单（登录/拦截/CSRF/到期）
- 本次关键假设（<=3条）：
  - 生产环境 `NEXT_PUBLIC_SITE_URL` 配置正确（用于锁定 canonical hostname）
  - cliproxy management debug 具备特征头（如 `X-CPA-VERSION`）
  - DB 可用（Prisma + Postgres）

## 2) Key Docs (single source of truth)
- 任务计划：`feature/公网登录页与会话鉴权/任务计划.md`
- 需求分析：`feature/公网登录页与会话鉴权/需求分析.md`
- UI 设计：`feature/公网登录页与会话鉴权/UI设计.md`
- 实现方案：`feature/公网登录页与会话鉴权/实现方案.md`

## 3) Batch Index
### 3.1 Impl Plan (zen-impl-plan)
- `feature/公网登录页与会话鉴权/plan/batch-0/`：已创建模板；落地实现前可补齐证据包/评审材料。
- `feature/公网登录页与会话鉴权/plan/batch-1/`：<可选>

### 3.2 UI (zen-ui-polish)
- `feature/公网登录页与会话鉴权/plan/ui/batch-0/`：已创建模板；如需多稿 UI 可按批次补齐。
- `feature/公网登录页与会话鉴权/plan/ui/batch-1/`：<可选>

## 4) 修订索引（CR Index, append-only）
> 冻结基线后，所有“后续 bug/调整”都写到 `plan/amendments/CR-*.md`，这里做目录索引即可。
- （暂无）

## 5) Risk & Rollback (summary)
- 风险（1-3条）：
  - middleware matcher 误拦导致静态资源/登录页不可用
  - canonical hostname 配错导致无法登录
  - 漏掉某些 `/api/*` 未加 requireSession
- 回滚策略：
  - 优先：`git revert <commit>`
  - 紧急降级：临时移除 middleware/requireSession（恢复 env 模式）
