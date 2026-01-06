-- Add ichiban kuji reference columns to sale_items table
ALTER TABLE sale_items
ADD COLUMN ichiban_kuji_prize_id UUID REFERENCES ichiban_kuji_prizes(id),
ADD COLUMN ichiban_kuji_id UUID REFERENCES ichiban_kuji(id);

-- Add comments
COMMENT ON COLUMN sale_items.ichiban_kuji_prize_id IS '如果是從一番賞售出，記錄獎項ID';
COMMENT ON COLUMN sale_items.ichiban_kuji_id IS '如果是從一番賞售出，記錄一番賞ID';

-- Add index for better query performance
CREATE INDEX idx_sale_items_ichiban_kuji_prize ON sale_items(ichiban_kuji_prize_id);
CREATE INDEX idx_sale_items_ichiban_kuji ON sale_items(ichiban_kuji_id);
