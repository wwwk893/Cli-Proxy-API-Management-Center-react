---
schema: deliverables_v2
task:
  name: "src→next-app 功能全量迁移"
  dir: "feature/src→next-app 功能全量迁移"
batch:
  id: "0"
meta:
  timestamp: "2025-12-26 14:40"

budget:
  data_structures_max: 10
  file_changes_max_lines: 20
  implementation_checklist_max: 20
  verification_checklist_max: 15
  risks_and_rollback_max: 8

auto_check:
  enabled: true
  target_file: "synthesis.final.md"
  fallback_files:
    - "plan.expertA.md"
    - "plan.codex.md"
  section_markers:
    data_structures: "## DATA_STRUCTURES"
    file_changes: "## FILE_CHANGES"
    implementation_checklist: "## IMPLEMENTATION_CHECKLIST"
    verification_checklist: "## VERIFICATION_CHECKLIST"
    risks_and_rollback: "## RISKS_AND_ROLLBACK"

outputs:
  required_files:
    - "review-package.md"
    - "deliverables.md"
    - "relevant_files.txt"
    - "plan.codex.md"
    - "plan.expertA.md"
    - "review.expertB.md"
    - "synthesis.final.md"
---

# 交付物与预算（Deliverables & Budget）

## 交付物（必须全部覆盖）
1) 数据结构/接口（≤10条）
2) 文件/目录改动清单（≤20行）
3) 实现 checklist（≤20项）
4) 验证 checklist（≤15项）
5) 风险与回滚（≤8条）
6) 深挖 Top5（可选）

## 章节约定（给自动检查用，强制）
请在 synthesis.final.md（优先）或 plan.* 中使用固定章节名：
- `## DATA_STRUCTURES`
- `## FILE_CHANGES`
- `## IMPLEMENTATION_CHECKLIST`
- `## VERIFICATION_CHECKLIST`
- `## RISKS_AND_ROLLBACK`

## 强制提醒：Zen relevant_files
- zen.consensus 的 `relevant_files` 需要“绝对路径数组”，必须展开 relevant_files.txt 里的每个文件路径。
