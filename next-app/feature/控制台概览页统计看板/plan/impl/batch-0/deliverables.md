---
schema: deliverables_v3
task:
  name: "控制台概览页统计看板"
  dir: "feature/控制台概览页统计看板"
batch:
  id: "0"
meta:
  timestamp: "2026-01-04 10:27"

# 说明：
# - 本批次会把材料打包给 ChatGPT（GPT‑5.2 Pro）产出 plan.pro.md（尽量完整，不做严格限额）。
# - 这里的 budget 仅用于“形态检查/过长预警”，不是硬限制。

budget:
  data_structures_max: 999
  file_changes_max_lines: 200
  implementation_checklist_max: 200
  verification_checklist_max: 200
  risks_and_rollback_max: 50

auto_check:
  enabled: true
  target_file: "synthesis.final.md"
  fallback_files:
    - "plan.pro.md"
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
    - "prompt.pro.md"
    - "plan.pro.md"
    - "review.xhigh.md"
    - "synthesis.final.md"
---

# 本批次交付物（Impl Plan / Pro）✅

> 目标：把“需求与上下文”变成一份可执行的施工图方案，并通过 xhigh 审阅闸门后回填到 `实现方案.md`。

## 文件齐全性（脚本会检查）
- [ ] review-package.md
- [ ] deliverables.md
- [ ] relevant_files.txt
- [ ] prompt.pro.md
- [ ] plan.pro.md
- [ ] review.xhigh.md
- [ ] synthesis.final.md

## 质量闸门（人工勾选）
- [ ] plan.pro.md 已对齐验收标准（逐条）
- [ ] plan.pro.md 已给出尽量完整的数据结构/状态模型
- [ ] plan.pro.md 给出了文件级改动清单（含关键 symbol）
- [ ] plan.pro.md checklist 足够细，执行者可以按步骤做
- [ ] review.xhigh.md Verdict = PASS（或已按 BLOCK 修复后重新审阅 PASS）
- [ ] synthesis.final.md 已把“施工图 + 审阅意见”收敛为最终可落地方案
