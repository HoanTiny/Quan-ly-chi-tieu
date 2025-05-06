"use client"

import { useState } from "react"
import { Trash2, AlertCircle, Filter, Search, X, Undo2 } from "lucide-react"
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

interface ExpenseListProps {
  expenses: Expense[]
  roommates: Roommate[]
  onRemoveExpense: (id: string) => void
  currentUserId: string
  isAdmin: boolean
}

export default function ExpenseList({
  expenses,
  roommates,
  onRemoveExpense,
  currentUserId,
  isAdmin,
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

  const { toast } = useToast()

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
  const toggleSettled = (id: string) => {
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

    toast({
      title: newValue ? "Đã đánh dấu thanh toán" : "Đã bỏ đánh dấu thanh toán",
      description: newValue
        ? "Chi tiêu đã được đánh dấu là đã thanh toán"
        : "Chi tiêu đã được đánh dấu là chưa thanh toán",
    })
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
  const filteredExpenses = expenses.filter((expense) => {
    // Lọc theo trạng thái thanh toán
    if (hideSettled && settledExpenses[expense.id]) return false

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
  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
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
          {sortedExpenses.map((expense) => (
            <Card key={expense.id} className={settledExpenses[expense.id] ? "bg-gray-50 border-gray-200" : ""}>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row justify-between items-start">
                  <div className="w-full sm:w-auto">
                    <div className="flex items-center justify-between sm:justify-start">
                      <h4 className="font-medium">{expense.description}</h4>
                      <div className="flex items-center ml-auto sm:ml-2">
                        <div className="flex items-center">
                          <Checkbox
                            id={`settled-${expense.id}`}
                            checked={settledExpenses[expense.id] || false}
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
                        <p className="text-sm text-muted-foreground ml-2">Không có ai được chọn (mặc định cho phòng)</p>
                      ) : (
                        <ul className="list-disc list-inside text-sm pl-2">
                          {expense.sharedWith.map((id) => (
                            <li key={id}>
                              {getRoommateName(id)}
                              {expense.shareMultipliers &&
                                expense.shareMultipliers[id] &&
                                expense.shareMultipliers[id] > 1 && (
                                  <span className="text-sm text-muted-foreground ml-1">
                                    (x{expense.shareMultipliers[id]})
                                  </span>
                                )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
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
                      <Trash2 className={`h-4 w-4 ${canDeleteExpense(expense) ? "text-destructive" : "text-muted"}`} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
