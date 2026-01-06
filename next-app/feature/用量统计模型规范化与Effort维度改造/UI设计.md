# UI 设计（用量统计模型规范化与Effort维度改造）

- 时间戳：2026-01-05
- 默认视图：基础模型（modelCanonical）聚合
- UI 路线：zen-ui-polish（双专家取稿 + Gemini 审阅收敛）
- 当前采用：Batch 0 `v3（专家B：Claude Opus 4.5）` √

## Batch 0（zen-ui-polish）产物索引
- `feature/用量统计模型规范化与Effort维度改造/plan/ui/batch-0/review-package.md`
- `feature/用量统计模型规范化与Effort维度改造/plan/ui/batch-0/relevant_files.txt`
- `feature/用量统计模型规范化与Effort维度改造/plan/ui/batch-0/v2.gemini.md`
- `feature/用量统计模型规范化与Effort维度改造/plan/ui/batch-0/v3.claude.md`
- `feature/用量统计模型规范化与Effort维度改造/plan/ui/batch-0/v4.final.md`
- `feature/用量统计模型规范化与Effort维度改造/plan/ui/batch-0/disputes.md`

## Batch 0 relevant_files（绝对路径）
- `/Users/wenlong/wt-next-migration/next-app/components/charts/usage-model-table.tsx`
- `/Users/wenlong/wt-next-migration/next-app/components/charts/model-usage-detail.tsx`
- `/Users/wenlong/wt-next-migration/next-app/app/api/usage/by-model/route.ts`
- `/Users/wenlong/wt-next-migration/next-app/app/(app)/usage/components/usage-content.tsx`
- `/Users/wenlong/wt-next-migration/next-app/app/(app)/usage/components/usage-filters-bar.tsx`
- `/Users/wenlong/wt-next-migration/next-app/components/usage/filter-popover.tsx`
- `/Users/wenlong/wt-next-migration/next-app/lib/usage/usage-filters-context.tsx`
- `/Users/wenlong/wt-next-migration/next-app/app/(app)/components/dashboard/components/TopModelsCard.tsx`
- `/Users/wenlong/wt-next-migration/next-app/app/api/models/route.ts`

---

## v2（专家A：Gemini）— 草图稿
> 同步文件：`feature/用量统计模型规范化与Effort维度改造/plan/ui/batch-0/v2.gemini.md`

```ascii
[ Page Header: Usage Statistics ]
[ Filter Bar ----------------------------------------------------------------]
| [Date: Last 7 Days v] [Granularity: Day v]  | [View: Base Model (Agg) v]   |
| [Channels: All v] [Sources: All v]          | [Effort: High, XHigh... v]   |
+----------------------------------------------------------------------------+
[ ! Alert: Raw View Active - Showing original model strings (Debug Only)    ]

[ Model Ranking Table (Default: Base Model) ---------------------------------]
| Model (Canonical)   | Effort Dist.      | Requests | Tokens   | Cost ($) |
+---------------------+-------------------+----------+----------+----------+
| v GPT-4o            | [==Low==|==High=] |     1.2k |     1.2M |   $15.20 |
|   > High            |                   |      800 |     0.8M |   $12.00 |
|   > Low             |                   |      400 |     0.4M |   $ 3.20 |
+---------------------+-------------------+----------+----------+----------+
| > GPT-5.2           | [=====XHigh=====] |      500 |     0.5M |   $45.00 |
+---------------------+-------------------+----------+----------+----------+
| > GPT-5.2-Codex     | [======N/A======] |      100 |     0.1M |   $ 5.00 |
+---------------------+-------------------+----------+----------+----------+
```

---

## v3（专家B：Claude Opus 4.5）— 草图稿 √
> 同步文件：`feature/用量统计模型规范化与Effort维度改造/plan/ui/batch-0/v3.claude.md`

