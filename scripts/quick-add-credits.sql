-- 快速积分充值脚本（简化版）
-- 针对测试环境的 credits_shadow 表
-- 根据实际数据库表结构优化

-- 🔧 配置区域：修改这里的值
-- 先检查是否已有记录，如果有则更新，没有则插入
DO $$
BEGIN
    -- 检查是否已存在该邮箱的记录
    IF EXISTS (SELECT 1 FROM credits_shadow WHERE email = 'muzigogo@qq.com') THEN
        -- 如果存在，增加积分
        UPDATE credits_shadow 
        SET credits = credits + 1
        WHERE email = 'muzigogo@qq.com';
        RAISE NOTICE '✓ 为邮箱增加了1个积分（测试环境）';
    ELSE
        -- 如果不存在，创建新记录
        INSERT INTO credits_shadow (
            anon_id,
            email, 
            credits,
            currency,
            amount,
            stripe_session
        )
        VALUES (
            'test_manual_' || extract(epoch from now())::text,
            'muzigogo@qq.com',
            1,
            'TEST',
            0,
            'manual_credit_' || extract(epoch from now())::text
        );
        RAISE NOTICE '✓ 创建了新的积分记录（测试环境）';
    END IF;
END $$;

-- 同时确保邮箱在 subscribers 表中存在并已验证
INSERT INTO subscribers (email, verified, verified_at) 
VALUES ('muzigogo@qq.com', true, NOW())
ON CONFLICT (email) 
DO UPDATE SET 
    verified = true,
    verified_at = COALESCE(subscribers.verified_at, NOW());

-- 查看结果
SELECT 
    '✅ 充值完成（测试环境）' AS status,
    email,
    credits AS current_credits,
    created_at
FROM credits_shadow 
WHERE email = 'muzigogo@qq.com';