"use client"

import { useState } from "react"
import { Plus, Calendar, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import type { Roommate, Expense, ExpenseShare } from "./expense-tracker"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ExpenseFormProps {
  roommates: Roommate[]
  rooms: string[]
  onAddExpense: (expense: Omit<Expense, "id">, expenseShares: ExpenseShare[]) => void
}

export default function ExpenseForm({ roommates, rooms, onAddExpense }: ExpenseFormProps) {
  const [newExpense, setNewExpense] = useState<{
    description: string
    amount: string
    paidBy: string
    sharedWith: string[]
    date: Date
  }>({
    description: "",
    amount: "",
    paidBy: "",
    sharedWith: [],
    date: new Date(),
  })

  // State cho chế độ chia không đều
  const [unequalSharing, setUnequalSharing] = useState(false)

  // State cho hệ số chia sẻ của mỗi thành viên
  const [shareMultipliers, setShareMultipliers] = useState<Record<string, number>>({})

  const handleExpenseChange = (field: string, value: string | string[] | Date) => {
    setNewExpense({
      ...newExpense,
      [field]: value,
    })
  }

  const toggleSharedWith = (roommateId: string) => {
    const currentSharedWith = [...newExpense.sharedWith]
    const index = currentSharedWith.indexOf(roommateId)

    if (index === -1) {
      currentSharedWith.push(roommateId)
      // Khởi tạo hệ số là 1 khi thêm vào danh sách
      setShareMultipliers((prev) => ({ ...prev, [roommateId]: 1 }))
    } else {
      currentSharedWith.splice(index, 1)
      // Xóa hệ số khi bỏ khỏi danh sách
      const newMultipliers = { ...shareMultipliers }
      delete newMultipliers[roommateId]
      setShareMultipliers(newMultipliers)
    }

    handleExpenseChange("sharedWith", currentSharedWith)
  }

  // Hàm cập nhật hệ số chia sẻ
  const updateShareMultiplier = (roommateId: string, action: "increase" | "decrease") => {
    setShareMultipliers((prev) => {
      const currentMultiplier = prev[roommateId] || 1
      const newMultiplier =
        action === "increase"
          ? Math.min(currentMultiplier + 1, 10) // Giới hạn tối đa là 10
          : Math.max(currentMultiplier - 1, 1) // Giới hạn tối thiểu là 1

      return { ...prev, [roommateId]: newMultiplier }
    })
  }

  // Tính toán tổng số phần chia (sum of parts)
  const calculateTotalParts = () => {
    let totalParts = 0
    newExpense.sharedWith.forEach((roommateId) => {
      totalParts += shareMultipliers[roommateId] || 1
    })
    return totalParts || 1 // Tránh chia cho 0
  }

  // Tính toán số tiền cho mỗi người theo hệ số
  const calculateAmountForRoommate = (roommateId: string) => {
    if (!newExpense.amount || isNaN(Number.parseFloat(newExpense.amount))) return 0

    const totalAmount = Number.parseFloat(newExpense.amount)
    const totalParts = calculateTotalParts()
    const roommateParts = shareMultipliers[roommateId] || 1

    return (totalAmount * roommateParts) / totalParts
  }

  const handleAddExpense = () => {
    if (newExpense.description.trim() === "" || newExpense.amount.trim() === "" || newExpense.paidBy === "") {
      alert("Vui lòng điền đầy đủ thông tin.")
      return
    }

    // Tạo danh sách chia sẻ với hệ số
    let sharedWith = [...newExpense.sharedWith]

    // Nếu không chọn ai, mặc định chia cho cả phòng
    if (sharedWith.length === 0) {
      const payer = roommates.find((r) => r.id === newExpense.paidBy)
      if (payer) {
        sharedWith = roommates.filter((r) => r.room === payer.room).map((r) => r.id)

        // Khởi tạo hệ số 1 cho tất cả
        const defaultMultipliers: Record<string, number> = {}
        sharedWith.forEach((id) => {
          defaultMultipliers[id] = 1
        })

        if (!unequalSharing) {
          // Nếu không chia không đều, reset tất cả về 1
          setShareMultipliers(defaultMultipliers)
        }
      }
    }

    // Tạo danh sách ExpenseShare với hệ số
    const expenseShares: ExpenseShare[] = sharedWith.map((roommateId) => ({
      roommate_id: roommateId,
      multiplier: unequalSharing ? shareMultipliers[roommateId] || 1 : 1,
    }))

    onAddExpense(
      {
        description: newExpense.description,
        amount: Number.parseFloat(newExpense.amount),
        paidBy: newExpense.paidBy,
        sharedWith: sharedWith,
        date: newExpense.date,
      },
      expenseShares,
    )

    // Reset form
    setNewExpense({
      description: "",
      amount: "",
      paidBy: "",
      sharedWith: [],
      date: new Date(),
    })
    setUnequalSharing(false)
    setShareMultipliers({})
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thêm chi phí</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="description">Mô tả</Label>
            <Input
              id="description"
              placeholder="Đã mua gì?"
              value={newExpense.description}
              onChange={(e) => handleExpenseChange("description", e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">Số tiền (VNĐ)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0"
              value={newExpense.amount}
              onChange={(e) => handleExpenseChange("amount", e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="date">Ngày chi tiêu</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {format(newExpense.date, "dd/MM/yyyy", { locale: vi })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={newExpense.date}
                  onSelect={(date) => handleExpenseChange("date", date || new Date())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="paidBy">Người chi trả</Label>
            {roommates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Thêm thành viên trước</p>
            ) : (
              <select
                id="paidBy"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={newExpense.paidBy}
                onChange={(e) => handleExpenseChange("paidBy", e.target.value)}
              >
                <option value="">Chọn thành viên</option>
                {roommates.map((roommate) => (
                  <option key={roommate.id} value={roommate.id}>
                    {roommate.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Chia sẻ với</Label>
              <div className="flex items-center space-x-2">
                <Switch id="unequal-sharing" checked={unequalSharing} onCheckedChange={setUnequalSharing} />
                <Label htmlFor="unequal-sharing" className="text-sm">
                  Chia không đều
                </Label>
              </div>
            </div>

            <div className="grid gap-4">
              {roommates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Thêm thành viên trước</p>
              ) : (
                rooms.map((room) => {
                  const roommatesInRoom = roommates.filter((r) => r.room === room)
                  if (roommatesInRoom.length === 0) return null

                  return (
                    <div key={room} className="space-y-2">
                      <h4 className="text-sm font-medium">{room}</h4>
                      {roommatesInRoom.map((roommate) => (
                        <div key={roommate.id} className="flex items-center space-x-2 ml-2">
                          <Checkbox
                            id={`shared-${roommate.id}`}
                            checked={newExpense.sharedWith.includes(roommate.id)}
                            onCheckedChange={() => toggleSharedWith(roommate.id)}
                          />
                          <Label htmlFor={`shared-${roommate.id}`} className="flex-grow">
                            {roommate.name}
                          </Label>

                          {unequalSharing && newExpense.sharedWith.includes(roommate.id) && (
                            <div className="flex items-center space-x-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-6 w-6 rounded-full"
                                onClick={() => updateShareMultiplier(roommate.id, "decrease")}
                                disabled={(shareMultipliers[roommate.id] || 1) <= 1}
                              >
                                <Minus className="h-3 w-3" />
                                <span className="sr-only">Giảm</span>
                              </Button>

                              <Badge
                                variant="outline"
                                className={cn(
                                  "h-6 min-w-[2rem] flex justify-center",
                                  (shareMultipliers[roommate.id] || 1) > 1 && "bg-primary text-primary-foreground",
                                )}
                              >
                                x{shareMultipliers[roommate.id] || 1}
                              </Badge>

                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-6 w-6 rounded-full"
                                onClick={() => updateShareMultiplier(roommate.id, "increase")}
                                disabled={(shareMultipliers[roommate.id] || 1) >= 10}
                              >
                                <Plus className="h-3 w-3" />
                                <span className="sr-only">Tăng</span>
                              </Button>

                              {newExpense.amount && !isNaN(Number.parseFloat(newExpense.amount)) && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  ≈{" "}
                                  {new Intl.NumberFormat("vi-VN", {
                                    style: "currency",
                                    currency: "VND",
                                    maximumFractionDigits: 0,
                                  }).format(calculateAmountForRoommate(roommate.id))}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })
              )}
              <p className="text-xs text-muted-foreground">
                * Nếu không chọn thành viên nào, chi phí sẽ được chia đều cho tất cả thành viên trong cùng phòng với
                người chi trả.
              </p>
              {unequalSharing && (
                <p className="text-xs text-muted-foreground">
                  * Chế độ chia không đều: Số tiền được chia theo tỷ lệ của hệ số. Ví dụ: nếu có hai người với hệ số là
                  x1 và x2, người thứ nhất sẽ trả 1/3 tổng chi phí và người thứ hai sẽ trả 2/3.
                </p>
              )}
            </div>
          </div>

          <Button onClick={handleAddExpense} disabled={roommates.length === 0}>
            <Plus className="mr-2 h-4 w-4" /> Thêm chi phí
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
