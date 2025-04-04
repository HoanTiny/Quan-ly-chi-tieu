-- Tạo hàm SQL để tạo bảng payment_statuses nếu chưa tồn tại
CREATE OR REPLACE FUNCTION create_payment_statuses_table()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Kiểm tra xem bảng đã tồn tại chưa
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'payment_statuses'
  ) THEN
    -- Tạo bảng payment_statuses
    CREATE TABLE public.payment_statuses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      from_id UUID NOT NULL,
      to_id UUID NOT NULL,
      expense_id UUID,
      amount INTEGER NOT NULL,
      is_paid BOOLEAN DEFAULT false,
      household_id UUID NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT fk_from_id FOREIGN KEY (from_id) REFERENCES public.roommates(id) ON DELETE CASCADE,
      CONSTRAINT fk_to_id FOREIGN KEY (to_id) REFERENCES public.roommates(id) ON DELETE CASCADE,
      CONSTRAINT fk_household_id FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE,
      CONSTRAINT fk_expense_id FOREIGN KEY (expense_id) REFERENCES public.expenses(id) ON DELETE CASCADE,
      UNIQUE(from_id, to_id, expense_id, household_id)
    );

    -- Tạo RLS policies cho bảng payment_statuses
    ALTER TABLE public.payment_statuses ENABLE ROW LEVEL SECURITY;

    -- Policies cho payment_statuses
    CREATE POLICY "Users can view payment statuses in their households" ON public.payment_statuses
      FOR SELECT USING (
        household_id IN (
          SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
        )
      );

    CREATE POLICY "Members can manage payment statuses" ON public.payment_statuses
      FOR ALL USING (
        household_id IN (
          SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
        )
      );
      
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

