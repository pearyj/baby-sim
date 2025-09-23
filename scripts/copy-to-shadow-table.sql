-- 将积分数据从主表复制到shadow表（用于开发环境）

-- 首先删除可能存在的旧记录，然后插入新记录
DELETE FROM credits_shadow WHERE email = 'muzigogo@qq.com';

-- 将你的积分记录复制过去
INSERT INTO credits_shadow (
    anon_id,
    email, 
    credits,
    currency,
    amount,
    stripe_session
)
SELECT 
    anon_id,
    email, 
    credits,
    currency,
    amount,
    stripe_session
FROM credits 
WHERE email = 'muzigogo@qq.com';

-- 验证复制结果
SELECT 
    '✅ Shadow表中的记录' AS status,
    id,
    anon_id,
    email,
    credits,
    currency,
    created_at
FROM credits_shadow 
WHERE email = 'muzigogo@qq.com';