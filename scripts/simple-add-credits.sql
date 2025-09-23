-- 最简单的积分充值脚本（测试环境）
-- 分步执行，避免复杂的 SQL 语法问题
-- 针对 credits_shadow 表

-- 第一步：确保邮箱在 subscribers 表中存在
INSERT INTO subscribers (email) 
VALUES ('muzigogo@qq.com')
ON CONFLICT (email) DO NOTHING;

-- 第二步：检查 credits_shadow 表中是否已有记录
-- 如果有记录，增加积分
UPDATE credits_shadow 
SET credits = credits + 1
WHERE email = 'muzigogo@qq.com';

-- 第三步：如果没有记录，创建新记录
INSERT INTO credits_shadow (
    anon_id,
    email, 
    credits,
    currency,
    amount,
    stripe_session,
    created_at
)
SELECT 
    'test_manual_' || extract(epoch from now())::text,
    'muzigogo@qq.com',
    1,
    'TEST',
    0,
    'manual_credit_' || extract(epoch from now())::text,
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM credits_shadow WHERE email = 'muzigogo@qq.com'
);

-- 第四步：查看结果
SELECT 
    '✅ 充值完成（测试环境）' AS status,
    email,
    credits AS current_credits,
    created_at
FROM credits_shadow 
WHERE email = 'muzigogo@qq.com';