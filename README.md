# BEST_SUPER_CRM · PROJECT NEXUS

教育创新项目 CRM 前端 V1.1。React 19 + TypeScript + Vinext（Next.js API）+ Tailwind 4 + shadcn/Radix，统一 Crystal Purple / Liquid Glass 设计。

## 运行

需要 Node.js 22.13 或更新版本。

```sh
npm ci
npm run dev
npm run build
```

本地地址：http://127.0.0.1:5173。所有路径首先显示内部授权登录页；成功登录后进入对应角色的工作台。本版本不提供自助注册。

## 演示账号

- 销售：`sales@nexus.demo` / `NexusSales2026!`（冰晶蓝工作空间）
- 运营：`ops@nexus.demo` / `NexusOps2026!`（冰晶紫工作空间）

这两个账号是公开静态站中的角色体验账号，不是正式身份认证。所有学生、队伍、课程、日期与项目介绍均为虚构演示数据，资料文件不是主办方官方文件。

## 已实现

- 角色相关导航、桌面可折叠玻璃侧栏，移动端独立五项底部导航及安全区。
- 工作台、八个项目、搜索、分类/状态/收藏/最近浏览、项目五类详情。
- 课程草稿与发布；销售仅查看已发布版本。
- 学生桌面表格、移动卡片、筛选 Bottom Sheet、分页、档案与教学反馈、状态更新。
- 队伍阶段进度、关注筛选、运营备注、状态更新、成员及课程详情。
- 桌面月/周/列表课程视图；手机日期条与当日列表；新建课程和课程完成。
- 反馈创建、关联学生与课程、销售可见范围。
- 资料搜索、PDF 与图片预览、真实示例文件下载、新窗口备用打开、微信下载提示。
- 文件选择仅生成当前页 Blob URL，不上传；最大 10 MB，PDF/PNG/JPEG。
- 全局搜索、通知已读、退出确认、空态、网络断开提示、页面错误恢复。
- 运营统计从当前记录计算；会话操作日志。
- 应用 manifest、图标、standalone 配置；未注册 Service Worker、未缓存学生数据。
- 页面功能模块按需加载，用户输入经 React 输出转义，支持减少动画偏好。

## 销售招生工作台

销售首页仅保留项目库、我的学生、当前演示营收和进行中学生四个业务指标。招生信息以横向清单展示 14 个开班项目，包含项目/队伍、招生进度、剩余名额、单价和状态。点击整行在当前页打开招生详情弹窗，可继续查看排期、授课老师、对接人、课程计划、海报和项目资料。销售桌面侧栏只显示工作台、项目中心、我的学生和资料中心，不展示队伍管理、课程管理、教学反馈或运营概览。

有效报名按学生去重，退出、结项及待分配记录不占用招生名额；暂停中的学生仍保留名额。其他顾问负责的队员仅展示年级和参与状态，本人负责的学生可打开档案。

## GitHub Pages

- 网站：https://jjzhang0.github.io/BEST_SUPER_CRM/
- 代码：https://github.com/JJZHANG0/BEST_SUPER_CRM
- `main` 推送触发 `.github/workflows/pages.yml`，生成并发布纯静态页面。

```sh
npm run build:pages
node tests/static-paths.mjs
node tests/recruitment.mjs
node scripts/preview-static.mjs
```

静态预览：http://127.0.0.1:4173/BEST_SUPER_CRM/。构建产物为 `out/`，所有脚本、海报、PDF 与 manifest 已适配仓库子目录。服务器迁移说明见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 数据与接入边界

`lib/nexus/data.ts` 定义虚构数据与类型，`lib/nexus/store.tsx` 为可替换的数据访问边界。所有业务修改仅在内存中保留，刷新重置；未使用 localStorage 或 IndexedDB 保存学生数据。文件权限与销售归属检查仅是前端演示，不构成安全边界；静态示例文件本身不含敏感信息。

正式上线前必须接入真实身份认证、服务端 RBAC/销售行级范围、受控文件存储与签名下载、审计与持久化接口。已提供独立 Enrollment 记录、关联新项目、学生档案编辑与负责销售分配。Excel 导入导出、账号权限管理为后续扩展，不把预留项包装为已实现。

PWA 预留不代表已实现完整安装条件、离线 CRM 或推送。所有费用都是演示报价，没有真实会议链接或付费报名入口。

## 验收

`tests/acceptance.cjs` 检查 19 个页面状态在 320、375、390、430、768、1024、1440 及横屏视口的水平溢出，以及销售登录、BPA 查询与 PDF 预览/下载、销售学生范围、运营队伍备注、学生状态与反馈录入。浏览器依赖使用当前工作环境的 Playwright，换环境时请调整脚本中的路径。

另有字体放大、空数据、断网、课程草稿发布、文件上传和 WebMCP 注册的定向检查。浏览器模拟不等同于真机验收：iOS Safari、Android 微信、物理软键盘、安装与下载链路仍需真实设备确认。

## Backend & server environments

The app can also run against a real API + PostgreSQL database (shared data across users and devices):
production http://1.13.182.30/ and development http://1.13.182.30:8080/. Without `NEXT_PUBLIC_API_BASE`
(e.g. the GitHub Pages build) it keeps working as the offline demo. See [docs/DEPLOY.md](docs/DEPLOY.md)
for the architecture, environment layout and `scripts/deploy.sh <dev|prod>`.
