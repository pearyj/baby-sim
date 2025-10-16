-- 测试用积分充值脚本（测试环境）
-- 用途：为指定邮箱直接添加积分，方便测试
-- 使用方法：在 Supabase SQL 编辑器中执行
-- 针对 credits_shadow 表

-- 设置要充值的邮箱和积分数量
DO $$
DECLARE
    target_email TEXT := 'muzigogo@qq.com';
    credits_to_add INTEGER := 1;
    test_anon_id TEXT := 'test_' || extract(epoch from now())::text;
BEGIN
    -- 1. 首先添加到 subscribers 表（如果不存在）
    INSERT INTO subscribers (email, verified) 
    VALUES (target_email, true)
    ON CONFLICT (email) 
    DO UPDATE SET verified = true;
    
    RAISE NOTICE '✓ 邮箱 % 已添加到 subscribers 表', target_email;
    
    -- 2. 检查 credits_shadow 表中是否已有该邮箱的记录
    IF EXISTS (SELECT 1 FROM credits_shadow WHERE email = target_email) THEN
        -- 如果存在，则增加积分
        UPDATE credits_shadow 
        SET credits = credits + credits_to_add
        WHERE email = target_email;
        
        RAISE NOTICE '✓ 为邮箱 % 增加了 % 个积分（测试环境）', target_email, credits_to_add;
    ELSE
        -- 如果不存在，则创建新记录
        INSERT INTO credits_shadow (
            anon_id,
            email, 
            credits,
            currency,
            amount,
            stripe_session
        ) VALUES (
            test_anon_id,
            target_email,
            credits_to_add,
            'TEST',
            0,
            'test_manual_credit_' || extract(epoch from now())::text
        );
        
        RAISE NOTICE '✓ 为邮箱 % 创建了新的积分记录，积分数量：%（测试环境）', target_email, credits_to_add;
    END IF;
    
    -- 3. 添加购买记录到 purchases 表（用于审计）
    INSERT INTO purchases (
        anon_id,
        email,
        credits,
        currency,
        amount,
        stripe_session,
        created_at
    ) VALUES (
        test_anon_id,
        target_email,
        credits_to_add,
        'TEST',
        0,
        'test_manual_purchase_' || extract(epoch from now())::text,
        NOW()
    );
    
    RAISE NOTICE '✓ 已添加购买记录到 purchases 表';
    
    -- 4. 显示当前积分状况
    DECLARE
        current_credits INTEGER;
    BEGIN
        SELECT credits INTO current_credits FROM credits_shadow WHERE email = target_email;
        RAISE NOTICE '📊 邮箱 % 当前总积分：%（测试环境）', target_email, current_credits;
    END;
    
END $$;

-- 验证结果：查询充值后的积分
SELECT 
    email,
    credits,
    currency,
    created_at
FROM credits_shadow 
WHERE email = 'muzigogo@qq.com';