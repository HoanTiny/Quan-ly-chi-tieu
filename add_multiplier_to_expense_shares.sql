-- Thêm cột multiplier vào bảng expense_shares
ALTER TABLE expense_shares
ADD COLUMN IF NOT EXISTS multiplier NUMERIC DEFAULT 1 NOT NULL;
