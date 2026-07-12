# 架构说明

## 运行时边界

```text
浏览器
  ├─ src/main.ts
  │   ├─ Canvas 绘制和 DOM UI
  │   ├─ 键盘、指针和触控按钮输入
  │   ├─ localStorage（玩家 ID、昵称、音效、本地成绩）
  │   └─ Supabase REST / Edge Function（可选）
  └─ src/game.ts
      └─ 纯 TypeScript 游戏核心

Supabase
  ├─ scores 表（仅 service role 可写）
  ├─ leaderboard 视图（anon/authenticated 可读）
  └─ submit-score Edge Function（签发令牌并校验成绩）
```

## 游戏核心

`src/game.ts` 不依赖浏览器 API，使用种子随机数生成器保证相同 seed 的方块队列一致。`Game` 负责棋盘、当前方块、队列、保留方块、锁定延迟、分数、等级、消行和动作时间线；`src/main.ts` 负责帧循环、DAS/ARR 输入、按需绘制、音频、网络和展示状态。

提交成绩时，浏览器发送游戏核心产生的 seed、分数、等级、消行数、持续时间和动作列表。服务端只做字段关系、时间线和合理性检查，不能防止拥有浏览器开发工具的用户伪造全部客户端数据。

## 数据流

1. 点击开始时生成 `game_id` 和 seed。
2. 在线模式向 `submit-score` 请求开局令牌；请求失败时回退到本地模式。
3. 游戏过程在浏览器本地运行，动作记录相对 `startedAt` 计时。
4. 游戏结束后，用户输入昵称并提交成绩。
5. Edge Function 验证令牌和请求字段，使用 service role 写入 `scores`。
6. 排行榜通过 `leaderboard` 视图读取每位玩家的最佳已验证成绩。

## 运行时策略

- 重力按累计时间推进，锁定延迟独立按帧计时，避免低等级时提前锁定。
- 棋盘只在重力、操作、锁定或阶段变化时重绘；桌面与移动端 HOLD/NEXT 仅在队列签名变化时同步重绘。
- 左右长按使用 150ms DAS 和 40ms ARR，不依赖操作系统键盘重复速度。
- 页面进入后台、打开排行榜时自动暂停；关闭排行榜后只恢复由排行榜触发的暂停。
- Edge Function、排行榜和成绩提交请求使用超时控制；开局请求失败时回退本地模式。
- `localStorage` 读取和写入都允许失败，损坏的本地成绩会回退为空列表。
- UI 使用 Lucide 图标、统一 `focus-visible`、dialog 标题关联和焦点回归；动态模式、复制和游戏反馈通过 live region 提供状态。

## 数据库规则

`scores.game_id` 唯一，因此一个游戏只能成功提交一次。RLS 开启后，匿名和登录用户不能直接读取或写入 `scores`；公开读取通过 `security_invoker = false` 的 `leaderboard` 视图完成。视图过滤 `verified = true`，并按玩家取最高分。

## 变更约定

- 游戏规则变更必须增加或更新 `tests/game.test.ts`。
- 请求体或数据库字段变更必须同步更新前端、Edge Function、migration 和部署文档。
- 新增环境变量时，同时更新 `.env.example`、README 和 GitHub Actions 配置说明。
- 不要在浏览器代码中引入 service role key 或 `SCORE_TOKEN_SECRET`。
