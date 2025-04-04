"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import RoomManagement from "./room-management"
import RoommateManagement from "./roommate-management"
import ExpenseForm from "./expense-form"
import ExpenseList from "./expense-list"
import SummaryView from "./summary-view"
import SettlementView from "./settlement-view"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { LogOut, Share2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

// Types
export interface Roommate {
  id: string
  name: string
  room: string
  household_id: string
}

export interface Expense {
  id: string
  description: string
  amount: number
  paidBy: string
  date: Date
  sharedWith: string[]
  household_id: string
}

export interface Household {
  id: string
  name: string
  created_by: string
  invite_code: string
}

export default function ExpenseTracker({ userId }: { userId: string }) {
  // State
  const [roommates, setRoommates] = useState<Roommate[]>([])
  const [rooms, setRooms] = useState<string[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [households, setHouseholds] = useState<Household[]>([])
  const [currentHousehold, setCurrentHousehold] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [inviteCode, setInviteCode] = useState("")
  const [householdName, setHouseholdName] = useState("")
  const [showCreateHousehold, setShowCreateHousehold] = useState(false)
  const [showJoinHousehold, setShowJoinHousehold] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

  // Load user's households
  useEffect(() => {
    const fetchUserHouseholds = async () => {
      try {
        setIsLoading(true)

        // Lấy danh sách household_id mà người dùng là thành viên
        const { data: membershipData, error: membershipError } = await supabase
          .from("household_members")
          .select("household_id")
          .eq("user_id", userId)

        if (membershipError) {
          console.error("Error fetching memberships:", membershipError)
          toast({
            title: "Lỗi",
            description: "Không thể tải thông tin thành viên. Vui lòng thử lại sau.",
            variant: "destructive",
          })
          setIsLoading(false)
          return
        }

        if (!membershipData || membershipData.length === 0) {
          // Người dùng chưa tham gia hộ gia đình nào
          setIsLoading(false)
          return
        }

        // Lấy thông tin chi tiết của các hộ gia đình
        const householdIds = membershipData.map((item) => item.household_id)
        const { data: householdData, error: householdError } = await supabase
          .from("households")
          .select("*")
          .in("id", householdIds)
          .order("created_at", { ascending: false })

        if (householdError) {
          console.error("Error fetching households:", householdError)
          toast({
            title: "Lỗi",
            description: "Không thể tải thông tin hộ gia đình. Vui lòng thử lại sau.",
            variant: "destructive",
          })
          setIsLoading(false)
          return
        }

        if (householdData && householdData.length > 0) {
          setHouseholds(householdData)
          setCurrentHousehold(householdData[0].id)
        }
      } catch (error) {
        console.error("Unexpected error:", error)
        toast({
          title: "Lỗi",
          description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserHouseholds()
  }, [userId, supabase, toast])

  // Load rooms, roommates and expenses when household changes
  useEffect(() => {
    const fetchHouseholdData = async () => {
      if (!currentHousehold) return

      try {
        // Fetch rooms
        const { data: roomData, error: roomError } = await supabase
          .from("rooms")
          .select("name")
          .eq("household_id", currentHousehold)

        if (roomError) {
          console.error("Error fetching rooms:", roomError)
          toast({
            title: "Lỗi",
            description: "Không thể tải danh sách phòng. Vui lòng thử lại sau.",
            variant: "destructive",
          })
        } else if (roomData) {
          setRooms(roomData.map((room) => room.name))
        }

        // Fetch roommates
        const { data: roommateData, error: roommateError } = await supabase
          .from("roommates")
          .select("*")
          .eq("household_id", currentHousehold)

        if (roommateError) {
          console.error("Error fetching roommates:", roommateError)
          toast({
            title: "Lỗi",
            description: "Không thể tải danh sách thành viên. Vui lòng thử lại sau.",
            variant: "destructive",
          })
        } else if (roommateData) {
          setRoommates(roommateData)
        }

        // Fetch expenses
        const { data: expenseData, error: expenseError } = await supabase
          .from("expenses")
          .select("*")
          .eq("household_id", currentHousehold)

        if (expenseError) {
          console.error("Error fetching expenses:", expenseError)
          toast({
            title: "Lỗi",
            description: "Không thể tải danh sách chi phí. Vui lòng thử lại sau.",
            variant: "destructive",
          })
          return
        }

        if (expenseData) {
          // Lấy thông tin chia sẻ chi phí cho mỗi chi phí
          const expensesWithShares = await Promise.all(
            expenseData.map(async (expense) => {
              const { data: sharesData, error: sharesError } = await supabase
                .from("expense_shares")
                .select("roommate_id")
                .eq("expense_id", expense.id)

              if (sharesError) {
                console.error("Error fetching expense shares:", sharesError)
                return {
                  id: expense.id,
                  description: expense.description,
                  amount: expense.amount,
                  paidBy: expense.paid_by,
                  date: new Date(expense.created_at),
                  sharedWith: [],
                  household_id: expense.household_id,
                }
              }

              return {
                id: expense.id,
                description: expense.description,
                amount: expense.amount,
                paidBy: expense.paid_by,
                date: new Date(expense.created_at),
                sharedWith: sharesData ? sharesData.map((share) => share.roommate_id) : [],
                household_id: expense.household_id,
              }
            }),
          )

          setExpenses(expensesWithShares)
        }
      } catch (error) {
        console.error("Unexpected error:", error)
        toast({
          title: "Lỗi",
          description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
          variant: "destructive",
        })
      }
    }

    fetchHouseholdData()
  }, [currentHousehold, supabase, toast])

  // Create a new household
  const createHousehold = async () => {
    if (!householdName.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập tên hộ gia đình",
        variant: "destructive",
      })
      return
    }

    try {
      // Generate a random invite code
      const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase()

      // Create the household
      const { data: householdData, error: householdError } = await supabase
        .from("households")
        .insert([
          {
            name: householdName.trim(),
            created_by: userId,
            invite_code: inviteCode,
          },
        ])
        .select()

      if (householdError) {
        toast({
          title: "Lỗi",
          description: "Không thể tạo hộ gia đình. Vui lòng thử lại.",
          variant: "destructive",
        })
        return
      }

      if (householdData && householdData.length > 0) {
        const newHouseholdId = householdData[0].id

        // Add the creator as a member
        const { error: memberError } = await supabase.from("household_members").insert([
          {
            household_id: newHouseholdId,
            user_id: userId,
            role: "admin",
          },
        ])

        if (memberError) {
          console.error("Error adding member:", memberError)
          toast({
            title: "Lỗi",
            description: "Không thể thêm bạn vào hộ gia đình. Vui lòng thử lại.",
            variant: "destructive",
          })
          return
        }

        // Update state
        setHouseholds([...households, householdData[0]])
        setCurrentHousehold(newHouseholdId)
        setShowCreateHousehold(false)
        setHouseholdName("")

        toast({
          title: "Thành công",
          description: "Đã tạo hộ gia đình mới",
        })
      }
    } catch (error) {
      console.error("Unexpected error:", error)
      toast({
        title: "Lỗi",
        description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
        variant: "destructive",
      })
    }
  }

  // Join a household with invite code
  const joinHousehold = async () => {
    if (!inviteCode.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập mã mời",
        variant: "destructive",
      })
      return
    }

    try {
      // Find the household with this invite code
      const { data: householdData, error: householdError } = await supabase
        .from("households")
        .select("*")
        .eq("invite_code", inviteCode.trim())

      if (householdError || !householdData || householdData.length === 0) {
        toast({
          title: "Lỗi",
          description: "Mã mời không hợp lệ",
          variant: "destructive",
        })
        return
      }

      const householdId = householdData[0].id

      // Check if user is already a member
      const { data: memberData } = await supabase
        .from("household_members")
        .select("*")
        .eq("household_id", householdId)
        .eq("user_id", userId)

      if (memberData && memberData.length > 0) {
        toast({
          title: "Thông báo",
          description: "Bạn đã là thành viên của hộ gia đình này",
        })
        setCurrentHousehold(householdId)
        setShowJoinHousehold(false)
        setInviteCode("")
        return
      }

      // Add user as a member
      const { error: memberError } = await supabase.from("household_members").insert([
        {
          household_id: householdId,
          user_id: userId,
          role: "member",
        },
      ])

      if (memberError) {
        console.error("Error joining household:", memberError)
        toast({
          title: "Lỗi",
          description: "Không thể tham gia hộ gia đình. Vui lòng thử lại.",
          variant: "destructive",
        })
        return
      }

      // Update state
      setHouseholds([...households, householdData[0]])
      setCurrentHousehold(householdId)
      setShowJoinHousehold(false)
      setInviteCode("")

      toast({
        title: "Thành công",
        description: "Đã tham gia hộ gia đình",
      })
    } catch (error) {
      console.error("Unexpected error:", error)
      toast({
        title: "Lỗi",
        description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
        variant: "destructive",
      })
    }
  }

  // Share invite code
  const shareInviteCode = async () => {
    if (!currentHousehold) return

    try {
      const { data, error } = await supabase
        .from("households")
        .select("invite_code")
        .eq("id", currentHousehold)
        .single()

      if (error) {
        console.error("Error fetching invite code:", error)
        toast({
          title: "Lỗi",
          description: "Không thể lấy mã mời. Vui lòng thử lại.",
          variant: "destructive",
        })
        return
      }

      if (data) {
        try {
          await navigator.clipboard.writeText(data.invite_code)
          toast({
            title: "Đã sao chép",
            description: "Mã mời đã được sao chép vào clipboard",
          })
        } catch (err) {
          toast({
            title: "Mã mời",
            description: `Mã mời của bạn là: ${data.invite_code}`,
          })
        }
      }
    } catch (error) {
      console.error("Unexpected error:", error)
      toast({
        title: "Lỗi",
        description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
        variant: "destructive",
      })
    }
  }

  // Sign out
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      window.location.href = "/"
    } catch (error) {
      console.error("Error signing out:", error)
      toast({
        title: "Lỗi",
        description: "Không thể đăng xuất. Vui lòng thử lại.",
        variant: "destructive",
      })
    }
  }

  // Add new room
  const addRoom = async (roomName: string) => {
    if (roomName.trim() === "" || rooms.includes(roomName.trim()) || !currentHousehold) return

    try {
      const { error } = await supabase.from("rooms").insert([
        {
          name: roomName.trim(),
          household_id: currentHousehold,
        },
      ])

      if (error) {
        console.error("Error adding room:", error)
        toast({
          title: "Lỗi",
          description: "Không thể thêm phòng. Vui lòng thử lại.",
          variant: "destructive",
        })
        return
      }

      setRooms([...rooms, roomName.trim()])
    } catch (error) {
      console.error("Unexpected error:", error)
      toast({
        title: "Lỗi",
        description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
        variant: "destructive",
      })
    }
  }

  // Remove room
  const removeRoom = async (roomName: string) => {
    if (!currentHousehold) return

    try {
      const { error } = await supabase.from("rooms").delete().eq("household_id", currentHousehold).eq("name", roomName)

      if (error) {
        console.error("Error removing room:", error)
        toast({
          title: "Lỗi",
          description: "Không thể xóa phòng. Vui lòng thử lại.",
          variant: "destructive",
        })
        return
      }

      setRooms(rooms.filter((r) => r !== roomName))

      // Remove all roommates in that room
      const roommatesInRoom = roommates.filter((r) => r.room === roomName)
      for (const roommate of roommatesInRoom) {
        await removeRoommate(roommate.id)
      }
    } catch (error) {
      console.error("Unexpected error:", error)
      toast({
        title: "Lỗi",
        description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
        variant: "destructive",
      })
    }
  }

  // Add new roommate
  const addRoommate = async (name: string, room: string) => {
    if (name.trim() === "" || room === "" || !currentHousehold) return

    try {
      const { data, error } = await supabase
        .from("roommates")
        .insert([
          {
            name: name.trim(),
            room: room,
            household_id: currentHousehold,
          },
        ])
        .select()

      if (error) {
        console.error("Error adding roommate:", error)
        toast({
          title: "Lỗi",
          description: "Không thể thêm thành viên. Vui lòng thử lại.",
          variant: "destructive",
        })
        return
      }

      if (data && data.length > 0) {
        setRoommates([...roommates, data[0]])
      }
    } catch (error) {
      console.error("Unexpected error:", error)
      toast({
        title: "Lỗi",
        description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
        variant: "destructive",
      })
    }
  }

  // Remove roommate
  const removeRoommate = async (id: string) => {
    try {
      // First check if this roommate is used in any expenses
      const { data: expenseData } = await supabase.from("expenses").select("id").eq("paid_by", id)

      if (expenseData && expenseData.length > 0) {
        toast({
          title: "Lỗi",
          description: "Không thể xóa thành viên này vì họ đã thanh toán một số chi phí.",
          variant: "destructive",
        })
        return
      }

      // Delete expense shares first
      await supabase.from("expense_shares").delete().eq("roommate_id", id)

      // Then delete the roommate
      const { error } = await supabase.from("roommates").delete().eq("id", id)

      if (error) {
        console.error("Error removing roommate:", error)
        toast({
          title: "Lỗi",
          description: "Không thể xóa thành viên. Vui lòng thử lại.",
          variant: "destructive",
        })
        return
      }

      setRoommates(roommates.filter((roommate) => roommate.id !== id))

      // Update expenses that include this roommate
      const updatedExpenses = expenses.map((expense) => ({
        ...expense,
        sharedWith: expense.sharedWith.filter((roommateId) => roommateId !== id),
      }))

      setExpenses(updatedExpenses)
    } catch (error) {
      console.error("Unexpected error:", error)
      toast({
        title: "Lỗi",
        description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
        variant: "destructive",
      })
    }
  }

  // Add new expense
  const addExpense = async (expense: Omit<Expense, "id" | "date" | "household_id">) => {
    if (!currentHousehold) return

    try {
      // If no roommates are selected to share with, default to all roommates in the same room
      let sharedWith = [...expense.sharedWith]
      if (sharedWith.length === 0) {
        const payerRoommate = roommates.find((r) => r.id === expense.paidBy)
        if (payerRoommate) {
          sharedWith = roommates.filter((r) => r.room === payerRoommate.room).map((r) => r.id)
        }
      }

      // Insert the expense
      const { data, error } = await supabase
        .from("expenses")
        .insert([
          {
            description: expense.description.trim(),
            amount: Math.round(expense.amount), // Round to whole number
            paid_by: expense.paidBy,
            household_id: currentHousehold,
          },
        ])
        .select()

      if (error || !data || data.length === 0) {
        console.error("Error adding expense:", error)
        toast({
          title: "Lỗi",
          description: "Không thể thêm chi phí. Vui lòng thử lại.",
          variant: "destructive",
        })
        return
      }

      const newExpenseId = data[0].id

      // Insert expense shares
      const shares = sharedWith.map((roommateId) => ({
        expense_id: newExpenseId,
        roommate_id: roommateId,
      }))

      const { error: sharesError } = await supabase.from("expense_shares").insert(shares)

      if (sharesError) {
        console.error("Error adding expense shares:", sharesError)
        toast({
          title: "Lỗi",
          description: "Không thể thêm chi tiết chia sẻ. Vui lòng thử lại.",
          variant: "destructive",
        })
        return
      }

      // Add to local state
      const expenseObj: Expense = {
        id: newExpenseId,
        description: expense.description.trim(),
        amount: Math.round(expense.amount),
        paidBy: expense.paidBy,
        date: new Date(),
        sharedWith: sharedWith,
        household_id: currentHousehold,
      }

      setExpenses([...expenses, expenseObj])
    } catch (error) {
      console.error("Unexpected error:", error)
      toast({
        title: "Lỗi",
        description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
        variant: "destructive",
      })
    }
  }

  // Remove expense
  const removeExpense = async (id: string) => {
    try {
      // Delete expense shares first (foreign key constraint)
      await supabase.from("expense_shares").delete().eq("expense_id", id)

      // Then delete the expense
      const { error } = await supabase.from("expenses").delete().eq("id", id)

      if (error) {
        console.error("Error removing expense:", error)
        toast({
          title: "Lỗi",
          description: "Không thể xóa chi phí. Vui lòng thử lại.",
          variant: "destructive",
        })
        return
      }

      setExpenses(expenses.filter((expense) => expense.id !== id))
    } catch (error) {
      console.error("Unexpected error:", error)
      toast({
        title: "Lỗi",
        description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
        variant: "destructive",
      })
    }
  }

  // Calculate balances
  const calculateBalances = () => {
    const balances: Record<string, number> = {}

    // Initialize balances for all roommates
    roommates.forEach((roommate) => {
      balances[roommate.id] = 0
    })

    // Calculate each expense's contribution to balances
    expenses.forEach((expense) => {
      const payer = expense.paidBy
      const sharedCount = expense.sharedWith.length

      // Skip if no one to share with
      if (sharedCount === 0) return

      const amountPerPerson = expense.amount / sharedCount

      // Add the full amount to the payer's balance (positive means others owe them)
      balances[payer] += expense.amount

      // Subtract each person's share from their balance
      expense.sharedWith.forEach((roommateId) => {
        balances[roommateId] -= amountPerPerson
      })
    })

    // Round all balances to whole numbers
    Object.keys(balances).forEach((key) => {
      balances[key] = Math.round(balances[key])
    })

    return balances
  }

  // Get final settlement transactions
  const getSettlementTransactions = () => {
    const balances = calculateBalances()
    const transactions: { from: string; to: string; amount: number }[] = []

    // Create arrays of debtors and creditors
    const debtors = roommates
      .filter((r) => balances[r.id] < 0)
      .map((r) => ({ id: r.id, balance: balances[r.id] }))
      .sort((a, b) => a.balance - b.balance) // Sort by balance ascending (most negative first)

    const creditors = roommates
      .filter((r) => balances[r.id] > 0)
      .map((r) => ({ id: r.id, balance: balances[r.id] }))
      .sort((a, b) => b.balance - a.balance) // Sort by balance descending (most positive first)

    // Match debtors with creditors to settle debts
    let debtorIndex = 0
    let creditorIndex = 0

    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex]
      const creditor = creditors[creditorIndex]

      // Calculate the transaction amount (minimum of the absolute values)
      const amount = Math.min(Math.abs(debtor.balance), creditor.balance)

      // Round to whole number
      const roundedAmount = Math.round(amount)

      if (roundedAmount > 0) {
        transactions.push({
          from: debtor.id,
          to: creditor.id,
          amount: roundedAmount,
        })
      }

      // Update balances
      debtor.balance += amount
      creditor.balance -= amount

      // Move to next debtor/creditor if their balance is settled
      if (Math.abs(debtor.balance) < 1) debtorIndex++
      if (Math.abs(creditor.balance) < 1) creditorIndex++
    }

    return transactions
  }

  // Calculate total expenses
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)

  // If loading, show loading state
  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Đang tải...</div>
  }

  // If no households, show create/join options
  if (households.length === 0 || !currentHousehold) {
    return (
      <div className="max-w-md mx-auto">
        <div className="flex justify-end mb-4">
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" /> Đăng xuất
          </Button>
        </div>

        <div className="space-y-4">
          {!showCreateHousehold && !showJoinHousehold && (
            <>
              <Button className="w-full" onClick={() => setShowCreateHousehold(true)}>
                Tạo hộ gia đình mới
              </Button>
              <Button className="w-full" variant="outline" onClick={() => setShowJoinHousehold(true)}>
                Tham gia hộ gia đình
              </Button>
            </>
          )}

          {showCreateHousehold && (
            <div className="space-y-4 border p-4 rounded-md">
              <h2 className="text-lg font-medium">Tạo hộ gia đình mới</h2>
              <div className="space-y-2">
                <Label htmlFor="householdName">Tên hộ gia đình</Label>
                <Input
                  id="householdName"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  placeholder="Nhập tên hộ gia đình"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={createHousehold}>Tạo</Button>
                <Button variant="outline" onClick={() => setShowCreateHousehold(false)}>
                  Hủy
                </Button>
              </div>
            </div>
          )}

          {showJoinHousehold && (
            <div className="space-y-4 border p-4 rounded-md">
              <h2 className="text-lg font-medium">Tham gia hộ gia đình</h2>
              <div className="space-y-2">
                <Label htmlFor="inviteCode">Mã mời</Label>
                <Input
                  id="inviteCode"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Nhập mã mời"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={joinHousehold}>Tham gia</Button>
                <Button variant="outline" onClick={() => setShowJoinHousehold(false)}>
                  Hủy
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          {households.length > 1 && (
            <select
              className="border rounded px-2 py-1"
              value={currentHousehold}
              onChange={(e) => setCurrentHousehold(e.target.value)}
            >
              {households.map((household) => (
                <option key={household.id} value={household.id}>
                  {household.name}
                </option>
              ))}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={shareInviteCode}>
            <Share2 className="h-4 w-4 mr-2" /> Chia sẻ mã mời
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" /> Đăng xuất
        </Button>
      </div>

      <Tabs defaultValue="roommates" className="w-full">
        <TabsList className="grid grid-cols-4 mb-8">
          <TabsTrigger value="roommates">Thành viên</TabsTrigger>
          <TabsTrigger value="expenses">Chi tiêu</TabsTrigger>
          <TabsTrigger value="summary">Tổng kết</TabsTrigger>
          <TabsTrigger value="settlement">Thanh toán</TabsTrigger>
        </TabsList>

        {/* Roommates Tab */}
        <TabsContent value="roommates">
          <RoomManagement rooms={rooms} onAddRoom={addRoom} onRemoveRoom={removeRoom} />
          <RoommateManagement
            roommates={roommates}
            rooms={rooms}
            onAddRoommate={addRoommate}
            onRemoveRoommate={removeRoommate}
          />
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses">
          <ExpenseForm roommates={roommates} rooms={rooms} onAddExpense={addExpense} />
          <ExpenseList expenses={expenses} roommates={roommates} onRemoveExpense={removeExpense} />
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary">
          <SummaryView totalExpenses={totalExpenses} balances={calculateBalances()} roommates={roommates} />
        </TabsContent>

        {/* Settlement Tab */}
        <TabsContent value="settlement">
          <SettlementView
            transactions={getSettlementTransactions()}
            roommates={roommates}
            hasRoommates={roommates.length > 0}
            hasExpenses={expenses.length > 0}
            householdId={currentHousehold}
            expenses={expenses}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}

