-- ============================================================
-- Migration: 修正 deliveries 欄位為可空
-- 原因：未出貨的訂單不應該有必填的 delivery_date 和 method
-- ============================================================

-- 移除 NOT NULL 約束
ALTER TABLE deliveries 
ALTER COLUMN delivery_date DROP NOT NULL;

ALTER TABLE deliveries 
ALTER COLUMN method DROP NOT NULL;

-- 註釋說明
COMMENT ON COLUMN deliveries.delivery_date IS '實際出貨日期。當 status=draft 時為 NULL，當 status=confirmed 時必填';
COMMENT ON COLUMN deliveries.method IS '交貨方式。可選，例如：宅配、自取、門市取貨等';
