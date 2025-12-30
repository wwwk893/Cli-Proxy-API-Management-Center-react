# UI设计｜src→next-app 功能全量迁移

- 生成时间：2025-12-26 14:59
- UI 产物批次：`plan/ui/batch-0/`
- 选定稿：v4 √（主人已授权“默认采用 v4”）

## 0) 设计约束（本任务强制）
- 延续 next-app 现有视觉语言：暗色玻璃拟态（`bg-card/..` + `border-border/..` + `backdrop-blur`）+ shadcn/ui + Tailwind。
- 页面结构统一：PageHeader（标题/副标题/操作区）+ 主 Card（承载主要交互）。
- 状态必须齐：loading / empty / error / disabled / confirm / dirty（尤其 Config Editor）。
- 文案必须 i18n：所有用户可见文案使用 `useI18n().t(key)`；新增 key 同步补齐 en/zh。
- 无账号/权限系统：迁移后保持旧版功能颗粒度，不引入 RBAC。

## 1) Batch 0：relevant_files（用于 Zen 上下文）
> 绝对路径清单见：`plan/ui/batch-0/relevant_files.txt`

- next-app/app/layout.tsx
- next-app/app/globals.css
- next-app/components/layout/sidebar.tsx
- next-app/components/i18n-context.tsx
- next-app/components/theme-context.tsx
- next-app/app/usage/page.tsx
- next-app/app/logs/page.tsx
- next-app/app/pipeline/page.tsx
- next-app/app/pricing/page.tsx
- index.html（旧版 sidebar/section 颗粒度参考）

## 2) v1（Codex）草图稿
产物：`plan/ui/batch-0/v1.codex.md`

```ascii
+--------------------------------------------------------------------------------------------------+
| Sidebar (w-56) |  <PageHeader>  Title / Subtitle                     [Primary] [Secondary]      |
|                |----------------------------------------------------------------------------------|
| - Dashboard    |  [Status Cards]  Connection · Server · Health · Version                          |
| - Login        |----------------------------------------------------------------------------------|
| - Settings     |  <Card> Filters / Form / Tabs / Table  (loading/empty/error/confirm/toast)       |
| - Providers    |----------------------------------------------------------------------------------|
| - Auth Files   |  Main content: ① 列表/表格 ② 编辑器 ③ 详情抽屉 ④ 图表（按页面选择）              |
| - Logs         |----------------------------------------------------------------------------------|
| - Usage        |  Footer: last updated · docs link · copy diagnostics                              |
+--------------------------------------------------------------------------------------------------+
```

要点摘要：
- `/login` 定位为连接/健康检查；`/settings` 用分组 Tabs 解决“信息太多一屏塞满”的问题。
- Auth Files 推荐表格或高密度列表，行内操作 + Drawer 详情；Config Editor 强调 dirty/save/reload。
- 强制统一 confirm/toast/empty/error 组件，避免每页一套。

## 3) v2（专家A：Gemini UI）草图稿（ASCII 原样贴出）
产物：`plan/ui/batch-0/v2.gemini.md`

```text
+------------------+-------------------------------------------------------+
| CLIProxy Center  |  Dashboard                               [Theme][Lang]|
+------------------+-------------------------------------------------------+
| [Dashboard]      |  +-------------------------------------------------+  |
| Login (Connect)  |  | PageHeader: Welcome back, System Online         |  |
+------------------+-------------------------------------------------------+
| Settings         |  +-------------------------------------------------+  |
|  > Providers     |                                                       |
| Auth Files       |  [ Status Cards Grid (4 cols)                    ]    |
| Logs             |  +-------+  +-------+  +-------+  +-------+       |   |
| Usage            |  | Conn  |  | Ver   |  | Cache |  | Cost  |       |   |
| Pipeline         |  |  OK   |  | v1.2  |  | 85%   |  | $0.4  |       |   |
| Pricing          |  +-------+  +-------+  +-------+  +-------+       |   |
| Config           |                                                       |
| System           |  +---------------------+  +------------------------+  |
|                  |  | Quick Actions       |  | Recent Activity        |  |
|                  |  | [Connect Server]    |  | > Auth file uploaded   |  |
|                  |  | [Upload Auth File]  |  | > Config updated       |  |
|                  |  | [Edit Config]       |  | > Provider added       |  |
| [Logout]         |  +---------------------+  +------------------------+  |
+------------------+-------------------------------------------------------+
```

