# 旧版 OAuth 登录中心（src/modules/oauth.js）行为要点摘录（供实现方案参考）

> 目的：避免把整份 `src/modules/oauth.js`（约 949 行）塞进 Zen 上下文导致超预算；这里只保留“行为基线 + 端点映射 + 边界策略”。  
> 事实来源：`/Users/wenlong/wt-next-migration/src/modules/oauth.js`

## 1) 覆盖 Provider 与端点
旧版界面覆盖以下 OAuth/provider：
- codex：`GET /codex-auth-url?is_webui=1`
- anthropic：`GET /anthropic-auth-url?is_webui=1`
- antigravity：`GET /antigravity-auth-url?is_webui=1`
- gemini-cli：`GET /gemini-cli-auth-url?is_webui=1`
- qwen：`GET /qwen-auth-url?is_webui=1`
- iflow（URL OAuth）：`GET /iflow-auth-url?is_webui=1`

统一状态轮询：
- `GET /get-auth-status?state=...` → 返回 `{ status: "ok" | "error" | "wait", error?: string }`

## 2) URL OAuth 核心流程（旧版）
1) 点击“开始 OAuth” → 请求 `/*-auth-url?is_webui=1` 得到 `{ url }`
2) 从 url 里解析 `state`（`new URL(url).searchParams.get("state")`）
3) UI 展示：
   - URL 输入框（可复制/可打开）
   - 状态文本：waiting / success / error（带颜色）
4) 开始轮询：
   - `setInterval` 轮询 `get-auth-status?state=...`
   - status=ok：停止轮询 → reset UI → toast 成功 → `loadAuthFiles()` 刷新认证文件
   - status=error：停止轮询 → 展示错误 → toast 失败 → **3 秒后 reset UI**（允许重新开始）
   - status=wait：持续更新 waiting 文案

## 3) iFlow Cookie 登录（旧版）
旧版对 iFlow 提供额外“Cookie 登录”能力：
- 输入 cookie（必填校验）
- `POST /iflow-auth-url` body：`{ cookie }`
- 成功后展示结果字段（旧版 DOM id 暗示字段）：
  - email
  - expired
  - path
  - type

## 4) 边界与体验策略（建议迁移到 Next）
- 轮询需要 stop 条件（ok/error/异常）与 cleanup（避免页面离开仍继续请求）
- error 后 3 秒自动 reset（旧版一致）
- 成功后引导用户查看 Auth Files（旧版是“自动刷新文件列表”；Next 可做“跳转/刷新”闭环）

