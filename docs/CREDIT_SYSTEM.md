# Credit System Documentation

## 概述

养娃模拟器的积分系统是一个基于Stripe支付的虚拟货币系统，用于控制高级功能的使用，包括GPT-5模型和AI图片生成。

## 系统架构

### 核心组件

1. **前端组件**
   - `PaywallGate`: 积分门控组件，控制功能访问
   - `PaywallUI`: 支付界面组件
   - `usePaymentStore`: 积分状态管理
   - `usePaymentStatus`: 支付状态钩子

2. **后端API**
   - `/api/credits`: 查询用户积分余额
   - `/api/consume-credit`: 消费积分
   - `/api/create-checkout-session`: 创建Stripe支付会话
   - `/api/webhook`: 处理Stripe支付回调

3. **数据库表**
   - `credits`: 用户积分表（生产环境）
   - `credits_shadow`: 积分表（开发环境）
   - `purchases`: 购买记录表
   - `game_sessions`: 游戏会话表

## 积分规则

### 定价配置

```typescript
const PRICE_CONFIG = {
  USD: { 
    basePrice: 299,           // 2.99美元
    baseCredits: 2,           // 基础2积分
    additionalCreditPrice: 150 // 每额外积分1.5美元
  },
  RMB: { 
    basePrice: 990,           // 9.9元人民币
    baseCredits: 1,           // 基础1积分
    additionalCreditPrice: 990 // 每额外积分9.9元
  }
}
```

### 积分消费规则

1. **图片生成**: 0.15积分/张
2. **GPT-5交互**: 0.05积分/次交互
3. **默认消费**: 1积分（如未指定amount）

### 计费逻辑

- **美元区域**：首次购买2.99美元获得2积分，之后每1.5美元1积分
- **人民币区域**：首次购买9.9元获得1积分，之后每9.9元1积分
- 支持小数积分（精确到0.01）
- 积分余额不能为负数
- **图片生成性价比**：用户充值1积分可生成约6.67张图片（1÷0.15≈6.67）

## 环境配置

### 前端环境变量

```bash
# 付费墙版本控制
VITE_PAYWALL_VERSION=prod|test|off

# Stripe公钥
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# 开发模式（生产环境必须为false）
VITE_DIRECT_API_MODE=false
```

### 后端环境变量

```bash
# 付费墙版本（应与前端一致）
PAYWALL_VERSION=prod|test|off

# Stripe配置
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_TEST_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# 数据库表配置
CREDITS_TABLE=credits
PURCHASES_TABLE=purchases
SESSIONS_TABLE=game_sessions
EVENTS_TABLE=game_events

# 环境标识
VERCEL_ENV=production|preview|development
NODE_ENV=production|development

# Supabase配置
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
```

## 表结构设计

### credits表

```sql
CREATE TABLE credits (
  id SERIAL PRIMARY KEY,
  anon_id VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  credits DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_credits_anon_id ON credits(anon_id);
CREATE INDEX idx_credits_email ON credits(email);
```

### purchases表

