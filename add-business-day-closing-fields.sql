-- 為 business_day_closings 表添加已收款和未收款統計欄位

-- 已收款統計欄位
ALTER TABLE business_day_closings
ADD COLUMN IF NOT EXISTS paid_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_sales NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_cash NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_card NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_transfer NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_cod NUMERIC(10, 2) DEFAULT 0;

-- 未收款統計欄位
ALTER TABLE business_day_closings
ADD COLUMN IF NOT EXISTS unpaid_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS unpaid_sales NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS unpaid_cash NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS unpaid_card NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS unpaid_transfer NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS unpaid_cod NUMERIC(10, 2) DEFAULT 0;

-- 驗證欄位是否添加成功
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'business_day_closings'
ORDER BY ordinal_position;
