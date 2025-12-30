---
schema: ui_review_package_v1
task:
  name: "src→next-app 功能全量迁移"
  dir: "feature/src→next-app 功能全量迁移"
batch:
  id: "0"
  dir: "feature/src→next-app 功能全量迁移/plan/ui/batch-0"
meta:
  timestamp: "2025-12-26 14:40"
  owner: "主人"
---
# UI评审包（填写后给 Zen 用）

## 1) 背景与目标
- 背景：旧版 `src/` 静态 WebUI 仍承载大量核心功能；Next 版 `next-app/` 已有基础布局、主题与部分页面，但缺少多页模块与统一交互。
- UI 目标：
  - 统一风格：延续 next-app 现有“夜间玻璃拟态 + 清晰信息层级”的视觉语言（Tailwind + shadcn/ui）。
  - 强交互：表单/列表/危险操作都具备明确反馈（loading、空态、错误态、disabled、confirm、toast）。
  - 可扩展：后续新增模块时能复用同一套布局、页面骨架与组件模式。
  - i18n：所有文案可中英切换（`useI18n().t`）。

## 2) 需要设计/补齐的路由（按导航颗粒度）
- `/`（Dashboard）：提供“连接状态 + 快捷入口 + 最近操作提示”的统一入口（不做权限）。
- `/login`：从“登录”语义转为“连接/健康检查/环境提示”（无账号体系）。
- `/settings`：基础设置（开关/输入项）为主，信息密度适中，避免一屏塞满。
- `/settings/providers`：Providers & OAuth（key 管理 + OAuth 跳转/回填）。
- `/auth-files`：Auth Files 列表（筛选/搜索/分页/统计）+ 下载/删除确认。
- `/config`：Config Editor（编辑器 + 脏态 + 保存/重载/下载）。
- `/system`：系统信息与诊断（版本/连接/复制/排障提示）。
- 现有页面（需对齐风格与交互细节，不重做）：`/usage`、`/logs`、`/pipeline`、`/pricing`。

## 3) 布局与组件约束（延续现状）
- 侧边栏：沿用 `next-app/components/layout/sidebar.tsx` 结构与宽度（`w-56`），当前激活态清晰。
- 内容区：沿用 `max-w-7xl mx-auto px-4 py-6` 的栅格与间距。
- 主题：支持 day/night/system（`ThemeProvider`），默认夜间；所有新页面必须在两种主题下可读。
- 组件：优先复用 `components/ui/*`（shadcn/ui）与现有卡片/按钮风格。

## 4) 交互与状态覆盖（必须显式设计）
- 通用状态：loading（骨架/占位）、empty（引导操作）、error（可重试 + 错误摘要）、disabled（原因提示）。
- 危险操作：删除/清空/覆盖写入必须二次确认（confirm 文案明确“不可逆”）。
- 表单保存：保存中禁用按钮；成功 toast；失败 toast + 回滚 UI 值。
- 列表体验：搜索/筛选即时反馈；分页清晰；大列表避免一次性渲染过多内容。

## 5) 需要重点打磨的“视觉亮点”（可选但推荐）
- “状态卡片”统一：连接状态、版本信息、配置健康度（例如 env 缺失提示）用同一套卡片样式。
- “空态”统一：每个页面空态都有 icon + 一句解释 + 主按钮引导。
- “诊断”友好：错误信息可复制，给出下一步建议（例如检查 env/检查后端）。
