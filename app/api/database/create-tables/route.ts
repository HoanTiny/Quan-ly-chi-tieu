import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Create a Supabase client with the service role key for admin operations
const supabaseAdmin = createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "")

export async function POST(request: Request) {
  try {
    // Thực hiện truy vấn SQL để tạo bảng payment_statuses nếu chưa tồn tại
    const { error: paymentStatusesError } = await supabaseAdmin.rpc("create_payment_statuses_table")

    if (paymentStatusesError) {
      console.error("Lỗi khi tạo bảng payment_statuses:", paymentStatusesError)
      return NextResponse.json({ error: "Không thể tạo bảng payment_statuses" }, { status: 500 })
    }

    // Tạo bảng roommate_qrcodes nếu chưa tồn tại
    // Thực hiện truy vấn SQL trực tiếp thay vì sử dụng RPC
    const createQRCodeTableSQL = `
      DO $$
      BEGIN
        -- Kiểm tra xem bảng đã tồn tại chưa
        IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'roommate_qrcodes') THEN
          -- Tạo bảng roommate_qrcodes
          CREATE TABLE roommate_qrcodes (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            roommate_id UUID NOT NULL,
            household_id UUID NOT NULL,
            qr_type VARCHAR(20) NOT NULL,
            qr_data TEXT,
            qr_label TEXT,
            qr_image_url TEXT,
            account_number TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            FOREIGN KEY (roommate_id) REFERENCES roommates(id) ON DELETE CASCADE,
            FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
          );
          
          -- Tạo index để tăng tốc truy vấn
          CREATE INDEX idx_roommate_qrcodes_roommate_id ON roommate_qrcodes(roommate_id);
          CREATE INDEX idx_roommate_qrcodes_household_id ON roommate_qrcodes(household_id);
        END IF;
      END;
      $$;
    `

    const { error: qrCodesError } = await supabaseAdmin.sql(createQRCodeTableSQL)

    if (qrCodesError) {
      console.error("Lỗi khi tạo bảng roommate_qrcodes:", qrCodesError)
      return NextResponse.json({ error: "Không thể tạo bảng roommate_qrcodes" }, { status: 500 })
    }

    // Tạo bucket storage cho QR codes nếu chưa tồn tại
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const qrCodesBucketExists = buckets?.some((bucket) => bucket.name === "qrcodes")

    if (!qrCodesBucketExists) {
      const { error: bucketError } = await supabaseAdmin.storage.createBucket("qrcodes", {
        public: true,
        fileSizeLimit: 1024 * 1024, // 1MB limit
        allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg"],
      })

      if (bucketError) {
        console.error("Lỗi khi tạo bucket storage:", bucketError)
        // Tiếp tục thực hiện ngay cả khi không thể tạo bucket
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Lỗi không mong muốn:", error)
    return NextResponse.json({ error: "Đã xảy ra lỗi không mong muốn" }, { status: 500 })
  }
}
