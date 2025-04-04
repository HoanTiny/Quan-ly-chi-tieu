-- Tạo bảng payment_statuses để lưu trữ trạng thái thanh toán
CREATE TABLE payment_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_id UUID NOT NULL REFERENCES roommates(id) ON DELETE CASCADE,
  to_id UUID NOT NULL REFERENCES roommates(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  is_paid BOOLEAN DEFAULT false,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(from_id, to_id, household_id)
);

-- Tạo RLS policies cho bảng payment_statuses
ALTER TABLE payment_statuses ENABLE ROW LEVEL SECURITY;

-- Policies cho payment_statuses
CREATE POLICY "Users can view payment statuses in their households" ON payment_statuses
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can manage payment statuses" ON payment_statuses
  FOR ALL USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

