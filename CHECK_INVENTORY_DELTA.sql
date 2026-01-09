-- ============================================================
-- 检查 fn_apply_inventory_delta 函数定义
-- ============================================================

SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'fn_apply_inventory_delta';

-- 检查是否有 trigger 调用这个函数
SELECT 
  trigger_name,
  event_object_table,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE action_statement LIKE '%fn_apply_inventory_delta%';
