---
schema: change_request_v1
cr:
  id: "CR-202601061222"
  title: "模型排行：Effort 子行显示 Token 明细"
  type: "bugfix|adjustment|scope-change"
  status: "done"
  created_at: "2026-01-06 12:22"
  updated_at: "2026-01-06 12:24"
task:
  dir: "feature/用量统计模型规范化与Effort维度改造"
  baseline_refs:
    - "feature/用量统计模型规范化与Effort维度改造/任务计划.md"
    - "feature/用量统计模型规范化与Effort维度改造/实现方案.md"   # 如无可删
---

# {{cr.id}} — {{cr.title}}

## 1) 背景与触发（为什么要改）
- 触发来源：主人反馈
- 现象/问题描述：模型排行“基础模型聚合”视图中，展开的 Effort 子行缺少 Token 明细（输入/输出/思考/缓存）查看入口。
- 影响范围：仅模型排行表格的 Effort 子行展示与明细查看。
- 是否超出原验收：否

## 2) 决策（改什么，不改什么）
- 改动结论（1-3条）：
  - 为 Effort 子行补充与主行一致的 Token 明细触发器与明细内容（popover/tooltip/触控 inline）。
- 不做什么（避免 scope creep）：
  - 不改表格列结构、不新增后端字段、不调整聚合口径与筛选逻辑。

## 3) 方案与改动点（带定位，越具体越好）
> 要求：文件路径 + 组件/函数名 + 简述
- 计划改动：
  - `components/charts/usage-model-table/rows.tsx`：在 effort 子行渲染处新增 `ModelUsageDetailTrigger` 与 touch inline 细节行，复用 effort metrics。
- 预期行为变化：
- 展开 Effort 子行时可查看输入/输出/思考/缓存 Token 与对应成本明细，交互与主行一致。
- 风险点：
- 触控端 inline 细节行增加一条子行，需确认不影响展开/选中交互。
- 回滚策略（优先 git revert）：
- 回滚本 CR 的单文件修改即可恢复原状。

## 4) 变更文件清单（仅本 CR）
- components/charts/usage-model-table/rows.tsx

## 5) 验证清单（手动）
- [ ] 场景 1：模型排行 → 基础模型聚合 → 展开 Effort 子行，明细触发器可见且可弹出。
- [ ] 场景 2：触控设备点击明细按钮，inline 细节行显示且不影响展开/收起。
- [ ] 回归点：主行明细/展开/筛选行为不受影响。

## 6) 记录（Append-only）
- 2026-01-06 12:22
- 状态：draft
- 备注：创建 CR
- 2026-01-06 12:24
  - 状态：draft→done
  - 备注：补齐 Effort 子行明细触发器与触控 inline 细节行
