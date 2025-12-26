# 任务6：Sessions 报表 + 多来源用量区分/对比 TODO

> 规则：后续每完成一个任务点，就在对应项后打勾（`[x]`）。  
> 本文件只记录任务6，其他大功能也遵循同样做法。

## 已完成（设计与确认）
- [x] 完成现有 `/usage` 页面与组件梳理
- [x] 完成 Zen 第1轮 UI/IA 评审（gemini + claude）
- [x] 形成页面/信息架构提案
- [x] 完成 Zen 第2轮复审并定稿
- [x] 用户确认：Tabs 在 `/usage` 内、MVP 包含 `channel-model`、turn=token_count

## 后端 API（MVP）
- [x] 扩展 URL schema：新增 `channels`（多值）与 `dimension=viewMode=channel/channel-model`
- [x] 扩展 `GET /api/usage`：支持按 `sourceType` 聚合（channel/channel-model），cost 使用 `SUM(costUsd)`
- [x] 新增 `GET /api/usage/sessions`：按 sessionId 聚合列表（分页/排序/filters/q/facets）
- [x] 新增 `GET /api/usage/sessions/:sessionId/events`：返回单 session 明细事件时间线
- [x] 为 Sessions API 补充 Zod schema 与类型（query/response）

## 前端页面（MVP）
- [x] `/usage` 顶部 Tabs：Overview / Sessions（共享 FiltersBar 状态）
- [x] FiltersBar 增加 Channel 多选下拉（含图标 + tooltip + URL 状态）
- [x] Overview MainChart 增加 viewMode：By Channel / Channel×Model
- [x] KPI Cards 在 All Channels 下显示 CLI vs Gateway 占比拆分
- [x] Sessions Tab：二级筛选条（q/model/originator/deviceId/effort）
- [x] Sessions Table：列与排序（lastActivity 默认 desc；tokens 合并列；cwd 末尾截断）
- [x] Sessions Drawer(Sheet)：meta+totals+事件时间线（按 token_count turn）
- [x] 空态：Gateway-only 时的解释 + 一键切换按钮
- [x] i18n 文案补齐（Channel/Session/空态/列名/视图标签）

## 手动验证与对账（MVP）
- [ ] 手动跑 `npm run codex:ingest` 与 `npm run usage:aggregate` 补齐数据
- [ ] Overview：对比 All vs 单 Channel 的 tokens/cost/趋势是否一致
- [ ] Sessions：筛选/分页/排序/明细加载是否正确
- [ ] 抽样对账：Sessions totals 与 UsageEvent 明细 SUM 一致
