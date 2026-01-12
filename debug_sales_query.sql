-- 检查销售记录的状态
-- 请在 Supabase SQL Editor 中执行这个查询

SELECT
  sale_no,
  customer_code,
  total,
  is_paid,
  source,
  status,
  created_at,
  sale_date
FROM sales
WHERE sale_no IN ('S0120', 'S0127', 'S0128', 'S0129')
ORDER BY created_at DESC;

-- 检查今天的所有 live 销售记录
SELECT
  sale_no,
  total,
  is_paid,
  source,
  status,
  created_at
FROM sales
WHERE source = 'live'
  AND created_at >= '2026-01-12T00:00:00'
  AND created_at < '2026-01-13T00:00:00'
ORDER BY created_at DESC;
