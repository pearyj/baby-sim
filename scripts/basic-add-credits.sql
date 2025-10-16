-- 基础版本：直接插入积分记录（测试环境）
-- 如果其他脚本报错，使用这个最简单的版本
-- 针对 credits_shadow 表

-- 插入积分记录（如果邮箱已存在会报错，这是正常的）
INSERT INTO credits_shadow (
    anon_id,
    email, 
    credits
) VALUES (
    'test_manual_123',
    'muzigogo@qq.com',
    1
);

-- 查看当前积分
SELECT email, credits FROM credits_shadow WHERE email = 'muzigogo@qq.com';