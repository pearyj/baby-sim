# credits 表

用户积分表，存储用户积分余额和充值记录。

## 表结构

| 字段名 | 数据类型 | 是否可空 | 默认值 | 说明 |
|--------|----------|----------|---------|------|
| `id` | `bigint` | NO | null | 主键，自动递增 |
| `anon_id` | `text` | NO | null | 匿名用户ID |
| `email` | `text` | YES | null | 用户邮箱地址 |
| `credits` | `numeric` | NO | null | 积分余额 |
| `currency` | `text` | NO | null | 货币类型 (USD/RMB/TEST) |
| `amount` | `integer` | NO | null | 支付金额（分为单位）|
| `stripe_session` | `text` | NO | null | Stripe会话ID |
| `created_at` | `timestamp with time zone` | YES | `now()` | 记录创建时间 |

## 索引

- **主键**: `id`
- **普通索引**: `anon_id` (用于匿名用户查询)
- **注意**: `email` 字段目前没有唯一约束，可能存在重复

## 字段说明

### `anon_id`
- 匿名用户标识符
- 用于在用户未提供邮箱时的积分管理
- 格式通常为: `anon_xxx` 或 `test_manual_xxx`

### `email` 
- 用户邮箱地址
- 可为空，用于匿名用户
- 与 `subscribers` 表关联

### `credits`
- 用户当前积分余额
- 数值类型，支持小数
- 每次消费或充值时更新

### `currency`
- 支付货币类型
- `USD`: 美元
- `RMB`: 人民币  
- `TEST`: 测试模式

### `amount`
- 实际支付金额
- 以分为单位存储（如 $1.00 存储为 100）
- 测试充值时为 0

### `stripe_session`
- Stripe 支付会话ID
- 用于关联支付记录
- 测试充值时格式为 `manual_credit_xxx`

## 用途

1. **积分管理**: 存储和更新用户积分余额
2. **支付记录**: 记录充值和支付信息
3. **用户关联**: 通过 `email` 或 `anon_id` 关联用户

## 相关API

- `GET /api/credits` - 查询积分余额
- `POST /api/consume-credit` - 消费积分
- `POST /api/create-checkout-session` - 创建支付会话
- `POST /api/webhook` - Stripe 支付回调

## 示例数据

```sql
-- 正常用户充值记录
{
  "id": 1,
  "anon_id": "anon_user_123",
  "email": "user@example.com",
  "credits": 5,
  "currency": "USD",
  "amount": 500,
  "stripe_session": "cs_test_xxxxx",
  "created_at": "2024-09-23T10:00:00Z"
}

-- 测试充值记录
{
  "id": 2,
  "anon_id": "test_manual_1695456789",
  "email": "test@example.com",
  "credits": 1,
  "currency": "TEST",
  "amount": 0,
  "stripe_session": "manual_credit_1695456789",
  "created_at": "2024-09-23T10:30:00Z"
}
```

## 注意事项

1. `email` 字段目前没有唯一约束，理论上可能存在重复记录
2. `credits` 字段会随着消费和充值动态更新
3. 匿名用户可以通过 `anon_id` 查询积分
4. 测试充值时 `currency` 设为 `TEST`，`amount` 为 0
5. 支持通过 `email` 或 `anon_id` 进行查询和更新
6. 在操作积分时应先检查是否存在记录，再决定是更新还是插入

## 业务逻辑

### 积分充值流程
1. 用户发起支付 → 创建 Stripe 会话
2. 支付成功 → Webhook 回调
3. 更新或创建 `credits` 记录
4. 同时在 `purchases` 表记录购买历史

### 积分消费流程
1. 检查用户积分余额
2. 扣除相应积分
3. 更新 `credits` 表中的余额

---

*表结构记录时间: 2024-09-23*