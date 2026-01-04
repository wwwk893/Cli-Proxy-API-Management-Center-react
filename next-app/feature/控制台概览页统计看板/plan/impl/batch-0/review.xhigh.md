---
schema: review_xhigh_v1
task:
  name: "控制台概览页统计看板"
  dir: "feature/控制台概览页统计看板"
batch:
  id: "0"
meta:
  timestamp: "2026-01-04 11:06"
  reviewer: "auditor-xhigh"
inputs:
  - "feature/控制台概览页统计看板/plan/impl/batch-0/plan.pro.md"
  - "feature/控制台概览页统计看板/plan/impl/batch-0/review-package.md"
  - "feature/控制台概览页统计看板/UI设计.md"
---

# Review.Xhigh — 控制台概览页统计看板 / Batch 0

## Verdict
- 结论：PASS

## Summary（3–6条）
- 方案整体对齐约束：Next.js(App Router)+TS+Tailwind+shadcn/ui、单端点 `/api/dashboard/overview`、局部降级（`allSettled + partialErrors`）、趋势图可用纯 SVG 避免重依赖。
- 明确落实“Server 内不再 HTTP 自调自身 API”的建议（强调直连 Prisma/management client）。
- DTO/页面状态/竞态治理（AbortController + requestSeq）完整度高，覆盖 AC2“无错乱”。
- AC3 状态矩阵覆盖全面，并明确每块至少一个跳转入口覆盖 `/usage /pipeline /logs /system /settings /pricing`。
- 需把若干 P1 在最终施工图中硬化（目录约定、降级不误导、timeout 可取消、Action Center 触发规则表）。

## P0（阻塞）
- 无（PASS）

## P1（重要）
1) 【问题】Dashboard 组件目录命名偏离现有 repo 约定（引入 `app/(app)/_components/...` 新范式）
- 影响：目录风格漂移、后续 import/维护成本上升。
- 具体改法：把 `app/(app)/_components/dashboard/**` 收敛到 `app/(app)/components/dashboard/**`（或与现有 usage 类似的就近 components 目录），并同步更新施工图中的文件清单与依赖方向。
- 涉及文件：`feature/控制台概览页统计看板/plan/impl/batch-0/plan.pro.md`

2) 【问题】局部降级“如何不误导用户”缺少强约束：失败时默认值可能被误显示为真实 0
- 影响：用户被误导为“系统正常/无失败”，Action Center 也可能漏触发。
- 具体改法（二选一，推荐 A）：
  - A) 让可降级模块可空：`pipeline/configHealth/logs/topModels/trend.buckets` 允许为 `null`，UI 对 `null` 显示“—/不可用”+跳转。
  - B) 增加 `availability` 映射并强制 UI 不展示误导性 0。
- 涉及文件：`feature/控制台概览页统计看板/plan/impl/batch-0/plan.pro.md`

3) 【问题】timeout 方案缺少“可取消（abort）”细节：`withTimeout(promise)` 无法停止 management fetch
- 影响：超时后请求仍继续跑，削弱降级对系统压力的缓解。
- 具体改法：把 `withTimeout` 改为“传入工厂函数 + AbortSignal”，仅对 fetch 可真正 abort；Prisma 查询则靠范围/点数控制并写明不可取消。
- 涉及文件：`feature/控制台概览页统计看板/plan/impl/batch-0/plan.pro.md`

4) 【问题】`fetchConfigHealth` 多管理端请求缺少并行与子降级策略
- 影响：configHealth 整块失败或误导性回填；串行会放大超时概率。
- 具体改法：在施工图明确：内部 `Promise.allSettled` 并行；子项失败置 `null/unknown` 并记录 `partialErrors`（可细分 code）。
- 涉及文件：`feature/控制台概览页统计看板/plan/impl/batch-0/plan.pro.md`

5) 【问题】Action Center 缺少“触发规则表（阈值/映射/兜底）”
- 影响：实现者自由发挥导致不足 3 条、跳转不覆盖 AC3、severity 不一致。
- 具体改法：补一个最小规则表（system disconnected / pipeline failed / missing pricing / missing keys/providers / usage disabled / 默认导航项补齐 3–5）。
- 涉及文件：`feature/控制台概览页统计看板/plan/impl/batch-0/plan.pro.md`

## P2（建议）
1) channel/codexPaths 常量建议复用现有常量，避免口径漂移。
- 具体改法：明确复用 `lib/usage/aggregation-constants.ts`（如 `CODEX_API_PATHS`）或同等来源。

2) overview query 校验建议复用现有 schema/validation 工具，保持风格一致。

3) 日志 meta 的来源表述需与现状对齐（当前 `/api/logs` 返回 JSON 字段而非 header）。

4) Feature Flag 建议作为可选项，且优先只做前端渲染开关，避免双端开关引入额外状态分支。

5) i18n 拆分兜底：若 locale messages 仍超 600 行，按域拆分并在 index 聚合导出。

## Verification（建议验收 Checklist）
- [ ] AC1：打开 `/`，默认 `last-24h/all`，首屏 KPI<=6 + 主趋势 + TopModels + ActionCenter；结构对齐 `feature/控制台概览页统计看板/UI设计.md`。
- [ ] AC2：快速切换 4×timeWindow 与 3×channel，无旧数据闪回；Network 每次仅 1 个 `/api/dashboard/overview` 请求。
- [ ] AC3：验证 loading/empty/error/disconnected/auth；逐块点击跳转覆盖 `/usage /pipeline /logs /system /settings /pricing`。
- [ ] 局部降级：让 logs/providers/pipeline 任一源失败，页面仍可用，且失败模块显示“—/不可用”而不是误导性 0，并出现 partialErrors 提示。
- [ ] 安全：检查 `/api/dashboard/overview` 响应体不包含任何 key 明文/可逆信息（仅数量/布尔/覆盖率）。
- [ ] 性能：确认 overview 内不 HTTP 自调 `/api/*`；只走 Prisma + management client。
- [ ] timeout：management 请求超时可 abort；超时归一为 `partialErrors(code="TIMEOUT")`。
- [ ] 口径一致性：Dashboard 的 channel/codexPaths 与 `/api/usage` 逻辑一致（复用常量）。
- [ ] 代码规则：新增/修改文件 <=600 行（尤其 i18n 拆分后的文件）。
