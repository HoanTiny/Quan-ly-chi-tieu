"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Filter, Download, PieChart, BarChart, User, Calendar, ArrowRight, DollarSign, Wallet } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import type { Roommate, Expense } from "./expense-tracker"
import { formatCurrency } from "@/lib/utils"
import { format, parse, startOfMonth, endOfMonth, isWithinInterval } from "date-fns"
import { createClient } from "@/lib/supabase/client"

interface MonthlyDashboardProps {
  expenses: Expense[]
  roommates: Roommate[]
}

interface BalanceTransaction {
  from: string
  to: string
  amount: number
  description: string
}

interface NetSpending {
  roommateId: string
  totalSpent: number
  totalReceived: number
  totalPaid: number
  netSpending: number
}

export default function MonthlyDashboard({ expenses, roommates }: MonthlyDashboardProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>("")
  const [selectedRoom, setSelectedRoom] = useState<string>("")
  const [selectedRoommate, setSelectedRoommate] = useState<string>("")
  const [viewMode, setViewMode] = useState<"table" | "chart">("table")
  const [activeTab, setActiveTab] = useState<"overview" | "details" | "balance" | "net">("overview")
  const [currentUserId, setCurrentUserId] = useState<string>("")
  const [linkedRoommateId, setLinkedRoommateId] = useState<string>("")

  const supabase = createClient()

  // Lấy thông tin người dùng hiện tại và roommate được liên kết
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          setCurrentUserId(user.id)

          // Lấy thông tin liên kết với roommate
          const { data, error } = await supabase
            .from("household_members")
            .select("linked_roommate_id")
            .eq("user_id", user.id)
            .single()

          if (!error && data && data.linked_roommate_id) {
            setLinkedRoommateId(data.linked_roommate_id)
            setSelectedRoommate(data.linked_roommate_id)
          }
        }
      } catch (error) {
        console.error("Error fetching current user:", error)
      }
    }

    fetchCurrentUser()
  }, [supabase])

  // Initialize the current month as selected month if empty
  useEffect(() => {
    if (!selectedMonth) {
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
      setSelectedMonth(currentMonth)
    }
  }, [selectedMonth])

  // Get unique rooms
  const uniqueRooms = useMemo(() => {
    return Array.from(new Set(roommates.map((r) => r.room)))
  }, [roommates])

  // Generate available months from expenses data
  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    expenses.forEach((expense) => {
      const date = new Date(expense.date)
      months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`)
    })
    return Array.from(months).sort().reverse()
  }, [expenses])

  // Filter expenses for the selected month, room, and roommate
  const filteredExpenses = useMemo(() => {
    if (!selectedMonth && !selectedRoom && !selectedRoommate) return expenses

    return expenses.filter((expense) => {
      // Filter by month if selected
      let withinDateRange = true
      if (selectedMonth) {
        const [year, month] = selectedMonth.split("-").map(Number)
        const monthStart = startOfMonth(new Date(year, month - 1))
        const monthEnd = endOfMonth(new Date(year, month - 1))
        withinDateRange = isWithinInterval(new Date(expense.date), { start: monthStart, end: monthEnd })
      }

      // Filter by room if selected
      let matchesRoomFilter = true
      if (selectedRoom) {
        const payer = roommates.find((r) => r.id === expense.paidBy)
        matchesRoomFilter = payer?.room === selectedRoom
      }

      // Filter by roommate if selected
      let matchesRoommateFilter = true
      if (selectedRoommate) {
        matchesRoommateFilter = expense.paidBy === selectedRoommate
      }

      return withinDateRange && matchesRoomFilter && matchesRoommateFilter
    })
  }, [expenses, selectedMonth, selectedRoom, selectedRoommate, roommates])

  // Calculate total spending by roommate for the filtered expenses
  const spendingByRoommate = useMemo(() => {
    const spending: Record<string, number> = {}

    // Initialize all roommates with zero spending
    roommates.forEach((roommate) => {
      spending[roommate.id] = 0
    })

    // Add expense amounts to the payers
    filteredExpenses.forEach((expense) => {
      if (spending[expense.paidBy] !== undefined) {
        spending[expense.paidBy] += expense.amount
      }
    })

    return spending
  }, [filteredExpenses, roommates])

  // Calculate expense categories (simplified as expense descriptions)
  const expenseCategories = useMemo(() => {
    const categories: Record<string, number> = {}

    filteredExpenses.forEach((expense) => {
      if (!categories[expense.description]) {
        categories[expense.description] = 0
      }
      categories[expense.description] += expense.amount
    })

    // Sort categories by amount
    return Object.entries(categories)
      .sort(([, a], [, b]) => b - a)
      .reduce(
        (obj, [key, value]) => ({
          ...obj,
          [key]: value,
        }),
        {} as Record<string, number>,
      )
  }, [filteredExpenses])

  // Calculate total monthly spending
  const totalMonthlySpending = useMemo(() => {
    return filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  }, [filteredExpenses])

  // Get expenses by roommate for detailed view
  const expensesByRoommate = useMemo(() => {
    const result: Record<string, Expense[]> = {}

    // Initialize with empty arrays for all roommates
    roommates.forEach((roommate) => {
      result[roommate.id] = []
    })

    // Group expenses by payer
    filteredExpenses.forEach((expense) => {
      if (result[expense.paidBy]) {
        result[expense.paidBy].push(expense)
      }
    })

    return result
  }, [filteredExpenses, roommates])

  // Calculate balances for each roommate based on filtered expenses
  const balancesByRoommate = useMemo(() => {
    const balances: Record<string, number> = {}

    // Initialize balances for all roommates
    roommates.forEach((roommate) => {
      balances[roommate.id] = 0
    })

    // Calculate each expense's contribution to balances
    filteredExpenses.forEach((expense) => {
      const payer = expense.paidBy
      const sharedWith = expense.sharedWith

      // Skip if no one to share with
      const sharedCount = sharedWith.length
      if (sharedCount === 0) return

      const amountPerPerson = expense.amount / sharedCount

      // Add the full amount to the payer's balance (positive means others owe them)
      balances[payer] += expense.amount

      // Subtract each person's share from their balance
      sharedWith.forEach((roommateId) => {
        balances[roommateId] -= amountPerPerson
      })
    })

    // Round all balances to whole numbers
    Object.keys(balances).forEach((key) => {
      balances[key] = Math.round(balances[key])
    })

    return balances
  }, [filteredExpenses, roommates])

  // Generate settlement transactions for the month
  const monthlySettlementTransactions = useMemo(() => {
    const transactions: BalanceTransaction[] = []
    const balances = { ...balancesByRoommate }

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
        const monthLabel = selectedMonth
          ? format(parse(selectedMonth, "yyyy-MM", new Date()), "MM/yyyy")
          : "Tất cả các tháng"

        transactions.push({
          from: debtor.id,
          to: creditor.id,
          amount: roundedAmount,
          description: `Thanh toán tháng ${monthLabel}`,
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
  }, [balancesByRoommate, roommates, selectedMonth])

  // Group transactions by payer
  const transactionsByPayer = useMemo(() => {
    const result: Record<string, BalanceTransaction[]> = {}

    // Initialize with empty arrays for all roommates
    roommates.forEach((roommate) => {
      result[roommate.id] = []
    })

    // Group transactions by payer (from)
    monthlySettlementTransactions.forEach((transaction) => {
      if (result[transaction.from]) {
        result[transaction.from].push(transaction)
      }
    })

    return result
  }, [monthlySettlementTransactions, roommates])

  // Group transactions by receiver
  const transactionsByReceiver = useMemo(() => {
    const result: Record<string, BalanceTransaction[]> = {}

    // Initialize with empty arrays for all roommates
    roommates.forEach((roommate) => {
      result[roommate.id] = []
    })

    // Group transactions by receiver (to)
    monthlySettlementTransactions.forEach((transaction) => {
      if (result[transaction.to]) {
        result[transaction.to].push(transaction)
      }
    })

    return result
  }, [monthlySettlementTransactions, roommates])

  // Calculate net spending for each roommate
  const netSpendingByRoommate = useMemo(() => {
    const result: NetSpending[] = []

    roommates.forEach((roommate) => {
      // Tổng chi tiêu
      const totalSpent = spendingByRoommate[roommate.id] || 0

      // Tổng số tiền được nhận từ người khác
      const totalReceived = transactionsByReceiver[roommate.id]
        ? transactionsByReceiver[roommate.id].reduce((sum, t) => sum + t.amount, 0)
        : 0

      // Tổng số tiền phải trả cho người khác
      const totalPaid = transactionsByPayer[roommate.id]
        ? transactionsByPayer[roommate.id].reduce((sum, t) => sum + t.amount, 0)
        : 0

      // Chi tiêu thực tế = Tổng chi tiêu - Tổng được nhận + Tổng phải trả
      const netSpending = totalSpent - totalReceived + totalPaid

      result.push({
        roommateId: roommate.id,
        totalSpent,
        totalReceived,
        totalPaid,
        netSpending,
      })
    })

    // Sắp xếp theo chi tiêu thực tế giảm dần
    return result.sort((a, b) => b.netSpending - a.netSpending)
  }, [roommates, spendingByRoommate, transactionsByReceiver, transactionsByPayer])

  // Export data to CSV
  const exportToCSV = () => {
    if (filteredExpenses.length === 0 && activeTab !== "balance" && activeTab !== "net") return
    if (activeTab === "balance" && monthlySettlementTransactions.length === 0) return
    if (activeTab === "net" && netSpendingByRoommate.length === 0) return

    // Create CSV content with BOM for Vietnamese characters
    const BOM = "\uFEFF"
    let csvContent = ""
    let fileName = ""

    if (activeTab === "overview") {
      // Overview export
      csvContent = "Tháng,Thành viên,Phòng,Số tiền chi tiêu\n"

      // Add spending by roommate
      roommates.forEach((roommate) => {
        if (spendingByRoommate[roommate.id] > 0) {
          const monthLabel = selectedMonth ? format(parse(selectedMonth, "yyyy-MM", new Date()), "MM/yyyy") : "Tất cả"
          csvContent += `"${monthLabel}","${roommate.name}","${roommate.room}","${formatCurrency(
            spendingByRoommate[roommate.id],
          )}"\n`
        }
      })

      // Add category breakdown
      csvContent += "\n\nDanh mục chi tiêu,Số tiền\n"
      Object.entries(expenseCategories).forEach(([category, amount]) => {
        csvContent += `"${category}","${formatCurrency(amount)}"\n`
      })

      fileName = `bao-cao-chi-tieu-tong-quan-thang-${selectedMonth || "tat-ca"}.csv`
    } else if (activeTab === "details") {
      // Detailed export
      csvContent = "Tháng,Thành viên,Phòng,Mô tả chi tiêu,Ngày,Số tiền\n"

      // Add detailed expenses
      filteredExpenses.forEach((expense) => {
        const payer = roommates.find((r) => r.id === expense.paidBy)
        if (payer) {
          const monthLabel = format(new Date(expense.date), "MM/yyyy")
          const dateLabel = format(new Date(expense.date), "dd/MM/yyyy")
          csvContent += `"${monthLabel}","${payer.name}","${payer.room}","${expense.description}","${dateLabel}","${formatCurrency(
            expense.amount,
          )}"\n`
        }
      })

      fileName = `bao-cao-chi-tieu-chi-tiet-thang-${selectedMonth || "tat-ca"}.csv`
    } else if (activeTab === "balance") {
      // Balance export
      csvContent = "Tháng,Thành viên,Phòng,Số dư,Trạng thái\n"

      // Add balance by roommate
      roommates.forEach((roommate) => {
        const balance = balancesByRoommate[roommate.id]
        if (balance !== 0) {
          const monthLabel = selectedMonth ? format(parse(selectedMonth, "yyyy-MM", new Date()), "MM/yyyy") : "Tất cả"
          const status = balance > 0 ? "Được nhận" : "Phải trả"
          csvContent += `"${monthLabel}","${roommate.name}","${roommate.room}","${formatCurrency(
            Math.abs(balance),
          )}","${status}"\n`
        }
      })

      // Add settlement transactions
      csvContent += "\n\nChi tiết thanh toán\n"
      csvContent += "Người trả,Phòng,Người nhận,Phòng,Số tiền\n"

      monthlySettlementTransactions.forEach((transaction) => {
        const payer = roommates.find((r) => r.id === transaction.from)
        const receiver = roommates.find((r) => r.id === transaction.to)
        if (payer && receiver) {
          csvContent += `"${payer.name}","${payer.room}","${receiver.name}","${receiver.room}","${formatCurrency(
            transaction.amount,
          )}"\n`
        }
      })

      fileName = `bao-cao-thanh-toan-thang-${selectedMonth || "tat-ca"}.csv`
    } else if (activeTab === "net") {
      // Net spending export
      csvContent = "Tháng,Thành viên,Phòng,Tổng chi tiêu,Tổng được nhận,Tổng phải trả,Chi tiêu thực tế\n"

      // Add net spending by roommate
      netSpendingByRoommate.forEach((spending) => {
        const roommate = roommates.find((r) => r.id === spending.roommateId)
        if (roommate) {
          const monthLabel = selectedMonth ? format(parse(selectedMonth, "yyyy-MM", new Date()), "MM/yyyy") : "Tất cả"
          csvContent += `"${monthLabel}","${roommate.name}","${roommate.room}","${formatCurrency(spending.totalSpent)}","${formatCurrency(spending.totalReceived)}","${formatCurrency(spending.totalPaid)}","${formatCurrency(spending.netSpending)}"\n`
        }
      })

      fileName = `bao-cao-chi-tieu-thuc-te-thang-${selectedMonth || "tat-ca"}.csv`
    }

    // Create and download the file
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", fileName)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Format month for display
  const formatMonth = (monthStr: string) => {
    if (!monthStr) return "Tất cả các tháng"
    const [year, month] = monthStr.split("-")
    return `Tháng ${month}/${year}`
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Báo cáo chi tiêu theo tháng</CardTitle>
          <CardDescription>Phân tích chi tiêu theo tháng, thành viên và danh mục</CardDescription>
        </div>
        <div className="flex space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" /> Bộ lọc
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <div className="p-2">
                <p className="text-sm font-medium mb-1">Tháng:</p>
                <select
                  className="w-full text-sm border rounded px-2 py-1"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  <option value="">Tất cả</option>
                  {availableMonths.map((month) => (
                    <option key={month} value={month}>
                      {formatMonth(month)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-2">
                <p className="text-sm font-medium mb-1">Phòng:</p>
                <select
                  className="w-full text-sm border rounded px-2 py-1"
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                >
                  <option value="">Tất cả</option>
                  {uniqueRooms.map((room) => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-2">
                <p className="text-sm font-medium mb-1">Thành viên:</p>
                <select
                  className="w-full text-sm border rounded px-2 py-1"
                  value={selectedRoommate}
                  onChange={(e) => setSelectedRoommate(e.target.value)}
                >
                  <option value="">Tất cả</option>
                  {roommates.map((roommate) => (
                    <option key={roommate.id} value={roommate.id}>
                      {roommate.name} ({roommate.room}){roommate.id === linkedRoommateId ? " (Bạn)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <DropdownMenuSeparator />

              <div className="p-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setSelectedMonth("")
                    setSelectedRoom("")
                    setSelectedRoommate(linkedRoommateId || "")
                  }}
                >
                  Xóa bộ lọc
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={
              (filteredExpenses.length === 0 && activeTab !== "balance" && activeTab !== "net") ||
              (activeTab === "balance" && monthlySettlementTransactions.length === 0) ||
              (activeTab === "net" && netSpendingByRoommate.length === 0)
            }
          >
            <Download className="h-4 w-4 mr-2" /> Xuất báo cáo
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {viewMode === "table" ? <BarChart className="h-4 w-4 mr-2" /> : <PieChart className="h-4 w-4 mr-2" />}
                Chế độ xem
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <div className="p-2">
                <Tabs
                  value={viewMode}
                  onValueChange={(value) => setViewMode(value as "table" | "chart")}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="table">Bảng</TabsTrigger>
                    <TabsTrigger value="chart">Biểu đồ</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "overview" | "details" | "balance" | "net")}
        >
          <TabsList className="mb-4">
            <TabsTrigger value="overview" className="flex items-center">
              <BarChart className="h-4 w-4 mr-2" /> Tổng quan
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center">
              <User className="h-4 w-4 mr-2" /> Chi tiết theo người
            </TabsTrigger>
            <TabsTrigger value="balance" className="flex items-center">
              <DollarSign className="h-4 w-4 mr-2" /> Số dư & Thanh toán
            </TabsTrigger>
            <TabsTrigger value="net" className="flex items-center">
              <Wallet className="h-4 w-4 mr-2" /> Chi tiêu thực tế
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {selectedMonth || selectedRoom || selectedRoommate
                  ? "Không có chi tiêu nào trong khoảng thời gian hoặc bộ lọc đã chọn."
                  : "Không có dữ liệu chi tiêu. Vui lòng thêm chi tiêu để xem báo cáo."}
              </div>
            ) : (
              <>
                {/* Tổng quan chi tiêu */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-center">
                        <h3 className="text-lg font-medium text-muted-foreground">Tổng chi tiêu</h3>
                        <p className="text-3xl font-bold mt-2">{formatCurrency(totalMonthlySpending)}</p>
                        <p className="text-sm text-muted-foreground mt-1">{formatMonth(selectedMonth)}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="text-center">
                        <h3 className="text-lg font-medium text-muted-foreground">Số lượng chi tiêu</h3>
                        <p className="text-3xl font-bold mt-2">{filteredExpenses.length}</p>
                        <p className="text-sm text-muted-foreground mt-1">{formatMonth(selectedMonth)}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="text-center">
                        <h3 className="text-lg font-medium text-muted-foreground">Chi tiêu trung bình</h3>
                        <p className="text-3xl font-bold mt-2">
                          {formatCurrency(
                            filteredExpenses.length > 0 ? totalMonthlySpending / filteredExpenses.length : 0,
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">Mỗi chi tiêu</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Chi tiêu theo thành viên */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Chi tiêu theo thành viên</h3>

                  {viewMode === "table" ? (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Thành viên</TableHead>
                            <TableHead>Phòng</TableHead>
                            <TableHead className="text-right">Tổng chi tiêu</TableHead>
                            <TableHead className="text-right">Tỉ lệ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {roommates
                            .filter((roommate) => spendingByRoommate[roommate.id] > 0)
                            .sort((a, b) => spendingByRoommate[b.id] - spendingByRoommate[a.id])
                            .map((roommate) => (
                              <TableRow key={roommate.id}>
                                <TableCell className="font-medium">
                                  {roommate.name}
                                  {roommate.id === linkedRoommateId && (
                                    <Badge variant="outline" className="ml-2">
                                      Bạn
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>{roommate.room}</TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(spendingByRoommate[roommate.id])}
                                </TableCell>
                                <TableCell className="text-right">
                                  {totalMonthlySpending > 0
                                    ? `${Math.round((spendingByRoommate[roommate.id] / totalMonthlySpending) * 100)}%`
                                    : "0%"}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="border rounded-md p-4">
                      {/* Đơn giản hóa biểu đồ bằng cách hiển thị các thanh tiến trình */}
                      <div className="space-y-4">
                        {roommates
                          .filter((roommate) => spendingByRoommate[roommate.id] > 0)
                          .sort((a, b) => spendingByRoommate[b.id] - spendingByRoommate[a.id])
                          .map((roommate) => {
                            const percentage =
                              totalMonthlySpending > 0
                                ? Math.round((spendingByRoommate[roommate.id] / totalMonthlySpending) * 100)
                                : 0

                            return (
                              <div key={roommate.id}>
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm font-medium">
                                    {roommate.name} ({roommate.room}){roommate.id === linkedRoommateId && " (Bạn)"}
                                  </span>
                                  <span className="text-sm font-medium">
                                    {formatCurrency(spendingByRoommate[roommate.id])}
                                  </span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-4">
                                  <div
                                    className="bg-primary rounded-full h-4"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                                <div className="text-xs text-right mt-1">{percentage}%</div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Chi tiêu theo danh mục */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Chi tiêu theo danh mục</h3>

                  {viewMode === "table" ? (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Danh mục</TableHead>
                            <TableHead className="text-right">Số tiền</TableHead>
                            <TableHead className="text-right">Tỉ lệ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(expenseCategories).map(([category, amount]) => (
                            <TableRow key={category}>
                              <TableCell className="font-medium">{category}</TableCell>
                              <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
                              <TableCell className="text-right">
                                {totalMonthlySpending > 0
                                  ? `${Math.round((amount / totalMonthlySpending) * 100)}%`
                                  : "0%"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="border rounded-md p-4">
                      {/* Thanh tiến trình cho các danh mục */}
                      <div className="space-y-4">
                        {Object.entries(expenseCategories).map(([category, amount]) => {
                          const percentage =
                            totalMonthlySpending > 0 ? Math.round((amount / totalMonthlySpending) * 100) : 0

                          return (
                            <div key={category}>
                              <div className="flex justify-between mb-1">
                                <span className="text-sm font-medium">{category}</span>
                                <span className="text-sm font-medium">{formatCurrency(amount)}</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-4">
                                <div className="bg-primary rounded-full h-4" style={{ width: `${percentage}%` }}></div>
                              </div>
                              <div className="text-xs text-right mt-1">{percentage}%</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="details">
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {selectedMonth || selectedRoom || selectedRoommate
                  ? "Không có chi tiêu nào trong khoảng thời gian hoặc bộ lọc đã chọn."
                  : "Không có dữ liệu chi tiêu. Vui lòng thêm chi tiêu để xem báo cáo."}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Chi tiết chi tiêu theo thành viên</h3>
                  <div className="text-sm text-muted-foreground">
                    {formatMonth(selectedMonth)}
                    {selectedRoom ? ` • Phòng: ${selectedRoom}` : ""}
                    {selectedRoommate ? ` • ${roommates.find((r) => r.id === selectedRoommate)?.name || ""}` : ""}
                  </div>
                </div>

                <ScrollArea className="h-[600px] rounded-md border">
                  <div className="p-4">
                    <Accordion type="multiple" className="w-full">
                      {roommates
                        .filter(
                          (roommate) =>
                            expensesByRoommate[roommate.id] &&
                            expensesByRoommate[roommate.id].length > 0 &&
                            (!selectedRoommate || roommate.id === selectedRoommate) &&
                            (!selectedRoom || roommate.room === selectedRoom),
                        )
                        .sort((a, b) => spendingByRoommate[b.id] - spendingByRoommate[a.id])
                        .map((roommate) => (
                          <AccordionItem key={roommate.id} value={roommate.id}>
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex justify-between w-full pr-4">
                                <div className="flex items-center">
                                  <User className="h-4 w-4 mr-2 text-muted-foreground" />
                                  <span>{roommate.name}</span>
                                  <span className="ml-2 text-sm text-muted-foreground">({roommate.room})</span>
                                  {roommate.id === linkedRoommateId && (
                                    <Badge variant="outline" className="ml-2">
                                      Bạn
                                    </Badge>
                                  )}
                                </div>
                                <div className="font-semibold">{formatCurrency(spendingByRoommate[roommate.id])}</div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="border rounded-md overflow-hidden mt-2">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Ngày</TableHead>
                                      <TableHead>Mô tả</TableHead>
                                      <TableHead className="text-right">Số tiền</TableHead>
                                      <TableHead className="text-right">Chia sẻ với</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {expensesByRoommate[roommate.id]
                                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                      .map((expense) => (
                                        <TableRow key={expense.id}>
                                          <TableCell className="whitespace-nowrap">
                                            {format(new Date(expense.date), "dd/MM/yyyy")}
                                          </TableCell>
                                          <TableCell>{expense.description}</TableCell>
                                          <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
                                          <TableCell className="text-right">
                                            {expense.sharedWith.length} người
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                    </Accordion>

                    {roommates.filter(
                      (roommate) =>
                        expensesByRoommate[roommate.id] &&
                        expensesByRoommate[roommate.id].length > 0 &&
                        (!selectedRoommate || roommate.id === selectedRoommate) &&
                        (!selectedRoom || roommate.room === selectedRoom),
                    ).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        Không có dữ liệu chi tiêu nào phù hợp với bộ lọc đã chọn.
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Tổng kết chi tiêu */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center">
                      <div className="flex items-center mb-2 sm:mb-0">
                        <Calendar className="h-5 w-5 mr-2 text-muted-foreground" />
                        <span className="text-sm font-medium">Tổng chi tiêu {formatMonth(selectedMonth)}</span>
                      </div>
                      <div className="text-xl font-bold">{formatCurrency(totalMonthlySpending)}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="balance">
            {monthlySettlementTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {selectedMonth || selectedRoom || selectedRoommate
                  ? "Không có dữ liệu thanh toán nào trong khoảng thời gian hoặc bộ lọc đã chọn."
                  : "Không có dữ liệu thanh toán. Vui lòng thêm chi tiêu để xem báo cáo thanh toán."}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Số dư và thanh toán theo tháng</h3>
                  <div className="text-sm text-muted-foreground">
                    {formatMonth(selectedMonth)}
                    {selectedRoom ? ` • Phòng: ${selectedRoom}` : ""}
                    {selectedRoommate ? ` • ${roommates.find((r) => r.id === selectedRoommate)?.name || ""}` : ""}
                  </div>
                </div>

                {/* Tổng quan số dư */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-center">
                        <h3 className="text-lg font-medium text-muted-foreground">Tổng số dư dương</h3>
                        <p className="text-3xl font-bold mt-2 text-green-600">
                          {formatCurrency(
                            Object.values(balancesByRoommate)
                              .filter((balance) => balance > 0)
                              .reduce((sum, balance) => sum + balance, 0),
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">Số tiền được nhận</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="text-center">
                        <h3 className="text-lg font-medium text-muted-foreground">Tổng số dư âm</h3>
                        <p className="text-3xl font-bold mt-2 text-red-600">
                          {formatCurrency(
                            Math.abs(
                              Object.values(balancesByRoommate)
                                .filter((balance) => balance < 0)
                                .reduce((sum, balance) => sum + balance, 0),
                            ),
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">Số tiền phải trả</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="text-center">
                        <h3 className="text-lg font-medium text-muted-foreground">Số giao dịch</h3>
                        <p className="text-3xl font-bold mt-2">{monthlySettlementTransactions.length}</p>
                        <p className="text-sm text-muted-foreground mt-1">Cần thanh toán</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Bảng số dư theo thành viên */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Số dư theo thành viên</h3>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Thành viên</TableHead>
                          <TableHead>Phòng</TableHead>
                          <TableHead className="text-right">Số dư</TableHead>
                          <TableHead>Trạng thái</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roommates
                          .filter(
                            (roommate) =>
                              balancesByRoommate[roommate.id] !== 0 &&
                              (!selectedRoommate || roommate.id === selectedRoommate) &&
                              (!selectedRoom || roommate.room === selectedRoom),
                          )
                          .sort((a, b) => balancesByRoommate[b.id] - balancesByRoommate[a.id])
                          .map((roommate) => {
                            const balance = balancesByRoommate[roommate.id]
                            const isPositive = balance > 0
                            return (
                              <TableRow key={roommate.id}>
                                <TableCell className="font-medium">
                                  {roommate.name}
                                  {roommate.id === linkedRoommateId && (
                                    <Badge variant="outline" className="ml-2">
                                      Bạn
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>{roommate.room}</TableCell>
                                <TableCell className="text-right font-medium">
                                  <span className={isPositive ? "text-green-600" : "text-red-600"}>
                                    {isPositive ? "+" : "-"}
                                    {formatCurrency(Math.abs(balance))}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={isPositive ? "outline" : "secondary"}
                                    className={
                                      isPositive
                                        ? "bg-green-50 text-green-700 border-green-200"
                                        : "bg-red-50 text-red-700 border-red-200"
                                    }
                                  >
                                    {isPositive ? "Được nhận" : "Phải trả"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Chi tiết thanh toán */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Chi tiết thanh toán</h3>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Người trả</TableHead>
                          <TableHead>Người nhận</TableHead>
                          <TableHead className="text-right">Số tiền</TableHead>
                          <TableHead>Mô tả</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlySettlementTransactions
                          .filter(
                            (transaction) =>
                              (!selectedRoommate ||
                                transaction.from === selectedRoommate ||
                                transaction.to === selectedRoommate) &&
                              (!selectedRoom ||
                                roommates.find((r) => r.id === transaction.from)?.room === selectedRoom ||
                                roommates.find((r) => r.id === transaction.to)?.room === selectedRoom),
                          )
                          .map((transaction, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {roommates.find((r) => r.id === transaction.from)?.name}
                                    {transaction.from === linkedRoommateId && " (Bạn)"}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {roommates.find((r) => r.id === transaction.from)?.room}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {roommates.find((r) => r.id === transaction.to)?.name}
                                    {transaction.to === linkedRoommateId && " (Bạn)"}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {roommates.find((r) => r.id === transaction.to)?.room}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(transaction.amount)}
                              </TableCell>
                              <TableCell>{transaction.description}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Thanh toán theo người */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Khoản phải trả */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Khoản phải trả</CardTitle>
                      <CardDescription>Các khoản thanh toán mỗi người cần thực hiện</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-4">
                          {roommates
                            .filter(
                              (roommate) =>
                                transactionsByPayer[roommate.id] &&
                                transactionsByPayer[roommate.id].length > 0 &&
                                (!selectedRoommate || roommate.id === selectedRoommate) &&
                                (!selectedRoom || roommate.room === selectedRoom),
                            )
                            .map((roommate) => {
                              const transactions = transactionsByPayer[roommate.id]
                              const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0)
                              return (
                                <div key={roommate.id} className="border rounded-md p-3">
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center">
                                      <User className="h-4 w-4 mr-2 text-muted-foreground" />
                                      <span className="font-medium">
                                        {roommate.name}
                                        {roommate.id === linkedRoommateId && " (Bạn)"}
                                      </span>
                                      <span className="ml-1 text-xs text-muted-foreground">({roommate.room})</span>
                                    </div>
                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                      Phải trả: {formatCurrency(totalAmount)}
                                    </Badge>
                                  </div>
                                  <div className="space-y-2 mt-3">
                                    {transactions.map((transaction, idx) => (
                                      <div key={idx} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center">
                                          <ArrowRight className="h-3 w-3 mr-1 text-muted-foreground" />
                                          <span>
                                            {roommates.find((r) => r.id === transaction.to)?.name}
                                            {transaction.to === linkedRoommateId && " (Bạn)"}
                                            <span className="text-xs text-muted-foreground">
                                              ({roommates.find((r) => r.id === transaction.to)?.room})
                                            </span>
                                          </span>
                                        </div>
                                        <span>{formatCurrency(transaction.amount)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}

                          {roommates.filter(
                            (roommate) =>
                              transactionsByPayer[roommate.id] &&
                              transactionsByPayer[roommate.id].length > 0 &&
                              (!selectedRoommate || roommate.id === selectedRoommate) &&
                              (!selectedRoom || roommate.room === selectedRoom),
                          ).length === 0 && (
                            <div className="text-center py-4 text-muted-foreground">
                              Không có khoản phải trả nào phù hợp với bộ lọc đã chọn.
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* Khoản được nhận */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Khoản được nhận</CardTitle>
                      <CardDescription>Các khoản thanh toán mỗi người sẽ nhận được</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-4">
                          {roommates
                            .filter(
                              (roommate) =>
                                transactionsByReceiver[roommate.id] &&
                                transactionsByReceiver[roommate.id].length > 0 &&
                                (!selectedRoommate || roommate.id === selectedRoommate) &&
                                (!selectedRoom || roommate.room === selectedRoom),
                            )
                            .map((roommate) => {
                              const transactions = transactionsByReceiver[roommate.id]
                              const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0)
                              return (
                                <div key={roommate.id} className="border rounded-md p-3">
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center">
                                      <User className="h-4 w-4 mr-2 text-muted-foreground" />
                                      <span className="font-medium">
                                        {roommate.name}
                                        {roommate.id === linkedRoommateId && " (Bạn)"}
                                      </span>
                                      <span className="ml-1 text-xs text-muted-foreground">({roommate.room})</span>
                                    </div>
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                      Được nhận: {formatCurrency(totalAmount)}
                                    </Badge>
                                  </div>
                                  <div className="space-y-2 mt-3">
                                    {transactions.map((transaction, idx) => (
                                      <div key={idx} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center">
                                          <ArrowRight className="h-3 w-3 mr-1 text-muted-foreground" />
                                          <span>
                                            {roommates.find((r) => r.id === transaction.from)?.name}
                                            {transaction.from === linkedRoommateId && " (Bạn)"}
                                            <span className="text-xs text-muted-foreground">
                                              ({roommates.find((r) => r.id === transaction.from)?.room})
                                            </span>
                                          </span>
                                        </div>
                                        <span>{formatCurrency(transaction.amount)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}

                          {roommates.filter(
                            (roommate) =>
                              transactionsByReceiver[roommate.id] &&
                              transactionsByReceiver[roommate.id].length > 0 &&
                              (!selectedRoommate || roommate.id === selectedRoommate) &&
                              (!selectedRoom || roommate.room === selectedRoom),
                          ).length === 0 && (
                            <div className="text-center py-4 text-muted-foreground">
                              Không có khoản được nhận nào phù hợp với bộ lọc đã chọn.
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="net">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Chi tiêu thực tế theo thành viên</h3>
                <div className="text-sm text-muted-foreground">
                  {formatMonth(selectedMonth)}
                  {selectedRoom ? ` • Phòng: ${selectedRoom}` : ""}
                  {selectedRoommate ? ` • ${roommates.find((r) => r.id === selectedRoommate)?.name || ""}` : ""}
                </div>
              </div>

              {/* Tổng quan chi tiêu thực tế */}
              <Card>
                <CardHeader>
                  <CardTitle>Tổng kết chi tiêu thực tế</CardTitle>
                  <CardDescription>Chi tiêu thực tế = Tổng chi tiêu - Tổng được nhận + Tổng phải trả</CardDescription>
                </CardHeader>
                <CardContent>
                  {netSpendingByRoommate.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {selectedMonth || selectedRoom || selectedRoommate
                        ? "Không có dữ liệu chi tiêu nào trong khoảng thời gian hoặc bộ lọc đã chọn."
                        : "Không có dữ liệu chi tiêu. Vui lòng thêm chi tiêu để xem báo cáo."}
                    </div>
                  ) : (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Thành viên</TableHead>
                            <TableHead>Phòng</TableHead>
                            <TableHead className="text-right">Tổng chi tiêu</TableHead>
                            <TableHead className="text-right">Được nhận</TableHead>
                            <TableHead className="text-right">Phải trả</TableHead>
                            <TableHead className="text-right font-medium">Chi tiêu thực tế</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {netSpendingByRoommate
                            .filter(
                              (spending) =>
                                (!selectedRoommate || spending.roommateId === selectedRoommate) &&
                                (!selectedRoom ||
                                  roommates.find((r) => r.id === spending.roommateId)?.room === selectedRoom),
                            )
                            .map((spending) => {
                              const roommate = roommates.find((r) => r.id === spending.roommateId)
                              if (!roommate) return null

                              return (
                                <TableRow key={roommate.id}>
                                  <TableCell className="font-medium">
                                    {roommate.name}
                                    {roommate.id === linkedRoommateId && (
                                      <Badge variant="outline" className="ml-2">
                                        Bạn
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>{roommate.room}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(spending.totalSpent)}</TableCell>
                                  <TableCell className="text-right text-green-600">
                                    {formatCurrency(spending.totalReceived)}
                                  </TableCell>
                                  <TableCell className="text-right text-red-600">
                                    {formatCurrency(spending.totalPaid)}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(spending.netSpending)}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Chi tiết chi tiêu thực tế */}
              <Card>
                <CardHeader>
                  <CardTitle>Chi tiết chi tiêu thực tế</CardTitle>
                  <CardDescription>Phân tích chi tiết các khoản chi tiêu thực tế của mỗi thành viên</CardDescription>
                </CardHeader>
                <CardContent>
                  {netSpendingByRoommate.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Không có dữ liệu chi tiêu nào phù hợp với bộ lọc đã chọn.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {viewMode === "table" ? (
                        <div className="space-y-4">
                          {netSpendingByRoommate
                            .filter(
                              (spending) =>
                                (!selectedRoommate || spending.roommateId === selectedRoommate) &&
                                (!selectedRoom ||
                                  roommates.find((r) => r.id === spending.roommateId)?.room === selectedRoom),
                            )
                            .map((spending) => {
                              const roommate = roommates.find((r) => r.id === spending.roommateId)
                              if (!roommate) return null

                              return (
                                <Card key={roommate.id} className="overflow-hidden">
                                  <CardHeader className="bg-muted/30 py-3">
                                    <div className="flex justify-between items-center">
                                      <div className="flex items-center">
                                        <User className="h-4 w-4 mr-2 text-muted-foreground" />
                                        <CardTitle className="text-base">
                                          {roommate.name}
                                          {roommate.id === linkedRoommateId && " (Bạn)"}
                                        </CardTitle>
                                        <span className="ml-2 text-xs text-muted-foreground">({roommate.room})</span>
                                      </div>
                                      <div className="font-bold">{formatCurrency(spending.netSpending)}</div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="p-0">
                                    <div className="grid grid-cols-3 divide-x">
                                      <div className="p-4 text-center">
                                        <p className="text-sm text-muted-foreground">Tổng chi tiêu</p>
                                        <p className="text-lg font-medium mt-1">
                                          {formatCurrency(spending.totalSpent)}
                                        </p>
                                      </div>
                                      <div className="p-4 text-center">
                                        <p className="text-sm text-muted-foreground">Được nhận</p>
                                        <p className="text-lg font-medium mt-1 text-green-600">
                                          {formatCurrency(spending.totalReceived)}
                                        </p>
                                      </div>
                                      <div className="p-4 text-center">
                                        <p className="text-sm text-muted-foreground">Phải trả</p>
                                        <p className="text-lg font-medium mt-1 text-red-600">
                                          {formatCurrency(spending.totalPaid)}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="p-4 border-t">
                                      <div className="flex justify-between items-center">
                                        <p className="text-sm font-medium">Chi tiêu thực tế</p>
                                        <p className="text-lg font-bold">{formatCurrency(spending.netSpending)}</p>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Tổng chi tiêu - Tổng được nhận + Tổng phải trả
                                      </p>
                                    </div>
                                  </CardContent>
                                </Card>
                              )
                            })}
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {netSpendingByRoommate
                            .filter(
                              (spending) =>
                                (!selectedRoommate || spending.roommateId === selectedRoommate) &&
                                (!selectedRoom ||
                                  roommates.find((r) => r.id === spending.roommateId)?.room === selectedRoom),
                            )
                            .map((spending) => {
                              const roommate = roommates.find((r) => r.id === spending.roommateId)
                              if (!roommate) return null

                              // Tính tỉ lệ chi tiêu thực tế
                              const totalNetSpending = netSpendingByRoommate.reduce((sum, s) => sum + s.netSpending, 0)
                              const percentage =
                                totalNetSpending > 0 ? Math.round((spending.netSpending / totalNetSpending) * 100) : 0

                              return (
                                <div key={roommate.id}>
                                  <div className="flex justify-between mb-1">
                                    <span className="text-sm font-medium">
                                      {roommate.name} ({roommate.room}){roommate.id === linkedRoommateId && " (Bạn)"}
                                    </span>
                                    <span className="text-sm font-medium">{formatCurrency(spending.netSpending)}</span>
                                  </div>
                                  <div className="w-full bg-muted rounded-full h-4">
                                    <div
                                      className="bg-primary rounded-full h-4"
                                      style={{ width: `${percentage}%` }}
                                    ></div>
                                  </div>
                                  <div className="flex justify-between text-xs mt-1">
                                    <span>
                                      Chi: {formatCurrency(spending.totalSpent)} | Nhận:{" "}
                                      {formatCurrency(spending.totalReceived)} | Trả:{" "}
                                      {formatCurrency(spending.totalPaid)}
                                    </span>
                                    <span>{percentage}%</span>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tổng kết chi tiêu thực tế */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row justify-between items-center">
                    <div className="flex items-center mb-2 sm:mb-0">
                      <Wallet className="h-5 w-5 mr-2 text-muted-foreground" />
                      <span className="text-sm font-medium">Tổng chi tiêu thực tế {formatMonth(selectedMonth)}</span>
                    </div>
                    <div className="text-xl font-bold">
                      {formatCurrency(netSpendingByRoommate.reduce((sum, s) => sum + s.netSpending, 0))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
