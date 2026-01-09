-- ============================================================
-- 完整追蹤：一筆交易的所有相關記錄
-- ============================================================

-- 請先在 POS 賣 1 個商品，然後執行此查詢

-- 1. 找出最新的 sale
WITH latest_sale AS (
  SELECT id, sale_no, created_at
  FROM sales
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT 
  '=== SALE ===' as section,
  s.id::text as sale_id,
  s.sale_no,
  s.status,
  s.fulfillment_status,
  s.total::text,
  s.created_at::text
FROM sales s
WHERE s.id = (SELECT id FROM latest_sale)

UNION ALL

SELECT 
  '=== SALE ITEMS ===' as section,
  si.id::text,
  p.name,
  si.quantity::text,
  si.price::text,
  '',
  ''
FROM sale_items si
JOIN products p ON p.id = si.product_id
WHERE si.sale_id = (SELECT id FROM latest_sale)

UNION ALL

SELECT 
  '=== DELIVERIES ===' as section,
  d.id::text,
  d.delivery_no,
  d.status,
  d.sale_id::text,
  '',
  d.created_at::text
FROM deliveries d
WHERE d.sale_id = (SELECT id FROM latest_sale)

UNION ALL

SELECT 
  '=== DELIVERY ITEMS ===' as section,
  di.id::text,
  d.delivery_no,
  p.name,
  di.quantity::text,
  di.delivery_id::text,
  ''
FROM delivery_items di
JOIN deliveries d ON d.id = di.delivery_id
JOIN products p ON p.id = di.product_id
WHERE d.sale_id = (SELECT id FROM latest_sale)

UNION ALL

SELECT 
  '=== INVENTORY LOGS ===' as section,
  il.id::text,
  p.name,
  il.ref_type,
  il.qty_change::text,
  il.memo,
  il.created_at::text
FROM inventory_logs il
JOIN products p ON p.id = il.product_id
WHERE il.ref_id IN (
  SELECT d.id FROM deliveries d WHERE d.sale_id = (SELECT id FROM latest_sale)
)
AND il.ref_type IN ('delivery', 'delivery_return')
ORDER BY section;
