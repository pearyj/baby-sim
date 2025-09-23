-- 检查数据库表结构
-- 用于了解 credits 表的实际字段

-- 查看 credits 表的字段结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'credits' 
ORDER BY ordinal_position;

-- 查看 subscribers 表的字段结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'subscribers' 
ORDER BY ordinal_position;