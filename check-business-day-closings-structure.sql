-- 檢查 business_day_closings 表的實際結構

-- 1. 檢查表是否存在
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'business_day_closings'
);

-- 2. 查看表的所有欄位
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'business_day_closings'
ORDER BY ordinal_position;

-- 3. 查看表的前幾筆資料（如果有的話）
SELECT * FROM business_day_closings LIMIT 5;
