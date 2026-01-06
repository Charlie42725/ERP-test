-- 一番賞主表
CREATE TABLE IF NOT EXISTS ichiban_kuji (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  total_draws INTEGER NOT NULL DEFAULT 0,
  avg_cost DECIMAL(10, 2) DEFAULT 0,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 一番賞獎項表
CREATE TABLE IF NOT EXISTS ichiban_kuji_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kuji_id UUID NOT NULL REFERENCES ichiban_kuji(id) ON DELETE CASCADE,
  prize_tier VARCHAR(50) NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_ichiban_kuji_prizes_kuji_id ON ichiban_kuji_prizes(kuji_id);
CREATE INDEX IF NOT EXISTS idx_ichiban_kuji_prizes_product_id ON ichiban_kuji_prizes(product_id);

-- 自動更新 updated_at 的觸發器
CREATE OR REPLACE FUNCTION fn_update_ichiban_kuji_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ichiban_kuji_updated_at
  BEFORE UPDATE ON ichiban_kuji
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_ichiban_kuji_updated_at();

-- RLS 政策（如果需要的話）
ALTER TABLE ichiban_kuji ENABLE ROW LEVEL SECURITY;
ALTER TABLE ichiban_kuji_prizes ENABLE ROW LEVEL SECURITY;

-- 允許所有操作（根據你的需求調整）
CREATE POLICY "Enable all access for ichiban_kuji" ON ichiban_kuji FOR ALL USING (true);
CREATE POLICY "Enable all access for ichiban_kuji_prizes" ON ichiban_kuji_prizes FOR ALL USING (true);
