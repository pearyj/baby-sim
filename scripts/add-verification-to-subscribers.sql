-- 为 subscribers 表添加邮箱验证相关字段
ALTER TABLE subscribers 
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_subscribers_verified ON subscribers(verified);

-- 为已存在的订阅者设置默认值（可选，根据业务需求决定）
-- UPDATE subscribers SET verified = FALSE WHERE verified IS NULL;