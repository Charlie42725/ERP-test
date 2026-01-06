-- 為已存在的 ichiban_kuji 表添加 price 欄位
ALTER TABLE ichiban_kuji
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) NOT NULL DEFAULT 0;
