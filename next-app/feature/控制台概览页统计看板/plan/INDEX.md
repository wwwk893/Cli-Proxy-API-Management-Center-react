---
schema: plan_index_v2
task:
  name: "控制台概览页统计看板"
  type: "feature"
  dir: "feature/控制台概览页统计看板"
meta:
  created_at: "2026-01-04"
  updated_at: "2026-01-04"
git:
  branch: "feat/next-migration"
  worktree: ""
  base_commit: "1fa24bd23f1204ba96f5183cf7ff895e7e8f2a0f"
status:
  phase: "Phase 0-4: Plan"
  state: "进行中"
next: "生成 UI 四稿并打包；生成 impl bundle.zip + prompt.pro.md"
---

# Plan Index — 控制台概览页统计看板

## 1) Current Status
- Phase：Plan（big-dev）
- State：进行中（未进入实现）
- Next：生成 `zen-ui-polish` 四稿 + UI 证据包；随后生成 `zen-impl-plan` impl bundle.zip + prompt.pro.md
- 本次关键假设（<=3条）：
  - 默认时间窗为过去 24h，信息优先级 A→B→C。
  - 渠道口径与现有 usage API 保持一致（codex/cliproxy）。
  - 概览页首屏以“单聚合端点”方案为主，支持部分降级。

## 2) Key Docs (single source of truth)
- 任务计划：`feature/控制台概览页统计看板/任务计划.md`
- 需求分析：`feature/控制台概览页统计看板/需求分析.md`
- UI 设计：`feature/控制台概览页统计看板/UI设计.md`
- 实现方案：`feature/控制台概览页统计看板/实现方案.md`

## 3) Batch Index
### 3.1 UI (zen-ui-polish)
- `feature/控制台概览页统计看板/plan/ui/batch-0/`：待生成 v2/v3/v4 + disputes + `ui-batch-0-*.zip`

### 3.2 Impl Plan (zen-impl-plan)
- `feature/控制台概览页统计看板/plan/impl/batch-0/`：待完善 7 件套 + `impl-batch-0-*.zip`

## 4) 修订索引（CR Index, append-only）
- （暂无）

## 5) Risk & Rollback (summary)
- 风险：聚合端点过重影响首页性能 → 并行/超时/部分降级，必要时拆分。
- 风险：日志缺少结构化等级 → v1 仅跳转/最小摘要，P1 再做统计。
- 回滚策略：恢复 `app/(app)/page.tsx` 占位内容。
