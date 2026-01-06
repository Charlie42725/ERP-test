-- Add remaining column to ichiban_kuji_prizes table
ALTER TABLE ichiban_kuji_prizes
ADD COLUMN remaining INTEGER NOT NULL DEFAULT 0;

-- Update existing records to set remaining = quantity
UPDATE ichiban_kuji_prizes
SET remaining = quantity;

-- Add comment
COMMENT ON COLUMN ichiban_kuji_prizes.remaining IS '該賞剩餘抽數';
