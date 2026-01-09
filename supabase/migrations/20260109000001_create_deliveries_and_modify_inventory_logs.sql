-- ============================================================
-- Migration: 出貨管理與庫存扣減分離
-- 核心原則：扣庫存唯一入口 = delivery confirmed
-- ============================================================

-- 1. 修改 inventory_logs.ref_type 的 CHECK constraint，加入 'delivery'
-- 先找到並刪除舊的 constraint
DO $$ 
BEGIN
  -- Drop the old check constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_il_reftype' 
    AND table_name = 'inventory_logs'
  ) THEN
    ALTER TABLE inventory_logs DROP CONSTRAINT chk_il_reftype;
  END IF;
END $$;

-- 新增包含 'delivery' 的 CHECK constraint
ALTER TABLE inventory_logs 
ADD CONSTRAINT chk_il_reftype 
CHECK (ref_type IN ('purchase', 'sale', 'purchase_return', 'sales_return', 'adjust', 'init', 'delivery'));

-- 2. 在 sales 表添加履約狀態相關欄位
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'none' CHECK (fulfillment_status IN ('none', 'partial', 'completed')),
ADD COLUMN IF NOT EXISTS delivery_method TEXT,
ADD COLUMN IF NOT EXISTS expected_delivery_date DATE,
ADD COLUMN IF NOT EXISTS delivery_note TEXT;

-- 3. 創建 deliveries 表（出貨單）
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_no TEXT NOT NULL UNIQUE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  delivery_date TIMESTAMP WITH TIME ZONE, -- 允許 NULL，未出貨時為 NULL
  method TEXT,
  note TEXT,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 創建索引提升查詢效能
CREATE INDEX IF NOT EXISTS idx_deliveries_sale_id ON deliveries(sale_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at);

-- 4. 創建 delivery_items 表（出貨明細）
CREATE TABLE IF NOT EXISTS delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery_id ON delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_product_id ON delivery_items(product_id);

-- 5. 更新舊資料：將所有已確認的 sales 標記為已完成履約
-- 這樣可以避免舊訂單被誤判為「待出貨」
UPDATE sales 
SET fulfillment_status = 'completed' 
WHERE status = 'confirmed' AND fulfillment_status = 'none';

-- 6. 添加 updated_at 觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deliveries_updated_at
BEFORE UPDATE ON deliveries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 7. 註釋說明
COMMENT ON TABLE deliveries IS '出貨單：記錄實際出貨事件，扣庫存唯一入口';
COMMENT ON COLUMN deliveries.status IS 'draft=待出貨, confirmed=已出貨(已扣庫存), cancelled=已取消';
COMMENT ON COLUMN sales.fulfillment_status IS 'none=未履約, partial=部分履約, completed=完全履約';
COMMENT ON TABLE delivery_items IS '出貨明細：記錄每次出貨的商品與數量';
