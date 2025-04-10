"use server"

import { createClient } from "@/lib/supabase/server"

// Cập nhật hàm login để xử lý chuyển hướng
export async function login(data) {
  const supabase = await createClient()

  const { email, password } = data

  const { error, data: authData } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.error("Login error:", error.message)
    return { error: error.message } // Trả về lỗi để hiển thị trên client
  }

  // Đăng nhập thành công
  return { success: true, user: authData?.user } // Trả về thành công và thông tin người dùng
}

export async function signup(data) {
  const supabase = await createClient()

  const { email, password } = data

  const { error, data: authData } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
    },
  })

  if (error) {
    console.error("Signup error:", error.message)
    return { error: error.message } // Trả về lỗi để hiển thị trên client
  }

  return { success: true, user: authData?.user } // Trả về thành công
}
