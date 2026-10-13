# ReaderWeb 随记

几个朋友分享生活感想的 MVP。界面参考浮墨的双栏文字流，评论用缩进、连接线和分支折叠保留回复关系。产品范围见 [SPEC.md](SPEC.md)。

## 本地运行

```sh
npm install
npm run dev
```

默认地址为 http://localhost:5173。页面和 API 使用同一个本地服务。

需要 Node.js 22.13 或更新版本；启动脚本在系统 Node 较旧时会尝试使用 Codex 已提供的 Node 运行时。指定端口使用 `npm run dev -- --port 5174`。

侧栏账号按钮可以在「小林」和「阿禾」之间切换。它们仅用于本地体验；账号 cookie 按浏览器会话隔离，内容保存在共同数据库中。开发身份仅接受本机回环请求，正式运行模式会禁用该身份入口。

## 数据

- 本地 SQLite 文件：`.data/readerweb.sqlite`，已加入忽略列表。
- 建表迁移：`server/migrations/001-initial.sql`。
- 首次创建开发数据库时写入两位账号、生活感想和嵌套评论示例。
- 重启服务不会重复添加示例，也不会清空用户内容。
- 感想和评论不是浏览器 localStorage 数据；localStorage 只保存本机草稿。
- 可通过 `READERWEB_DB` 环境变量指定另一个数据库文件，适合隔离测试环境。

## 检查

```sh
npm test
npm run build
npm run test:sites
```

API 测试覆盖共享持久化、作者权限、提交去重、回复树、删除占位、标签与日期过滤、开发身份边界。浏览器调试记录与截图见 [design-qa.md](design-qa.md)。

## 目录

- `src/`：React 界面、服务请求、样式。
- `server/`：本地 HTTP API、SQLite 存储、迁移及开发示例。
- `public/avatars/`：两位本地体验账号的生成头像。
- `tests/api.test.mjs`：数据与权限检查。
- `docs/references/`：用户提供的视觉参考；`docs/qa/`：浏览器验证证据。

## 后续托管

本轮只在 localhost 完成与调试，未注册或部署 Sites。原模板的 Worker 和构建约定保持完整；当前构建输出中的模板 Worker 仅处理前端静态资源，不能代替本地 API。未来部署完整多人版本时，需要把服务接口接到受支持的动态 Worker、D1 和平台身份，另行验证朋友访问范围。

账号头像由内置 ImageGen 生成，提示词和资源记录见 [docs/avatars.md](docs/avatars.md)。图标使用 [Phosphor](https://github.com/phosphor-icons/react)，本地数据库使用 [Node SQLite](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)。
# FriendsShare
