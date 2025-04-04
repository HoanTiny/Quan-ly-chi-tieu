import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Roommate } from "./expense-tracker"
import { formatCurrency } from "@/lib/utils"

interface SummaryViewProps {
  totalExpenses: number
  balances: Record<string, number>
  roommates: Roommate[]
}

export default function SummaryView({ totalExpenses, balances, roommates }: SummaryViewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tổng kết chi tiêu</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center p-3 bg-muted rounded-md">
            <span className="font-medium">Tổng chi phí:</span>
            <span className="font-bold">{formatCurrency(totalExpenses)}</span>
          </div>

          <h3 className="font-semibold text-lg mt-4">Số dư cá nhân</h3>
          {roommates.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Thêm thành viên để xem số dư.</p>
          ) : (
            <div className="space-y-2">
              {roommates.map((roommate) => {
                const balance = balances[roommate.id] || 0
                return (
                  <div key={roommate.id} className="flex justify-between items-center p-3 border rounded-md">
                    <div>
                      <span className="font-medium">{roommate.name}</span>
                      <span className="text-sm text-muted-foreground ml-2">({roommate.room})</span>
                    </div>
                    <span
                      className={
                        balance > 0 ? "font-medium text-green-600" : balance < 0 ? "font-medium text-red-600" : ""
                      }
                    >
                      {balance > 0 ? "+" : ""}
                      {formatCurrency(balance)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <div className="pt-4 text-sm text-muted-foreground">
            <p>
              * Số dư dương nghĩa là người khác nợ bạn tiền.
              <br />* Số dư âm nghĩa là bạn nợ tiền người khác.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

