-- 從備份恢復 business_day_closings 數據（如果有備份的話）

-- 檢查是否有備份表
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'business_day_closings_backup') THEN
    RAISE NOTICE '發現備份表，開始恢復數據...';

    -- 恢復數據（只恢復新表有的欄位）
    INSERT INTO business_day_closings (
      id,
      source,
      closing_time,
      sales_count,
      total_sales,
      total_cash,
      total_card,
      total_transfer,
      total_cod,
      sales_by_account,
      note,
      created_by,
      created_at
    )
    SELECT
      COALESCE(id, gen_random_uuid()),
      COALESCE(source, 'pos')::VARCHAR,
      COALESCE(closing_time, NOW()),
      COALESCE(sales_count, 0),
      COALESCE(total_sales, 0),
      COALESCE(total_cash, 0),
      COALESCE(total_card, 0),
      COALESCE(total_transfer, 0),
      COALESCE(total_cod, 0),
      sales_by_account,
      note,
      created_by,
      COALESCE(created_at, NOW())
    FROM business_day_closings_backup
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE '✅ 數據恢復完成！';
  ELSE
    RAISE NOTICE 'ℹ️ 沒有找到備份表，跳過數據恢復';
  END IF;
END $$;

-- 顯示恢復後的記錄數
SELECT
  source,
  COUNT(*) as count,
  MIN(closing_time) as earliest,
  MAX(closing_time) as latest
FROM business_day_closings
GROUP BY source;
