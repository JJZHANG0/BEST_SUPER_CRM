# 部署与后续服务器迁移

## GitHub Pages

仓库 `JJZHANG0/BEST_SUPER_CRM`，发布分支 `main`，Pages Source 使用 GitHub Actions。

工作流在 Node 22 上安装锁定依赖，通过 Next 静态导出生成 `out/`，校验仓库子目录资源路径后上传 Pages artifact 并部署。哈希路由（例如 `/BEST_SUPER_CRM/#/programs/bpa`）允许详情页直接打开及刷新。

修改代码后提交并推送 main 即可更新。GitHub 仓库 Actions 页查看构建、部署状态。回滚时使用 `git revert <commit>` 后推送，保留历史。

本地验证：

```sh
npm ci
npm run build:pages
node tests/recruitment.mjs
node tests/static-paths.mjs
node scripts/preview-static.mjs
```

## 未来服务器部署

当前版本无后台运行要求，可部署到任意静态 Web 服务器。以域名根目录发布时执行 `npm run build:static`，将 `out/` 全部内容放入 Web 根目录；不要把源码、node_modules 或环境文件作为站点目录。若继续使用单层子路径，可设置 `NEXT_PUBLIC_BASE_PATH=/your-path npm run build:static`。

Nginx 示例（替换域名、证书和目录后使用）：

```nginx
server {
    listen 80;
    server_name crm.example.com;
    root /srv/nexus/out;
    index index.html;
    location / { try_files $uri $uri/ =404; }
}
```

正式使用前配置域名和 HTTPS。该静态站点迁移只搬迁前端，不会自动产生真实账号、数据库或跨设备数据同步。

## 接入真实业务的边界

- 以服务端身份认证替换演示登录，所有 API 在服务端校验角色和销售归属。
- 以数据库存储项目、开班队伍、学生、独立 Enrollment、课程及反馈；报名名额在事务中校验，避免并发超售。
- 招生配置当前在 `lib/nexus/recruitment.ts`，应由运营可管理的数据库记录替换。
- 资料进入私有对象存储，授权后生成短期下载地址；海报与公开招生资料单独管理。
- 接入审计、备份恢复、数据保留与删除策略。部署密钥仅存服务器或 CI Secret。
- 学生资料不得放进公开 GitHub 仓库、静态 bundle、公开 PDF 或无控制的浏览器持久化缓存。

现有 `lib/nexus/store.tsx` 是前端状态边界，业务修改只在当前内存会话生效，刷新即重置。所有现有价格、身份、学生、队伍和素材均为示例，不用于实际报价或库存承诺。
