import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Thực hiện truy vấn SQL để tạo bảng payment_statuses nếu chưa tồn tại
    const { error } = await supabase.rpc("create_payment_statuses_table")

    if (error) {
      console.error("Lỗi khi tạo bảng payment_statuses:", error)
      return NextResponse.json({ error: "Không thể tạo bảng payment_statuses" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Lỗi không mong muốn:", error)
    return NextResponse.json({ error: "Đã xảy ra lỗi không mong muốn" }, { status: 500 })
  }
}
