-- 重建 business_day_closings 表（完整版）

-- 1. 備份現有數據（如果表存在）
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'business_day_closings') THEN
    CREATE TABLE IF NOT EXISTS business_day_closings_backup AS
    SELECT * FROM business_day_closings;
    RAISE NOTICE '已備份現有數據到 business_day_closings_backup';
  END IF;
END $$;

-- 2. 刪除舊表（如果存在）
DROP TABLE IF EXISTS business_day_closings;

-- 3. 創建新表（包含所有必要欄位）
CREATE TABLE business_day_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(10) NOT NULL CHECK (source IN ('pos', 'live')),
  closing_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 總計統計（包含已收款和未收款）
  sales_count INTEGER DEFAULT 0,
  total_sales NUMERIC(10, 2) DEFAULT 0,
  total_cash NUMERIC(10, 2) DEFAULT 0,
  total_card NUMERIC(10, 2) DEFAULT 0,
  total_transfer NUMERIC(10, 2) DEFAULT 0,
  total_cod NUMERIC(10, 2) DEFAULT 0,

  -- 已收款統計
  paid_count INTEGER DEFAULT 0,
  paid_sales NUMERIC(10, 2) DEFAULT 0,
  paid_cash NUMERIC(10, 2) DEFAULT 0,
  paid_card NUMERIC(10, 2) DEFAULT 0,
  paid_transfer NUMERIC(10, 2) DEFAULT 0,
  paid_cod NUMERIC(10, 2) DEFAULT 0,

  -- 未收款統計
  unpaid_count INTEGER DEFAULT 0,
  unpaid_sales NUMERIC(10, 2) DEFAULT 0,
  unpaid_cash NUMERIC(10, 2) DEFAULT 0,
  unpaid_card NUMERIC(10, 2) DEFAULT 0,
  unpaid_transfer NUMERIC(10, 2) DEFAULT 0,
  unpaid_cod NUMERIC(10, 2) DEFAULT 0,

  -- 其他欄位
  sales_by_account JSONB,
  note TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 創建索引
CREATE INDEX idx_business_day_closings_source ON business_day_closings(source);
CREATE INDEX idx_business_day_closings_closing_time ON business_day_closings(closing_time DESC);
CREATE INDEX idx_business_day_closings_source_closing_time ON business_day_closings(source, closing_time DESC);

-- 5. 啟用 RLS（Row Level Security）
ALTER TABLE business_day_closings ENABLE ROW LEVEL SECURITY;

-- 6. 創建 RLS 策略（允許所有操作，因為這是內部系統）
CREATE POLICY "Allow all operations on business_day_closings"
  ON business_day_closings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 7. 驗證表結構
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'business_day_closings'
ORDER BY ordinal_position;

-- 完成訊息
DO $$
BEGIN
  RAISE NOTICE '✅ business_day_closings 表已重建完成！';
  RAISE NOTICE '📋 如果有備份數據在 business_day_closings_backup 表中';
END $$;
