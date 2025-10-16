-- 调试积分查询问题
-- 查看 muzigogo@qq.com 的所有积分记录

SELECT 
    '🔍 所有积分记录' AS section,
    id,
    anon_id,
    email,
    credits,
    currency,
    amount,
    stripe_session,
    created_at
FROM credits 
WHERE email = 'muzigogo@qq.com'
ORDER BY created_at DESC;

-- 同时查看是否有匹配 anon_id 的记录
SELECT 
    '🎯 匹配anon_id的记录' AS section,
    id,
    anon_id,
    email,
    credits,
    currency,
    created_at
FROM credits 
WHERE anon_id = 'anon_1758087700431_38xnl0335';

-- 查看所有可能相关的记录
SELECT 
    '📊 可能相关的记录' AS section,
    id,
    anon_id,
    email,
    credits,
    currency,
    created_at
FROM credits 
WHERE email = 'muzigogo@qq.com' OR anon_id = 'anon_1758087700431_38xnl0335'
ORDER BY created_at DESC;