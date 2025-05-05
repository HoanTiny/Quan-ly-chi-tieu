import { createClient } from "@supabase/supabase-js"

// Tạo Supabase client với service role key cho các thao tác admin
export const createAdminClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase environment variables")
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey)
}
