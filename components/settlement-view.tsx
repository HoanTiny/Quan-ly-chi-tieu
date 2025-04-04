"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileSpreadsheet, PlusCircle, Filter } from "lucide-react"
import type { Roommate, Expense } from "./expense-tracker"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { vi } from "date-fns/locale"

interface SettlementViewProps {
  transactions: { from: string; to: string; amount: number }[]
  roommates: Roommate[]
  hasRoommates: boolean
  hasExpenses: boolean
  householdId: string
  expenses: Expense[]
}

interface PaymentStatus {
  id: string
  from_id: string
  to_id: string
  expense_id?: string
  amount: number
  is_paid: boolean
  household_id: string
  created_at: string
}

interface DetailedTransaction {
  from: string
  to: string
  amount: number
  expenseId: string
  expenseDescription: string
  date: Date
}

export default function SettlementView({
  transactions,
  roommates,
  hasRoommates,
  hasExpenses,
  householdId,
  expenses,
}: SettlementViewProps) {
  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [tableExists, setTableExists] = useState(true)
  const [isCreatingTable, setIsCreatingTable] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>("all")
  const [detailedTransactions, setDetailedTransactions] = useState<DetailedTransaction[]>([])
  const supabase = createClient()
  const { toast } = useToast()

  // Lấy tên người dùng theo ID
  const getRoommateName = (id: string) => {
    const roommate = roommates.find((r) => r.id === id)
    return roommate ? `${roommate.name}` : "Không xác định"
  }

  // Tạo ID duy nhất cho mỗi giao dịch
  const getTransactionId = (from: string, to: string, expenseId?: string) => {
    return expenseId ? `${from}-${to}-${expenseId}` : `${from}-${to}`
  }

  // Tạo bảng payment_statuses nếu chưa tồn tại
  const createPaymentStatusTable = async () => {
    setIsCreatingTable(true)
    try {
      const { error } = await supabase.rpc("create_payment_statuses_table")

      if (error) {
        console.error("Lỗi khi tạo bảng:", error)
        toast({
          title: "Lỗi",
          description: "Không thể tạo bảng trạng thái thanh toán. Vui lòng liên hệ quản trị viên.",
          variant: "destructive",
        })
        return false
      }

      toast({
        title: "Thành công",
        description: "Đã tạo bảng trạng thái thanh toán.",
      })

      setTableExists(true)
      return true
    } catch (error) {
      console.error("Lỗi không mong muốn khi tạo bảng:", error)
      toast({
        title: "Lỗi",
        description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
        variant: "destructive",
      })
      return false
    } finally {
      setIsCreatingTable(false)
    }
  }

  // Lưu trạng thái thanh toán trong bộ nhớ cục bộ
  const savePaymentStatusLocally = (from: string, to: string, isPaid: boolean, expenseId?: string) => {
    const transactionId = getTransactionId(from, to, expenseId)
    const newStatuses = { ...paymentStatuses, [transactionId]: isPaid }
    setPaymentStatuses(newStatuses)

    // Lưu vào localStorage để giữ trạng thái giữa các lần tải trang
    if (typeof window !== "undefined") {
      localStorage.setItem(`payment_status_${householdId}`, JSON.stringify(newStatuses))
    }

    return true
  }

  // Cập nhật trạng thái thanh toán
  const updatePaymentStatus = async (from: string, to: string, amount: number, isPaid: boolean, expenseId?: string) => {
    setIsLoading(true)
    const transactionId = getTransactionId(from, to, expenseId)

    try {
      // Nếu bảng không tồn tại, chỉ lưu cục bộ
      if (!tableExists) {
        const success = savePaymentStatusLocally(from, to, isPaid, expenseId)
        if (success) {
          toast({
            title: "Đã cập nhật",
            description: isPaid
              ? `Đã đánh dấu khoản thanh toán từ ${getRoommateName(from)} cho ${getRoommateName(to)} là đã thanh toán.`
              : `Đã đánh dấu khoản thanh toán từ ${getRoommateName(from)} cho ${getRoommateName(to)} là chưa thanh toán.`,
          })
        }
        setIsLoading(false)
        return
      }

      // Kiểm tra xem bản ghi đã tồn tại chưa
      let query = supabase
        .from("payment_statuses")
        .select("*")
        .eq("from_id", from)
        .eq("to_id", to)
        .eq("household_id", householdId)

      if (expenseId) {
        query = query.eq("expense_id", expenseId)
      }

      const { data: existingData, error: checkError } = await query.maybeSingle()

      if (checkError) {
        if (checkError.code === "42P01") {
          // Bảng không tồn tại
          setTableExists(false)
          savePaymentStatusLocally(from, to, isPaid, expenseId)
          toast({
            title: "Thông báo",
            description: "Dữ liệu thanh toán được lưu cục bộ do bảng dữ liệu chưa được tạo.",
          })
          setIsLoading(false)
          return
        } else {
          console.error("Lỗi khi kiểm tra trạng thái thanh toán:", checkError)
          toast({
            title: "Lỗi",
            description: "Không thể cập nhật trạng thái thanh toán. Vui lòng thử lại sau.",
            variant: "destructive",
          })
          setIsLoading(false)
          return
        }
      }

      if (existingData) {
        // Cập nhật bản ghi hiện có
        const { error: updateError } = await supabase
          .from("payment_statuses")
          .update({ is_paid: isPaid })
          .eq("id", existingData.id)

        if (updateError) {
          console.error("Lỗi khi cập nhật trạng thái thanh toán:", updateError)
          toast({
            title: "Lỗi",
            description: "Không thể cập nhật trạng thái thanh toán. Vui lòng thử lại sau.",
            variant: "destructive",
          })
          setIsLoading(false)
          return
        }
      } else {
        // Tạo bản ghi mới
        const newRecord: any = {
          from_id: from,
          to_id: to,
          amount: amount,
          is_paid: isPaid,
          household_id: householdId,
        }

        if (expenseId) {
          newRecord.expense_id = expenseId
        }

        const { error: insertError } = await supabase.from("payment_statuses").insert([newRecord])

        if (insertError) {
          if (insertError.code === "42P01") {
            // Bảng không tồn tại
            setTableExists(false)
            savePaymentStatusLocally(from, to, isPaid, expenseId)
            toast({
              title: "Thông báo",
              description: "Dữ liệu thanh toán được lưu cục bộ do bảng dữ liệu chưa được tạo.",
            })
          } else {
            console.error("Lỗi khi tạo trạng thái thanh toán:", insertError)
            toast({
              title: "Lỗi",
              description: "Không thể cập nhật trạng thái thanh toán. Vui lòng thử lại sau.",
              variant: "destructive",
            })
          }
          setIsLoading(false)
          return
        }
      }

      // Cập nhật state
      setPaymentStatuses({
        ...paymentStatuses,
        [transactionId]: isPaid,
      })

      toast({
        title: "Thành công",
        description: isPaid
          ? `Đã đánh dấu khoản thanh toán từ ${getRoommateName(from)} cho ${getRoommateName(to)} là đã thanh toán.`
          : `Đã đánh dấu khoản thanh toán từ ${getRoommateName(from)} cho ${getRoommateName(to)} là chưa thanh toán.`,
      })
    } catch (error) {
      console.error("Lỗi không mong muốn:", error)
      toast({
        title: "Lỗi",
        description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Tải trạng thái thanh toán từ cơ sở dữ liệu hoặc localStorage
  const loadPaymentStatuses = async () => {
    if (!householdId) return

    // Trước tiên, kiểm tra localStorage
    if (typeof window !== "undefined") {
      const localData = localStorage.getItem(`payment_status_${householdId}`)
      if (localData) {
        try {
          setPaymentStatuses(JSON.parse(localData))
        } catch (e) {
          console.error("Lỗi phân tích dữ liệu cục bộ:", e)
        }
      }
    }

    // Sau đó thử tải từ cơ sở dữ liệu
    setIsLoading(true)
    try {
      const { data, error } = await supabase.from("payment_statuses").select("*").eq("household_id", householdId)

      if (error) {
        if (error.code === "42P01") {
          // Bảng không tồn tại
          setTableExists(false)
        } else {
          console.error("Lỗi khi tải trạng thái thanh toán:", error)
        }
        return
      }

      if (data) {
        const statuses: Record<string, boolean> = {}
        data.forEach((item: PaymentStatus) => {
          const transactionId = getTransactionId(item.from_id, item.to_id, item.expense_id)
          statuses[transactionId] = item.is_paid
        })
        setPaymentStatuses(statuses)
      }
    } catch (error) {
      console.error("Lỗi không mong muốn:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Tạo chi tiết giao dịch từ các chi phí
  const generateDetailedTransactions = () => {
    const detailed: DetailedTransaction[] = []

    expenses.forEach((expense) => {
      const paidBy = expense.paidBy
      const sharedWith = expense.sharedWith

      if (sharedWith.length === 0) return

      const amountPerPerson = expense.amount / sharedWith.length

      // Với mỗi người chia sẻ chi phí, tạo một giao dịch chi tiết
      sharedWith.forEach((roommateId) => {
        // Bỏ qua nếu người chia sẻ cũng là người trả tiền
        if (roommateId === paidBy) return

        detailed.push({
          from: roommateId,
          to: paidBy,
          amount: amountPerPerson,
          expenseId: expense.id,
          expenseDescription: expense.description,
          date: expense.date,
        })
      })
    })

    setDetailedTransactions(detailed)
  }

  // Lọc giao dịch theo tháng
  const getFilteredTransactions = () => {
    if (selectedMonth === "all") {
      return detailedTransactions
    }

    const [year, month] = selectedMonth.split("-")
    return detailedTransactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date)
      return (
        transactionDate.getFullYear() === Number.parseInt(year) &&
        transactionDate.getMonth() === Number.parseInt(month) - 1
      )
    })
  }

  // Tạo danh sách các tháng có giao dịch
  const getAvailableMonths = () => {
    const months = new Set<string>()

    expenses.forEach((expense) => {
      const date = new Date(expense.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      months.add(monthKey)
    })

    return Array.from(months).sort().reverse()
  }

  // Tính tổng số tiền theo người nhận
  const getTotalByRecipient = () => {
    const totals: Record<string, number> = {}

    const filtered = getFilteredTransactions()
    filtered.forEach((transaction) => {
      if (!totals[transaction.to]) {
        totals[transaction.to] = 0
      }
      totals[transaction.to] += transaction.amount
    })

    return totals
  }

  // Tính tổng số tiền theo người trả
  const getTotalByPayer = () => {
    const totals: Record<string, number> = {}

    const filtered = getFilteredTransactions()
    filtered.forEach((transaction) => {
      if (!totals[transaction.from]) {
        totals[transaction.from] = 0
      }
      totals[transaction.from] += transaction.amount
    })

    return totals
  }

  // Tải trạng thái thanh toán khi component được tải
  useEffect(() => {
    loadPaymentStatuses()
    generateDetailedTransactions()
  }, [householdId, expenses])

  // Xuất dữ liệu ra file CSV
  const exportToCSV = () => {
    const filtered = getFilteredTransactions()
    if (filtered.length === 0) return

    // Tạo nội dung CSV
    let csvContent = "Người trả,Người nhận,Mô tả chi phí,Ngày,Số tiền,Đã thanh toán\n"

    filtered.forEach((transaction) => {
      const fromName = getRoommateName(transaction.from)
      const toName = getRoommateName(transaction.to)
      const description = transaction.expenseDescription
      const date = format(new Date(transaction.date), "dd/MM/yyyy")
      const amount = formatCurrency(transaction.amount)
      const transactionId = getTransactionId(transaction.from, transaction.to, transaction.expenseId)
      const isPaid = paymentStatuses[transactionId] ? "Đã thanh toán" : "Chưa thanh toán"

      csvContent += `"${fromName}","${toName}","${description}","${date}","${amount}","${isPaid}"\n`
    })

    // Tạo blob và tải xuống
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    const monthText = selectedMonth === "all" ? "tat-ca" : selectedMonth
    link.setAttribute("download", `thanh-toan-${monthText}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const availableMonths = getAvailableMonths()
  const filteredTransactions = getFilteredTransactions()
  const totalByRecipient = getTotalByRecipient()
  const totalByPayer = getTotalByPayer()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Kế hoạch thanh toán</CardTitle>
          <CardDescription>Chi tiết các khoản thanh toán và tổng hợp</CardDescription>
        </div>
        <div className="flex space-x-2">
          {!tableExists && (
            <Button variant="outline" size="sm" onClick={createPaymentStatusTable} disabled={isCreatingTable}>
              <PlusCircle className="h-4 w-4 mr-2" />
              {isCreatingTable ? "Đang tạo bảng..." : "Tạo bảng thanh toán"}
            </Button>
          )}
          {detailedTransactions.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Xuất CSV
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!tableExists && (
          <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded-md border border-yellow-200">
            <p className="text-sm">
              <strong>Lưu ý:</strong> Bảng dữ liệu thanh toán chưa được tạo. Bạn vẫn có thể đánh dấu thanh toán, nhưng
              dữ liệu sẽ chỉ được lưu cục bộ trên trình duyệt này. Nhấn nút "Tạo bảng thanh toán" để lưu trữ dữ liệu lâu
              dài.
            </p>
          </div>
        )}

        {detailedTransactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            {!hasRoommates
              ? "Thêm thành viên và chi phí để tạo kế hoạch thanh toán."
              : !hasExpenses
                ? "Thêm chi phí để tạo kế hoạch thanh toán."
                : "Không cần thanh toán. Tất cả số dư đã được cân bằng!"}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Lọc theo tháng:</span>
              <select
                className="text-sm border rounded px-2 py-1"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="all">Tất cả</option>
                {availableMonths.map((month) => {
                  const [year, monthNum] = month.split("-")
                  return (
                    <option key={month} value={month}>
                      Tháng {monthNum}/{year}
                    </option>
                  )
                })}
              </select>
            </div>

            <Tabs defaultValue="detailed">
              <TabsList className="mb-4">
                <TabsTrigger value="detailed">Chi tiết thanh toán</TabsTrigger>
                <TabsTrigger value="summary">Tổng hợp theo người</TabsTrigger>
              </TabsList>

              <TabsContent value="detailed">
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Người trả</TableHead>
                        <TableHead>Người nhận</TableHead>
                        <TableHead>Mô tả chi phí</TableHead>
                        <TableHead>Ngày</TableHead>
                        <TableHead className="text-right">Số tiền</TableHead>
                        <TableHead className="text-center">Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                            Không có dữ liệu thanh toán cho thời gian đã chọn
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTransactions.map((transaction, index) => {
                          const transactionId = getTransactionId(
                            transaction.from,
                            transaction.to,
                            transaction.expenseId,
                          )
                          const isPaid = paymentStatuses[transactionId] || false

                          return (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{getRoommateName(transaction.from)}</TableCell>
                              <TableCell>{getRoommateName(transaction.to)}</TableCell>
                              <TableCell>{transaction.expenseDescription}</TableCell>
                              <TableCell>{format(new Date(transaction.date), "dd/MM/yyyy", { locale: vi })}</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(transaction.amount)}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center">
                                  <Checkbox
                                    checked={isPaid}
                                    onCheckedChange={(checked) => {
                                      updatePaymentStatus(
                                        transaction.from,
                                        transaction.to,
                                        transaction.amount,
                                        checked as boolean,
                                        transaction.expenseId,
                                      )
                                    }}
                                    disabled={isLoading}
                                  />
                                  <span className="ml-2 text-xs">{isPaid ? "Đã thanh toán" : "Chưa thanh toán"}</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="summary">
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tổng hợp theo người trả</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.keys(totalByPayer).length === 0 ? (
                          <p className="text-muted-foreground text-center py-2">Không có dữ liệu</p>
                        ) : (
                          Object.entries(totalByPayer).map(([roommate, total]) => (
                            <div key={roommate} className="flex justify-between items-center p-2 border-b">
                              <span>{getRoommateName(roommate)}</span>
                              <span className="font-medium">{formatCurrency(total)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tổng hợp theo người nhận</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.keys(totalByRecipient).length === 0 ? (
                          <p className="text-muted-foreground text-center py-2">Không có dữ liệu</p>
                        ) : (
                          Object.entries(totalByRecipient).map(([roommate, total]) => (
                            <div key={roommate} className="flex justify-between items-center p-2 border-b">
                              <span>{getRoommateName(roommate)}</span>
                              <span className="font-medium">{formatCurrency(total)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-4 p-4 bg-muted rounded-md">
                  <h3 className="font-semibold mb-2">Tổng quan thanh toán</h3>
                  <ul className="space-y-2">
                    <li className="flex justify-between">
                      <span>Tổng số giao dịch:</span>
                      <span className="font-medium">{filteredTransactions.length}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Đã thanh toán:</span>
                      <span className="font-medium">
                        {
                          filteredTransactions.filter((t) => {
                            const id = getTransactionId(t.from, t.to, t.expenseId)
                            return paymentStatuses[id]
                          }).length
                        }
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Chưa thanh toán:</span>
                      <span className="font-medium">
                        {
                          filteredTransactions.filter((t) => {
                            const id = getTransactionId(t.from, t.to, t.expenseId)
                            return !paymentStatuses[id]
                          }).length
                        }
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Tổng số tiền:</span>
                      <span className="font-medium">
                        {formatCurrency(filteredTransactions.reduce((sum, t) => sum + t.amount, 0))}
                      </span>
                    </li>
                  </ul>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

