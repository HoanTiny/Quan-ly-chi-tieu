"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface RoomManagementProps {
  rooms: string[]
  onAddRoom: (roomName: string) => void
  onRemoveRoom: (roomName: string) => void
}

export default function RoomManagement({ rooms, onAddRoom, onRemoveRoom }: RoomManagementProps) {
  const [newRoomName, setNewRoomName] = useState("")

  const handleAddRoom = () => {
    if (newRoomName.trim() === "") return
    onAddRoom(newRoomName)
    setNewRoomName("")
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Quản lý phòng</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-6">
          <Input
            placeholder="Tên phòng"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddRoom()}
          />
          <Button onClick={handleAddRoom}>
            <Plus className="mr-2 h-4 w-4" /> Thêm phòng
          </Button>
        </div>

        <div className="space-y-4">
          {rooms.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Chưa có phòng nào. Hãy thêm phòng đầu tiên của bạn ở trên.
            </p>
          ) : (
            rooms.map((room) => (
              <div key={room} className="flex items-center justify-between p-3 border rounded-md">
                <span>{room}</span>
                <Button variant="ghost" size="icon" onClick={() => onRemoveRoom(room)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

