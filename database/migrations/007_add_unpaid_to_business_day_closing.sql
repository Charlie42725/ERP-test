-- 添加日结未收款统计字段
-- Migration: 007_add_unpaid_to_business_day_closing
-- Date: 2026-01-12
-- Purpose: 支持日结显示未收款订单

-- ============================================================
-- 1. 为 business_day_closings 表添加未收款统计字段
-- ============================================================

-- 添加已收款统计
ALTER TABLE business_day_closings
ADD COLUMN IF NOT EXISTS paid_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_sales NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_cash NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_card NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_transfer NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_cod NUMERIC(10, 2) DEFAULT 0;

-- 添加未收款统计
ALTER TABLE business_day_closings
ADD COLUMN IF NOT EXISTS unpaid_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS unpaid_sales NUMERIC(10, 2) DEFAULT 0;

-- 添加注释
COMMENT ON COLUMN business_day_closings.paid_count IS '已收款笔数';
COMMENT ON COLUMN business_day_closings.paid_sales IS '已收款总额';
COMMENT ON COLUMN business_day_closings.paid_cash IS '已收款 - 现金';
COMMENT ON COLUMN business_day_closings.paid_card IS '已收款 - 刷卡';
COMMENT ON COLUMN business_day_closings.paid_transfer IS '已收款 - 转账';
COMMENT ON COLUMN business_day_closings.paid_cod IS '已收款 - 货到付款';
COMMENT ON COLUMN business_day_closings.unpaid_count IS '未收款笔数';
COMMENT ON COLUMN business_day_closings.unpaid_sales IS '未收款总额';

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_business_day_closings_paid_sales ON business_day_closings(paid_sales DESC);
CREATE INDEX IF NOT EXISTS idx_business_day_closings_unpaid_sales ON business_day_closings(unpaid_sales DESC);
