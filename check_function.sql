-- 查看 fn_log_from_sale_items 函數定義
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'fn_log_from_sale_items';

-- 查看 fn_rollback_on_cancel 函數定義
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'fn_rollback_on_cancel';
