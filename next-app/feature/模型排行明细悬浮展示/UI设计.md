模型排行明细悬浮展示 - UI 设计与交互草图（生成时间：2025-12-22 09:54）

Batch 0 relevant_files
- /Users/wenlong/Cli-Proxy-API-Management-Center-react/next-app/components/charts/usage-model-table.tsx
- /Users/wenlong/Cli-Proxy-API-Management-Center-react/next-app/app/usage/components/usage-content.tsx
- /Users/wenlong/Cli-Proxy-API-Management-Center-react/next-app/app/api/usage/by-model/route.ts
- /Users/wenlong/Cli-Proxy-API-Management-Center-react/next-app/lib/usage-aggregate.ts
- /Users/wenlong/Cli-Proxy-API-Management-Center-react/next-app/prisma/schema.prisma
- /Users/wenlong/Cli-Proxy-API-Management-Center-react/next-app/components/ui/tooltip.tsx
- /Users/wenlong/Cli-Proxy-API-Management-Center-react/next-app/components/ui/popover.tsx

## v1（自拟）
### ASCII 草图
```
模型排行表格
┌────────────────────────────────────────────────────────────────────┐
│ Model     Requests  Failed  Total Tokens   Cache Hit   Cost (USD) │
├────────────────────────────────────────────────────────────────────┤
│ ▶ ● gpt-5.2-codex   160      0      18.3M    90% ███   $4.763  ⓘ  │
│    ┌───────────────────────────────────────────────────────────┐   │
│    │ Token 明细              价格明细（金额）                    │   │
│    │ 输入 12.3M              输入 $1.234                        │   │
│    │ 输出  5.8M              输出 $3.529                        │   │
│    │ 思考  0.2M (计入输出)   价格未配置 → 未配置                │   │
│    └───────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

### 交互流程
- Desktop：模型名旁「ⓘ」hover 展示 Tooltip；点击「ⓘ」固定 Popover（再次点击关闭）。
- Touch：点击「ⓘ」打开 Popover（不依赖 hover）。
- loading：与列表数据同批获取，明细不额外请求；若异步扩展，则显示小骨架。
- empty：该模型 Token 全为 0 显示“暂无明细数据”。
- error：明细计算异常显示“明细获取失败”与重试入口（若走异步）。
- disabled/权限不足：不涉及。

### 组件拆分建议
- `ModelDetailTrigger`：统一处理 hover/点击与冒泡阻止。
- `ModelDetailPopover`：使用 Popover 渲染内容。
- `ModelDetailContent`：Token/价格明细列表与“未配置”提示。

### 交互细节
- `ⓘ` 图标仅在 hover 行时显现（减少噪音），focus 时显示 ring。
- 明细项为两列网格；缺价显示“未配置”并用淡橙色提示。
- Popover `side="right"`，避免遮挡模型名列。

### 验收点清单
- hover + 点击均可触发明细；触控设备可点击。
- 明细含输入/输出/思考 Token 与输入/输出金额。
- 未配置价格显示“未配置”。

---

## v2（UI 专家A · gemini 3 pro）
### ASCII 草图
```
+-------------------------------------------------------+
| [Model Name] gpt-4-turbo-preview                  [x] |
+-------------------------------------------------------+
| Metric       Tokens       Cost (Est.)                |
| Input        1.2M         $12.00                     |
| Output       0.8M         $24.00                     |
| Reasoning    150K         (Incl. in Output)          |
| Cached       500K         -$0.50                     |
| Total        2.15M        $35.50                     |
| [Badge] Gateway Mode (Reasoning billed as Output)    |
+-------------------------------------------------------+
```

### 交互流程
- Desktop：hover 300ms 预览；点击 Info 固定显示；移出 150ms 关闭。
- Touch：点击模型名触发 Popover。
- 数据与列表接口同批返回；无二次加载。
- 缺价：金额列显示“未配置”，警示色。

### 组件拆分建议
- `components/charts/model-usage-popover.tsx` 独立 Popover。
- 表格仅负责渲染与传参，避免文件过大。

### 交互细节
- Info 图标为触发器，hover 变色。
- Reasoning 行提示“计入输出金额”。

### 验收点清单
- API 返回 input/output/reasoning token。
- 点击 Info 触发 Popover；移动端不溢出屏幕。
- 价格缺失显示“未配置”。

---

## v3（UI 专家B · claude-4.5-opus）
### ASCII 草图
```
表格行内 hover Popover + 触控 inline 展开
┌──────────────────────────────────────────────────────────────┐
│ ▶ ● claude-3.5  ...  $8.900   ← hover/click                  │
│   ┌───────────────────────────────────────────────────────┐  │
│   │ Token 明细 | 金额明细                                   │  │
│   │ 输入 800K  | 输入 $3.200                                │  │
│   │ 输出 350K  | 输出 $5.250                                │  │
│   │ 思考  50K  | (含思考)                                   │  │
│   └───────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 交互流程
- Desktop：hover 300ms 预览，点击固定；Esc 关闭。
- Touch：点击模型名 → inline 明细行展开（TableRow）。
- loading：若异步显示 Skeleton（150ms 延迟）。
- empty/error：空态与重试按钮可见。

