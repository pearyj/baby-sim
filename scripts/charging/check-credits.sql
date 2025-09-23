-- 查询指定邮箱的积分状况

-- 🔧 修改这里的邮箱地址
WITH target_email AS (
  SELECT 'muzigogo@qq.com' AS email
)

SELECT 
    '📊 积分查询结果' AS title,
    c.email,
    c.credits AS current_credits,
    c.currency,
    c.created_at AS first_credit_time,
    s.verified AS email_verified,
    s.verified_at AS verification_time
FROM target_email t
LEFT JOIN credits c ON c.email = t.email
LEFT JOIN subscribers s ON s.email = t.email;

-- 查询该邮箱的所有购买记录
SELECT 
    '📋 购买历史' AS title,
    email,
    credits,
    currency,
    amount,
    stripe_session,
    created_at
FROM purchases 
WHERE email = 'muzigogo@qq.com'
ORDER BY created_at DESC;

-- 统计信息
SELECT 
    '📈 统计信息' AS title,
    COUNT(*) AS total_purchases,
    SUM(credits) AS total_credits_purchased,
    SUM(amount) AS total_amount_spent
FROM purchases 
WHERE email = 'muzigogo@qq.com';