# 数据库文档

本目录包含了 BabySim 项目的完整数据库表结构文档。

## 📁 文件结构

- `subscribers.md` - 用户订阅表结构
- `credits.md` - 积分表结构
- `email_verifications.md` - 邮箱验证表结构
- `game_sessions.md` - 游戏会话表结构（待添加）
- `game_events.md` - 游戏事件表结构（待添加）
- `purchases.md` - 购买记录表结构（待添加）

## 🗄️ 数据库概览

### 核心表
- **subscribers** - 存储用户邮箱订阅信息和验证状态
- **credits** - 存储用户积分余额和充值记录
- **email_verifications** - 存储邮箱验证码和验证状态

### 游戏相关表
- **game_sessions** - 存储游戏会话数据
- **game_events** - 存储游戏事件日志
- **purchases** - 存储购买和支付记录

## 🔧 表关系

```
subscribers (email) ←→ credits (email)
subscribers (email) ←→ email_verifications (email)
game_sessions (anon_id) ←→ credits (anon_id)
```

## 📊 使用说明

1. 查看具体表结构请参考对应的 `.md` 文件
2. 所有表结构都基于 Supabase PostgreSQL
3. 表结构可能随项目发展而更新

---

*最后更新: 2024-09-23*