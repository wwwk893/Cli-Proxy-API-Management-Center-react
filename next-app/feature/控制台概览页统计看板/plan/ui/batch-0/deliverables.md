---
schema: ui_deliverables_v2
budget:
  ascii_max_lines: 25
  draft_max_total_lines: 160
  synth_max_total_lines: 200
outputs:
  required_files:
    - "review-package.md"
    - "deliverables.md"
    - "relevant_files.txt"
    - "v2.gemini.md"
    - "v3.claude.md"
    - "v4.final.md"
    - "disputes.md"
---

# UI 交付物清单（Batch 0）✅

## 必备文件（脚本会检查，不齐不打包）
- [ ] review-package.md
- [ ] deliverables.md
- [ ] relevant_files.txt
- [ ] v2.gemini.md（Gemini 草稿）
- [ ] v3.claude.md（Claude 草稿）
- [ ] v4.final.md（Gemini 综合推荐稿）
- [ ] disputes.md（争议点清单）

## 出稿要求（给子代理看的）
- ASCII 草图必须放在第一个 code block，<= 25 行
- 草稿 v2/v3 总行数建议 <= 160 行
- 推荐稿 v4 总行数建议 <= 200 行
- 禁止输出长表格与整页生产代码（只给结构与要点）

## OpenCode 上下文提示（别忘了）
- relevant_files.txt 每行是一个绝对路径
- 调用子代理时：把 relevant_files 清单逐行贴进 prompt，并允许它们用 read/grep/glob 查看代码
- 子代理只输出 Markdown 内容，你（plan-docs）负责落盘与回填 UI设计.md