```ascii
┌─────────────────────────────────────────────────────────────────────────────┐
│ [时间范围] [粒度] [渠道▾] [来源▾]                    [⟳] [🌐] [☀]          │
├─────────────────────────────────────────────────────────────────────────────┤
│ Top Models                                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ View: [基础模型 ✓] [基础模型+Effort] [原始模型⚠]   Effort: [▾ 全部]    │ │
│ │                                                  [模型筛选▾] [来源▾]   │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ Model          │ Requests │ Fail │ Tokens        │ Cache │ Cost │ Effort│ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ ▶ ● gpt-5.2    │ 12,345   │ 23   │ ██████ 1.2M   │ 42%   │ $45  │▁▃█▅   │ │
│ │   └─ high      │  8,000   │ 12   │ ████   800K   │ 38%   │ $30  │       │ │
│ │   └─ xhigh     │  4,345   │ 11   │ ██     400K   │ 50%   │ $15  │       │ │
│ │ ▷ ● gpt-5.2-codex│ 5,678  │  5   │ ████   600K   │ 55%   │ $18  │▂▅█▃   │ │
│ │ ▷ ● o3         │ 3,210   │  8   │ ███    400K   │ 30%   │ $22  │▁▁█▁   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ⚠ 原始模型视图：显示未规范化的 modelRaw，仅用于排错。[← 返回默认视图]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## v4（综合推荐稿）
> 同步文件：`feature/用量统计模型规范化与Effort维度改造/plan/ui/batch-0/v4.final.md`

（建议主人优先 review v4；如需更偏视觉或更偏交互细节，可回看 v2/v3。）

```ascii
[顶部过滤: 日期范围 | 粒度 | 渠道 | 来源 ]
[第二行: 视图模式: [基础模型(聚合) v] | Effort筛选: [全部/High/Low... v] ]
+--------------------------------------------------------------------------+
| ! 警告: 当前为原始视图 - 显示原始模型字符串 (仅供排错)                   |
+--------------------------------------------------------------------------+
| Model (Canonical)      | Effort Dist.    | Requests | Tokens | Cost ($)|
|------------------------|-----------------|----------|--------|---------|
| v gpt-5.2              | [==Low==|==Hi=] |     1.2k |   1.2M | $ 45.00 |
|   > High               |                 |      800 |   0.8M | $ 30.00 |
|   > Low                |                 |      400 |   0.4M | $ 15.00 |
| > gpt-5.2-codex        | [=====N/A=====] |      100 |   0.1M | $  5.00 |
| > gpt-5.2-max          | [=====N/A=====] |       50 |   0.5M | $ 10.00 |
+--------------------------------------------------------------------------+
```

---

## 争议点清单（Batch 0，<=8）
> 同步文件：`feature/用量统计模型规范化与Effort维度改造/plan/ui/batch-0/disputes.md`

1) Effort 列位置：紧跟 Model 列 vs 靠右/靠近 Cost
2) Source 子行默认展开：默认折叠 vs 默认展开
3) Effort=null 展示：未标注/Unspecified/N/A 的文案与视觉归类

## 验收点（摘自 v4，<=12）
1) 默认聚合：`gpt-5.2-high` 与 `gpt-5.2-low` 合并为 `gpt-5.2`
2) 独立模型区分：`gpt-5.2-codex` 不与 `gpt-5.2` 合并
3) 非 Effort 后缀：`gpt-5.2-max` 作为独立基础模型 `gpt-5.2-max`（effort 为空）
4) Raw 模式警告：切到 Raw 视图时出现警告条，且禁用 Effort 筛选
5) Effort 筛选联动：只勾选 High 时，只统计 High 的数据
6) 空状态：筛选无结果时可理解且可一键清除筛选
7) 移动端适配：窄屏隐藏 Effort Dist./Requests 等次要列
8) 搜索增强：模型筛选器搜 “high” 能命中其 canonical 父项
9) Dashboard 对齐：Top Models 与 /usage 默认视图口径一致

## 手动验证步骤（摘自 v4，<=10）
1) 准备数据：写入 `gpt-5.2-high`、`gpt-5.2-codex`、`gpt-5.2-max` 的使用记录
2) 默认视图：看到 `gpt-5.2 / gpt-5.2-codex / gpt-5.2-max`
3) 展开：`gpt-5.2` 展开后能看到 High 子行
4) Effort 筛选：选 High 后 `gpt-5.2` 数值变化，且不匹配的模型隐藏
5) Raw 切换：切 Raw 后出现警告条、列表变原始模型串、Effort 筛选不可用
6) Dashboard：Top Models 排序/口径与 /usage 默认视图一致
