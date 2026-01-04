---
schema: ui_disputes_v1
items:
  - id: action-placement
    dimension: Action Center 位置与权重
    diff: "B1: 右上卡片且醒目(<=5条)；B2: 吸底通知条(<=3条)；A1: 与趋势并列；A2: 右侧栏控制面板"
    decision: "采用右侧栏置顶 Action Center（桌面默认 3 条、最多 5 条；移动端顺序上提；支持‘查看全部’）"
    p0: true
    info_needed: "是否需要 v1 就支持‘重试聚合任务’按钮（否则先只做跳转）"
  - id: trend-chart-mode
    dimension: 主趋势图形态
    diff: "v4: 单图 + Tabs(Cost/Tokens/Requests)；替代双轴叠加/多图"
    decision: "单图 + Tabs，默认 Cost；Tokens/Requests 作为辅助视图"
    p0: true
    info_needed: "分桶粒度：last-24h 默认按小时？last-7d/30d 按天？"
  - id: auto-refresh
    dimension: 自动刷新策略
    diff: "B1/B2 提到自动刷新/重连；v1 草稿倾向默认关闭避免打扰"
    decision: "Batch 0 默认仅手动刷新；后续 P1 再加可选 30–60s 自动刷新"
    p0: false
    info_needed: "主人是否希望默认开启自动刷新？"
  - id: action-count
    dimension: Action 条数上限
    diff: "B1: <=5 条；B2: <=3 条（不打扰）"
    decision: "桌面端默认 3 条（最多 5 条），移动端默认 3 条；其余折叠或提供‘查看全部’"
    p0: false
    info_needed: "Action 条目来源是否需要包含‘价格缺失’（若价格表模块已二期再补）"
  - id: navigation-style
    dimension: Action 的交互形态（跳转 vs 抽屉）
    diff: "专家稿出现抽屉/底部条等形态"
    decision: "v1 只做跳转（保持实现简单可回滚）；抽屉/内联操作放 P1"
    p0: true
    info_needed: "无"
---

# 争议点清单（<=8条）

1) Action Center 位置与权重
- 差异：B1 右上醒目、B2 吸底不打扰、A2 右侧控制面板
- 裁决（P0）：右侧栏置顶；桌面 3 条（最多 5），移动端顺序上提；提供“查看全部”

2) 主趋势图形态
- 差异：双轴/多图会增加认知负担
- 裁决（P0）：单图 + Tabs（Cost/Tokens/Requests），默认 Cost

3) 自动刷新策略
- 差异：有稿建议默认轮询；v1 更倾向默认关
- 裁决（P1）：Batch 0 默认手动刷新；P1 再做可选自动刷新

4) Action 条数上限
- 差异：B1 <=5 vs B2 <=3
- 裁决（P1）：桌面默认 3（最多 5）；移动端默认 3

5) 交互形态（跳转 vs 抽屉）
- 差异：抽屉更顺滑但 scope 更大
- 裁决（P0）：v1 只做跳转；抽屉/重试按钮放 P1