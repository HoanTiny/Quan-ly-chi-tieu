"use client"

import type React from "react"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Filter, ArrowRight, ArrowDown, ArrowUp, X } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatCurrency } from "@/lib/utils"
import type { Roommate, Expense } from "./expense-tracker"

interface SummaryViewProps {
  totalExpenses: number
  balances: Record<string, number>
  roommates: Roommate[]
  expenses: Expense[]
}

export default function SummaryView({ totalExpenses, balances, roommates, expenses }: SummaryViewProps) {
  const [selectedRoommate, setSelectedRoommate] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<"debts" | "credits" | null>(null)
  const [expandedExpenses, setExpandedExpenses] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState("balances")

  // Tính toán số dư dương (tín dụng) và số dư âm (nợ) cho mỗi thành viên
  const { positiveBalances, negativeBalances, totalPositive, totalNegative } = useMemo(() => {
    const positive: Record<string, number> = {}
    const negative: Record<string, number> = {}
    let totalPos = 0
    let totalNeg = 0

    Object.entries(balances).forEach(([id, balance]) => {
      if (balance > 0) {
        positive[id] = balance
        totalPos += balance
      } else if (balance < 0) {
        negative[id] = Math.abs(balance)
        totalNeg += Math.abs(balance)
      }
    })

    return {
      positiveBalances: positive,
      negativeBalances: negative,
      totalPositive: totalPos,
      totalNegative: totalNeg,
    }
  }, [balances])

  // Tạo danh sách chi tiết khoản nợ giữa các thành viên
  const detailedDebts = useMemo(() => {
    const result: {
      from: string
      to: string
      amount: number
      details: {
        description: string
        amount: number
        date: Date
        multiplier?: number
      }[]
    }[] = []

    // Nếu không có bộ lọc, trả về danh sách trống
    if (!selectedRoommate) return result

    // Lọc các chi phí liên quan đến thành viên đã chọn
    expenses.forEach((expense) => {
      const paidBy = expense.paidBy
      const sharedWith = expense.sharedWith
      const multipliers = expense.shareMultipliers || {}

      // Bỏ qua nếu không có ai chia sẻ
      if (sharedWith.length === 0) return

      // Tính tổng hệ số
      let totalMultiplier = 0
      sharedWith.forEach((roommateId) => {
        totalMultiplier += multipliers[roommateId] || 1
      })

      // Trường hợp 1: Thành viên đã chọn là người trả tiền (có người khác nợ họ)
      if (filterType === "credits" && paidBy === selectedRoommate) {
        sharedWith.forEach((roommateId) => {
          // Bỏ qua nếu người chia sẻ cũng là người trả tiền
          if (roommateId === paidBy) return

          const roommateMultiplier = multipliers[roommateId] || 1
          const amountForRoommate = Math.round((expense.amount * roommateMultiplier) / totalMultiplier)

          // Tìm khoản nợ hiện có hoặc tạo mới
          const debtIndex = result.findIndex((debt) => debt.from === roommateId && debt.to === paidBy)
          if (debtIndex === -1) {
            result.push({
              from: roommateId,
              to: paidBy,
              amount: amountForRoommate,
              details: [
                {
                  description: expense.description,
                  amount: amountForRoommate,
                  date: expense.date,
                  multiplier: roommateMultiplier > 1 ? roommateMultiplier : undefined,
                },
              ],
            })
          } else {
            result[debtIndex].amount += amountForRoommate
            result[debtIndex].details.push({
              description: expense.description,
              amount: amountForRoommate,
              date: expense.date,
              multiplier: roommateMultiplier > 1 ? roommateMultiplier : undefined,
            })
          }
        })
      }

      // Trường hợp 2: Thành viên đã chọn là người chia sẻ chi phí (họ nợ người khác)
      if (filterType === "debts" && sharedWith.includes(selectedRoommate) && paidBy !== selectedRoommate) {
        const roommateMultiplier = multipliers[selectedRoommate] || 1
        const amountForRoommate = Math.round((expense.amount * roommateMultiplier) / totalMultiplier)

        // Tìm khoản nợ hiện có hoặc tạo mới
        const debtIndex = result.findIndex((debt) => debt.from === selectedRoommate && debt.to === paidBy)
        if (debtIndex === -1) {
          result.push({
            from: selectedRoommate,
            to: paidBy,
            amount: amountForRoommate,
            details: [
              {
                description: expense.description,
                amount: amountForRoommate,
                date: expense.date,
                multiplier: roommateMultiplier > 1 ? roommateMultiplier : undefined,
              },
            ],
          })
        } else {
          result[debtIndex].amount += amountForRoommate
          result[debtIndex].details.push({
            description: expense.description,
            amount: amountForRoommate,
            date: expense.date,
            multiplier: roommateMultiplier > 1 ? roommateMultiplier : undefined,
          })
        }
      }
    })

    // Sắp xếp theo số tiền giảm dần
    return result.sort((a, b) => b.amount - a.amount)
  }, [selectedRoommate, filterType, expenses])

  // Xử lý mở rộng/thu gọn chi tiết chi phí
  const toggleExpenseDetails = (debtId: string) => {
    setExpandedExpenses((prev) => ({
      ...prev,
      [debtId]: !prev[debtId],
    }))
  }

  // Xóa bộ lọc
  const clearFilter = () => {
    setSelectedRoommate(null)
    setFilterType(null)
  }

  // Lấy tên thành viên theo ID
  const getRoommateName = (id: string) => {
    const roommate = roommates.find((r) => r.id === id)
    return roommate ? roommate.name : "Không xác định"
  }

  // Lấy phòng của thành viên theo ID
  const getRoommateRoom = (id: string) => {
    const roommate = roommates.find((r) => r.id === id)
    return roommate ? roommate.room : ""
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <CardTitle>Tổng kết chi tiêu</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-1">
            <span>Tổng chi tiêu: {formatCurrency(totalExpenses)}</span>
            {selectedRoommate && (
              <Badge variant="outline" className="ml-2 flex items-center gap-1 mt-1 sm:mt-0">
                <span className="truncate max-w-[150px]">
                  {getRoommateName(selectedRoommate)}
                  {filterType === "debts" ? " (Khoản nợ)" : " (Khoản được nợ)"}
                </span>
                <Button variant="ghost" size="sm" className="h-4 w-4 ml-1 p-0" onClick={clearFilter}>
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
          </CardDescription>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={!roommates.length} className="whitespace-nowrap">
              <Filter className="h-4 w-4 mr-2" /> Bộ lọc
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <div className="p-2">
              <div className="mb-2">
                <p className="text-sm font-medium mb-1">Lọc theo thành viên:</p>
                <select
                  className="w-full text-sm border rounded px-2 py-1"
                  value={selectedRoommate || ""}
                  onChange={(e) => {
                    setSelectedRoommate(e.target.value || null)
                    if (e.target.value && !filterType) {
                      setFilterType("debts")
                    }
                  }}
                >
                  <option value="">Chọn thành viên</option>
                  {roommates.map((roommate) => (
                    <option key={roommate.id} value={roommate.id}>
                      {roommate.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRoommate && (
                <div className="mb-2">
                  <p className="text-sm font-medium mb-1">Loại khoản:</p>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant={filterType === "debts" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setFilterType("debts")}
                    >
                      Khoản nợ
                    </Button>
                    <Button
                      size="sm"
                      variant={filterType === "credits" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setFilterType("credits")}
                    >
                      Khoản được nợ
                    </Button>
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={clearFilter}
                disabled={!selectedRoommate}
              >
                Xóa bộ lọc
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="balances">Số dư</TabsTrigger>
            <TabsTrigger value="details">Chi tiết</TabsTrigger>
          </TabsList>

          <TabsContent value="balances">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Số dư dương - Những người được nợ */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-green-600 flex items-center">
                    <ArrowDown className="h-4 w-4 mr-2" /> Được nợ
                  </CardTitle>
                  <CardDescription>Những người được nợ tiền</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {Object.keys(positiveBalances).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Không có khoản được nợ</p>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(positiveBalances)
                          .sort(([, a], [, b]) => b - a)
                          .map(([id, balance]) => (
                            <div
                              key={id}
                              className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer"
                              onClick={() => {
                                setSelectedRoommate(id)
                                setFilterType("credits")
                              }}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{getRoommateName(id)}</span>
                                <span className="text-xs text-muted-foreground">{getRoommateRoom(id)}</span>
                              </div>
                              <span className="font-semibold text-green-600">{formatCurrency(balance)}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </ScrollArea>
                  <div className="mt-4 pt-2 border-t flex justify-between items-center">
                    <span className="text-sm font-medium">Tổng cộng:</span>
                    <span className="font-bold text-green-600">{formatCurrency(totalPositive)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Số dư âm - Những người nợ */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-red-600 flex items-center">
                    <ArrowUp className="h-4 w-4 mr-2" /> Đang nợ
                  </CardTitle>
                  <CardDescription>Những người đang nợ tiền</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {Object.keys(negativeBalances).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Không có khoản nợ</p>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(negativeBalances)
                          .sort(([, a], [, b]) => b - a)
                          .map(([id, balance]) => (
                            <div
                              key={id}
                              className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer"
                              onClick={() => {
                                setSelectedRoommate(id)
                                setFilterType("debts")
                              }}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{getRoommateName(id)}</span>
                                <span className="text-xs text-muted-foreground">{getRoommateRoom(id)}</span>
                              </div>
                              <span className="font-semibold text-red-600">{formatCurrency(balance)}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </ScrollArea>
                  <div className="mt-4 pt-2 border-t flex justify-between items-center">
                    <span className="text-sm font-medium">Tổng cộng:</span>
                    <span className="font-bold text-red-600">{formatCurrency(totalNegative)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="details">
            {!selectedRoommate ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Chọn một thành viên để xem chi tiết khoản nợ</p>
                <Button
                  variant="outline"
                  onClick={() => document.querySelector<HTMLButtonElement>('[data-dropdown-trigger="true"]')?.click()}
                >
                  <Filter className="h-4 w-4 mr-2" /> Chọn thành viên
                </Button>
              </div>
            ) : detailedDebts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {filterType === "debts"
                    ? `${getRoommateName(selectedRoommate)} không nợ ai cả`
                    : `Không ai nợ ${getRoommateName(selectedRoommate)} cả`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted p-3 rounded-md">
                  <h3 className="font-medium mb-1">
                    {filterType === "debts"
                      ? `${getRoommateName(selectedRoommate)} đang nợ:`
                      : `Những người đang nợ ${getRoommateName(selectedRoommate)}:`}
                  </h3>
                </div>

                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {detailedDebts.map((debt, index) => {
                      const debtId = `${debt.from}-${debt.to}-${index}`
                      const isExpanded = expandedExpenses[debtId] || false

                      return (
                        <Card key={debtId} className="overflow-hidden">
                          <div
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleExpenseDetails(debtId)}
                          >
                            <div className="flex items-center">
                              <div className="mr-3">
                                {filterType === "debts" ? (
                                  <ArrowRight className="h-5 w-5 text-amber-500" />
                                ) : (
                                  <ArrowLeft className="h-5 w-5 text-green-500" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">
                                  {filterType === "debts" ? getRoommateName(debt.to) : getRoommateName(debt.from)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {filterType === "debts" ? getRoommateRoom(debt.to) : getRoommateRoom(debt.from)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatCurrency(debt.amount)}</p>
                              <p className="text-xs text-muted-foreground">{debt.details.length} khoản chi tiêu</p>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-4 pb-4 pt-2 border-t">
                              <p className="text-sm font-medium mb-2">Chi tiết các khoản:</p>
                              <div className="space-y-2">
                                {debt.details
                                  .sort((a, b) => b.amount - a.amount)
                                  .map((detail, detailIndex) => (
                                    <div
                                      key={detailIndex}
                                      className="flex justify-between items-center p-2 rounded-md bg-muted/50"
                                    >
                                      <div className="flex-1">
                                        <p className="font-medium">{detail.description}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {new Date(detail.date).toLocaleDateString("vi-VN")}
                                          {detail.multiplier && (
                                            <Badge variant="secondary" className="ml-2">
                                              x{detail.multiplier}
                                            </Badge>
                                          )}
                                        </p>
                                      </div>
                                      <p className="font-semibold">{formatCurrency(detail.amount)}</p>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

// Thêm component ArrowLeft
function ArrowLeft(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}
