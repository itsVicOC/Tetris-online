# 无尽方块

基于 Vite、TypeScript 和 Canvas 的在线俄罗斯方块风格游戏。支持键盘和触控操作、确定性种子、持久玩家 ID、每局游戏 ID、音效、响应式界面，以及可选的 Supabase 全球排行榜。

## 功能概览

- 10 × 20 棋盘、七种方块、七袋随机生成、墙踢、预览队列、保留方块和幽灵方块
- 键盘 DAS/ARR 连续移动、触控按钮和棋盘手势输入
- 落地锁定延迟、基础墙踢/地面 kick、切换后台自动暂停
- Lucide 图标工具栏、移动端紧凑 HOLD/NEXT、矮屏自适应棋盘和 48px 触控控制
- 在线/本地模式提示、复制反馈、游戏动作反馈和键盘焦点管理
- 本地模式：无需后端即可游玩，成绩保存在当前浏览器
- 在线模式：通过 Supabase Edge Function 校验并提交成绩
- GitHub Pages 静态部署，支持仓库项目页和自定义域名

## 环境要求

- Node.js 20 或更高版本（CI 使用 Node 20）
- npm 10 或更高版本
- 在线排行榜才需要 Supabase CLI 和 Supabase 项目

## 快速开始

```bash
npm ci
npm run dev
```

开发服务器启动后，打开终端输出的本地地址。未配置 Supabase 时，游戏和本地排行榜仍可完整使用。

生产构建和预览：

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

`npm run build` 会先执行 TypeScript 类型检查，再生成 `dist/`。不要将 `dist/` 提交到版本库。

## 配置

复制环境变量模板：

```bash
cp .env.example .env.local
```

| 变量 | 用途 | 是否可公开 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase 项目 URL | 可以，构建后会进入浏览器 |
| `VITE_SUPABASE_ANON_KEY` | 浏览器读取排行榜、调用 Edge Function 的公开 key；新项目优先填写 `sb_publishable_...` | 可以，构建后会进入浏览器 |
| `SCORE_TOKEN_SECRET` | Edge Function 签发成绩令牌的 HMAC 密钥 | **必须保密，仅配置在 Supabase Function secrets** |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function 写入 `scores` 表 | **必须保密，仅由 Supabase 运行环境提供** |

`VITE_*` 变量不是服务器秘密。不要把 service role key 或 `SCORE_TOKEN_SECRET` 写入 `.env.local`、GitHub Pages 变量或前端代码。

## Supabase 在线排行榜

完整部署步骤见 [Supabase 部署指南](docs/supabase-deployment.md)。概要如下：

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
npx supabase secrets set SCORE_TOKEN_SECRET="$(openssl rand -hex 32)"
npx supabase functions deploy submit-score
```

然后在 `.env.local` 中设置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`，重新启动开发服务器。

数据库只向 `anon`/`authenticated` 授予 `leaderboard` 视图的读取权限；`scores` 表禁止浏览器直接写入。Edge Function 会验证开局令牌、玩家和游戏 ID、种子、持续时间、动作时间线、成绩合理性和重复提交。该机制适合休闲游戏的基础防刷，不是权威服务端模拟，也不提供账号认证、IP 限流或完整回放验证。

## GitHub Pages

工作流文件为 `.github/workflows/deploy.yml`，在 `main` 分支推送或手动触发时执行：

1. `npm ci`
2. `npm test`
3. `npm run build`
4. 发布 `dist/` 到 GitHub Pages

在仓库 Settings → Secrets and variables → Actions 中配置：

- Repository variable：`VITE_SUPABASE_URL`
- Repository secret：`VITE_SUPABASE_ANON_KEY`

publishable/anon key 会被编译进浏览器，使用 secret 只是为了避免在仓库设置页面公开显示，并不改变其公开属性。首次发布前，请在 Settings → Pages 中选择 GitHub Actions。部署完成后应检查项目页、排行榜读取和无 Supabase 配置时的本地回退。

## 操作

| 操作 | 键盘 | 手机 |
| --- | --- | --- |
| 左右移动 | `←` / `→` | 左右滑动或触控按钮 |
| 软降 | `↓` | 向下短滑 |
| 硬降 | `空格` | 向下长滑或触控按钮 |
| 顺时针旋转 | `X` | 点按棋盘或 `↻` 按钮 |
| 逆时针旋转 | `Z` | `↺` 按钮 |
| 保留方块 | `C` | `HOLD` 按钮 |
| 暂停/继续 | `P` / `Esc` | 暂停按钮 |

## 计分与排行榜规则

- 单次消行基础分：1/2/3/4 行分别为 100/300/500/800，再乘当前等级
- 软降每格 1 分，硬降每格 2 分
- 每消除 10 行升一级，降落速度随等级提高
- 方块落地后有约 450ms 的锁定调整时间；移动或旋转可有限次数重置锁定计时
- 全球榜每位玩家只保留最高分，最多展示 100 位玩家
- 本地榜最多保存 500 条记录，展示时同样只取每位玩家的最佳成绩
- 每个游戏 ID 只能提交一次；昵称长度为 2–16 个字符

## 数据与隐私

浏览器会在 `localStorage` 保存玩家 ID、最近昵称、音效开关和本地成绩。玩家 ID 在当前浏览器中持久存在，可通过清除站点数据重置。在线提交的昵称、玩家 ID、游戏 ID、成绩、等级、消行数和提交时间会进入 Supabase。排行榜界面只展示玩家 ID 前 8 位，但公开的 `leaderboard` REST 视图包含完整玩家 ID、游戏 ID 和成绩字段。

如需删除本地数据，请清除该站点的浏览器存储。如需删除在线成绩，请通过 Supabase 管理后台处理；项目当前没有用户账号或自助删除入口。

## 故障排查

- **排行榜不可用**：检查 URL 是否包含 `https://`、publishable key 是否正确、migration 和 Function 是否部署到同一项目，并查看 Edge Function 日志。启用新式 API key 的项目不要继续使用 legacy anon JWT。
- **开始游戏长时间连接中**：排行榜请求会在约 3.5 秒后超时并自动回退本地模式；持续出现时请检查 Edge Function 状态。
- **成绩校验失败**：确认浏览器时间没有明显错误，成绩是在同一局游戏结束后提交，且没有重复提交同一个游戏 ID。
- **GitHub Pages 空白页**：确认工作流使用了 `dist/` artifact，并检查 Actions 构建日志；Vite 已配置相对资源路径。
- **没有声音**：先点击页面后再切换音效；浏览器通常会阻止未经过用户手势创建音频上下文。

## 项目结构

详见 [架构说明](docs/architecture.md)。核心目录：

```text
src/game.ts                         游戏规则、随机数、计分和动作记录
src/main.ts                         Canvas、输入、交互反馈、存储和排行榜请求
tests/game.test.ts                  游戏核心单元测试
supabase/migrations/001_scores.sql 数据表、RLS 和 leaderboard 视图
supabase/functions/submit-score     开局令牌和成绩校验
.github/workflows/deploy.yml        GitHub Pages CI/CD
```

## 维护说明

修改游戏规则时，请同时更新 `src/game.ts`、`tests/game.test.ts` 和本 README 的玩法规则。修改数据库字段、Function 请求体或环境变量时，请同步更新 [Supabase 部署指南](docs/supabase-deployment.md) 和架构说明。提交变更前请遵循 [贡献指南](CONTRIBUTING.md)。