要点摘要（保留专家观点，用于综合取舍）：
- 强调 Dashboard 的状态卡 + 快捷入口 + 最近活动。
- 强调 Config Editor 的“编辑→dirty→保存→校验→toast”闭环。
- 倾向在 `/login` 提供 base/key 输入并存储（此点与本仓库“server env”策略存在冲突，已纳入争议点收敛）。

## 4) v3（专家B：Claude Opus 4.5）草图稿（ASCII 原样贴出）
产物：`plan/ui/batch-0/v3.claude.md`

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR (w-56)          │  CONTENT AREA (max-w-7xl px-4 py-6)               │
│ ┌─────────────────────┐ │  ┌──────────────────────────────────────────────┐  │
│ │ CLIProxy Center     │ │  │ PAGE HEADER                                  │  │
│ ├─────────────────────┤ │  │ [Breadcrumb?] Title + Subtitle + Actions     │  │
│ │ ● Dashboard         │ │  └──────────────────────────────────────────────┘  │
│ │   Login/Health      │ │  ┌──────────────────────────────────────────────┐  │
│ │   Settings          │ │  │ MAIN CARD (bg-card/60 border-border/60)      │  │
│ │     └─ Providers    │ │  │ ┌────────────────────────────────────────┐   │  │
│ │   Auth Files        │ │  │ │ TOOLBAR: Search│Filter│Refresh│Actions│   │  │
│ │   Logs              │ │  │ ├────────────────────────────────────────┤   │  │
│ │   Usage             │ │  │ │ CONTENT: List/Form/Editor/Stats        │   │  │
│ │   Pipeline          │ │  │ │ [Loading] [Empty] [Error] states here  │   │  │
│ │   Pricing           │ │  │ └────────────────────────────────────────┘   │  │
│ │   Config            │ │  │ ┌────────────────────────────────────────┐   │  │
│ │   System            │ │  │ │ FOOTER: Pagination / Save / Status     │   │  │
│ └─────────────────────┘ │  │ └────────────────────────────────────────┘   │  │
│ [Theme] [Lang] toggles  │  └──────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

要点摘要：
- 强调“状态与边界”与“需要回滚的操作”清单（Settings/Providers 保存失败回滚；Config 保存失败保留内容）。
- 强调统一 ConfirmDialog/DirtyGuard/ListToolbar 等可复用组件，避免单文件爆炸。
- 给出反模式清单（密钥泄漏、日志大列表性能、不可逆提示不足、dirty 丢失等），利于实现阶段防翻车。

## 5) v4（综合推荐稿）√
产物：`plan/ui/batch-0/v4.final.md`

```ascii
+--------------------------------------------------------------------------------------+
| Sidebar |  <PageHeader>  Title + Subtitle                          [Primary][More]  |
|         |--------------------------------------------------------------------------------------|
|         |  [Status Cards]  Connection · Version · Health · Last Updated                          |
|         |--------------------------------------------------------------------------------------|
|         |  <Main Card>  Toolbar（Search/Filter/Refresh） + Content（List/Form/Editor/Stats）     |
|         |             States: loading / empty / error / confirm / dirty / disabled               |
|         |--------------------------------------------------------------------------------------|
|         |  Footer: Pagination / SaveBar / Tips / Copy Diagnostics                                |
+--------------------------------------------------------------------------------------+
```

