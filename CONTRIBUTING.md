# 贡献指南

## 开发环境

项目以 Node.js 20 为基准。使用 nvm 时可执行：

```bash
nvm use
npm ci
```

## 开发与验证

启动开发服务器：

```bash
npm run dev
```

提交变更前必须通过：

```bash
npm test
npm run typecheck
npm run build
```

## 变更要求

- 游戏规则、计分、随机队列或碰撞行为变更，需要同步增加或更新单元测试。
- 前端与 Edge Function 之间的请求字段变更，需要同时修改两端和架构文档。
- 数据库结构或权限变更，需要新增 migration；不要直接修改已在共享环境执行过的 migration。
- 环境变量变更，需要同步更新 `.env.example`、README、部署指南和 GitHub Actions 配置。
- 用户可见操作、计分或数据处理行为变更，需要同步更新 README。

## 提交范围

保持一次变更只解决一个明确问题。不要提交 `node_modules/`、`dist/`、`.env.local`、Supabase service role key 或 Function secrets。提交前检查构建产物中不存在服务端秘密。

## 文档约定

命令应能从项目根目录直接执行。安全相关说明必须明确区分浏览器公开配置和服务端秘密；排行榜行为应以 migration、Edge Function 和前端实现的共同结果为准。
