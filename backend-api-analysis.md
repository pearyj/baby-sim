# Baby Sim 后端API服务梳理

## 概述

本文档详细梳理了Baby Sim项目中所有的后端API服务，包括每个API的功能、参数、响应类型等信息，为Go语言迁移提供参考。

## API服务列表

### 1. 聊天服务 (`/api/chat.ts`)

**功能**: 多模型AI聊天服务，支持OpenAI、DeepSeek、Volcengine等多个AI提供商

**HTTP方法**: `POST`

**请求参数**:
```typescript
interface RequestBody {
  messages: ChatMessage[];           // 聊天消息数组
  provider?: 'openai' | 'deepseek' | 'volcengine' | 'gemini-flash' | 'gemini-pro' | 'gpt5';  // AI提供商（gpt5 为兼容别名）
  streaming?: boolean;               // 是否流式响应
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

**响应类型**:
- 流式响应: `text/plain` (Server-Sent Events)
- 非流式响应: `application/json`
```typescript
{
  content: string;                   // AI回复内容
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

**支持的AI模型**:
- OpenAI: `gpt-4o-mini`
- Gemini Flash: `gemini-2.5-flash`
- Gemini 3.0 Pro (含 gpt5 兼容别名): `gemini-3.0-pro`
- DeepSeek: `deepseek-chat`
- Volcengine: `deepseek-v3-250324`

**环境变量**:
- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`
- `GEMINI_API_KEY`
- `VOLCENGINE_LLM_API_KEY`

---

### 2. 图片生成服务 (`/api/image.ts`)

**功能**: 使用Doubao API生成AI图片

**HTTP方法**: `POST`

**请求参数**:
```typescript
{
  prompt: string;                    // 图片生成提示词
  size?: string;                     // 图片尺寸，默认 '1024x1024'
  quality?: string;                  // 图片质量，默认 'standard'
}
```

**响应类型**:
```typescript
{
  imageUrl?: string;                 // 生成的图片URL
  error?: string;                    // 错误信息
}
```

**环境变量**:
- `VOLCENGINE_LLM_API_KEY` 或 `ARK_API_KEY`

**限流**: 30次/分钟

---

### 3. 支付结账会话创建 (`/api/create-checkout-session.ts`)

**功能**: 创建Stripe支付会话

**HTTP方法**: `POST`

**请求参数**:
```typescript
{
  anonId: string;                    // 匿名用户ID
  email: string;                     // 用户邮箱
  lang: string;                      // 语言代码
  donatedUnits: number;              // 购买单位数量
  embedded?: boolean;                // 是否嵌入模式
  isMobile?: boolean;                // 是否移动设备
  isAppleDevice?: boolean;           // 是否苹果设备
}
```

**响应类型**:
```typescript
{
  success: boolean;
  sessionId?: string;                // Stripe会话ID
  url?: string;                      // 支付页面URL
  message?: string;                  // 状态消息
  error?: string;                    // 错误信息
}
```

**价格配置**:
- USD: 基础价格 $1.99 (2积分)，额外积分 $1.00/个
- RMB: 基础价格 ¥6.00 (1积分)，额外积分 ¥6.00/个

**环境变量**:
- `STRIPE_SECRET_KEY`
- `PAYWALL_VERSION`

---

### 4. Stripe Webhook处理 (`/api/webhook.ts`)

**功能**: 处理Stripe支付完成回调

**HTTP方法**: `POST`

**请求**: Stripe原始webhook数据

**处理事件**:
- `checkout.session.completed`: 支付完成，添加用户积分

**响应类型**:
```typescript
{
  received: boolean;
  error?: string;
}
```

**环境变量**:
- `STRIPE_WEBHOOK_SECRET`

---

### 5. 积分消费 (`/api/consume-credit.ts`)

**功能**: 消费用户积分

**HTTP方法**: `POST`

**请求参数**:
```typescript
{
  anonId: string;                    // 匿名用户ID
  email?: string;                    // 用户邮箱（可选）
  amount?: number;                   // 消费积分数量，默认1
}
```

**响应类型**:
```typescript
{
  success: boolean;
  remainingCredits: number;          // 剩余积分
  consumedCredits: number;           // 消费的积分
  error?: string;
}
```

**限流**: 120次/分钟

**环境变量**:
- `CREDITS_TABLE`: 积分表名
- `VERCEL_ENV`: 环境标识

---

### 6. 积分查询 (`/api/credits.ts`)

**功能**: 查询用户当前积分余额

**HTTP方法**: `GET`

**查询参数**:
```typescript
{
  anonId: string;                    // 匿名用户ID
  email?: string;                    // 用户邮箱（可选）
  skipPaywall?: 'yes';               // 跳过付费墙（开发用）
}
```

**响应类型**:
```typescript
{
  credits: number;                   // 用户积分余额
  bypass?: boolean;                  // 是否跳过付费墙
  error?: string;
}
```

**限流**: 120次/分钟

---

### 7. 邮箱订阅 (`/api/subscribe.ts`)

**功能**: 用户邮箱订阅服务

**HTTP方法**: `POST`

**请求参数**:
```typescript
{
  email: string;                     // 用户邮箱
}
```

**响应类型**:
```typescript
{
  success: boolean;
  message?: 'already_subscribed';    // 已订阅消息
  error?: string;
}
```

**数据库操作**: 使用upsert防止重复邮箱

---

### 8. 游戏会话初始化 (`/api/session-init.ts`)

**功能**: 初始化游戏会话记录

**HTTP方法**: `POST`

**请求参数**:
```typescript
{
  anonId: string;                    // 匿名用户ID
  kidId: string;                     // 孩子ID
  style: string;                     // 游戏风格
  customInstruction?: any;           // 自定义指令（JSON）
  meta?: any;                        // 额外元数据
}
```

**响应类型**:
```typescript
{
  success: boolean;
  error?: string;
}
```

**数据库表**: `game_sessions` 或 `game_sessions_shadow`

---

### 9. 事件日志记录 (`/api/log-event.ts`)

**功能**: 记录用户游戏事件

**HTTP方法**: `POST`

**请求参数**:
```typescript
{
  anonId: string;                    // 匿名用户ID
  kidId: string;                     // 孩子ID
  type: string;                      // 事件类型
  payload?: any;                     // 事件数据（JSON）
}
```

**常见事件类型**:
- `choice`: 用户选择
- `checkout_initiated`: 发起支付
- `image_generated`: 图片生成

**响应类型**:
```typescript
{
  success: boolean;
  error?: string;
}
```

**数据库表**: `game_events` 或 `game_events_shadow`

---

### 10. 会话标志更新 (`/api/session-flag.ts`)

**功能**: 更新游戏会话的状态标志

**HTTP方法**: `POST`

**请求参数**:
```typescript
{
  anonId: string;                    // 匿名用户ID
  kidId: string;                     // 孩子ID
  flags: {
    checkoutInitiated?: boolean;     // 是否发起支付
    checkoutCompleted?: boolean;     // 是否完成支付
    imageGenerated?: boolean;        // 是否生成图片
  }
}
```

**响应类型**:
```typescript
{
  success: boolean;
  noChange?: boolean;                // 无变更标志
  error?: string;
}
```

---

### 11. 订阅健康检查 (`/api/subscribe-health.ts`)

**功能**: 检查订阅服务和数据库连接状态

**HTTP方法**: `GET`

**响应类型**:
```typescript
{
  timestamp: string;                 // 检查时间戳
  supabaseConfigured: boolean;       // Supabase是否配置
  subscribersTableExists: boolean;   // 订阅表是否存在
  canInsert: boolean;                // 是否可以插入数据
  error?: string;                    // 错误信息
}
```

---

### 12. Supabase健康检查 (`/api/supabaseHealth.ts`)

**功能**: 检查Supabase数据库连接和表状态

**HTTP方法**: `GET`

**响应类型**:
```typescript
{
  ok: boolean;                       // 健康状态
  table: string;                     // 检查的表名
  rowCount?: number;                 // 表行数
  error?: string;                    // 错误信息
}
```

---

## 共享模块

### 工具函数 (`_utils.ts`)

**功能**:
- CORS处理
- 预检请求处理
- 简单的内存限流器

**主要函数**:
- `applyCors()`: 应用CORS头
- `handlePreflight()`: 处理OPTIONS请求
- `rateLimit()`: 基于IP的限流

### 支付共享配置 (`paymentShared.ts`)

**功能**:
- Stripe客户端配置
- 价格计算逻辑
- 内存积分存储

**主要配置**:
- 价格配置（USD/RMB）
- 积分计算函数
- 全局积分存储

### Supabase管理客户端 (`supabaseAdmin.ts`)

**功能**: 服务端Supabase客户端配置

**环境变量**:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_SERVICE_KEY`

---

## 数据库表结构

### 主要表

1. **subscribers**: 邮箱订阅表
   - `email`: 用户邮箱（唯一）

2. **credits**: 用户积分表
   - `anon_id`: 匿名用户ID
   - `email`: 用户邮箱
   - `credits`: 积分余额

3. **game_sessions**: 游戏会话表
   - `anon_id`: 匿名用户ID
   - `kid_id`: 孩子ID
   - `initial_style`: 初始风格
   - `checkout_initiated`: 是否发起支付
   - `checkout_completed`: 是否完成支付
   - `image_generated`: 是否生成图片

4. **game_events**: 游戏事件表
   - `anon_id`: 匿名用户ID
   - `kid_id`: 孩子ID
   - `type`: 事件类型
   - `payload`: 事件数据

### 影子表

开发环境使用带`_shadow`后缀的表，避免污染生产数据：
- `credits_shadow`
- `game_sessions_shadow`
- `game_events_shadow`

---

## 环境变量汇总

### AI服务
- `OPENAI_API_KEY`: OpenAI API密钥
- `DEEPSEEK_API_KEY`: DeepSeek API密钥
- `VOLCENGINE_LLM_API_KEY`: 火山引擎API密钥
- `ARK_API_KEY`: 火山引擎备用密钥

### 支付服务
- `STRIPE_SECRET_KEY`: Stripe密钥
- `STRIPE_TEST_SECRET_KEY`: Stripe测试密钥
- `STRIPE_WEBHOOK_SECRET`: Webhook签名密钥
- `PAYWALL_VERSION`: 付费墙版本控制

### 数据库
- `SUPABASE_URL`: Supabase项目URL
- `SUPABASE_SERVICE_KEY`: 服务角色密钥
- `SUPABASE_SERVICE_ROLE_KEY`: 服务角色密钥（备用）
- `VITE_SUPABASE_SERVICE_KEY`: 前端服务密钥（备用）

### 表配置
- `CREDITS_TABLE`: 积分表名
- `SESSIONS_TABLE`: 会话表名
- `EVENTS_TABLE`: 事件表名
- `PURCHASES_TABLE`: 购买表名

### 环境控制
- `VERCEL_ENV`: Vercel环境标识
- `NODE_ENV`: Node.js环境标识
- `PAYWALL_PERSISTENCE`: 付费墙持久化方式

---

## Go迁移建议

### 1. 项目结构
```
cmd/
  server/
    main.go
internal/
  handlers/
    chat.go
    image.go
    payment.go
    health.go
  services/
    ai_service.go
    payment_service.go
    storage_service.go
  models/
    chat.go
    payment.go
    session.go
  clients/
    supabase.go
    stripe.go
    openai.go
```

### 2. 核心依赖
- **Web框架**: Gin
- **数据库**: supabase-go
- **缓存**: go-redis
- **支付**: stripe-go
- **AI客户端**: go-openai
- **配置**: viper
- **日志**: logrus

### 3. 迁移优先级
1. **第一阶段**: 健康检查、基础框架
2. **第二阶段**: 聊天和图片生成API
3. **第三阶段**: 支付和积分系统
4. **第四阶段**: 会话和事件日志
5. **第五阶段**: 订阅和管理功能

### 4. 注意事项
- 保持API接口完全兼容
- 实现相同的限流策略
- 保持错误响应格式一致
- 支持流式响应（聊天API）
- 正确处理CORS和预检请求
- 实现Stripe webhook签名验证
- 支持多环境表切换逻辑
