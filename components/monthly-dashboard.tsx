"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Filter, ChevronDown, ChevronUp, BarChart, PieChart } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Roommate, Expense } from "./expense-tracker"
import { formatCurrency } from "@/lib/utils"

interface MonthlyDashboardProps {
  expenses: Expense[]
  roommates: Roommate[]
}

export default function MonthlyDashboard({ expenses, roommates }: MonthlyDashboardProps) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState<"overview" | "byRoom" | "byPerson">("overview")

  // Lấy danh sách các năm có trong dữ liệu
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    expenses.forEach((expense) => {
      const date = new Date(expense.date)
      years.add(date.getFullYear())
    })
    return Array.from(years).sort((a, b) => b - a) // Sắp xếp giảm dần
  }, [expenses])

  // Lấy danh sách các phòng
  const rooms = useMemo(() => {
    const uniqueRooms = new Set<string>()
    roommates.forEach((roommate) => {
      uniqueRooms.add(roommate.room)
    })
    return Array.from(uniqueRooms).sort()
  }, [roommates])

  // Lọc chi tiêu theo năm và tháng
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const date = new Date(expense.date)
      const year = date.getFullYear()
      const month = date.getMonth()

      if (year !== selectedYear) return false
      if (selectedMonth !== null && month !== selectedMonth) return false
      if (selectedRoom !== null) {
        const payer = roommates.find((r) => r.id === expense.paidBy)
        if (!payer || payer.room !== selectedRoom) return false
      }

      return true
    })
  }, [expenses, selectedYear, selectedMonth, selectedRoom, roommates])

  // Tính tổng chi tiêu theo tháng
  const expensesByMonth = useMemo(() => {
    const months: Record<number, number> = {}
    // Khởi tạo tất cả các tháng với giá trị 0
    for (let i = 0; i < 12; i++) {
      months[i] = 0
    }

    expenses.forEach((expense) => {
      const date = new Date(expense.date)
      const year = date.getFullYear()
      const month = date.getMonth()

      if (year === selectedYear) {
        if (selectedRoom === null) {
          months[month] += expense.amount
        } else {
          const payer = roommates.find((r) => r.id === expense.paidBy)
          if (payer && payer.room === selectedRoom) {
            months[month] += expense.amount
          }
        }
      }
    })

    return months
  }, [expenses, selectedYear, selectedRoom, roommates])

  // Tính tổng chi tiêu theo phòng
  const expensesByRoom = useMemo(() => {
    const roomExpenses: Record<string, number> = {}
    rooms.forEach((room) => {
      roomExpenses[room] = 0
    })

    filteredExpenses.forEach((expense) => {
      const payer = roommates.find((r) => r.id === expense.paidBy)
      if (payer) {
        roomExpenses[payer.room] = (roomExpenses[payer.room] || 0) + expense.amount
      }
    })

    return roomExpenses
  }, [filteredExpenses, roommates, rooms])

  // Tính tổng chi tiêu theo người
  const expensesByPerson = useMemo(() => {
    const personExpenses: Record<string, number> = {}
    roommates.forEach((roommate) => {
      personExpenses[roommate.id] = 0
    })

    filteredExpenses.forEach((expense) => {
      personExpenses[expense.paidBy] = (personExpenses[expense.paidBy] || 0) + expense.amount
    })

    return personExpenses
  }, [filteredExpenses, roommates])

  // Tính tổng chi tiêu
  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  }, [filteredExpenses])

  // Xử lý mở rộng/thu gọn tháng
  const toggleMonth = (month: number) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [month]: !prev[month],
    }))
  }

  // Mở rộng tất cả các tháng
  const expandAllMonths = () => {
    const expanded: Record<string, boolean> = {}
    for (let i = 0; i < 12; i++) {
      expanded[i] = true
    }
    setExpandedMonths(expanded)
  }

  // Thu gọn tất cả các tháng
  const collapseAllMonths = () => {
    setExpandedMonths({})
  }

  // Lấy tên tháng
  const getMonthName = (month: number) => {
    const months = [
      "Tháng 1",
      "Tháng 2",
      "Tháng 3",
      "Tháng 4",
      "Tháng 5",
      "Tháng 6",
      "Tháng 7",
      "Tháng 8",
      "Tháng 9",
      "Tháng 10",
      "Tháng 11",
      "Tháng 12",
    ]
    return months[month]
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

  // Tính phần trăm chi tiêu theo tháng
  const getMonthPercentage = (month: number) => {
    const totalYearExpenses = Object.values(expensesByMonth).reduce((sum, amount) => sum + amount, 0)
    if (totalYearExpenses === 0) return 0
    return (expensesByMonth[month] / totalYearExpenses) * 100
  }

  // Tính phần trăm chi tiêu theo phòng
  const getRoomPercentage = (room: string) => {
    const totalRoomExpenses = Object.values(expensesByRoom).reduce((sum, amount) => sum + amount, 0)
    if (totalRoomExpenses === 0) return 0
    return (expensesByRoom[room] / totalRoomExpenses) * 100
  }

  // Tính phần trăm chi tiêu theo người
  const getPersonPercentage = (personId: string) => {
    const totalPersonExpenses = Object.values(expensesByPerson).reduce((sum, amount) => sum + amount, 0)
    if (totalPersonExpenses === 0) return 0
    return (expensesByPerson[personId] / totalPersonExpenses) * 100
  }

  // Tính màu sắc dựa trên phần trăm
  const getColorByPercentage = (percentage: number) => {
    if (percentage >= 50) return "bg-red-500"
    if (percentage >= 30) return "bg-orange-500"
    if (percentage >= 20) return "bg-yellow-500"
    if (percentage >= 10) return "bg-green-500"
    return "bg-blue-500"
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <CardTitle>Báo cáo chi tiêu theo tháng</CardTitle>
          <CardDescription>
            Phân tích chi tiêu theo tháng, thành viên và danh mục
            {selectedRoom && (
              <Badge variant="outline" className="ml-2">
                Phòng: {selectedRoom}
              </Badge>
            )}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" /> Bộ lọc
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <div className="p-2">
                <div className="mb-2">
                  <p className="text-sm font-medium mb-1">Năm:</p>
                  <select
                    className="w-full text-sm border rounded px-2 py-1"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-2">
                  <p className="text-sm font-medium mb-1">Tháng:</p>
                  <select
                    className="w-full text-sm border rounded px-2 py-1"
                    value={selectedMonth === null ? "" : selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value === "" ? null : Number(e.target.value))}
                  >
                    <option value="">Tất cả</option>
                    {Array.from({ length: 12 }, (_, i) => i).map((month) => (
                      <option key={month} value={month}>
                        {getMonthName(month)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-2">
                  <p className="text-sm font-medium mb-1">Phòng:</p>
                  <select
                    className="w-full text-sm border rounded px-2 py-1"
                    value={selectedRoom || ""}
                    onChange={(e) => setSelectedRoom(e.target.value || null)}
                  >
                    <option value="">Tất cả</option>
                    {rooms.map((room) => (
                      <option key={room} value={room}>
                        {room}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => {
                    setSelectedMonth(null)
                    setSelectedRoom(null)
                  }}
                >
                  Xóa bộ lọc
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={expandAllMonths}>
              <ChevronDown className="h-4 w-4 mr-1" /> Mở tất cả
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAllMonths}>
              <ChevronUp className="h-4 w-4 mr-1" /> Thu gọn tất cả
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="byRoom">Theo phòng</TabsTrigger>
            <TabsTrigger value="byPerson">Theo người</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Tổng chi tiêu</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
                    <p className="text-sm text-muted-foreground">
                      {selectedMonth !== null
                        ? `${getMonthName(selectedMonth)} ${selectedYear}`
                        : `Năm ${selectedYear}`}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Tháng chi tiêu cao nhất</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.entries(expensesByMonth).length > 0 ? (
                      <>
                        <div className="text-2xl font-bold">
                          {getMonthName(
                            Number(Object.entries(expensesByMonth).sort(([, a], [, b]) => b - a)[0]?.[0] || 0),
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(Object.entries(expensesByMonth).sort(([, a], [, b]) => b - a)[0]?.[1] || 0)}
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Không có dữ liệu</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Số lượng chi tiêu</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{filteredExpenses.length}</div>
                    <p className="text-sm text-muted-foreground">khoản chi tiêu</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center">
                    <BarChart className="h-4 w-4 mr-2" /> Chi tiêu theo tháng
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(expensesByMonth)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([month, amount]) => {
                        const monthNumber = Number(month)
                        const percentage = getMonthPercentage(monthNumber)
                        const isExpanded = expandedMonths[monthNumber] || false
                        const monthExpenses = filteredExpenses.filter(
                          (expense) => new Date(expense.date).getMonth() === monthNumber,
                        )

                        if (amount === 0) return null

                        return (
                          <div key={month} className="border rounded-md overflow-hidden">
                            <div
                              className="p-3 flex justify-between items-center cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleMonth(monthNumber)}
                            >
                              <div className="flex items-center">
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 mr-2" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 mr-2" />
                                )}
                                <span className="font-medium">{getMonthName(monthNumber)}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold">{formatCurrency(amount)}</span>
                                <span className="text-xs text-muted-foreground ml-2">({percentage.toFixed(1)}%)</span>
                              </div>
                            </div>

                            <div className="h-2 w-full bg-gray-100">
                              <div
                                className={`h-full ${getColorByPercentage(percentage)}`}
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>

                            {isExpanded && monthExpenses.length > 0 && (
                              <div className="p-3 border-t">
                                <ScrollArea className="h-[200px]">
                                  <div className="space-y-2">
                                    {monthExpenses
                                      .sort((a, b) => b.amount - a.amount)
                                      .map((expense) => (
                                        <div
                                          key={expense.id}
                                          className="flex justify-between items-center p-2 rounded-md bg-muted/50"
                                        >
                                          <div>
                                            <p className="font-medium">{expense.description}</p>
                                            <p className="text-xs text-muted-foreground">
                                              {getRoommateName(expense.paidBy)} ({getRoommateRoom(expense.paidBy)})
                                            </p>
                                          </div>
                                          <span className="font-medium">{formatCurrency(expense.amount)}</span>
                                        </div>
                                      ))}
                                  </div>
                                </ScrollArea>
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="byRoom">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center">
                  <PieChart className="h-4 w-4 mr-2" /> Chi tiêu theo phòng
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(expensesByRoom)
                    .sort(([, a], [, b]) => b - a)
                    .map(([room, amount]) => {
                      const percentage = getRoomPercentage(room)
                      if (amount === 0) return null

                      return (
                        <div key={room} className="border rounded-md overflow-hidden">
                          <div className="p-3 flex justify-between items-center">
                            <span className="font-medium">{room}</span>
                            <div className="text-right">
                              <span className="font-bold">{formatCurrency(amount)}</span>
                              <span className="text-xs text-muted-foreground ml-2">({percentage.toFixed(1)}%)</span>
                            </div>
                          </div>

                          <div className="h-2 w-full bg-gray-100">
                            <div
                              className={`h-full ${getColorByPercentage(percentage)}`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="byPerson">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center">
                  <PieChart className="h-4 w-4 mr-2" /> Chi tiêu theo người
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(expensesByPerson)
                    .sort(([, a], [, b]) => b - a)
                    .map(([personId, amount]) => {
                      const percentage = getPersonPercentage(personId)
                      if (amount === 0) return null

                      return (
                        <div key={personId} className="border rounded-md overflow-hidden">
                          <div className="p-3 flex justify-between items-center">
                            <div>
                              <span className="font-medium">{getRoommateName(personId)}</span>
                              <span className="text-xs text-muted-foreground ml-2">({getRoommateRoom(personId)})</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold">{formatCurrency(amount)}</span>
                              <span className="text-xs text-muted-foreground ml-2">({percentage.toFixed(1)}%)</span>
                            </div>
                          </div>

                          <div className="h-2 w-full bg-gray-100">
                            <div
                              className={`h-full ${getColorByPercentage(percentage)}`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