最终决策摘要：
- `/login` 定位为 Connect & Health（默认不输入密钥）；如需临时覆盖仅作为开发态可选项，后续在实现方案评审安全影响。
- Auth Files：表格为主 + Drawer 详情；危险操作统一 AlertDialog（含“不可逆”）。
- Config Editor：SaveBar（dirty/last saved）+ DirtyGuard；保存失败不丢编辑内容。
- 全局统一：PageHeader、StatusCards、EmptyState、ErrorState（含 Copy+Retry）、CopyButton、ConfirmDialog。

## 6) 争议点清单
详见：`plan/ui/batch-0/disputes.md`

## 7) 设计验收（手动）
1. 逐个点击侧边栏：`/` `/login` `/settings` `/settings/providers` `/auth-files` `/config` `/system`
2. 切换主题（day/night）检查表单与卡片对比度
3. 切换语言（en/zh）检查标题/按钮/提示是否覆盖
4. 检查危险按钮：是否都有 confirm 且文案含“不可逆”
5. 检查空态/错误态是否有 CTA 与 Retry

---

# UI设计增量｜OAuth 登录中心（Batch 1）

- 生成时间：2025-12-26 17:54
- UI 产物批次：`plan/ui/batch-1/`
- 选定稿：v4 √（主人于 2025-12-29 10:12 选择）

## 8) Batch 1：relevant_files（用于 Zen 上下文）
> 绝对路径清单见：`plan/ui/batch-1/relevant_files.txt`

- src/modules/oauth.js（旧版 OAuth 登录中心行为基线）
- next-app/app/settings/providers/page.tsx（现有 OAuth Tab，作为风格/交互参考）
- next-app/app/api/providers/oauth-url/route.ts（生成 OAuth URL）
- next-app/app/api/providers/oauth-status/route.ts（轮询 OAuth 状态）
- next-app/app/auth-files/page.tsx（成功后引导/查看凭证）
- next-app/components/common/page-header.tsx（页面骨架）
- next-app/components/common/copy-button.tsx（复制交互）
- next-app/components/layout/sidebar.tsx（若新增 `/oauth` 入口）
- next-app/components/i18n-context.tsx（文案 key）

## 9) Batch 1：v1（Codex）草图稿
产物：`plan/ui/batch-1/v1.codex.md`

```ascii
+------------------------------------------------------------------------------------------------------+
| Sidebar | <PageHeader> OAuth 登录中心                          [查看 Auth Files] [帮助/文档]         |
|         |------------------------------------------------------------------------------------------------------|
|         |  ┌──────────────────────────────┐  ┌────────────────────────────────────────────────────┐ |
|         |  | Provider 选择（栅格卡片）      |  | 授权流程（Step Card）                               | |
|         |  | [Codex] [Anthropic] [AG]      |  | 1) 生成授权链接   [生成] [重置]                     | |
|         |  | [Gemini CLI] [Qwen] [iFlow]   |  | 2) URL（单行截断） [Copy] [Open]                    | |
|         |  | tags: URL OAuth / Cookie OAuth|  | 3) 状态：WAIT/OK/ERR + 进度/倒计时/超时              | |
|         |  └──────────────────────────────┘  | 4) 完成：Success CTA / Error 可复制 + Retry/Reset    | |
|         |                                    └────────────────────────────────────────────────────┘ |
|         |------------------------------------------------------------------------------------------------------|
|         |  <Accordion: iFlow Cookie 登录（仅当 provider=iFlow 展示）>                                         |
+------------------------------------------------------------------------------------------------------+
```

要点摘要：
- “独立 OAuth 登录中心页面”为主体验（建议 `/oauth`），`/settings/providers` 作为简版入口。
- ProviderGrid + AuthFlowPanel 两列结构，移动端堆叠。
- 强化轮询体验：2s 轮询 + 5min 超时 + error 后 3s reset。
- iFlow Cookie 登录收纳在折叠高级区。

## 10) Batch 1：v2（专家A：Gemini UI）草图稿（ASCII 原样贴出）
产物：`plan/ui/batch-1/v2.gemini.md`

