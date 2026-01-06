-- 檢查所有與 sale_items 和 products 相關的觸發器
SELECT
    trigger_name,
    event_object_table,
    action_statement,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE event_object_table IN ('sale_items', 'products', 'sales')
ORDER BY event_object_table, trigger_name;

-- 檢查所有可能扣庫存的函數
SELECT
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_type = 'FUNCTION'
AND (
    routine_definition ILIKE '%stock%'
    OR routine_definition ILIKE '%inventory%'
    OR routine_definition ILIKE '%sale_items%'
)
ORDER BY routine_name;
