-- Thêm cột account_number vào bảng roommate_qrcodes nếu chưa tồn tại
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'roommate_qrcodes' 
    AND column_name = 'account_number'
  ) THEN
    ALTER TABLE roommate_qrcodes ADD COLUMN account_number TEXT;
  END IF;
END
$$;
