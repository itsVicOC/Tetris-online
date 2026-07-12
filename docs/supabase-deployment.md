# Supabase 部署指南

## 前置条件

- 已创建 Supabase 项目
- 已安装 Node.js 20；Supabase CLI 可通过 `npx` 运行
- 已安装 OpenSSL，或准备好其他安全随机数生成工具

登录并关联项目：

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
```

`project-ref` 可在 Supabase 项目 URL（`https://<project-ref>.supabase.co`）或项目设置中找到。

## 部署数据库

从项目根目录执行：

```bash
npx supabase db push
```

该命令会执行 `supabase/migrations/001_scores.sql`，创建 `scores` 表、索引和 `leaderboard` 视图，并启用 RLS、配置公开视图的读取授权。也可以把 SQL 粘贴到 Supabase SQL Editor，但推荐使用 CLI 保持迁移记录一致。

## 配置并部署 Function

生成只用于服务端的 HMAC 密钥：

```bash
npx supabase secrets set SCORE_TOKEN_SECRET="$(openssl rand -hex 32)"
npx supabase functions deploy submit-score
```

`SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 由 Supabase Function 运行环境提供。不要把 service role key 写入前端环境变量。部署后可在 Supabase Dashboard → Edge Functions → `submit-score` → Logs 查看请求和错误。

## 配置前端

复制模板并填写项目公开配置：

```bash
cp .env.example .env.local
```

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<sb_publishable_...>
```

重新启动 Vite 开发服务器：

```bash
npm run dev
```

变量名为兼容现有代码保留 `ANON_KEY`，但新 Supabase 项目应优先填写 `sb_publishable_...`。publishable key 会进入浏览器构建产物，属于公开客户端凭据；真正需要保护的是 Function secret 和 service role key。

## 验证清单

1. 开始一局游戏时，Network 面板应看到 `functions/v1/submit-score` 的 `action=start` 请求。
2. 结束游戏并提交合法昵称后，Function 应返回成功，`scores` 表出现一条 `verified = true` 记录。
3. 排行榜请求应读取 `/rest/v1/leaderboard`，而不是直接读取 `scores`。
4. 使用相同游戏 ID 再次提交应得到重复提交错误。
5. 未配置 Supabase 时，游戏仍应能把成绩写入本地排行榜。

## 常见问题

### `db push` 找不到项目

重新执行 `npx supabase link --project-ref <project-ref>`，确认 CLI 登录的账号拥有该项目权限。

### Function 返回 `score verification failed`

检查浏览器时间、游戏 ID、seed 和 token 是否来自同一局；确认没有重复提交，并检查 Edge Function 日志中的请求字段。

### 排行榜读取失败

确认 migration 已执行、`leaderboard` 视图存在且已授予 `anon` 读取权限；前端 URL 必须与已部署的 Supabase 项目一致。

### 密钥泄露

立即在 Supabase 中轮换 `SCORE_TOKEN_SECRET` 或 service role key，并重新部署 Function。已发布到浏览器的 publishable key 不属于需要保密的服务端秘密。
