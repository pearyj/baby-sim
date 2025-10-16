1. 📝 快速充值脚本quick-add-credits.sql
这是最简单的版本，只需要：
修改脚本中的邮箱地址和积分数量
在Supabase SQL编辑器中执行
自动处理邮箱验证状态


2. 🔧 完整充值脚本（推荐） add-test-credits.sql
功能更全面，包括：
详细的执行日志
自动创建subscribers记录
添加购买审计记录
显示执行结果

这个脚本可以在check-credits.sql中查看到购买记录。

 
3. 📊 积分查询脚本 check-credits.sql
用于查看账户状态：
当前积分余额
邮箱验证状态
购买历史记录
统计信息