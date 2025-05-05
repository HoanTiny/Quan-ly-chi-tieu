CREATE OR REPLACE FUNCTION create_roommate_qrcodes_table()
RETURNS void AS $$
BEGIN
  -- Kiểm tra xem bảng đã tồn tại chưa
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'roommate_qrcodes') THEN
    -- Tạo bảng roommate_qrcodes
    CREATE TABLE roommate_qrcodes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      roommate_id UUID NOT NULL,
      household_id UUID NOT NULL,
      qr_type VARCHAR(20) NOT NULL,
      qr_data TEXT NOT NULL,
      qr_label TEXT,
      qr_image_url TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      FOREIGN KEY (roommate_id) REFERENCES roommates(id) ON DELETE CASCADE,
      FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
    );
    
    -- Tạo index để tăng tốc truy vấn
    CREATE INDEX idx_roommate_qrcodes_roommate_id ON roommate_qrcodes(roommate_id);
    CREATE INDEX idx_roommate_qrcodes_household_id ON roommate_qrcodes(household_id);
  END IF;
END;
$$ LANGUAGE plpgsql;
