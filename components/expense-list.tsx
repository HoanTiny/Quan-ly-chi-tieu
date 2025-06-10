"use client"

import { useState, useEffect, useMemo } from "react"
import { Trash2, AlertCircle, Filter, Search, X, Undo2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import type { Roommate, Expense } from "./expense-tracker"
import { formatCurrency } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"

interface ExpenseListProps {
  expenses: Expense[]
  roommates: Roommate[]
  onRemoveExpense: (id: string) => void
  currentUserId: string
  isAdmin: boolean
  onUpdateExpenseStatus?: (id: string, isPaid: boolean) => void
  householdId: string
}

export default function ExpenseList({
  expenses,
  roommates,
  onRemoveExpense,
  currentUserId,
  isAdmin,
  onUpdateExpenseStatus,
  householdId,
}: ExpenseListProps) {
  // State cho bộ lọc và tìm kiếm
  const [hideSettled, setHideSettled] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRoommate, setSelectedRoommate] = useState<string | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null })
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "amount-high" | "amount-low">("newest")

  // State cho trạng thái thanh toán và lịch sử
  const [settledExpenses, setSettledExpenses] = useState<Record<string, boolean>>({})
  const [settledHistory, setSettledHistory] = useState<Record<string, boolean>>({})
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [expenseToSettle, setExpenseToSettle] = useState<string | null>(null)
  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, Record<string, boolean>>>({})
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([])

  const { toast } = useToast()
  const supabase = createClient()

  // Tạo ID duy nhất cho mỗi giao dịch
  const getTransactionId = (from: string, to: string, expenseId?: string) => {
    return expenseId ? `${from}-${to}-${expenseId}` : `${from}-${to}`
  }

  // Khởi tạo trạng thái thanh toán từ expenses và database
  useEffect(() => {
    const loadPaymentStatuses = async () => {
      if (!householdId) return

      try {
        // Tải trạng thái thanh toán từ database
        const { data, error } = await supabase.from("payment_statuses").select("*").eq("household_id", householdId)

        if (!error && data) {
          const expenseStatuses: Record<string, boolean> = {}
          const userStatuses: Record<string, Record<string, boolean>> = {}

          data.forEach((item) => {
            // Lưu trạng thái thanh toán của expense
            if (item.expense_id) {
              expenseStatuses[item.expense_id] = item.is_paid || false
            }

            // Lưu trạng thái thanh toán của từng user
            if (item.expense_id && item.from_id) {
              if (!userStatuses[item.expense_id]) {
                userStatuses[item.expense_id] = {}
              }
              userStatuses[item.expense_id][item.from_id] = item.is_paid || false
            }
          })

          setSettledExpenses(expenseStatuses)
          setPaymentStatuses(userStatuses)
        }
      } catch (error) {
        console.error("Lỗi khi tải trạng thái thanh toán:", error)
      }
    }

    loadPaymentStatuses()
  }, [householdId, supabase])

  // Kiểm tra xem expense có được thanh toán hoàn toàn không
  const isExpenseFullyPaid = useMemo(() => {
    const fullyPaidExpenses: Record<string, boolean> = {}

    expenses.forEach((expense) => {
      const paidBy = expense.paidBy
      const sharedWith = expense.sharedWith

      if (sharedWith.length === 0) {
        fullyPaidExpenses[expense.id] = false
        return
      }

      // Kiểm tra xem tất cả người chia sẻ đã thanh toán chưa
      const allPaid = sharedWith.every((roommateId) => {
        if (roommateId === paidBy) return true // Người trả tiền không cần thanh toán cho chính mình

        const transactionId = getTransactionId(roommateId, paidBy, expense.id)
        return paymentStatuses[expense.id]?.[roommateId] || false
      })

      fullyPaidExpenses[expense.id] = allPaid
    })

    return fullyPaidExpenses
  }, [expenses, paymentStatuses])

  // Cập nhật lại danh sách khi expenses hoặc bộ lọc thay đổi
  useEffect(() => {
    filterExpenses()
  }, [expenses, hideSettled, searchTerm, selectedRoommate, selectedRoom, dateRange, sortOrder, isExpenseFullyPaid])

  // Lấy tên thành viên theo ID
  const getRoommateName = (id: string) => {
    const roommate = roommates.find((r) => r.id === id)
    return roommate ? `${roommate.name} (${roommate.room})` : "Không xác định"
  }

  // Lấy phòng của thành viên theo ID
  const getRoommateRoom = (id: string) => {
    const roommate = roommates.find((r) => r.id === id)
    return roommate ? roommate.room : ""
  }

  // Kiểm tra xem người dùng có quyền xóa chi tiêu không
  const canDeleteExpense = (expense: Expense) => {
    // Nếu không có thông tin người tạo, cho phép admin xóa
    if (!expense.created_by) return isAdmin
    // Nếu có thông tin người tạo, cho phép người tạo hoặc admin xóa
    return isAdmin || expense.created_by === currentUserId
  }

  // Đánh dấu chi tiêu đã thanh toán
  const toggleSettled = async (id: string) => {
    // Kiểm tra xem tất cả người dùng đã thanh toán chưa
    const allUsersPaid = checkAllUsersPaid(id)

    if (!settledExpenses[id] && !allUsersPaid) {
      // Nếu chưa thanh toán và không phải tất cả người dùng đã thanh toán
      setExpenseToSettle(id)
      setShowConfirmDialog(true)
      return
    }

    await completeToggleSettled(id)
  }

  // Hoàn tất việc đánh dấu thanh toán
  const completeToggleSettled = async (id: string) => {
    const newValue = !settledExpenses[id]

    // Lưu trạng thái cũ vào lịch sử
    setSettledHistory((prev) => ({
      ...prev,
      [id]: settledExpenses[id] || false,
    }))

    setSettledExpenses((prev) => ({
      ...prev,
      [id]: newValue,
    }))

    // Cập nhật trạng thái thanh toán lên database
    try {
      const expense = expenses.find((e) => e.id === id)
      if (expense) {
        // Kiểm tra xem bản ghi đã tồn tại chưa
        const { data: existingData, error: checkError } = await supabase
          .from("payment_statuses")
          .select("*")
          .eq("expense_id", id)
          .maybeSingle()

        if (!checkError) {
          if (existingData) {
            // Cập nhật bản ghi hiện có
            await supabase.from("payment_statuses").update({ is_paid: newValue }).eq("id", existingData.id)
          } else {
            // Tạo bản ghi mới
            await supabase.from("payment_statuses").insert([
              {
                expense_id: id,
                is_paid: newValue,
                household_id: householdId,
              },
            ])
          }
        }

        // Nếu đánh dấu là đã thanh toán, cập nhật tất cả người dùng là đã thanh toán
        if (newValue) {
          const updatedStatuses = { ...paymentStatuses }
          if (!updatedStatuses[id]) {
            updatedStatuses[id] = {}
          }

          // Đánh dấu tất cả người dùng là đã thanh toán
          expense.sharedWith.forEach((userId) => {
            updatedStatuses[id][userId] = true

            // Cập nhật database cho từng người dùng
            updateUserPaymentStatus(id, userId, true)
          })

          setPaymentStatuses(updatedStatuses)
        }
      }

      // Cập nhật trạng thái thanh toán lên server nếu có callback
      if (onUpdateExpenseStatus) {
        onUpdateExpenseStatus(id, newValue)
      }

      toast({
        title: newValue ? "Đã đánh dấu thanh toán" : "Đã bỏ đánh dấu thanh toán",
        description: newValue
          ? "Chi tiêu đã được đánh dấu là đã thanh toán"
          : "Chi tiêu đã được đánh dấu là chưa thanh toán",
      })
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái thanh toán:", error)
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật trạng thái thanh toán",
        variant: "destructive",
      })
    }

    setShowConfirmDialog(false)
    setExpenseToSettle(null)
  }

  // Kiểm tra xem tất cả người dùng đã thanh toán chưa
  const checkAllUsersPaid = (expenseId: string) => {
    const expense = expenses.find((e) => e.id === expenseId)
    if (!expense) return false

    const statuses = paymentStatuses[expenseId] || {}
    return expense.sharedWith.every((userId) => {
      if (userId === expense.paidBy) return true // Người trả tiền không cần thanh toán cho chính mình
      return statuses[userId] || false
    })
  }

  // Đánh dấu người dùng đã thanh toán
  const toggleUserPaid = async (expenseId: string, userId: string) => {
    const currentStatus = paymentStatuses[expenseId]?.[userId] || false
    const newStatus = !currentStatus

    // Cập nhật state
    setPaymentStatuses((prev) => {
      const expenseStatuses = prev[expenseId] || {}
      const newExpenseStatuses = {
        ...expenseStatuses,
        [userId]: newStatus,
      }

      return {
        ...prev,
        [expenseId]: newExpenseStatuses,
      }
    })

    // Cập nhật database
    await updateUserPaymentStatus(expenseId, userId, newStatus)

    // Kiểm tra xem tất cả người dùng đã thanh toán chưa
    setTimeout(() => {
      const allPaid = checkAllUsersPaid(expenseId)
      if (allPaid && !settledExpenses[expenseId]) {
        // Nếu tất cả đã thanh toán, đánh dấu expense là đã thanh toán
        completeToggleSettled(expenseId)
      }
    }, 100)
  }

  // Cập nhật trạng thái thanh toán của người dùng lên database
  const updateUserPaymentStatus = async (expenseId: string, userId: string, isPaid: boolean) => {
    try {
      const expense = expenses.find((e) => e.id === expenseId)
      if (!expense) return

      // Kiểm tra xem bản ghi đã tồn tại chưa
      const { data: existingData, error: checkError } = await supabase
        .from("payment_statuses")
        .select("*")
        .eq("expense_id", expenseId)
        .eq("from_id", userId)
        .maybeSingle()

      if (!checkError) {
        if (existingData) {
          // Cập nhật bản ghi hiện có
          await supabase.from("payment_statuses").update({ is_paid: isPaid }).eq("id", existingData.id)
        } else {
          // Tạo bản ghi mới
          await supabase.from("payment_statuses").insert([
            {
              expense_id: expenseId,
              from_id: userId,
              to_id: expense.paidBy,
              is_paid: isPaid,
              household_id: householdId,
            },
          ])
        }
      }
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái thanh toán của người dùng:", error)
    }
  }

  // Hoàn tác trạng thái thanh toán
  const undoSettled = (id: string) => {
    // Khôi phục trạng thái từ lịch sử
    setSettledExpenses((prev) => ({
      ...prev,
      [id]: settledHistory[id] || false,
    }))

    toast({
      title: "Đã hoàn tác",
      description: "Trạng thái thanh toán đã được khôi phục",
    })
  }

  // Lấy danh sách các phòng duy nhất
  const uniqueRooms = Array.from(new Set(roommates.map((r) => r.room)))

  // Lọc chi tiêu theo các điều kiện
  const filterExpenses = () => {
    const filtered = expenses.filter((expense) => {
      // Lọc theo trạng thái thanh toán - ẩn những chi tiêu đã thanh toán hoàn toàn
      if (hideSettled && isExpenseFullyPaid[expense.id]) return false

      // Lọc theo từ khóa tìm kiếm
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchDescription = expense.description.toLowerCase().includes(searchLower)
        const matchPayer = getRoommateName(expense.paidBy).toLowerCase().includes(searchLower)
        const matchAmount = formatCurrency(expense.amount).toLowerCase().includes(searchLower)

        if (!matchDescription && !matchPayer && !matchAmount) return false
      }

      // Lọc theo thành viên
      if (selectedRoommate && expense.paidBy !== selectedRoommate && !expense.sharedWith.includes(selectedRoommate)) {
        return false
      }

      // Lọc theo phòng
      if (selectedRoom) {
        const payerRoom = getRoommateRoom(expense.paidBy)
        const sharedWithRooms = expense.sharedWith.map((id) => getRoommateRoom(id))

        if (payerRoom !== selectedRoom && !sharedWithRooms.includes(selectedRoom)) {
          return false
        }
      }

      // Lọc theo khoảng thời gian
      if (dateRange.from && new Date(expense.date) < dateRange.from) return false
      if (dateRange.to) {
        const toDate = new Date(dateRange.to)
        toDate.setHours(23, 59, 59, 999) // Đặt thời gian là cuối ngày
        if (new Date(expense.date) > toDate) return false
      }

      return true
    })

    // Sắp xếp chi tiêu
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOrder) {
        case "newest":
          return new Date(b.date).getTime() - new Date(a.date).getTime()
        case "oldest":
          return new Date(a.date).getTime() - new Date(b.date).getTime()
        case "amount-high":
          return b.amount - a.amount
        case "amount-low":
          return a.amount - b.amount
        default:
          return 0
      }
    })

    setFilteredExpenses(sorted)
  }

  // Đặt lại tất cả bộ lọc
  const resetFilters = () => {
    setSearchTerm("")
    setSelectedRoommate(null)
    setSelectedRoom(null)
    setDateRange({ from: null, to: null })
    setSortOrder("newest")
  }

  // Kiểm tra xem có bộ lọc nào đang được áp dụng không
  const hasActiveFilters =
    searchTerm || selectedRoommate || selectedRoom || dateRange.from || dateRange.to || sortOrder !== "newest"

  return (
    <div className="mt-8">
      <CardHeader className="px-0 pt-0 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <CardTitle className="text-xl">Lịch sử chi tiêu</CardTitle>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {/* Thanh tìm kiếm */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Bộ lọc */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="whitespace-nowrap">
                <Filter className="h-4 w-4 mr-2" /> Bộ lọc
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1">
                    !
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuItem onClick={() => setHideSettled(!hideSettled)}>
                <Checkbox checked={hideSettled} className="mr-2" />
                <span>Ẩn chi tiêu đã thanh toán</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <div className="p-2">
                <p className="text-sm font-medium mb-1">Thành viên:</p>
                <select
                  className="w-full text-sm border rounded px-2 py-1"
                  value={selectedRoommate || ""}
                  onChange={(e) => setSelectedRoommate(e.target.value || null)}
                >
                  <option value="">Tất cả</option>
                  {roommates.map((roommate) => (
                    <option key={roommate.id} value={roommate.id}>
                      {roommate.name} ({roommate.room})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-2">
                <p className="text-sm font-medium mb-1">Phòng:</p>
                <select
                  className="w-full text-sm border rounded px-2 py-1"
                  value={selectedRoom || ""}
                  onChange={(e) => setSelectedRoom(e.target.value || null)}
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
                <p className="text-sm font-medium mb-1">Sắp xếp theo:</p>
                <select
                  className="w-full text-sm border rounded px-2 py-1"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                >
                  <option value="newest">Mới nhất</option>
                  <option value="oldest">Cũ nhất</option>
                  <option value="amount-high">Số tiền (cao → thấp)</option>
                  <option value="amount-low">Số tiền (thấp → cao)</option>
                </select>
              </div>

              {hasActiveFilters && (
                <div className="p-2">
                  <Button variant="outline" size="sm" className="w-full" onClick={resetFilters}>
                    Xóa bộ lọc
                  </Button>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      {expenses.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">Chưa có chi phí nào.</p>
      ) : filteredExpenses.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">Không tìm thấy chi phí nào phù hợp với bộ lọc.</p>
      ) : (
        <div className="space-y-4">
          {filteredExpenses.map((expense) => {
            const isFullyPaid = isExpenseFullyPaid[expense.id]
            return (
              <Card key={expense.id} className={isFullyPaid ? "bg-gray-50 border-gray-200" : ""}>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start">
                    <div className="w-full sm:w-auto">
                      <div className="flex items-center justify-between sm:justify-start">
                        <h4 className="font-medium">{expense.description}</h4>
                        <div className="flex items-center ml-auto sm:ml-2">
                          <div className="flex items-center">
                            <Checkbox
                              id={`settled-${expense.id}`}
                              checked={isFullyPaid}
                              onCheckedChange={() => toggleSettled(expense.id)}
                              className="mr-2"
                            />
                            <label htmlFor={`settled-${expense.id}`} className="text-xs text-muted-foreground">
                              Đã thanh toán
                            </label>
                          </div>

                          {/* Nút hoàn tác */}
                          {settledExpenses[expense.id] !== settledHistory[expense.id] && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 ml-1"
                                    onClick={() => undoSettled(expense.id)}
                                  >
                                    <Undo2 className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Hoàn tác trạng thái thanh toán</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{format(expense.date, "PPP", { locale: vi })}</p>
                      <p className="mt-1">
                        <span className="font-medium">Số tiền:</span> {formatCurrency(expense.amount)}
                      </p>
                      <p>
                        <span className="font-medium">Người chi trả:</span> {getRoommateName(expense.paidBy)}
                      </p>
                      <div className="mt-1">
                        <span className="font-medium">Chia sẻ với:</span>
                        {expense.sharedWith.length === 0 ? (
                          <p className="text-sm text-muted-foreground ml-2">
                            Không có ai được chọn (mặc định cho phòng)
                          </p>
                        ) : (
                          <ul className="list-disc list-inside text-sm pl-2">
                            {expense.sharedWith.map((id) => (
                              <li key={id} className="flex items-center gap-2">
                                <span>
                                  {getRoommateName(id)}
                                  {expense.shareMultipliers &&
                                    expense.shareMultipliers[id] &&
                                    expense.shareMultipliers[id] > 1 && (
                                      <span className="text-sm text-muted-foreground ml-1">
                                        (x{expense.shareMultipliers[id]})
                                      </span>
                                    )}
                                </span>
                                {id !== expense.paidBy && (
                                  <>
                                    <Checkbox
                                      id={`user-paid-${expense.id}-${id}`}
                                      checked={paymentStatuses[expense.id]?.[id] || false}
                                      onCheckedChange={() => toggleUserPaid(expense.id, id)}
                                      className="ml-auto h-3 w-3"
                                    />
                                    <label
                                      htmlFor={`user-paid-${expense.id}-${id}`}
                                      className="text-xs text-muted-foreground"
                                    >
                                      Đã trả
                                    </label>
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Hiển thị trạng thái thanh toán */}
                      {checkAllUsersPaid(expense.id) && !isFullyPaid && (
                        <div className="mt-2 flex items-center text-green-600 text-sm">
                          <Check className="h-4 w-4 mr-1" />
                          <span>Tất cả đã thanh toán</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center mt-4 sm:mt-0">
                      {!canDeleteExpense(expense) && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="mr-2 text-amber-600">
                                <AlertCircle className="h-4 w-4" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Chỉ người tạo chi tiêu hoặc quản trị viên mới có thể xóa</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveExpense(expense.id)}
                        disabled={!canDeleteExpense(expense)}
                      >
                        <Trash2
                          className={`h-4 w-4 ${canDeleteExpense(expense) ? "text-destructive" : "text-muted"}`}
                        />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog xác nhận đánh dấu thanh toán */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận đánh dấu thanh toán</DialogTitle>
            <DialogDescription>
              Chưa phải tất cả người dùng đã thanh toán khoản này. Bạn có chắc chắn muốn đánh dấu là đã thanh toán?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Hủy
            </Button>
            <Button onClick={() => expenseToSettle && completeToggleSettled(expenseToSettle)}>Xác nhận</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
