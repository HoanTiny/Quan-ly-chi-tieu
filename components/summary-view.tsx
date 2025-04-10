"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Filter, FileSpreadsheet, Search, X, ArrowRight } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import type { Roommate, Expense } from "./expense-tracker"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"

interface SummaryViewProps {
  totalExpenses: number
  balances: Record<string, number>
  roommates: Roommate[]
  expenses: Expense[] // Thêm expenses để tính toán chi tiết
}

// Hàm làm tròn số tiền đến hàng nghìn
const roundToThousand = (amount: number): number => {
  return Math.ceil(amount / 1000) * 1000
}

export default function SummaryView({ totalExpenses, balances, roommates, expenses }: SummaryViewProps) {
  // State cho bộ lọc
  const [selectedRoommate, setSelectedRoommate] = useState<string | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: "", to: "" })
  const [searchTerm, setSearchTerm] = useState("")

  // Add new state for filtering by who owes whom
  const [filterDebtDirection, setFilterDebtDirection] = useState<"all" | "from" | "to">("all")
  const [filterDebtPerson, setFilterDebtPerson] = useState<string | null>(null)

  // Làm tròn số dư của mỗi người
  const roundedBalances: Record<string, number> = {}
  Object.keys(balances).forEach((key) => {
    roundedBalances[key] = roundToThousand(balances[key])
  })

  // Lấy danh sách các phòng duy nhất
  const uniqueRooms = Array.from(new Set(roommates.map((r) => r.room)))

  // Lọc chi tiêu theo các điều kiện
  const filteredExpenses = expenses.filter((expense) => {
    // Lọc theo từ khóa tìm kiếm
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const matchDescription = expense.description.toLowerCase().includes(searchLower)
      const matchPayer =
        roommates
          .find((r) => r.id === expense.paidBy)
          ?.name.toLowerCase()
          .includes(searchLower) || false
      const matchAmount = formatCurrency(expense.amount).toLowerCase().includes(searchLower)

      if (!matchDescription && !matchPayer && !matchAmount) return false
    }

    // Lọc theo thành viên
    if (selectedRoommate && expense.paidBy !== selectedRoommate && !expense.sharedWith.includes(selectedRoommate)) {
      return false
    }

    // Lọc theo phòng
    if (selectedRoom) {
      const payerRoom = roommates.find((r) => r.id === expense.paidBy)?.room
      const sharedWithRooms = expense.sharedWith.map((id) => roommates.find((r) => r.id === id)?.room)

      if (payerRoom !== selectedRoom && !sharedWithRooms.includes(selectedRoom)) {
        return false
      }
    }

    // Lọc theo khoảng thời gian
    if (dateRange.from && new Date(expense.date) < new Date(dateRange.from)) return false
    if (dateRange.to) {
      const toDate = new Date(dateRange.to)
      toDate.setHours(23, 59, 59, 999) // Đặt thời gian là cuối ngày
      if (new Date(expense.date) > toDate) return false
    }

    return true
  })

  // Tính tổng số dư dương và âm dựa trên chi tiêu đã lọc
  const filteredBalances: Record<string, number> = {}
  roommates.forEach((roommate) => {
    filteredBalances[roommate.id] = 0
  })

  // Tính toán số dư dựa trên chi tiêu đã lọc
  filteredExpenses.forEach((expense) => {
    const payer = expense.paidBy
    const sharedWith =
      expense.sharedWith.length > 0
        ? expense.sharedWith
        : roommates.filter((r) => r.room === roommates.find((rm) => rm.id === payer)?.room).map((r) => r.id)

    if (sharedWith.length === 0) return

    const amountPerPerson = expense.amount / sharedWith.length

    // Cộng toàn bộ số tiền vào người chi trả
    filteredBalances[payer] += expense.amount

    // Trừ phần chia sẻ từ mỗi người
    sharedWith.forEach((roommateId) => {
      filteredBalances[roommateId] -= amountPerPerson
    })
  })

  // Làm tròn số dư đã lọc
  Object.keys(filteredBalances).forEach((key) => {
    filteredBalances[key] = roundToThousand(filteredBalances[key])
  })

  const totalPositive = roommates
    .filter((r) => filteredBalances[r.id] > 0)
    .reduce((sum, r) => sum + filteredBalances[r.id], 0)

  const totalNegative = roommates
    .filter((r) => filteredBalances[r.id] < 0)
    .reduce((sum, r) => sum + Math.abs(filteredBalances[r.id]), 0)

  // Tạo danh sách chi tiết ai nợ ai cho từng chi tiêu
  const detailedDebts: { from: Roommate; to: Roommate; amount: number; expenseDescription: string }[] = []

  // Tính toán chi tiết nợ cho từng chi tiêu đã lọc
  filteredExpenses.forEach((expense) => {
    const payer = roommates.find((r) => r.id === expense.paidBy)
    if (!payer) return

    // Lấy danh sách người chia sẻ chi phí
    const sharedWith =
      expense.sharedWith.length > 0
        ? expense.sharedWith
        : roommates.filter((r) => r.room === payer.room).map((r) => r.id)

    if (sharedWith.length === 0) return

    // Tính số tiền mỗi người phải trả
    const amountPerPerson = roundToThousand(expense.amount / sharedWith.length)

    // Tạo các khoản nợ chi tiết
    sharedWith.forEach((roommateId) => {
      // Bỏ qua nếu người chia sẻ cũng là người trả tiền
      if (roommateId === payer.id) return

      const debtor = roommates.find((r) => r.id === roommateId)
      if (!debtor) return

      detailedDebts.push({
        from: debtor,
        to: payer,
        amount: amountPerPerson,
        expenseDescription: expense.description,
      })
    })
  })

  // Nhóm các khoản nợ theo cặp người nợ - người được nợ
  const groupedDebts: Record<string, { from: Roommate; to: Roommate; amount: number; expenses: string[] }> = {}

  detailedDebts.forEach((debt) => {
    const key = `${debt.from.id}-${debt.to.id}`

    if (!groupedDebts[key]) {
      groupedDebts[key] = {
        from: debt.from,
        to: debt.to,
        amount: 0,
        expenses: [],
      }
    }

    groupedDebts[key].amount += debt.amount
    if (!groupedDebts[key].expenses.includes(debt.expenseDescription)) {
      groupedDebts[key].expenses.push(debt.expenseDescription)
    }
  })

  // Tính tổng chi tiêu đã lọc
  const filteredTotalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)

  // Đặt lại tất cả bộ lọc
  const resetFilters = () => {
    setSearchTerm("")
    setSelectedRoommate(null)
    setSelectedRoom(null)
    setDateRange({ from: "", to: "" })
  }

  // Kiểm tra xem có bộ lọc nào đang được áp dụng không
  const hasActiveFilters = searchTerm || selectedRoommate || selectedRoom || dateRange.from || dateRange.to

  // Xuất dữ liệu ra file CSV
  const exportToCSV = () => {
    if (Object.values(groupedDebts).length === 0) return

    // Tạo nội dung CSV
    let csvContent = "Người nợ,Phòng,Người được nợ,Phòng,Số tiền,Chi tiêu liên quan\n"

    Object.values(groupedDebts).forEach((debt) => {
      const fromName = debt.from.name
      const fromRoom = debt.from.room
      const toName = debt.to.name
      const toRoom = debt.to.room
      const amount = formatCurrency(debt.amount)
      const expensesList = debt.expenses.join("; ")

      csvContent += `"${fromName}","${fromRoom}","${toName}","${toRoom}","${amount}","${expensesList}"\n`
    })

    // Tạo blob với BOM (Byte Order Mark) để đảm bảo Excel hiển thị đúng ký tự Unicode
    const BOM = "\uFEFF"
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    const fileName = `tong-ket-chi-tieu${dateRange.from ? `-tu-${dateRange.from}` : ""}${dateRange.to ? `-den-${dateRange.to}` : ""}.csv`
    link.setAttribute("download", fileName)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Add filter controls to the CardHeader
  // Update filtering in the GroupedDebts section
  const filteredGroupedDebts = Object.values(groupedDebts).filter((debt) => {
    if (filterDebtDirection === "all") return true
    if (!filterDebtPerson) return true

    if (filterDebtDirection === "from") {
      return debt.from.id === filterDebtPerson
    } else if (filterDebtDirection === "to") {
      return debt.to.id === filterDebtPerson
    }

    return true
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Tổng kết chi tiêu</CardTitle>
          <CardDescription>Tổng hợp số dư và các khoản thanh toán cần thực hiện</CardDescription>
        </div>
        <div className="flex space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" /> Bộ lọc
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1">
                    !
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
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

              <DropdownMenuSeparator />

              <div className="p-2">
                <p className="text-sm font-medium mb-1">Từ ngày:</p>
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                  className="w-full text-sm"
                />
              </div>

              <div className="p-2">
                <p className="text-sm font-medium mb-1">Đến ngày:</p>
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                  className="w-full text-sm"
                />
              </div>

              {/* Add filter for who owes whom */}
              <div className="p-2 border-t">
                <p className="text-sm font-medium mb-1">Lọc theo khoản nợ:</p>
                <div className="flex flex-col gap-2">
                  <select
                    className="w-full text-sm border rounded px-2 py-1"
                    value={filterDebtDirection}
                    onChange={(e) => setFilterDebtDirection(e.target.value as "all" | "from" | "to")}
                  >
                    <option value="all">Tất cả khoản nợ</option>
                    <option value="from">Người nợ</option>
                    <option value="to">Người được nợ</option>
                  </select>

                  {filterDebtDirection !== "all" && (
                    <select
                      className="w-full text-sm border rounded px-2 py-1"
                      value={filterDebtPerson || ""}
                      onChange={(e) => setFilterDebtPerson(e.target.value || null)}
                    >
                      <option value="">Chọn người</option>
                      {roommates.map((roommate) => (
                        <option key={roommate.id} value={roommate.id}>
                          {roommate.name} ({roommate.room})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {(hasActiveFilters || filterDebtDirection !== "all" || filterDebtPerson) && (
                <div className="p-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      resetFilters()
                      setFilterDebtDirection("all")
                      setFilterDebtPerson(null)
                    }}
                  >
                    Xóa bộ lọc
                  </Button>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={Object.values(groupedDebts).length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Xuất CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Thanh tìm kiếm */}
          <div className="relative w-full md:w-64 mb-4">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm chi tiêu..."
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

          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedRoommate && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Thành viên: {roommates.find((r) => r.id === selectedRoommate)?.name}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => setSelectedRoommate(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {selectedRoom && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Phòng: {selectedRoom}
                  <Button variant="ghost" size="sm" className="h-4 w-4 p-0 ml-1" onClick={() => setSelectedRoom(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {dateRange.from && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Từ: {format(new Date(dateRange.from), "dd/MM/yyyy")}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => setDateRange({ ...dateRange, from: "" })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {dateRange.to && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Đến: {format(new Date(dateRange.to), "dd/MM/yyyy")}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => setDateRange({ ...dateRange, to: "" })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={resetFilters} className="ml-auto">
                Xóa tất cả bộ lọc
              </Button>
            </div>
          )}

          <div className="flex justify-between items-center p-3 bg-muted rounded-md">
            <span className="font-medium">Tổng chi phí{hasActiveFilters ? " (đã lọc)" : ""}:</span>
            <span className="font-bold">{formatCurrency(roundToThousand(filteredTotalExpenses))}</span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">Số dư dương (được nợ)</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="space-y-2">
                  {roommates
                    .filter((r) => filteredBalances[r.id] > 0)
                    .sort((a, b) => filteredBalances[b.id] - filteredBalances[a.id])
                    .map((roommate) => (
                      <div key={roommate.id} className="flex justify-between items-center p-2 border-b">
                        <div>
                          <span className="font-medium">{roommate.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">({roommate.room})</span>
                        </div>
                        <span className="font-medium text-green-600">
                          +{formatCurrency(filteredBalances[roommate.id])}
                        </span>
                      </div>
                    ))}
                  {roommates.filter((r) => filteredBalances[r.id] > 0).length === 0 && (
                    <div className="text-center py-2 text-muted-foreground">Không có số dư dương</div>
                  )}
                  <div className="flex justify-between items-center p-2 border-t border-t-2">
                    <span className="font-bold">Tổng cộng</span>
                    <span className="font-bold text-green-600">+{formatCurrency(totalPositive)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">Số dư âm (nợ người khác)</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="space-y-2">
                  {roommates
                    .filter((r) => filteredBalances[r.id] < 0)
                    .sort((a, b) => filteredBalances[a.id] - filteredBalances[b.id])
                    .map((roommate) => (
                      <div key={roommate.id} className="flex justify-between items-center p-2 border-b">
                        <div>
                          <span className="font-medium">{roommate.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">({roommate.room})</span>
                        </div>
                        <span className="font-medium text-red-600">
                          {formatCurrency(filteredBalances[roommate.id])}
                        </span>
                      </div>
                    ))}
                  {roommates.filter((r) => filteredBalances[r.id] < 0).length === 0 && (
                    <div className="text-center py-2 text-muted-foreground">Không có số dư âm</div>
                  )}
                  <div className="flex justify-between items-center p-2 border-t border-t-2">
                    <span className="font-bold">Tổng cộng</span>
                    <span className="font-bold text-red-600">-{formatCurrency(totalNegative)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chi tiết thanh toán theo từng cặp người dùng */}
          <Card className="mt-6">
            <CardHeader className="py-3">
              <CardTitle className="text-base">Chi tiết thanh toán (Ai nợ ai)</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              {filteredGroupedDebts.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {hasActiveFilters || filterDebtDirection !== "all" || filterDebtPerson
                    ? "Không có khoản nợ nào phù hợp với bộ lọc."
                    : "Không có khoản nợ nào cần thanh toán."}
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredGroupedDebts.map((debt, index) => (
                    <Card key={index} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="p-3 bg-muted flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div className="flex items-center">
                            <div>
                              <span className="font-medium">{debt.from.name}</span>
                              <span className="text-xs text-muted-foreground ml-1">({debt.from.room})</span>
                            </div>
                            <ArrowRight className="h-4 w-4 mx-2" />
                            <div>
                              <span className="font-medium">{debt.to.name}</span>
                              <span className="text-xs text-muted-foreground ml-1">({debt.to.room})</span>
                            </div>
                          </div>
                          <span className="font-bold text-red-600">{formatCurrency(debt.amount)}</span>
                        </div>
                        <div className="p-3 text-sm">
                          <p className="font-medium mb-1">Chi tiêu liên quan:</p>
                          <ul className="list-disc list-inside pl-2 text-muted-foreground">
                            {debt.expenses.map((desc, i) => (
                              <li key={i}>{desc}</li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="pt-4 text-sm text-muted-foreground">
            <p>
              * Số dư dương nghĩa là người khác nợ bạn tiền.
              <br />* Số dư âm nghĩa là bạn nợ tiền người khác.
              <br />* Tất cả số tiền đã được làm tròn lên đến hàng nghìn.
              {hasActiveFilters && (
                <>
                  <br />* Kết quả đang được lọc theo các điều kiện bạn đã chọn.
                </>
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