```sql
CREATE TABLE purchases (
  id SERIAL PRIMARY KEY,
  anon_id VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  stripe_session_id VARCHAR(255) UNIQUE,
  amount_cents INTEGER,
  currency VARCHAR(3),
  credits_purchased DECIMAL(10,2),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## API接口规范

### GET /api/credits

**查询用户积分余额**

**请求参数**:
```typescript
{
  anonId: string;     // 必需：匿名用户ID
  email?: string;     // 可选：用户邮箱
  skipPaywall?: 'yes' // 开发用：跳过付费墙
}
```

**响应**:
```typescript
{
  credits: number;    // 积分余额
  bypass?: boolean;   // 是否跳过付费墙
  error?: string;     // 错误信息
}
```

### POST /api/consume-credit

**消费用户积分**

**请求体**:
```typescript
{
  anonId: string;     // 必需：匿名用户ID
  email?: string;     // 可选：用户邮箱
  amount?: number;    // 可选：消费数量，默认1
}
```

**响应**:
```typescript
{
  ok: boolean;        // 操作是否成功
  remaining: number;  // 剩余积分
  error?: string;     // 错误信息（如"no_credits"）
}
```

### POST /api/create-checkout-session

**创建Stripe支付会话**

**请求体**:
```typescript
{
  anonId: string;       // 匿名用户ID
  email: string;        // 用户邮箱
  lang: string;         // 语言（决定货币）
  donatedUnits: number; // 购买单位数
  isMobile?: boolean;   // 是否移动设备
  isAppleDevice?: boolean; // 是否Apple设备
}
```

**响应**:
```typescript
{
  success: boolean;
  sessionId?: string;   // Stripe会话ID
  url?: string;         // 支付页面URL
  clientSecret?: string; // 客户端密钥
  error?: string;
  message?: string;
}
```

## 用户身份识别

### 匿名ID系统

- 每个用户生成唯一的`anonId`（存储在localStorage）
- 格式：`anon_${timestamp}_${randomString}`
- 用于关联积分和游戏数据

### 邮箱关联

- 用户可选择提供邮箱
- 邮箱用于：
  - 接收支付收据
  - 跨设备同步积分
  - 客服支持

## 安全机制

### 并发控制

- 使用乐观锁防止积分重复扣除
- 最多重试3次
- WHERE子句包含当前余额检查

### 限流保护

- 积分查询：120次/分钟
- 积分消费：120次/分钟
- 基于IP地址限流

### 数据验证

- 严格的参数验证
- Stripe webhook签名验证
- 金额上限检查（美元$500，人民币3000元）

## 环境隔离

### 表切换逻辑

```typescript
const env = process.env.VERCEL_ENV || 'development';
const TABLE = process.env.CREDITS_TABLE || 
  ((env === 'production' || env === 'preview') ? 'credits' : 'credits_shadow');
```

### 环境对应关系

- **production**: 使用生产表（credits, purchases等）
- **preview**: 使用生产表（与production共享数据）
- **development**: 使用影子表（credits_shadow等）

## 调试和监控

### 调试工具

1. **测试页面**: `/payment-test-page`
2. **调试链接**: `?secretTestEnding=yes`
3. **跳过付费墙**: `?skipPaywall=yes`

### 日志系统

- 前端：`🔍 PAYWALL DEBUG`前缀
- 后端：结构化日志记录
- 关键事件：支付、消费、错误

### 监控指标

- 积分余额变化
- 支付成功率
- API响应时间
- 错误率统计

## 故障处理

### 紧急程序

1. **完全禁用付费墙**:
   ```bash
   VITE_PAYWALL_VERSION=off
   ```

2. **紧急跳过链接**:
   ```
   https://your-domain.com/?skipPaywall=yes
   ```

3. **重置用户数据**:
   - 清除localStorage
   - 重新生成匿名ID

### 常见问题

1. **积分未更新**: 检查邮箱匹配和表选择
2. **支付失败**: 验证Stripe配置和webhook
3. **跨设备同步**: 确保邮箱一致性

## 最佳实践

### 开发建议

1. 始终在开发环境使用影子表
2. 测试前检查环境变量配置
3. 监控积分消费日志
4. 定期备份积分数据

### 部署检查清单

- [ ] 环境变量正确配置
- [ ] Stripe webhook URL更新
- [ ] 数据库表权限检查
- [ ] 付费墙版本设置
- [ ] 限流配置验证

## 扩展计划

### 未来功能

1. **积分套餐**: 批量购买优惠
2. **订阅模式**: 月度/年度订阅
3. **积分转赠**: 用户间积分转移
4. **积分过期**: 设置有效期机制
5. **多币种支持**: 更多本地货币

### 技术优化

1. **缓存层**: Redis缓存积分余额
2. **异步处理**: 队列化积分操作
3. **分布式锁**: 更强的并发控制
4. **实时同步**: WebSocket积分更新

---

*最后更新: 2024年12月*
*维护者: 开发团队*