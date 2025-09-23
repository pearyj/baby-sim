-- 测试用积分充值脚本
-- 用途：为指定邮箱直接添加积分，方便测试
-- 使用方法：在 Supabase SQL 编辑器中执行

-- 设置要充值的邮箱和积分数量
DO $$
DECLARE
    target_email TEXT := 'muzigogo@qq.com';
    credits_to_add INTEGER := 1;
    test_anon_id TEXT := 'test_' || extract(epoch from now())::text;
    target_currency TEXT := 'USD'; -- 使用真实货币代码：USD 或 RMB
    target_amount INTEGER; -- 根据货币设置对应价格
BEGIN
    -- 根据货币设置对应的金额
    IF target_currency = 'USD' THEN
        target_amount := credits_to_add * 99; -- USD: $0.99 per credit
    ELSIF target_currency = 'RMB' THEN
        target_amount := credits_to_add * 699; -- RMB: ¥6.99 per credit
    ELSE
        target_amount := 0; -- 默认值
    END IF;
    
    RAISE NOTICE '💰 设置货币: %, 单价: % 分, 总金额: % 分', target_currency, 
        CASE WHEN target_currency = 'USD' THEN 99 ELSE 699 END, 
        target_amount;
    -- 1. 首先添加到 subscribers 表（如果不存在）
    INSERT INTO subscribers (email, verified) 
    VALUES (target_email, true)
    ON CONFLICT (email) 
    DO UPDATE SET verified = true;
    
    RAISE NOTICE '✓ 邮箱 % 已添加到 subscribers 表', target_email;
    
    -- 2. 检查 credits 表中是否已有该邮箱的记录
    IF EXISTS (SELECT 1 FROM credits WHERE email = target_email) THEN
        -- 如果存在，则增加积分
        UPDATE credits 
        SET credits = credits + credits_to_add
        WHERE email = target_email;
        
        RAISE NOTICE '✓ 为邮箱 % 增加了 % 个积分', target_email, credits_to_add;
    ELSE
        -- 如果不存在，则创建新记录
        INSERT INTO credits (
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
            target_currency,
            target_amount,
            'test_manual_credit_' || extract(epoch from now())::text
        );
        
        RAISE NOTICE '✓ 为邮箱 % 创建了新的积分记录，积分数量：%', target_email, credits_to_add;
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
        target_currency,
        target_amount,
        'test_manual_purchase_' || extract(epoch from now())::text,
        NOW()
    );
    
    RAISE NOTICE '✓ 已添加购买记录到 purchases 表';
    
    -- 4. 同步到 credits_shadow 表（重要！）
    -- 先删除 shadow 表中的旧记录
    DELETE FROM credits_shadow WHERE email = target_email;
    
    -- 将更新后的记录复制到 shadow 表
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
    WHERE email = target_email;
    
    RAISE NOTICE '✓ 已同步到 credits_shadow 表';
    
    -- 5. 显示当前积分状况
    DECLARE
        current_credits INTEGER;
    BEGIN
        SELECT credits INTO current_credits FROM credits WHERE email = target_email;
        RAISE NOTICE '📊 邮箱 % 当前总积分：%', target_email, current_credits;
    END;
    
END $$;

-- 验证结果：查询充值后的积分（主表和 shadow 表）
SELECT 
    '📊 主表 credits' AS table_name,
    email,
    credits,
    currency,
    created_at
FROM credits 
WHERE email = 'muzigogo@qq.com'

UNION ALL

SELECT 
    '🔄 Shadow表 credits_shadow' AS table_name,
    email,
    credits,
    currency,
    created_at
FROM credits_shadow 
WHERE email = 'muzigogo@qq.com'
ORDER BY table_name;