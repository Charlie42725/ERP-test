-- ============================================================
-- Migration: 移除 sales confirmed 時扣庫存的觸發器
-- 原因：扣庫存唯一入口改為 delivery confirmed
-- ============================================================

-- 1. 刪除舊的 sales confirmed 觸發器
DROP TRIGGER IF EXISTS trigger_sale_confirmed ON sales;
DROP FUNCTION IF EXISTS handle_sale_confirmed();

-- 2. 註釋：說明為什麼移除
-- 原本的 trigger_sale_confirmed 會在 sales.status 變成 confirmed 時：
--   - 扣減 products.stock
--   - 寫入 inventory_logs (ref_type='sale')
-- 
-- 新架構下：
--   - sales confirmed = 交易成立，不等於出貨
--   - 扣庫存改由 delivery confirmed 觸發
--   - inventory_logs.ref_type='delivery' 才是真正的庫存扣減記錄

COMMENT ON TABLE sales IS '銷售單：記錄交易成立事件，不直接扣庫存';
