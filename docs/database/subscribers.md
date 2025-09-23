# subscribers 表

用户邮箱订阅表，存储用户邮箱信息和验证状态。

## 表结构

| 字段名 | 数据类型 | 是否可空 | 默认值 | 说明 |
|--------|----------|----------|---------|------|
| `id` | `uuid` | NO | `gen_random_uuid()` | 主键，自动生成的UUID |
| `email` | `text` | NO | null | 用户邮箱地址（唯一） |
| `created_at` | `timestamp with time zone` | YES | `now()` | 记录创建时间 |
| `verified` | `boolean` | YES | `false` | 邮箱是否已验证 |
| `verified_at` | `timestamp with time zone` | YES | null | 邮箱验证时间 |

## 索引

- **主键**: `id`
- **唯一约束**: `email` (邮箱地址唯一)
- **普通索引**: `verified` (用于快速查询验证状态)

## 用途

1. **邮箱订阅管理**: 存储用户订阅信息
2. **邮箱验证**: 记录邮箱验证状态和时间
3. **积分关联**: 通过 `email` 字段与 `credits` 表关联

## 相关API

- `POST /api/subscribe` - 添加邮箱订阅
- `GET /api/check-email-verification` - 检查邮箱验证状态
- `POST /api/verify-email-code` - 验证邮箱

## 示例数据

```sql
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "user@example.com",
  "created_at": "2024-09-23T10:00:00Z",
  "verified": true,
  "verified_at": "2024-09-23T10:05:00Z"
}
```

## 注意事项

1. `email` 字段必须唯一
2. `verified` 默认为 `false`，需要通过邮箱验证流程设置为 `true`
3. `verified_at` 只有在验证成功时才会设置值
4. 支持 upsert 操作防止重复邮箱

---

*表结构记录时间: 2024-09-23*