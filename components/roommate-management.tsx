"use client"

import { useState } from "react"
import { Plus, Trash2, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Roommate } from "./expense-tracker"

interface RoommateManagementProps {
  roommates: Roommate[]
  rooms: string[]
  onAddRoommate: (name: string, room: string) => void
  onRemoveRoommate: (id: string) => void
  isAdmin: boolean // Thêm prop để kiểm tra quyền admin
}

export default function RoommateManagement({
  roommates,
  rooms,
  onAddRoommate,
  onRemoveRoommate,
  isAdmin,
}: RoommateManagementProps) {
  const [newRoommateName, setNewRoommateName] = useState("")
  const [newRoommateRoom, setNewRoommateRoom] = useState("")

  const handleAddRoommate = () => {
    if (newRoommateName.trim() === "" || newRoommateRoom === "") return
    onAddRoommate(newRoommateName, newRoommateRoom)
    setNewRoommateName("")
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Quản lý thành viên</CardTitle>
        {!isAdmin && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center text-amber-600 text-sm">
                  <ShieldAlert className="h-4 w-4 mr-1" />
                  Chỉ quản trị viên mới có thể thêm/xóa thành viên
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Bạn cần quyền quản trị viên để thêm hoặc xóa thành viên</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </CardHeader>
      <CardContent>
        {isAdmin && (
          <div className="grid gap-4 mb-6">
            <div className="grid gap-2">
              <Label htmlFor="roommateName">Tên</Label>
              <Input
                id="roommateName"
                placeholder="Tên thành viên"
                value={newRoommateName}
                onChange={(e) => setNewRoommateName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="roommateRoom">Phòng</Label>
              {rooms.length === 0 ? (
                <p className="text-sm text-muted-foreground">Thêm phòng trước</p>
              ) : (
                <select
                  id="roommateRoom"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newRoommateRoom}
                  onChange={(e) => setNewRoommateRoom(e.target.value)}
                >
                  <option value="">Chọn phòng</option>
                  {rooms.map((room) => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <Button
              onClick={handleAddRoommate}
              disabled={rooms.length === 0 || newRoommateName.trim() === "" || newRoommateRoom === ""}
            >
              <Plus className="mr-2 h-4 w-4" /> Thêm thành viên
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {roommates.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Chưa có thành viên nào.</p>
          ) : (
            roommates.map((roommate) => (
              <div key={roommate.id} className="flex items-center justify-between p-3 border rounded-md">
                <div>
                  <span className="font-medium">{roommate.name}</span>
                  <span className="text-sm text-muted-foreground ml-2">({roommate.room})</span>
                </div>
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => onRemoveRoommate(roommate.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
