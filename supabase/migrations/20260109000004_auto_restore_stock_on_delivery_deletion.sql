-- ============================================================
-- Migration: 刪除 delivery 時自動回補庫存
-- 場景：POS 現場交貨後客戶反悔，刪除 sale 時需要回補庫存
-- ============================================================

-- 1. 創建函數：刪除 confirmed delivery 時回補庫存
CREATE OR REPLACE FUNCTION handle_delivery_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- 只有 confirmed 的 delivery 才需要回補庫存
  IF OLD.status = 'confirmed' THEN
    -- 回補庫存：只寫入 inventory_logs，trigger 會自動更新 products.stock
    DECLARE
      item RECORD;
    BEGIN
      FOR item IN 
        SELECT di.product_id, di.quantity
        FROM delivery_items di
        WHERE di.delivery_id = OLD.id
      LOOP
        -- 🔧 修复：移除手动更新 stock，只寫入庫存日誌（trigger 會自動處理）
        INSERT INTO inventory_logs (
          product_id,
          ref_type,
          ref_id,
          qty_change,
          memo
        ) VALUES (
          item.product_id,
          'delivery_return',  -- 新的 ref_type
          OLD.id,
          item.quantity,  -- 正數
          format('取消出貨回補庫存 - %s (原因：刪除銷售記錄)', OLD.delivery_no)
        );
      END LOOP;
    END;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 2. 創建觸發器
DROP TRIGGER IF EXISTS trigger_delivery_deletion ON deliveries;
CREATE TRIGGER trigger_delivery_deletion
BEFORE DELETE ON deliveries
FOR EACH ROW
EXECUTE FUNCTION handle_delivery_deletion();

-- 3. 修改 inventory_logs 的 CHECK constraint，加入 'delivery_return'
DO $$ 
BEGIN
  -- Drop the old check constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_il_reftype' 
    AND table_name = 'inventory_logs'
  ) THEN
    ALTER TABLE inventory_logs DROP CONSTRAINT chk_il_reftype;
  END IF;
END $$;

-- 新增包含 'delivery_return' 的 CHECK constraint
ALTER TABLE inventory_logs 
ADD CONSTRAINT chk_il_reftype 
CHECK (ref_type IN ('purchase', 'sale', 'purchase_return', 'sales_return', 'adjust', 'init', 'delivery', 'delivery_return'));

-- 4. 註釋說明
COMMENT ON FUNCTION handle_delivery_deletion() IS '刪除已確認的出貨單時自動回補庫存';

```