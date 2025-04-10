"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/server"
import { login, signup } from "./actions"


export default function AuthForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState("signin")
  const { toast } = useToast()

  // Thêm state để quản lý tab đang active

  // Cập nhật hàm handleLogin để hiển thị thông báo và chuyển hướng
  const handleLogin = async (e) => {
    e.preventDefault() // Ngăn hành vi mặc định của form
    setLoading(true)
    setError(null)

    const result = await login({ email, password })

    if (result.error) {
      setError(result.error) // Hiển thị lỗi nếu có
      toast({
        title: "Đăng nhập thất bại",
        description: result.error,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Đăng nhập thành công",
        description: "Đang chuyển hướng đến trang quản lý...",
      })
      // Chuyển hướng đến trang dashboard
      window.location.href = "/dashboard"
    }

    setLoading(false)
  }

  // Cập nhật hàm handleSignup để xử lý đăng ký
const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signup({ email, password });

    if (result.error) {
      setError(result.error);
      toast({
        title: 'Đăng ký thất bại',
        description: result.error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Đăng ký thành công',
        description: 'Vui lòng đăng nhập để tiếp tục',
      });
      // Chuyển về tab đăng nhập sau khi đăng ký thành công
      setActiveTab('signin');
    }

    setLoading(false);
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Quản lý chi tiêu</CardTitle>
          <CardDescription className="text-center">Đăng nhập hoặc đăng ký để tiếp tục</CardDescription>
        </CardHeader>
        {/* Cập nhật component Tabs để sử dụng activeTab */}
        <Tabs defaultValue="signin" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signin">Đăng nhập</TabsTrigger>
            <TabsTrigger value="signup">Đăng ký</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4 pt-4">
                {error && <div className="px-6 py-2 mb-2 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>}
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Mật khẩu</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Đang xử lý..." : "Đăng nhập"}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={handleSignup}>
              <CardContent className="space-y-4 pt-4">
                {error && <div className="px-6 py-2 mb-2 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>}
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Mật khẩu</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Đang xử lý..." : "Đăng ký"}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}