```text
+-----------------------------------------------------------------------+
|  OAuth 登录中心                                        [ 刷新状态 ]   |
|  连接第三方服务以获取访问凭证。                                       |
|                                                                       |
|  [ 1. 选择提供商 ]                                                    |
|  +-----------+  +-----------+  +-----------+  +-----------+           |
|  | [Icon]    |  | [Icon]    |  | [Icon]    |  | [Icon]    |           |
|  | Codex     |  | Anthropic |  | iFlow     |  | Gemini    |           |
|  | (URL)     |  | (URL)     |  | (URL/Ck)  |  | (CLI)     |           |
|  +-----------+  +----^------+  +-----------+  +-----------+           |
|                      | (选中高亮)                                     |
|                                                                       |
|  [ 2. 授权流程: Anthropic ] ---------------------------------------+  |
|  |                                                                 |  |
|  |  状态: [ (Wait) 等待授权... 04:58 ]  [ 进度条::::::::::::: ]    |  |
|  |                                                                 |  |
|  |  授权链接:                                                      |  |
|  |  +--------------------------------------------------+ [打开]    |  |
|  |  | https://anthropic.com/login/oauth/authorize...   | [复制]    |  |
|  |  +--------------------------------------------------+           |  |
|  |                                                                 |  |
|  |  [ ⚠ 遇到错误? 重置流程 ]                                       |  |
|  |                                                                 |  |
|  +-----------------------------------------------------------------+  |
|                                                                       |
|  > 高级选项 (仅 iFlow 可见): 手动录入 Cookie [折叠/展开]              |
+-----------------------------------------------------------------------+
```

要点摘要（保留专家观点，用于综合取舍）：
- 强调“沉浸式状态感知”：Badge + 倒计时 + 进度条，减少“等待焦虑”。
- 成功态建议提供强引导（结果卡片/overlay + 去 Auth Files CTA）。
- iFlow Cookie 登录作为高级折叠区，保证主流程清爽。

## 11) Batch 1：v3（专家B：Claude Opus 4.5）草图稿（ASCII 原样贴出）
产物：`plan/ui/batch-1/v3.claude.md`

```
┌─────────────────────────────────────────────────────────────────┐
│  🔐 OAuth 登录中心                              [?帮助] [×关闭] │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Codex   │ │Anthropic│ │Gemini   │ │  Qwen   │ │ iFlow ▼ │   │
│  │  [URL]  │ │  [URL]  │ │  [URL]  │ │  [URL]  │ │[URL|Cookie]│ │
│  └────●────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  ▶ 授权链接                                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ https://auth.openai.com/authorize?state=abc12...   [复制] │  │
│  └───────────────────────────────────────────────────────────┘  │
│  [🌐 在浏览器中打开]                                            │
│                                                                 │
│  状态: ⏳ 等待授权中...  ██████░░░░ 3:42 剩余                   │
│  ⚠️ 授权链接含敏感 state，请勿分享给他人                        │
├─────────────────────────────────────────────────────────────────┤
│  ▼ 高级: Cookie 登录 (仅 iFlow)                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 粘贴 cookie...                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│  [提交 Cookie]                                                  │
├─────────────────────────────────────────────────────────────────┤
│  ✅ 授权成功！ → [查看 Auth Files] [刷新凭据列表]               │
└─────────────────────────────────────────────────────────────────┘
```

要点摘要：
- 强调边界处理：stop polling、超时、错误 3 秒 reset、切换 provider confirm、卸载清理。
- 强调安全提示：URL 的 state 与 Cookie 的敏感性不可忽略，且不应持久化。
- 建议用状态机实现，便于拆分组件与复用 hook。

## 12) Batch 1：v4（综合推荐稿）√
产物：`plan/ui/batch-1/v4.final.md`

推荐结论：
- 建议主人优先选择 v4：结构清晰、边界齐全、与 next-app 现有风格兼容。
- 争议点与取舍详见：`plan/ui/batch-1/disputes.md`