### 组件拆分建议
- 模块化拆分：`model-detail-trigger`/`model-detail-popover`/`model-detail-inline`/`model-detail-content`。

### 交互细节
- focus/active/hover 高亮行与触发器。
- “未配置”以弱警示色 + 斜体展示。

### 验收点清单
- hover/click/touch 均可触发。
- 键盘可访问（Enter/Space/Esc）。
- 缺价提示明确。

---

## v4（综合推荐稿）√
### 取舍理由
- 保留 v3 的“触控 inline 展开”思路，确保无 hover 的设备可用。
- 采用 v2 的简洁 Popover 信息密度与“Reasoning 计入输出”文案。
- 约束在现有表格结构内，尽量减少大型拆分，仅新增 2–3 个小组件。

### ASCII 草图
```
模型排行表格（保持原列）
┌────────────────────────────────────────────────────────────────────┐
│ Model ... Cost (USD)                                               │
├────────────────────────────────────────────────────────────────────┤
│ ▶ ● gpt-5.2-codex ... $4.763  ⓘ                                   │
│    ┌───────────────────────────────────────────────────────────┐   │
│    │ Token 明细        价格明细（金额）                          │   │
│    │ 输入 12.3M        输入 $1.234                              │   │
│    │ 输出  5.8M        输出 $3.529                              │   │
│    │ 思考  0.2M        计入输出金额                              │   │
│    │ 缓存  1.1M        缓存 $0.125                               │   │
│    └───────────────────────────────────────────────────────────┘   │
│  （触控设备：点击 ⓘ 后在行下方展开同样内容）                       │
└────────────────────────────────────────────────────────────────────┘
```

### 交互流程
- Desktop：hover ⓘ 触发 Tooltip；点击 ⓘ 固定 Popover；再次点击关闭。
- Touch：点击 ⓘ 展开 inline 明细行（TableRow + Collapsible）。
- loading：明细随列表数据返回（无额外请求）；若后端延迟填充显示骨架。
- empty：Token 全为 0 → “暂无明细数据”。
- error：展示“明细获取失败”与“重试”（仅在异步模式）。

### 组件拆分建议
- `ModelDetailTrigger`：处理 hover/点击/冒泡与键盘行为。
- `ModelDetailContent`：Token + 价格明细网格（可复用）。
- `ModelDetailInline`：触控 inline 展开容器（可选）。

### 交互细节
- 触发器 `aria-haspopup="dialog"`、`aria-expanded`。
- 未配置价格：金额列显示“未配置”且附 `text-muted-foreground` + `italic`。
- 价格拆分由后端返回字段（`inputCostUsd`/`outputCostUsd`），避免前端再计算。

### 验收点清单
- hover 与点击均可查看明细；触控设备可 inline 展开。
- 明细字段齐全且与筛选条件一致。
- 未配置价格清晰可见。

---

## 差异矩阵
| 维度 | v1 | v2(专家A) | v3(专家B) | v4(综合) | 是否争议 | 备注/依赖 |
| -- | -- | -- | -- | -- | -- | -- |
| 触发方式 | ⓘ hover + click | hover+click | hover+click+inline | hover+click+inline | 否 | 统一 |
| 触控适配 | 点击 ⓘ popover | 点击 ⓘ popover | inline 展开 | inline 展开 | 是 | 触控体验 |
| 信息密度 | 中 | 高 | 高 | 中高 | 否 | 维持可读性 |
| 组件拆分 | 小拆分 | 单独 popover | 模块化拆分 | 小拆分 | 是 | 控制改动范围 |
| 价格拆分来源 | 前/后皆可 | 偏前端 | 偏后端 | 后端字段 | 是 | 减少误差 |
| 交互动画 | 简单 | 简单 | 详细 | 简单 | 否 | 成本考虑 |
| 键盘可访问 | 基础 | 基础 | 完整 | 基础 | 是 | 视投入 |

## 争议评分与结论
- 争议维度：触控适配、组件拆分、价格拆分来源、键盘可访问（共 4 项）
- 评分：total_score=2（仅“组件拆分/键盘可访问”存在差异），无 P0
- 结论：不触发深挖批次，采用 v4 作为实现参考

## 深挖批次记录
- 无（未触发）

## 附：验收点清单（汇总）
- 视觉：明细浮层/行内展开在浅色与暗色主题下可读；未配置提示对比度合格。
- 交互：hover/点击/触控均可触发；行点击与明细触发互不冲突。
- 状态：loading/empty/error 明确；失败可重试（如异步）。
- 可访问性：触发器可聚焦，Esc 关闭，aria 标注齐全。
