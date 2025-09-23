# 邮箱验证服务配置指南

## 概述

邮箱验证功能使用验证码的方式确保用户拥有邮箱的所有权，增强积分查询和支付的安全性。

## 实现方案

### 1. 数据库表结构

#### `email_verifications` 表
```sql
- id: UUID (主键)
- email: VARCHAR(255) (邮箱地址)
- code: VARCHAR(6) (6位验证码)
- anon_id: VARCHAR(255) (关联的匿名用户ID，可选)
- verified: BOOLEAN (是否已验证，默认false)
- expires_at: TIMESTAMP (过期时间)
- created_at: TIMESTAMP (创建时间)
- updated_at: TIMESTAMP (更新时间)
```

#### `subscribers` 表新增字段
```sql
- verified: BOOLEAN (邮箱是否已验证)
- verified_at: TIMESTAMP (验证时间)
```

### 2. API 端点

#### `/api/send-verification-code` (POST)
发送邮箱验证码
- 限流：每分钟最多3次
- 验证码有效期：10分钟
- 自动清理该邮箱的旧验证码

#### `/api/verify-email-code` (POST)
验证邮箱验证码
- 限流：每分钟最多10次
- 验证成功后标记邮箱为已验证
- 自动清理使用过的验证码

#### `/api/check-email-verification` (GET)
检查邮箱验证状态
- 限流：每分钟最多30次

## 邮件服务配置

### 推荐方案：Resend

Resend 是现代化的邮件服务，易于集成且价格合理。

#### 1. 注册 Resend 账户
访问 [https://resend.com](https://resend.com) 注册账户

#### 2. 获取 API Key
在 Resend 控制台生成 API Key

#### 3. 配置环境变量
```bash
RESEND_API_KEY=re_your_api_key_here
```

#### 4. 验证域名 (生产环境)
在 Resend 控制台验证发送域名 `babysim.fun`

### 备选方案

#### SendGrid
```javascript
// 在 send-verification-code.ts 中替换邮件发送逻辑
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: email,
  from: 'noreply@babysim.fun',
  subject: '邮箱验证码 - BabySim',
  html: emailContent.html,
};

await sgMail.send(msg);
```

#### 阿里云邮件推送
适合中国用户，需要ICP备案的域名

## 部署步骤

### 1. 数据库迁移
```bash
# 在 Supabase SQL 编辑器中执行
psql -f scripts/create-email-verification-table.sql
psql -f scripts/add-verification-to-subscribers.sql
```

### 2. 环境变量配置
```bash
# 生产环境
RESEND_API_KEY=re_live_xxx

# 测试环境  
RESEND_API_KEY=re_test_xxx
```

### 3. 前端部署
前端代码已包含邮箱验证功能，部署后自动生效。

## 用户体验流程

### 积分查询流程
1. 用户输入邮箱地址
2. 系统检查邮箱是否已验证
3. 如未验证，弹出验证码对话框
4. 用户收到验证码邮件
5. 输入验证码完成验证
6. 可正常查询积分

### 支付流程
1. 用户输入邮箱地址
2. 必须完成邮箱验证才能继续支付
3. 验证成功后可正常支付

## 安全考虑

### 1. 限流保护
- 发送验证码：每分钟最多3次
- 验证码验证：每分钟最多10次
- 基于IP地址的简单限流

### 2. 验证码安全
- 6位数字验证码
- 10分钟过期时间
- 使用后自动失效
- 新验证码会清理旧验证码

### 3. 数据保护
- 验证码不会记录到日志
- 过期验证码自动清理
- 邮箱验证状态持久化

## 监控和维护

### 1. 监控指标
- 验证码发送成功率
- 验证码验证成功率
- 邮件发送延迟
- API 错误率

### 2. 定期维护
- 清理过期验证码记录
- 监控邮件发送配额
- 检查垃圾邮件投诉

## 成本分析

### Resend 定价 (2024)
- 免费额度：每月3,000封邮件
- 付费计划：$20/月 起，每月50,000封邮件
- 超出按 $0.40/1000封 计费

### 预期使用量
- 假设日活用户 1000 人
- 每用户平均验证 1 次
- 月邮件量约 30,000 封
- 月成本约 $20

## 故障排除

### 常见问题

#### 1. 邮件发送失败
- 检查 API Key 配置
- 确认域名验证状态
- 查看 Resend 控制台错误日志

#### 2. 验证码收不到
- 检查垃圾邮件文件夹
- 确认邮箱地址格式正确
- 检查邮件服务商屏蔽策略

#### 3. 验证失败
- 确认验证码未过期
- 检查验证码格式（6位数字）
- 查看后端错误日志

### 调试命令
```bash
# 查看验证码记录
SELECT * FROM email_verifications WHERE email = 'user@example.com';

# 查看邮箱验证状态
SELECT verified, verified_at FROM subscribers WHERE email = 'user@example.com';

# 清理过期验证码
DELETE FROM email_verifications WHERE expires_at < NOW();
```