-- Create tables for the expense tracker application

-- Households table
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  invite_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Household members table
CREATE TABLE household_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(household_id, user_id)
);

-- Thêm cột linked_roommate_id vào bảng household_members
ALTER TABLE household_members ADD COLUMN IF NOT EXISTS linked_roommate_id UUID REFERENCES roommates(id) ON DELETE SET NULL;

-- Rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, household_id)
);

-- Roommates table
CREATE TABLE roommates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  room TEXT NOT NULL,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses table
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  paid_by UUID NOT NULL REFERENCES roommates(id),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expense shares table
CREATE TABLE expense_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  roommate_id UUID NOT NULL REFERENCES roommates(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(expense_id, roommate_id)
);

-- Create RLS policies
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE roommates ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_shares ENABLE ROW LEVEL SECURITY;

-- Households policies
CREATE POLICY "Users can view households they are members of" ON households
  FOR SELECT USING (
    id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create households" ON households
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Only admins can update households" ON households
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM household_members 
      WHERE household_id = id AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete households" ON households
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM household_members 
      WHERE household_id = id AND role = 'admin'
    )
  );

-- Household members policies
CREATE POLICY "Users can view members of their households" ON household_members
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add members to households they admin" ON household_members
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM household_members 
      WHERE household_id = household_id AND role = 'admin'
    )
  );

CREATE POLICY "Users can join households with invite code" ON household_members
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT id FROM households WHERE invite_code = current_setting('app.invite_code', true)::text
    ) AND user_id = auth.uid()
  );

-- Rooms policies
CREATE POLICY "Users can view rooms in their households" ON rooms
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can manage rooms" ON rooms
  FOR ALL USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Roommates policies
CREATE POLICY "Users can view roommates in their households" ON roommates
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can manage roommates" ON roommates
  FOR ALL USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Expenses policies
CREATE POLICY "Users can view expenses in their households" ON expenses
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can manage expenses" ON expenses
  FOR ALL USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Expense shares policies
CREATE POLICY "Users can view expense shares in their households" ON expense_shares
  FOR SELECT USING (
    expense_id IN (
      SELECT id FROM expenses WHERE household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Members can manage expense shares" ON expense_shares
  FOR ALL USING (
    expense_id IN (
      SELECT id FROM expenses WHERE household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
      )
    )
  );
