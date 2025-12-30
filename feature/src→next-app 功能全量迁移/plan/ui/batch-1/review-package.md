---
schema: ui_review_package_v1
task:
  name: "src→next-app 功能全量迁移"
  dir: "feature/src→next-app 功能全量迁移"
batch:
  id: "1"
  dir: "feature/src→next-app 功能全量迁移/plan/ui/batch-1"
meta:
  timestamp: "2025-12-26 17:54"
  owner: "主人"
---
# UI评审包：OAuth 登录界面迁移与重设计（给 Zen 用）

## 1) 背景与问题
- 旧版：`src/modules/oauth.js` 提供一个“OAuth 登录中心”式界面，覆盖 codex/anthropic/antigravity/gemini-cli/qwen/iflow，并包含：
  - 生成授权链接（`/*-auth-url?is_webui=1`）
  - 轮询状态（`/get-auth-status?state=...`，wait/ok/error）
  - 成功后刷新 Auth Files
  - iflow 额外支持“Cookie 登录”（POST `/iflow-auth-url` body `{ cookie }`）并展示结果信息
- 现状：Next 版 `next-app/` 仅在 `/settings/providers` 的 OAuth Tab 中提供“生成 URL + 简单轮询”，缺少旧版“登录中心”的体验与完整能力（尤其 iflow cookie 登录与成功后的引导/刷新闭环）。

## 2) UI 目标（必须）
- 迁移补齐：Next 侧补回“OAuth 登录界面”的完整能力（以旧版 oauth.js 为行为基线）。
- 视觉更美观：延续 next-app 现有暗色玻璃拟态 + shadcn/ui 的风格，信息层级更清晰。
- 交互更好用：
  - 生成链接、复制/打开、轮询状态、失败恢复、成功引导清晰且“可复用”
  - 覆盖 loading/empty/error/disabled/timeout/confirm/toast
- 可扩展：后续新增 Provider OAuth 时，尽量只需补一个配置项，而非复制一套组件。
- i18n：所有用户可见文案必须 `useI18n().t(key)`（en/zh 都要补齐）。

## 3) 范围与非范围
### 范围（本次要设计）
- 设计一个独立“OAuth 登录中心”页面（建议新增路由：`/oauth` 或 `/login/oauth`，由实现阶段定稿），包含：
  1) Provider 选择与能力说明（哪些支持 URL OAuth、哪些支持 Cookie）
  2) “生成授权链接”卡片：展示 URL、Copy/Open、状态 badge、重置/重新生成
  3) “状态轮询”与超时策略（参考旧版：2s 轮询 + 5min 超时 + error 后 3s reset）
  4) 成功后动作：提示已完成并提供 CTA（打开 Auth Files / 刷新 Auth Files）
  5) iflow Cookie 登录：一个可折叠的高级区（输入 cookie、提交、显示结果字段）
- 与现有 `/settings/providers` 的 OAuth Tab 协调：可以保留为“快速入口/简版”，但 OAuth 登录中心才是主体验。

### 非范围（本次不做）
- 不引入账号体系/RBAC。
- 不设计数据库模型；OAuth 登录页面只通过 Next `/api/*` 调 management API，不要求本地持久化（是否需要后续扩展再说）。
- 不在 UI 评审阶段落地业务代码（只输出设计稿与交互规范）。

## 4) 关键交互（必须显式设计）
- 主路径（URL OAuth）：
  1) 选择 Provider → 点击“生成授权链接”
  2) 显示 URL（可复制/可打开）+ 状态“等待中”
  3) 轮询状态（显示剩余时间/超时提示更佳）
  4) ok：停止轮询 → toast 成功 → 提示“可到 Auth Files 查看/已刷新”
  5) error：展示错误摘要 + toast → 3 秒后重置到“可重新开始”
- iflow Cookie 登录（高级）：
  - 输入 cookie → 提交 → 显示成功/失败与结果字段（email/expired/path/type 等）
  - 成功后同样引导刷新/查看 Auth Files
- 可用性与安全：
  - URL 可能较长：提供单行截断 + 一键复制 + “打开新窗口”
  - 状态信息可复制（方便排障）
  - 不在前端暴露管理密钥；浏览器只请求 Next `/api/*`

## 5) 视觉亮点建议（可选但推荐）
- Provider 卡片栅格：每个 Provider 有 icon/名称/能力标签（URL OAuth / Cookie OAuth）。
- 状态条（Polling）：用 Badge + progress/倒计时增强“正在等待”的可感知性。
- 成功态：带绿色高亮的“下一步”卡片（去 Auth Files 查看）。
- 错误态：可复制的错误详情 + Retry / Reset 主按钮。

