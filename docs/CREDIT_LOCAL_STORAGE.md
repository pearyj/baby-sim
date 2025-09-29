# 积分本地存储功能说明

## 概述

为了提升用户体验，我们实现了积分本地存储功能。用户在查询余额后，即使刷新页面也可以继续使用自己的余额，而无需再次查询邮箱。

## 功能特性

### 1. 积分缓存机制
- **缓存时长**: 5分钟
- **存储位置**: localStorage (通过 Zustand persist 中间件)
- **缓存内容**: 积分余额 + 最后获取时间戳

### 2. 智能刷新策略
- **自动使用缓存**: 5分钟内不重复请求服务器
- **强制刷新**: 用户主动查询积分时强制刷新
- **支付后刷新**: 充值完成后立即刷新积分

### 3. 数据持久化
存储在 localStorage 中的数据包括:
```typescript
{
  anonId: string;           // 匿名用户ID
  kidId: string;            // 游戏角色ID  
  email: string;            // 用户邮箱
  credits: number;          // 积分余额
  creditsLastFetched: number; // 最后获取时间戳
}
```

## 实现细节

### 1. Store 层修改
- 添加 `creditsLastFetched` 字段记录缓存时间
- 添加 `isCreditsCacheValid()` 方法验证缓存有效性
- 修改 `fetchCredits()` 支持强制刷新参数
- 更新 `consumeCredit()` 在消费后更新缓存时间戳

### 2. 缓存验证逻辑
```typescript
isCreditsCacheValid: () => {
  const { creditsLastFetched } = get();
  const now = Date.now();
  const CACHE_DURATION = 5 * 60 * 1000; // 5分钟
  return now - creditsLastFetched < CACHE_DURATION;
}
```

### 3. 智能获取策略
```typescript
fetchCredits: async (emailParam?: string, forceRefresh?: boolean) => {
  // 如果缓存有效且不强制刷新，直接返回
  if (!forceRefresh && isCreditsCacheValid()) {
    return;
  }
  // 否则从服务器获取最新积分
  // ...
}
```

## 使用场景

### 1. 页面刷新
- 用户刷新页面后，积分从 localStorage 恢复
- 5分钟内无需重新查询服务器

### 2. 主动查询
- 用户在 PaywallUI 中点击"查询积分"
- 强制刷新获取最新余额

### 3. 支付完成
- 充值成功后立即刷新积分
- 确保显示最新余额

### 4. 积分消费
- 图片生成等操作消费积分后
- 立即更新本地缓存

## 优势

1. **减少服务器请求**: 5分钟缓存避免频繁查询
2. **提升用户体验**: 刷新页面后积分立即可用
3. **数据一致性**: 关键操作时强制刷新确保准确性
4. **离线友好**: 短时间内可离线使用已缓存的积分

## 注意事项

1. **缓存过期**: 超过5分钟自动失效，下次使用时重新获取
2. **强制刷新**: 支付、主动查询等场景会忽略缓存
3. **数据同步**: 多设备间积分不会自动同步，需要手动刷新
4. **存储限制**: localStorage 有容量限制，但积分数据很小

## 技术实现

### 依赖库
- **Zustand**: 状态管理
- **Zustand/middleware/persist**: 数据持久化

### 关键文件
- `src/stores/usePaymentStore.ts`: 积分状态管理
- `src/components/payment/PaywallUI.tsx`: 支付界面
- `src/components/payment/PaywallGate.tsx`: 积分门控

### 配置项
```typescript
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存时长
```

---

*实现时间: 2024年12月*
*维护者: 开发团队*