import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import ExpenseTracker from "@/components/expense-tracker"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function DashboardPage() {
  const cookieStore = cookies()
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Log session for debugging
  console.log("Dashboard session:", session ? "Authenticated" : "Not authenticated")

  // If not authenticated, redirect to login
  if (!session) {
    redirect("/")
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-4">Bảng điều khiển</h1>
      <ExpenseTracker userId={session.user.id} />
    </div>
  )
}

