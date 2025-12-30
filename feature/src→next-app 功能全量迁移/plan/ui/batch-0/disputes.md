---
schema: ui_disputes_v1
items:
  - id: "D1"
    title: "/login 是否允许输入 base/key"
    decision: "默认不允许（采用服务端 env）；如需临时覆盖仅作为开发态可选项，需在实现方案单独评审安全影响"
  - id: "D2"
    title: "Auth Files 列表形态：卡片 vs 表格"
    decision: "表格为主（信息密度更高）+ Drawer 详情；必要时再补 Grid/List 切换"
  - id: "D3"
    title: "危险操作确认：window.confirm vs Dialog"
    decision: "统一使用 shadcn AlertDialog，并强制文案包含“不可逆”"
  - id: "D4"
    title: "i18n 组织方式：本地字典 vs locales 文件"
    decision: "沿用现有 `components/i18n-context.tsx` 的 messages(en/zh) 结构，新增 key 同步补齐两种语言"
---
# 争议点清单（<=8条）

1) `/login` 输入 base/key 的取舍  
- 争议：是否沿用旧版“浏览器输入并存储”方式。  
- 结论：默认采用服务端 env（更安全、与现有 next-app 逻辑一致）；如主人后续确需临时覆盖，仅作为开发态可选项并单独评审。  

2) Auth Files 列表呈现  
- 争议：卡片更“好看”，表格更“好用”。  
- 结论：管理台场景优先表格（密度与可扫描性更好），详情用 Drawer。  

3) 危险操作二次确认一致性  
- 争议：现有页面部分使用 `window.confirm`（实现快但体验一般）。  
- 结论：统一 `AlertDialog`，文案包含“不可逆”，并提供 Cancel。  

4) i18n 落地方式  
- 争议：是否引入新的 locales/en.json 结构。  
- 结论：不引入第二套 i18n；沿用现有 `i18n-context.tsx`。  
