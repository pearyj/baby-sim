# 修复 send-verification-code 错误

## 问题描述
- `subscribers table does not have verified column yet`
- `RESEND_API_KEY not configured`

## 解决步骤

### 1. 修复 subscribers 表结构

在 Supabase SQL Editor 中执行以下 SQL：

```sql
-- 为 subscribers 表添加邮箱验证相关字段
ALTER TABLE subscribers 
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_subscribers_verified ON subscribers(verified);

-- 为已存在的订阅者设置默认值（可选）
UPDATE subscribers SET verified = FALSE WHERE verified IS NULL;
```

### 2. 配置 RESEND_API_KEY

#### 方法一：在 Vercel 环境变量中添加
1. 登录 Vercel Dashboard
2. 进入项目设置 → Environment Variables
3. 添加：`RESEND_API_KEY=your_resend_api_key_here`

#### 方法二：本地开发环境
创建 `.env.local` 文件并添加：
```
RESEND_API_KEY=your_resend_api_key_here
```

### 3. 获取 Resend API Key
1. 访问 https://resend.com/
2. 注册/登录账户
3. 在 Dashboard 中创建 API Key
4. 复制 API Key 并配置到环境变量

### 4. 验证修复
运行以下 API 测试验证功能：
```bash
curl -X POST http://localhost:3000/api/send-verification-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

## 注意事项
- 确保 Supabase 连接正常
- Resend API Key 需要有发送邮件的权限
- 邮件发送域名需要在 Resend 中验证