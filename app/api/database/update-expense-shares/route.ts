import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createClient()

    // Thêm cột multiplier vào bảng expense_shares nếu chưa tồn tại
    const { error } = await supabase.rpc("exec_sql", {
      sql_string: `
        ALTER TABLE expense_shares
        ADD COLUMN IF NOT EXISTS multiplier NUMERIC DEFAULT 1 NOT NULL;
      `,
    })

    if (error) {
      console.error("Database update error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Database updated successfully" })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
