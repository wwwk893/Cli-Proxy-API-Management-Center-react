---
schema: plan_index_v2
task:
  name: "用量统计模型规范化与Effort维度改造"
  type: "feature"
  dir: "feature/用量统计模型规范化与Effort维度改造"
meta:
  created_at: "2026-01-05"
  updated_at: "2026-01-05"
git:
  branch: "feat/next-migration"
  worktree: ""
  base_commit: "60bf72a11b484a12c426c3c271242220a9c90864"
status:
  phase: "Apply: 进行中"
  state: "进行中"
next: "执行实现方案 checklist 第 9 项（对账验证：迁移前后总量一致 AC3）"
---

# Plan Index — 用量统计模型规范化与Effort维度改造

## 1) Current Status
- Phase：Apply（big-dev-apply）
- State：进行中（已进入实现）
- Next：执行实现方案 checklist 第 9 项（对账验证：迁移前后总量一致 AC3）
- 本次关键假设（<=3条）：
  - `gpt-5.2-codex*` 与 `gpt-5.2` 为不同基础模型，不合并；但各自按 effort 细分。
  - effort 仅从末尾解析：`-(low|medium|high|xhigh)` 或 `(low|medium|high|xhigh)`。
  - 迁移前后总量一致（仅分组维度变化），且保留 modelRaw 追溯。

## 2) Key Docs (single source of truth)
- 任务计划：`feature/用量统计模型规范化与Effort维度改造/任务计划.md`
- 需求分析：`feature/用量统计模型规范化与Effort维度改造/需求分析.md`
- UI 设计：`feature/用量统计模型规范化与Effort维度改造/UI设计.md`
- 实现方案：`feature/用量统计模型规范化与Effort维度改造/实现方案.md`

## 3) Batch Index
### 3.1 UI (zen-ui-polish)
- `feature/用量统计模型规范化与Effort维度改造/plan/ui/batch-0/`：已生成 v2/v3/v4 + disputes + `zen-ui-batch-0-202601051209.zip`（采用 v3 √）

### 3.2 Impl Plan (zen-impl-plan)
- `feature/用量统计模型规范化与Effort维度改造/plan/batch-0/`：已回填 `plan.pro.md`；已复审收敛 `synthesis.final.md`；已生成 `实现方案.md`（待主人确认）

## 4) 修订索引（CR Index, append-only）
- CR-202601061222：`plan/amendments/CR-202601061222-模型排行Effort-子行显示-Token-明细.md`
- （暂无）

## 5) Risk & Rollback (summary)
- 风险：解析规则误判导致少量模型被错误归并/拆分 → 提供“维度=原始模型”回退 + 解析例外表。
- 风险：按 canonical 聚合后，`ModelPricing` 仍按 raw 配置导致“未配置/冲突”提示增多 → canonical→raw fallback + 冲突提示。
- 回滚策略：UI 切回“原始模型维度”，API 暂时按 raw 分组返回；保留新增列不删除。

## 自动校验（Guardrails，append-only）
> 由脚本自动追加；请勿修改历史记录。需要更正请新增一条说明。

- 2026-01-05 13:48 (phase1-scaffold)
  - validate_task_plan: PASS (errors=0, warns=0, infos=0)
  - validate_modeA_repo: PASS (errors=0, warns=0, infos=0) · [PASS] Mode A repo check @ /Users/wenlong/wt-next-migration

- 2026-01-05 14:04 (impl-plan-reviewed)
  - validate_task_plan: PASS (errors=0, warns=0, infos=0)
  - validate_modeA_repo: PASS (errors=0, warns=0, infos=0) · [PASS] Mode A repo check @ /Users/wenlong/wt-next-migration
