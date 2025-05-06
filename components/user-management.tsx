"use client"

import { useState, useEffect } from "react"
import { ShieldAlert, Trash2, UserPlus, Mail, Copy, Search, X, Filter, Link2, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface UserManagementProps {
  householdId: string
  currentUserId: string
  isAdmin: boolean
  roommates: Array<{
    id: string
    name: string
    room: string
    household_id: string
  }>
}

interface User {
  id: string
  email: string
  role: "admin" | "member"
  created_at: string
  household_id: string
  household_name: string
  linked_roommate_id?: string
  linked_roommate_name?: string
}

export default function UserManagement({ householdId, currentUserId, isAdmin, roommates }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([])
  const [allHouseholds, setAllHouseholds] = useState<{ id: string; name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState("")
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [userToRemove, setUserToRemove] = useState<User | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedHousehold, setSelectedHousehold] = useState<string>("all")
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [userToLink, setUserToLink] = useState<User | null>(null)
  const [selectedRoommateId, setSelectedRoommateId] = useState<string>("")
  const [isLinking, setIsLinking] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

  // Tải danh sách hộ gia đình
  useEffect(() => {
    const fetchHouseholds = async () => {
      try {
        // Lấy danh sách household_id mà người dùng là thành viên
        const { data: membershipData, error: membershipError } = await supabase
          .from("household_members")
          .select("household_id")
          .eq("user_id", currentUserId)

        if (membershipError) {
          console.error("Error fetching memberships:", membershipError)
          return
        }

        if (!membershipData || membershipData.length === 0) {
          return
        }

        // Lấy thông tin chi tiết của các hộ gia đình
        const householdIds = membershipData.map((item) => item.household_id)
        const { data: householdData, error: householdError } = await supabase
          .from("households")
          .select("id, name")
          .in("id", householdIds)
          .order("name", { ascending: true })

        if (householdError) {
          console.error("Error fetching households:", householdError)
          return
        }

        if (householdData) {
          setAllHouseholds(householdData)
        }
      } catch (error) {
        console.error("Unexpected error:", error)
      }
    }

    fetchHouseholds()
  }, [currentUserId, supabase])

  // Tải danh sách người dùng
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true)

      try {
        // Lấy danh sách tất cả các hộ gia đình mà người dùng hiện tại là thành viên
        const { data: membershipData, error: membershipError } = await supabase
          .from("household_members")
          .select("household_id")
          .eq("user_id", currentUserId)

        if (membershipError) {
          console.error("Error fetching memberships:", membershipError)
          toast({
            title: "Lỗi",
            description: "Không thể tải danh sách thành viên. Vui lòng thử lại sau.",
            variant: "destructive",
          })
          setIsLoading(false)
          return
        }

        if (!membershipData || membershipData.length === 0) {
          setUsers([])
          setIsLoading(false)
          return
        }

        const householdIds = membershipData.map((item) => item.household_id)

        // Lấy thông tin chi tiết của các hộ gia đình
        const { data: householdData, error: householdError } = await supabase
          .from("households")
          .select("id, name")
          .in("id", householdIds)

        if (householdError) {
          console.error("Error fetching households:", householdError)
          setIsLoading(false)
          return
        }

        const householdsMap = new Map(householdData?.map((h) => [h.id, h.name]) || [])

        // Lấy danh sách thành viên trong tất cả các hộ gia đình
        const query = supabase
          .from("household_members")
          .select("user_id, role, created_at, household_id, linked_roommate_id")
          .in("household_id", householdIds)

        const { data: membersData, error: membersError } = await query

        if (membersError) {
          console.error("Error fetching household members:", membersError)
          setIsLoading(false)
          return
        }

        // Tạo danh sách người dùng với thông tin từ các nguồn khác nhau
        const usersList: User[] = []
        for (const member of membersData || []) {
          let email = ""

          // Nếu là người dùng hiện tại, lấy email từ session
          if (member.user_id === currentUserId) {
            const {
              data: { user },
            } = await supabase.auth.getUser()
            if (user) {
              email = user.email || ""
            }
          }

          // Thử lấy email từ hàm get_user_email
          if (!email) {
            try {
              const { data: userData, error: userError } = await supabase.rpc("get_user_email", {
                user_id: member.user_id,
              })
              if (!userError && userData) {
                email = userData
              }
            } catch (error) {
              console.log("Cannot fetch user email, using default")
              email = `user_${member.user_id.substring(0, 8)}`
            }
          }

          // Tìm tên của roommate được liên kết (nếu có)
          let linkedRoommateName = undefined
          if (member.linked_roommate_id) {
            const linkedRoommate = roommates.find((r) => r.id === member.linked_roommate_id)
            if (linkedRoommate) {
              linkedRoommateName = linkedRoommate.name
            }
          }

          usersList.push({
            id: member.user_id,
            email: email,
            role: member.role as "admin" | "member",
            created_at: member.created_at,
            household_id: member.household_id,
            household_name: householdsMap.get(member.household_id) || "Không xác định",
            linked_roommate_id: member.linked_roommate_id,
            linked_roommate_name: linkedRoommateName,
          })
        }

        setUsers(usersList)
      } catch (error) {
        console.error("Unexpected error:", error)
        toast({
          title: "Lỗi",
          description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsers()
  }, [householdId, supabase, toast, currentUserId, roommates])

  // Thay đổi vai trò người dùng
  const toggleUserRole = async (userId: string, currentRole: "admin" | "member", householdId: string) => {
    if (!isAdmin) {
      toast({
        title: "Không có quyền",
        description: "Chỉ quản trị viên mới có thể thay đổi vai trò người dùng.",
        variant: "destructive",
      })
      return
    }

    // Không cho phép thay đổi vai trò của chính mình
    if (userId === currentUserId) {
      toast({
        title: "Không được phép",
        description: "Bạn không thể thay đổi vai trò của chính mình.",
        variant: "destructive",
      })
      return
    }

    try {
      const newRole = currentRole === "admin" ? "member" : "admin"

      const { error } = await supabase
        .from("household_members")
        .update({ role: newRole })
        .eq("household_id", householdId)
        .eq("user_id", userId)

      if (error) {
        console.error("Error updating user role:", error)
        toast({
          title: "Lỗi",
          description: "Không thể cập nhật vai trò người dùng. Vui lòng thử lại sau.",
          variant: "destructive",
        })
        return
      }

      // Cập nhật state
      setUsers(
        users.map((user) => {
          if (user.id === userId && user.household_id === householdId) {
            return { ...user, role: newRole }
          }
          return user
        }),
      )

      toast({
        title: "Thành công",
        description: `Đã thay đổi vai trò người dùng thành ${newRole === "admin" ? "quản trị viên" : "thành viên"}.`,
      })
    } catch (error) {
      console.error("Unexpected error:", error)
      toast({
        title: "Lỗi",
        description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
        variant: "destructive",
      })
    }
  }

  // Xóa người dùng khỏi hộ gia đình
  const removeUser = async (user: User) => {
    if (!isAdmin) {
      toast({
        title: "Không có quyền",
        description: "Chỉ quản trị viên mới có thể xóa người dùng.",
        variant: "destructive",
      })
      return
    }

    // Không cho phép xóa chính mình
    if (user.id === currentUserId) {
      toast({
        title: "Không được phép",
        description: "Bạn không thể xóa chính mình khỏi hộ gia đình.",
        variant: "destructive",
      })
      return
    }

    setUserToRemove(user)
    setShowConfirmDialog(true)
  }

  // Xác nhận xóa người dùng
  const confirmRemoveUser = async () => {
    if (!userToRemove) return

    try {
      const { error } = await supabase
        .from("household_members")
        .delete()
        .eq("household_id", userToRemove.household_id)
        .eq("user_id", userToRemove.id)

      if (error) {
        console.error("Error removing user:", error)
        toast({
          title: "Lỗi",
          description: "Không thể xóa người dùng. Vui lòng thử lại sau.",
          variant: "destructive",
        })
        return
      }

      // Cập nhật state
      setUsers(
        users.filter((user) => !(user.id === userToRemove.id && user.household_id === userToRemove.household_id)),
      )

      toast({
        title: "Thành công",
        description: "Đã xóa người dùng khỏi hộ gia đình.",
      })

      setShowConfirmDialog(false)
      setUserToRemove(null)
    } catch (error) {
      console.error("Unexpected error:", error)
      toast({
        title: "Lỗi",
        description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
        variant: "destructive",
      })
    }
  }

  // Mời người dùng tham gia hộ gia đình
  const inviteUser = async () => {
    if (!isAdmin) {
      toast({
        title: "Không có quyền",
        description: "Chỉ quản trị viên mới có thể mời người dùng.",
        variant: "destructive",
      })
      return
    }

    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập địa chỉ email hợp lệ.",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)

    try {
      // Lấy mã mời của hộ gia đình
      const { data: householdData, error: householdError } = await supabase
        .from("households")
        .select("invite_code")
        .eq("id", householdId)
        .single()

      if (householdError || !householdData) {
        console.error("Error fetching household invite code:", householdError)
        toast({
          title: "Lỗi",
          description: "Không thể lấy mã mời. Vui lòng thử lại sau.",
          variant: "destructive",
        })
        setIsSending(false)
        return
      }

      // Gửi email mời (giả lập - chỉ hiển thị thông báo)
      // Trong thực tế, bạn sẽ cần một API endpoint để gửi email

      // Hiển thị thông báo thành công
      toast({
        title: "Đã gửi lời mời",
        description: `Mã mời: ${householdData.invite_code} đã được gửi đến ${inviteEmail}`,
      })

      setInviteEmail("")
      setShowInviteDialog(false)
    } catch (error) {
      console.error("Unexpected error:", error)
      toast({
        title: "Lỗi",
        description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  // Sao chép mã mời
  const copyInviteCode = async () => {
    try {
      // Lấy mã mời của hộ gia đình
      const { data, error } = await supabase.from("households").select("invite_code").eq("id", householdId).single()

      if (error || !data) {
        console.error("Error fetching invite code:", error)
        toast({
          title: "Lỗi",
          description: "Không thể lấy mã mời. Vui lòng thử lại sau.",
          variant: "destructive",
        })
        return
      }

      // Sao chép vào clipboard
      await navigator.clipboard.writeText(data.invite_code)
      toast({
        title: "Đã sao chép",
        description: "Mã mời đã được sao chép vào clipboard",
      })
    } catch (error) {
      console.error("Error copying invite code:", error)
      toast({
        title: "Lỗi",
        description: "Không thể sao chép mã mời. Vui lòng thử lại sau.",
        variant: "destructive",
      })
    }
  }

  // Mở dialog liên kết người dùng với thành viên
  const openLinkDialog = (user: User) => {
    setUserToLink(user)
    setSelectedRoommateId(user.linked_roommate_id || "")
    setShowLinkDialog(true)
  }

  // Liên kết người dùng với thành viên
  const linkUserToRoommate = async () => {
    if (!userToLink) return

    setIsLinking(true)

    try {
      // Cập nhật liên kết trong cơ sở dữ liệu
      // Sửa lỗi: Nếu selectedRoommateId là "none", đặt giá trị là null
      const linkedRoommateId = selectedRoommateId === "none" ? null : selectedRoommateId || null

      const { error } = await supabase
        .from("household_members")
        .update({ linked_roommate_id: linkedRoommateId })
        .eq("household_id", userToLink.household_id)
        .eq("user_id", userToLink.id)

      if (error) {
        console.error("Error linking user to roommate:", error)
        toast({
          title: "Lỗi",
          description: "Không thể liên kết người dùng với thành viên. Vui lòng thử lại sau.",
          variant: "destructive",
        })
        return
      }

      // Tìm tên của roommate được liên kết (nếu có)
      let linkedRoommateName = undefined
      if (selectedRoommateId && selectedRoommateId !== "none") {
        const linkedRoommate = roommates.find((r) => r.id === selectedRoommateId)
        if (linkedRoommate) {
          linkedRoommateName = linkedRoommate.name
        }
      }

      // Cập nhật state
      setUsers(
        users.map((user) => {
          if (user.id === userToLink.id && user.household_id === userToLink.household_id) {
            return {
              ...user,
              linked_roommate_id: selectedRoommateId === "none" ? undefined : selectedRoommateId || undefined,
              linked_roommate_name: linkedRoommateName,
            }
          }
          return user
        }),
      )

      toast({
        title: "Thành công",
        description:
          selectedRoommateId && selectedRoommateId !== "none"
            ? `Đã liên kết người dùng với thành viên ${linkedRoommateName}.`
            : "Đã hủy liên kết người dùng với thành viên.",
      })

      setShowLinkDialog(false)
      setUserToLink(null)
      setSelectedRoommateId("")
    } catch (error) {
      console.error("Unexpected error:", error)
      toast({
        title: "Lỗi",
        description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
        variant: "destructive",
      })
    } finally {
      setIsLinking(false)
    }
  }

  // Lọc người dùng theo tìm kiếm và hộ gia đình
  const filteredUsers = users.filter((user) => {
    // Lọc theo từ khóa tìm kiếm
    if (searchTerm && !user.email.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }

    // Lọc theo hộ gia đình
    if (selectedHousehold !== "all" && user.household_id !== selectedHousehold) {
      return false
    }

    return true
  })

  // Lọc roommates theo household_id
  const filteredRoommates = roommates.filter(
    (roommate) => roommate.household_id === (userToLink?.household_id || householdId),
  )

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quản lý người dùng</CardTitle>
          <CardDescription>Chỉ quản trị viên mới có thể quản lý người dùng.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4 text-muted-foreground">
            <ShieldAlert className="h-5 w-5 mr-2" />
            <span>Bạn cần quyền quản trị viên để truy cập tính năng này.</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Quản lý người dùng</CardTitle>
          <CardDescription>Quản lý người dùng trong tất cả các hộ gia đình của bạn</CardDescription>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={copyInviteCode}>
            <Copy className="h-4 w-4 mr-2" /> Sao chép mã mời
          </Button>
          <Button size="sm" onClick={() => setShowInviteDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Mời người dùng
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
          {/* Thanh tìm kiếm */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm người dùng..."
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

          {/* Bộ lọc hộ gia đình */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" /> Lọc theo hộ gia đình
                {selectedHousehold !== "all" && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1">
                    !
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <div className="p-2">
                <select
                  className="w-full text-sm border rounded px-2 py-1"
                  value={selectedHousehold}
                  onChange={(e) => setSelectedHousehold(e.target.value)}
                >
                  <option value="all">Tất cả hộ gia đình</option>
                  {allHouseholds.map((household) => (
                    <option key={household.id} value={household.id}>
                      {household.name}
                    </option>
                  ))}
                </select>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-32">Đang tải...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm || selectedHousehold !== "all"
              ? "Không tìm thấy người dùng nào phù hợp với bộ lọc."
              : "Không có người dùng nào trong hộ gia đình."}
          </div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Hộ gia đình</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Thành viên liên kết</TableHead>
                  <TableHead>Ngày tham gia</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={`${user.id}-${user.household_id}`}>
                    <TableCell>
                      <div className="font-medium">{user.email}</div>
                      <div className="text-xs text-muted-foreground">{user.id === currentUserId ? "(Bạn)" : ""}</div>
                    </TableCell>
                    <TableCell>{user.household_name}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "admin" ? "default" : "outline"}>
                        {user.role === "admin" ? "Quản trị viên" : "Thành viên"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.linked_roommate_name ? (
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1"
                        >
                          <UserCheck className="h-3 w-3" />
                          {user.linked_roommate_name}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Chưa liên kết
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString("vi-VN")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center space-x-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => openLinkDialog(user)}>
                                <Link2 className="h-4 w-4 text-blue-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Liên kết với thành viên</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {user.id !== currentUserId && (
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center">
                                    <Switch
                                      checked={user.role === "admin"}
                                      onCheckedChange={() => toggleUserRole(user.id, user.role, user.household_id)}
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    {user.role === "admin"
                                      ? "Chuyển thành thành viên thường"
                                      : "Chuyển thành quản trị viên"}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => removeUser(user)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Xóa người dùng khỏi hộ gia đình</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Dialog mời người dùng */}
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mời người dùng</DialogTitle>
              <DialogDescription>Nhập địa chỉ email của người bạn muốn mời tham gia hộ gia đình.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                  <Input
                    id="email"
                    placeholder="example@email.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
              </div>
              {allHouseholds.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="invite-household">Hộ gia đình</Label>
                  <select
                    id="invite-household"
                    className="w-full border rounded px-2 py-1"
                    value={householdId}
                    onChange={(e) => setSelectedHousehold(e.target.value)}
                  >
                    {allHouseholds.map((household) => (
                      <option key={household.id} value={household.id}>
                        {household.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Hủy</Button>
              </DialogClose>
              <Button onClick={inviteUser} disabled={isSending}>
                {isSending ? "Đang gửi..." : "Gửi lời mời"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog xác nhận xóa người dùng */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Xác nhận xóa người dùng</DialogTitle>
              <DialogDescription>
                Bạn có chắc chắn muốn xóa người dùng {userToRemove?.email} khỏi hộ gia đình{" "}
                {userToRemove?.household_name} không?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Hủy</Button>
              </DialogClose>
              <Button variant="destructive" onClick={confirmRemoveUser}>
                Xóa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog liên kết người dùng với thành viên */}
        <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Liên kết người dùng với thành viên</DialogTitle>
              <DialogDescription>
                Liên kết người dùng {userToLink?.email} với một thành viên trong hộ gia đình{" "}
                {userToLink?.household_name}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="roommate-select">Thành viên</Label>
                <Select value={selectedRoommateId} onValueChange={setSelectedRoommateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn thành viên" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không liên kết</SelectItem>
                    {filteredRoommates.map((roommate) => (
                      <SelectItem key={roommate.id} value={roommate.id}>
                        {roommate.name} ({roommate.room})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Liên kết này sẽ giúp hệ thống xác định người dùng này đại diện cho thành viên nào trong hộ gia đình.
                </p>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Hủy</Button>
              </DialogClose>
              <Button onClick={linkUserToRoommate} disabled={isLinking}>
                {isLinking ? "Đang liên kết..." : "Liên kết"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
