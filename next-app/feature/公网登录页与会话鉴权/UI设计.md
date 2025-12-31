# 公网登录页与会话鉴权 - 登录页 UI 设计（生成时间：2025-12-30 12:14）

## 1) 设计目标
- 高端/克制：深色低饱和 + 玻璃拟态 + 轻光晕背景，避免花哨插画。
- 信息清晰：校验/加载/错误/成功态“可读且不打扰”。
- 移动端友好：单栏，按钮与切换易点击，状态提示不遮挡。
- 安全语义明确：hostname 固定，仅输入端口；提示用户“仅支持 https”。

## 2) 推荐稿（v1）
### 2.1 布局草图（移动端/桌面通用）

```
┌──────────────────────────────────────────────────────────┐
│  CLIProxy Management Center                 [中文|EN]    │
│  Sign in to Console / 登录管理控制台                      │
│  Enter the port and admin key to connect.                 │
│                                                          │
│  Host (fixed)   example.com                               │
│  Port           [ 3818                ]                   │
│  Admin Key      [ ******************* ][ 👁 ]             │
│  [ ] Remember for 30 days                                 │
│                                                          │
│  [ Test connection ]   [ Sign in ]                        │
│                                                          │
│  Status: Testing... / Connected (vX) / Error (401/timeout)│
└──────────────────────────────────────────────────────────┘
```

### 2.2 关键交互
- Host：只读展示（来自 `NEXT_PUBLIC_SITE_URL`），避免用户误填 hostname。
- Port：仅允许 1..65535；失焦/提交时显示错误；输入框保持紧凑但易点击。
- Admin Key：默认 password，支持显隐；支持粘贴；不做格式化。
- Test connection：
  - loading：禁用按钮并显示“Testing…”
  - success：显示 Connected + serverVersion/buildDate（若有）
  - error：分级提示（端口非法/无法连接/401/403/非管理服务）
- Sign in：
  - 若未 probe，内部先 probe，失败则停留并聚焦错误字段。
  - 成功后跳转 `next`（安全校验）或 `/`。

### 2.3 组件组合（shadcn/ui）
- `Card`（玻璃拟态容器）+ `Label` + `Input` + `Button`
- 语言切换：`DropdownMenu`
- 状态提示：`Alert` 或 `Badge + text`
- 显隐密码：`Button` variant `ghost` size `icon-sm` + lucide icon

### 2.4 Tailwind 样式要点（类名方向）
- 外层：`min-h-screen bg-page flex items-center justify-center px-4`
- 卡片：复用 `.bg-glass` + `shadow-2xl shadow-black/30` + `border-white/10`
- 标题：`text-2xl font-semibold tracking-tight`
- 描述：`text-sm text-muted-foreground`
- 输入 focus：`focus-visible:ring-[3px] focus-visible:ring-ring/40`
- 主按钮：`default`；次按钮：`outline/secondary`

## 3) 文案（中英）
- 标题：`登录管理控制台` / `Sign in to Console`
- 副标题：`请输入端口与管理员密钥以连接管理服务（仅支持 HTTPS）。` / `Enter the port and admin key to connect (HTTPS only).`
- 字段：
  - Host：`域名（固定）` / `Host (fixed)`
  - Port：`端口` / `Port`
  - Admin Key：`管理员密钥` / `Admin Key`
- 按钮：`测试连接` / `Test connection`；`登录` / `Sign in`
- 状态：
  - `正在测试连接…` / `Testing connection…`
  - `连接成功` / `Connected`
  - `认证失败：密钥无效或无权限` / `Authentication failed: invalid key or insufficient permissions.`
  - `无法连接：请检查端口/网络/证书` / `Cannot connect: check port/network/certificate.`
  - `目标不是管理服务（请确认端口）` / `Target is not a management service (check the port).`
