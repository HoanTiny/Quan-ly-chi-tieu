"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import type { Roommate, Expense } from "./expense-tracker"

interface ExpenseFormProps {
  roommates: Roommate[]
  rooms: string[]
  onAddExpense: (expense: Omit<Expense, "id" | "date">) => void
}

export default function ExpenseForm({ roommates, rooms, onAddExpense }: ExpenseFormProps) {
  const [newExpense, setNewExpense] = useState<{
    description: string
    amount: string
    paidBy: string
    sharedWith: string[]
  }>({
    description: "",
    amount: "",
    paidBy: "",
    sharedWith: [],
  })

  const handleExpenseChange = (field: string, value: string | string[]) => {
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
    } else {
      currentSharedWith.splice(index, 1)
    }

    handleExpenseChange("sharedWith", currentSharedWith)
  }

  const handleAddExpense = () => {
    if (newExpense.description.trim() === "" || newExpense.amount.trim() === "" || newExpense.paidBy === "") {
      alert("Vui lòng điền đầy đủ thông tin.")
      return
    }

    onAddExpense({
      description: newExpense.description,
      amount: Number.parseFloat(newExpense.amount),
      paidBy: newExpense.paidBy,
      sharedWith: newExpense.sharedWith,
    })

    setNewExpense({
      description: "",
      amount: "",
      paidBy: "",
      sharedWith: [],
    })
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
            <Label>Chia sẻ với</Label>
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
                          <Label htmlFor={`shared-${roommate.id}`}>{roommate.name}</Label>
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

