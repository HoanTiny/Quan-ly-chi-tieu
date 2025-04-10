import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Kiểm tra quyền admin
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Thực thi SQL để thêm cột created_by
    const sql = `
      -- Thêm cột created_by vào bảng expenses nếu chưa tồn tại
      DO $$
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
        END IF;
      END $$;
    `

    const { error } = await supabase.rpc("exec_sql", { sql_query: sql })

    if (error) {
      console.error("Error executing SQL:", error)
      return NextResponse.json({ error: "Failed to update database schema" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
