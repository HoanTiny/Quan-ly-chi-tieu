-- Tạo hàm SQL để thêm cột created_by vào bảng expenses nếu chưa tồn tại
CREATE OR REPLACE FUNCTION add_created_by_column()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Kiểm tra xem cột đã tồn tại chưa
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'expenses' 
    AND column_name = 'created_by'
  ) THEN
    -- Thêm cột created_by
    ALTER TABLE public.expenses ADD COLUMN created_by UUID REFERENCES auth.users(id);
    
    -- Cập nhật RLS policy cho bảng expenses
    DROP POLICY IF EXISTS "Members can manage expenses" ON expenses;
    
    -- Tạo policy mới
    CREATE POLICY "Members can view expenses in their households" ON expenses
      FOR SELECT USING (
        household_id IN (
          SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
      );

    -- Chỉ người tạo chi tiêu hoặc admin mới có thể xóa chi tiêu
    CREATE POLICY "Only creators or admins can delete expenses" ON expenses
      FOR DELETE USING (
        created_by = auth.uid() OR
        auth.uid() IN (
          SELECT user_id FROM household_members 
          WHERE household_id = expenses.household_id AND role = 'admin'
        )
      );

    -- Tất cả thành viên có thể thêm chi tiêu
    CREATE POLICY "Members can insert expenses" ON expenses
      FOR INSERT WITH CHECK (
        household_id IN (
          SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
      );

    -- Chỉ người tạo chi tiêu hoặc admin mới có thể cập nhật chi tiêu
    CREATE POLICY "Only creators or admins can update expenses" ON expenses
      FOR UPDATE USING (
        created_by = auth.uid() OR
        auth.uid() IN (
          SELECT user_id FROM household_members 
          WHERE household_id = expenses.household_id AND role = 'admin'
        )
      );
      
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;
