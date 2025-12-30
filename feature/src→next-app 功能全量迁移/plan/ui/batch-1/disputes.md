# 争议点清单（Batch 1：OAuth 登录中心）

1) 路由归属：`/oauth`（独立入口） vs `/settings/providers` 内嵌（延续原位置）
2) 成功后动作：仅提示并引导跳转 `/auth-files` vs 自动触发“刷新 Auth Files”动作
3) 错误后 reset：严格对齐旧版“3 秒自动 reset” vs 给用户停留查看错误（需按钮手动 reset）
4) Provider 切换策略：轮询中强制禁止切换 vs 允许切换但必须 confirm 并自动 stop polling
5) iFlow Cookie 登录：是否必须一并落地（旧版有） vs 作为后续增量（本次仅 UI 预留）
6) 安全提示强度：仅文案提示 vs 复制/打开前增加 confirm（更安全但更打扰）

