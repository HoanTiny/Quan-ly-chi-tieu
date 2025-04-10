-- Thêm cột created_by vào bảng expenses nếu chưa tồn tại
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Cập nhật RLS policy cho bảng expenses
CREATE OR REPLACE POLICY "Members can view expenses in their households" ON expenses
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Chỉ người tạo chi tiêu hoặc admin mới có thể xóa chi tiêu
CREATE OR REPLACE POLICY "Only creators or admins can delete expenses" ON expenses
  FOR DELETE USING (
    created_by = auth.uid() OR
    auth.uid() IN (
      SELECT user_id FROM household_members 
      WHERE household_id = expenses.household_id AND role = 'admin'
    )
  );

-- Tất cả thành viên có thể thêm chi tiêu
CREATE OR REPLACE POLICY "Members can insert expenses" ON expenses
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Chỉ người tạo chi tiêu hoặc admin mới có thể cập nhật chi tiêu
CREATE OR REPLACE POLICY "Only creators or admins can update expenses" ON expenses
  FOR UPDATE USING (
    created_by = auth.uid() OR
    auth.uid() IN (
      SELECT user_id FROM household_members 
      WHERE household_id = expenses.household_id AND role = 'admin'
    )
  );
