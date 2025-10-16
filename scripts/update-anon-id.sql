-- 更新积分记录的anon_id以匹配前端使用的ID
-- 这样就能正常查询到积分了

UPDATE credits 
SET anon_id = 'anon_1758087700431_38xnl0335'
WHERE email = 'muzigogo@qq.com';

-- 验证更新结果
SELECT 
    '✅ 更新后的记录' AS status,
    id,
    anon_id,
    email,
    credits,
    currency,
    created_at
FROM credits 
WHERE email = 'muzigogo@qq.com';