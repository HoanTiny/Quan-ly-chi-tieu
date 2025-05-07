'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RoomManagement from './room-management';
import RoommateManagement from './roommate-management';
import ExpenseForm from './expense-form';
import ExpenseList from './expense-list';
import SummaryView from './summary-view';
import SettlementView from './settlement-view';
import MonthlyDashboard from './monthly-dashboard';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, Share2, Menu } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import UserManagement from './user-management';
import QRCodeManager from './qr-code-manager';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Types
export interface Roommate {
  id: string;
  name: string;
  room: string;
  household_id: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  date: Date;
  sharedWith: string[];
  household_id: string;
  created_by?: string;
  shareMultipliers?: Record<string, number>;
}

export interface ExpenseShare {
  roommate_id: string;
  multiplier: number;
}

export interface Household {
  id: string;
  name: string;
  created_by: string;
  invite_code: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: 'admin' | 'member';
}

export default function ExpenseTracker({ userId }: { userId: string }) {
  // State
  const [roommates, setRoommates] = useState<Roommate[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [currentHousehold, setCurrentHousehold] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [showCreateHousehold, setShowCreateHousehold] = useState(false);
  const [showJoinHousehold, setShowJoinHousehold] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'member'>('member');
  const [needsDatabaseUpdate, setNeedsDatabaseUpdate] = useState(false);
  const [activeTab, setActiveTab] = useState('roommates');
  const [qrCodes, setQrCodes] = useState<Record<string, any[]>>({});

  const supabase = createClient();
  const { toast } = useToast();

  // Load user's households
  useEffect(() => {
    const fetchUserHouseholds = async () => {
      try {
        setIsLoading(true);

        // Lấy danh sách household_id và role mà người dùng là thành viên
        const { data: membershipData, error: membershipError } = await supabase
          .from('household_members')
          .select('household_id, role')
          .eq('user_id', userId);

        if (membershipError) {
          console.error('Error fetching memberships:', membershipError);
          toast({
            title: 'Lỗi',
            description:
              'Không thể tải thông tin thành viên. Vui lòng thử lại sau.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }

        if (!membershipData || membershipData.length === 0) {
          // Người dùng chưa tham gia hộ gia đình nào
          setIsLoading(false);
          return;
        }

        // Lấy thông tin chi tiết của các hộ gia đình
        const householdIds = membershipData.map((item) => item.household_id);
        const { data: householdData, error: householdError } = await supabase
          .from('households')
          .select('*')
          .in('id', householdIds)
          .order('created_at', { ascending: false });

        if (householdError) {
          console.error('Error fetching households:', householdError);
          toast({
            title: 'Lỗi',
            description:
              'Không thể tải thông tin hộ gia đình. Vui lòng thử lại sau.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }

        if (householdData && householdData.length > 0) {
          setHouseholds(householdData);
          const firstHouseholdId = householdData[0].id;
          setCurrentHousehold(firstHouseholdId);

          // Lấy vai trò của người dùng trong hộ gia đình đầu tiên
          const userMembership = membershipData.find(
            (m) => m.household_id === firstHouseholdId
          );
          if (userMembership) {
            setUserRole(userMembership.role as 'admin' | 'member');
          }
        }
      } catch (error) {
        console.error('Unexpected error:', error);
        toast({
          title: 'Lỗi',
          description: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserHouseholds();
  }, [userId, supabase, toast]);

  // Load rooms, roommates and expenses when household changes
  useEffect(() => {
    const fetchHouseholdData = async () => {
      if (!currentHousehold) return;

      try {
        // Lấy vai trò của người dùng trong hộ gia đình hiện tại
        const { data: memberData, error: memberError } = await supabase
          .from('household_members')
          .select('role')
          .eq('household_id', currentHousehold)
          .eq('user_id', userId)
          .single();

        if (memberError) {
          console.error('Error fetching user role:', memberError);
        } else if (memberData) {
          setUserRole(memberData.role as 'admin' | 'member');
        }

        // Fetch rooms
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('name')
          .eq('household_id', currentHousehold);

        if (roomError) {
          console.error('Error fetching rooms:', roomError);
          toast({
            title: 'Lỗi',
            description: 'Không thể tải danh sách phòng. Vui lòng thử lại sau.',
            variant: 'destructive',
          });
        } else if (roomData) {
          setRooms(roomData.map((room) => room.name));
        }

        // Fetch roommates
        const { data: roommateData, error: roommateError } = await supabase
          .from('roommates')
          .select('*')
          .eq('household_id', currentHousehold);

        if (roommateError) {
          console.error('Error fetching roommates:', roommateError);
          toast({
            title: 'Lỗi',
            description:
              'Không thể tải danh sách thành viên. Vui lòng thử lại sau.',
            variant: 'destructive',
          });
        } else if (roommateData) {
          setRoommates(roommateData);
        }

        // Fetch expenses - Kiểm tra xem cột created_by có tồn tại không
        try {
          // Thử truy vấn với cột created_by
          const { data: expenseData, error: expenseError } = await supabase
            .from('expenses')
            .select('*, created_by')
            .eq('household_id', currentHousehold);

          if (expenseError) {
            // Nếu có lỗi liên quan đến cột created_by
            if (expenseError.message.includes('created_by')) {
              setNeedsDatabaseUpdate(true);
              // Thử lại truy vấn không có cột created_by
              const { data: basicExpenseData, error: basicExpenseError } =
                await supabase
                  .from('expenses')
                  .select('*')
                  .eq('household_id', currentHousehold);

              if (basicExpenseError) {
                console.error('Error fetching expenses:', basicExpenseError);
                toast({
                  title: 'Lỗi',
                  description:
                    'Không thể tải danh sách chi phí. Vui lòng thử lại sau.',
                  variant: 'destructive',
                });
                return;
              }

              if (basicExpenseData) {
                processExpenseData(basicExpenseData, false);
              }
            } else {
              console.error('Error fetching expenses:', expenseError);
              toast({
                title: 'Lỗi',
                description:
                  'Không thể tải danh sách chi phí. Vui lòng thử lại sau.',
                variant: 'destructive',
              });
            }
          } else if (expenseData) {
            processExpenseData(expenseData, true);
          }
        } catch (error) {
          console.error('Error in expense fetching:', error);
          setNeedsDatabaseUpdate(true);

          // Thử lại truy vấn không có cột created_by
          const { data: basicExpenseData, error: basicExpenseError } =
            await supabase
              .from('expenses')
              .select('*')
              .eq('household_id', currentHousehold);

          if (basicExpenseError) {
            console.error('Error fetching basic expenses:', basicExpenseError);
          } else if (basicExpenseData) {
            processExpenseData(basicExpenseData, false);
          }
        }

        // Thêm phần load QR codes
        const { data: qrCodeData, error: qrCodeError } = await supabase
          .from('roommate_qrcodes')
          .select('*')
          .eq('household_id', currentHousehold);

        if (!qrCodeError && qrCodeData) {
          // Nhóm QR codes theo roommate_id
          const groupedQrCodes: Record<string, any[]> = {};
          qrCodeData.forEach((qrCode) => {
            if (!groupedQrCodes[qrCode.roommate_id]) {
              groupedQrCodes[qrCode.roommate_id] = [];
            }
            groupedQrCodes[qrCode.roommate_id].push(qrCode);
          });
          setQrCodes(groupedQrCodes);
        }
      } catch (error) {
        console.error('Unexpected error:', error);
        toast({
          title: 'Lỗi',
          description: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.',
          variant: 'destructive',
        });
      }
    };

    fetchHouseholdData();
  }, [currentHousehold, supabase, toast, userId]);

  // Hàm xử lý dữ liệu chi tiêu
  const processExpenseData = async (
    expenseData: any[],
    hasCreatedByField: boolean
  ) => {
    try {
      // Lấy thông tin chia sẻ chi phí cho mỗi chi phí
      const expensesWithShares = await Promise.all(
        expenseData.map(async (expense) => {
          const { data: sharesData, error: sharesError } = await supabase
            .from('expense_shares')
            .select('roommate_id, multiplier')
            .eq('expense_id', expense.id);

          if (sharesError) {
            console.error('Error fetching expense shares:', sharesError);
            return {
              id: expense.id,
              description: expense.description,
              amount: expense.amount,
              paidBy: expense.paid_by,
              date: new Date(expense.created_at),
              sharedWith: [],
              household_id: expense.household_id,
              created_by: hasCreatedByField ? expense.created_by : undefined,
            };
          }

          return {
            id: expense.id,
            description: expense.description,
            amount: expense.amount,
            paidBy: expense.paid_by,
            date: new Date(expense.created_at),
            sharedWith: sharesData
              ? sharesData.map((share) => share.roommate_id)
              : [],
            household_id: expense.household_id,
            created_by: hasCreatedByField ? expense.created_by : undefined,
            // Thêm multipliers vào dữ liệu expense để sử dụng ở các component khác
            shareMultipliers: sharesData
              ? sharesData.reduce((acc, share) => {
                  acc[share.roommate_id] = share.multiplier;
                  return acc;
                }, {} as Record<string, number>)
              : {},
          };
        })
      );

      setExpenses(expensesWithShares);
    } catch (error) {
      console.error('Error processing expense data:', error);
    }
  };

  // Create a new household
  const createHousehold = async () => {
    if (!householdName.trim()) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập tên hộ gia đình',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Generate a random invite code
      const inviteCode = Math.random()
        .toString(36)
        .substring(2, 10)
        .toUpperCase();

      // Create the household
      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .insert([
          {
            name: householdName.trim(),
            created_by: userId,
            invite_code: inviteCode,
          },
        ])
        .select();

      if (householdError) {
        toast({
          title: 'Lỗi',
          description: 'Không thể tạo hộ gia đình. Vui lòng thử lại.',
          variant: 'destructive',
        });
        return;
      }

      if (householdData && householdData.length > 0) {
        const newHouseholdId = householdData[0].id;

        // Add the creator as a member with admin role
        const { error: memberError } = await supabase
          .from('household_members')
          .insert([
            {
              household_id: newHouseholdId,
              user_id: userId,
              role: 'admin',
            },
          ]);

        if (memberError) {
          console.error('Error adding member:', memberError);
          toast({
            title: 'Lỗi',
            description:
              'Không thể thêm bạn vào hộ gia đình. Vui lòng thử lại.',
            variant: 'destructive',
          });
          return;
        }

        // Update state
        setHouseholds([...households, householdData[0]]);
        setCurrentHousehold(newHouseholdId);
        setShowCreateHousehold(false);
        setHouseholdName('');
        setUserRole('admin'); // Người tạo hộ gia đình là admin

        toast({
          title: 'Thành công',
          description: 'Đã tạo hộ gia đình mới',
        });
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: 'Lỗi',
        description: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.',
        variant: 'destructive',
      });
    }
  };

  // Join a household with invite code
  const joinHousehold = async () => {
    if (!inviteCode.trim()) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập mã mời',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Find the household with this invite code
      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .select('*')
        .eq('invite_code', inviteCode.trim());

      if (householdError || !householdData || householdData.length === 0) {
        toast({
          title: 'Lỗi',
          description: 'Mã mời không hợp lệ',
          variant: 'destructive',
        });
        return;
      }

      const householdId = householdData[0].id;

      // Check if user is already a member
      const { data: memberData } = await supabase
        .from('household_members')
        .select('*')
        .eq('household_id', householdId)
        .eq('user_id', userId);

      if (memberData && memberData.length > 0) {
        toast({
          title: 'Thông báo',
          description: 'Bạn đã là thành viên của hộ gia đình này',
        });
        setCurrentHousehold(householdId);
        setShowJoinHousehold(false);
        setInviteCode('');
        return;
      }

      // Add user as a member with member role
      const { error: memberError } = await supabase
        .from('household_members')
        .insert([
          {
            household_id: householdId,
            user_id: userId,
            role: 'member', // Người tham gia bằng mã mời là member
          },
        ]);

      if (memberError) {
        console.error('Error joining household:', memberError);
        toast({
          title: 'Lỗi',
          description: 'Không thể tham gia hộ gia đình. Vui lòng thử lại.',
          variant: 'destructive',
        });
        return;
      }

      // Update state
      setHouseholds([...households, householdData[0]]);
      setCurrentHousehold(householdId);
      setShowJoinHousehold(false);
      setInviteCode('');
      setUserRole('member'); // Người tham gia bằng mã mời là member

      toast({
        title: 'Thành công',
        description: 'Đã tham gia hộ gia đình',
      });
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: 'Lỗi',
        description: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.',
        variant: 'destructive',
      });
    }
  };

  // Share invite code
  const shareInviteCode = async () => {
    if (!currentHousehold) return;

    try {
      const { data, error } = await supabase
        .from('households')
        .select('invite_code')
        .eq('id', currentHousehold)
        .single();

      if (error) {
        console.error('Error fetching invite code:', error);
        toast({
          title: 'Lỗi',
          description: 'Không thể lấy mã mời. Vui lòng thử lại.',
          variant: 'destructive',
        });
        return;
      }

      if (data) {
        try {
          await navigator.clipboard.writeText(data.invite_code);
          toast({
            title: 'Đã sao chép',
            description: 'Mã mời đã được sao chép vào clipboard',
          });
        } catch (err) {
          toast({
            title: 'Mã mời',
            description: `Mã mời của bạn là: ${data.invite_code}`,
          });
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: 'Lỗi',
        description: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.',
        variant: 'destructive',
      });
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể đăng xuất. Vui lòng thử lại.',
        variant: 'destructive',
      });
    }
  };

  // Add new room
  const addRoom = async (roomName: string) => {
    if (
      roomName.trim() === '' ||
      rooms.includes(roomName.trim()) ||
      !currentHousehold
    )
      return;

    // Kiểm tra quyền hạn - chỉ admin mới được thêm phòng
    if (userRole !== 'admin') {
      toast({
        title: 'Không có quyền',
        description: 'Chỉ quản trị viên mới có thể thêm phòng mới.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('rooms').insert([
        {
          name: roomName.trim(),
          household_id: currentHousehold,
        },
      ]);

      if (error) {
        console.error('Error adding room:', error);
        toast({
          title: 'Lỗi',
          description: 'Không thể thêm phòng. Vui lòng thử lại.',
          variant: 'destructive',
        });
        return;
      }

      setRooms([...rooms, roomName.trim()]);
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: 'Lỗi',
        description: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.',
        variant: 'destructive',
      });
    }
  };

  // Remove room
  const removeRoom = async (roomName: string) => {
    if (!currentHousehold) return;

    // Kiểm tra quyền hạn - chỉ admin mới được xóa phòng
    if (userRole !== 'admin') {
      toast({
        title: 'Không có quyền',
        description: 'Chỉ quản trị viên mới có thể xóa phòng.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('household_id', currentHousehold)
        .eq('name', roomName);

      if (error) {
        console.error('Error removing room:', error);
        toast({
          title: 'Lỗi',
          description: 'Không thể xóa phòng. Vui lòng thử lại.',
          variant: 'destructive',
        });
        return;
      }

      setRooms(rooms.filter((r) => r !== roomName));

      // Remove all roommates in that room
      const roommatesInRoom = roommates.filter((r) => r.room === roomName);
      for (const roommate of roommatesInRoom) {
        await removeRoommate(roommate.id);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: 'Lỗi',
        description: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.',
        variant: 'destructive',
      });
    }
  };

  // Add new roommate
  const addRoommate = async (name: string, room: string) => {
    if (name.trim() === '' || room === '' || !currentHousehold) return;

    // Kiểm tra quyền hạn - chỉ admin mới được thêm thành viên
    if (userRole !== 'admin') {
      toast({
        title: 'Không có quyền',
        description: 'Chỉ quản trị viên mới có thể thêm thành viên.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('roommates')
        .insert([
          {
            name: name.trim(),
            room: room,
            household_id: currentHousehold,
          },
        ])
        .select();

      if (error) {
        console.error('Error adding roommate:', error);
        toast({
          title: 'Lỗi',
          description: 'Không thể thêm thành viên. Vui lòng thử lại.',
          variant: 'destructive',
        });
        return;
      }

      if (data && data.length > 0) {
        setRoommates([...roommates, data[0]]);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: 'Lỗi',
        description: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.',
        variant: 'destructive',
      });
    }
  };

  // Remove roommate
  const removeRoommate = async (id: string) => {
    // Kiểm tra quyền hạn - chỉ admin mới được xóa thành viên
    if (userRole !== 'admin') {
      toast({
        title: 'Không có quyền',
        description: 'Chỉ quản trị viên mới có thể xóa thành viên.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // First check if this roommate is used in any expenses
      const { data: expenseData } = await supabase
        .from('expenses')
        .select('id')
        .eq('paid_by', id);

      if (expenseData && expenseData.length > 0) {
        toast({
          title: 'Lỗi',
          description:
            'Không thể xóa thành viên này vì họ đã thanh toán một số chi phí.',
          variant: 'destructive',
        });
        return;
      }

      // Delete expense shares first
      await supabase.from('expense_shares').delete().eq('roommate_id', id);

      // Then delete the roommate
      const { error } = await supabase.from('roommates').delete().eq('id', id);

      if (error) {
        console.error('Error removing roommate:', error);
        toast({
          title: 'Lỗi',
          description: 'Không thể xóa thành viên. Vui lòng thử lại.',
          variant: 'destructive',
        });
        return;
      }

      setRoommates(roommates.filter((roommate) => roommate.id !== id));

      // Update expenses that include this roommate
      const updatedExpenses = expenses.map((expense) => ({
        ...expense,
        sharedWith: expense.sharedWith.filter(
          (roommateId) => roommateId !== id
        ),
      }));

      setExpenses(updatedExpenses);
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: 'Lỗi',
        description: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.',
        variant: 'destructive',
      });
    }
  };

  // Add new expense
  const addExpense = async (
    expense: Omit<Expense, 'id' | 'household_id' | 'created_by'>,
    expenseShares: ExpenseShare[] = []
  ) => {
    if (!currentHousehold) return;

    try {
      // If no roommates are selected to share with, default to all roommates in the same room
      let sharedWith = [...expense.sharedWith];
      if (sharedWith.length === 0) {
        const payerRoommate = roommates.find((r) => r.id === expense.paidBy);
        if (payerRoommate) {
          sharedWith = roommates
            .filter((r) => r.room === payerRoommate.room)
            .map((r) => r.id);

          // Tạo expenseShares mặc định nếu chưa có
          if (expenseShares.length === 0) {
            expenseShares = sharedWith.map((id) => ({
              roommate_id: id,
              multiplier: 1,
            }));
          }
        }
      }

      // Chuẩn bị dữ liệu chi tiêu
      const expenseData: any = {
        description: expense.description.trim(),
        amount: Math.round(expense.amount), // Round to whole number
        paid_by: expense.paidBy,
        household_id: currentHousehold,
        created_at: expense.date.toISOString(), // Sử dụng ngày được chọn
      };

      // Thêm created_by nếu cơ sở dữ liệu đã được cập nhật
      if (!needsDatabaseUpdate) {
        expenseData.created_by = userId;
      }

      // Insert the expense
      const { data, error } = await supabase
        .from('expenses')
        .insert([expenseData])
        .select();

      if (error || !data || data.length === 0) {
        console.error('Error adding expense:', error);
        toast({
          title: 'Lỗi',
          description: 'Không thể thêm chi phí. Vui lòng thử lại.',
          variant: 'destructive',
        });
        return;
      } else {
        toast({
          title: 'Thành công',
          description: 'Chi phí đã được thêm thành công',
        });
      }

      const newExpenseId = data[0].id;

      // Insert expense shares với hệ số multiplier
      const shares = sharedWith.map((roommateId) => {
        // Tìm expenseShare tương ứng
        const share = expenseShares.find((s) => s.roommate_id === roommateId);
        return {
          expense_id: newExpenseId,
          roommate_id: roommateId,
          multiplier: share?.multiplier || 1, // Sử dụng hệ số nếu có, mặc định là 1
        };
      });

      const { error: sharesError } = await supabase
        .from('expense_shares')
        .insert(shares);

      if (sharesError) {
        console.error('Error adding expense shares:', sharesError);
        toast({
          title: 'Lỗi',
          description: 'Không thể thêm chi tiết chia sẻ. Vui lòng thử lại.',
          variant: 'destructive',
        });
        return;
      }

      // Add to local state
      const expenseObj: Expense = {
        id: newExpenseId,
        description: expense.description.trim(),
        amount: Math.round(expense.amount),
        paidBy: expense.paidBy,
        date: expense.date, // Sử dụng ngày được chọn
        sharedWith: sharedWith,
        household_id: currentHousehold,
        created_by: !needsDatabaseUpdate ? userId : undefined,
        shareMultipliers: expenseShares.reduce((acc, share) => {
          acc[share.roommate_id] = share.multiplier;
          return acc;
        }, {} as Record<string, number>),
      };

      setExpenses([...expenses, expenseObj]);
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: 'Lỗi',
        description: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.',
        variant: 'destructive',
      });
    }
  };

  // Remove expense
  const removeExpense = async (id: string) => {
    // Tìm chi tiêu cần xóa
    const expenseToRemove = expenses.find((e) => e.id === id);
    if (!expenseToRemove) return;

    // Kiểm tra quyền hạn - chỉ người tạo chi tiêu hoặc admin mới được xóa
    if (
      expenseToRemove.created_by &&
      expenseToRemove.created_by !== userId &&
      userRole !== 'admin'
    ) {
      toast({
        title: 'Không có quyền',
        description:
          'Chỉ người tạo chi tiêu hoặc quản trị viên mới có thể xóa chi tiêu này.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Delete expense shares first (foreign key constraint)
      await supabase.from('expense_shares').delete().eq('expense_id', id);

      // Then delete the expense
      const { error } = await supabase.from('expenses').delete().eq('id', id);

      if (error) {
        console.error('Error removing expense:', error);
        toast({
          title: 'Lỗi',
          description: 'Không thể xóa chi phí. Vui lòng thử lại.',
          variant: 'destructive',
        });
        return;
      }

      setExpenses(expenses.filter((expense) => expense.id !== id));
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: 'Lỗi',
        description: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.',
        variant: 'destructive',
      });
    }
  };

  // Calculate balances
  const calculateBalances = () => {
    const balances: Record<string, number> = {};

    // Initialize balances for all roommates
    roommates.forEach((roommate) => {
      balances[roommate.id] = 0;
    });

    // Calculate each expense's contribution to balances
    expenses.forEach((expense) => {
      const payer = expense.paidBy;
      const sharedWith = expense.sharedWith;
      const multipliers = expense.shareMultipliers || {};

      // Skip if no one to share with
      if (sharedWith.length === 0) return;

      // Tính tổng hệ số
      let totalMultiplier = 0;
      sharedWith.forEach((roommateId) => {
        totalMultiplier += multipliers[roommateId] || 1;
      });

      // Add the full amount to the payer's balance (positive means others owe them)
      balances[payer] += expense.amount;

      // Subtract each person's share from their balance based on their multiplier
      sharedWith.forEach((roommateId) => {
        const roommateParts = multipliers[roommateId] || 1;
        const amountForRoommate =
          (expense.amount * roommateParts) / totalMultiplier;
        balances[roommateId] -= amountForRoommate;
      });
    });

    // Round all balances to whole numbers
    Object.keys(balances).forEach((key) => {
      balances[key] = Math.round(balances[key]);
    });

    return balances;
  };

  // Get final settlement transactions
  const getSettlementTransactions = () => {
    const balances = calculateBalances();
    const transactions: {
      from: string;
      to: string;
      amount: number;
      relatedExpenses?: {
        id: string;
        description: string;
        amount: number;
        multiplier: number;
      }[];
    }[] = [];

    // Create arrays of debtors and creditors
    const debtors = roommates
      .filter((r) => balances[r.id] < 0)
      .map((r) => ({ id: r.id, balance: balances[r.id] }))
      .sort((a, b) => a.balance - b.balance); // Sort by balance ascending (most negative first)

    const creditors = roommates
      .filter((r) => balances[r.id] > 0)
      .map((r) => ({ id: r.id, balance: balances[r.id] }))
      .sort((a, b) => b.balance - a.balance); // Sort by balance descending (most positive first)

    // Match debtors with creditors to settle debts
    let debtorIndex = 0;
    let creditorIndex = 0;

    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];

      // Calculate the transaction amount (minimum of the absolute values)
      const amount = Math.min(Math.abs(debtor.balance), creditor.balance);

      // Round to whole number
      const roundedAmount = Math.round(amount);

      if (roundedAmount > 0) {
        // Find related expenses for this transaction
        const relatedExpenses = expenses
          .filter((expense) => {
            // Expense is related if debtor is in sharedWith AND creditor is paidBy
            return (
              expense.sharedWith.includes(debtor.id) &&
              expense.paidBy === creditor.id
            );
          })
          .map((expense) => {
            // Calculate the amount this expense contributes to the debt
            const multipliers = expense.shareMultipliers || {};
            const debtorMultiplier = multipliers[debtor.id] || 1;

            // Calculate total parts
            let totalMultiplier = 0;
            expense.sharedWith.forEach((id) => {
              totalMultiplier += multipliers[id] || 1;
            });

            // Calculate amount based on multiplier
            const expenseAmount = Math.round(
              (expense.amount * debtorMultiplier) / totalMultiplier
            );

            return {
              id: expense.id,
              description: expense.description,
              amount: expenseAmount,
              multiplier: debtorMultiplier,
            };
          })
          .filter((item) => item.amount > 0); // Only include expenses with positive amounts

        transactions.push({
          from: debtor.id,
          to: creditor.id,
          amount: roundedAmount,
          relatedExpenses: relatedExpenses,
        });
      }

      // Update balances
      debtor.balance += amount;
      creditor.balance -= amount;

      // Move to next debtor/creditor if their balance is settled
      if (Math.abs(debtor.balance) < 1) debtorIndex++;
      if (Math.abs(creditor.balance) < 1) creditorIndex++;
    }

    return transactions;
  };

  // Calculate total expenses
  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );

  // If loading, show loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">Đang tải...</div>
    );
  }

  // If no households, show create/join options
  if (households.length === 0 || !currentHousehold) {
    return (
      <div className="max-w-md mx-auto p-4">
        <div className="flex justify-end mb-4">
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" /> Đăng xuất
          </Button>
        </div>

        <div className="space-y-4">
          {!showCreateHousehold && !showJoinHousehold && (
            <>
              <Button
                className="w-full"
                onClick={() => setShowCreateHousehold(true)}
              >
                Tạo hộ gia đình mới
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setShowJoinHousehold(true)}
              >
                Tham gia hộ gia đình
              </Button>
            </>
          )}

          {showCreateHousehold && (
            <div className="space-y-4 border p-4 rounded-md">
              <h2 className="text-lg font-medium">Tạo hộ gia đình mới</h2>
              <div className="space-y-2">
                <Label htmlFor="householdName">Tên hộ gia đình</Label>
                <Input
                  id="householdName"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  placeholder="Nhập tên hộ gia đình"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={createHousehold}>Tạo</Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateHousehold(false)}
                >
                  Hủy
                </Button>
              </div>
            </div>
          )}

          {showJoinHousehold && (
            <div className="space-y-4 border p-4 rounded-md">
              <h2 className="text-lg font-medium">Tham gia hộ gia đình</h2>
              <div className="space-y-2">
                <Label htmlFor="inviteCode">Mã mời</Label>
                <Input
                  id="inviteCode"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Nhập mã mời"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={joinHousehold}>Tham gia</Button>
                <Button
                  variant="outline"
                  onClick={() => setShowJoinHousehold(false)}
                >
                  Hủy
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {households.length > 1 && (
            <select
              className="border rounded px-2 py-1 text-sm"
              value={currentHousehold}
              onChange={(e) => setCurrentHousehold(e.target.value)}
            >
              {households.map((household) => (
                <option key={household.id} value={household.id}>
                  {household.name}
                </option>
              ))}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={shareInviteCode}>
            <Share2 className="h-4 w-4 mr-2" /> Chia sẻ mã mời
          </Button>
          {userRole === 'admin' && (
            <Badge variant="outline" className="bg-green-50">
              Quản trị viên
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" /> Đăng xuất
        </Button>
      </div>

      {/* Mobile Tab Navigation */}
      <div className="md:hidden mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span>
                {activeTab === 'roommates'
                  ? 'Thành viên'
                  : activeTab === 'expenses'
                  ? 'Chi tiêu'
                  : activeTab === 'summary'
                  ? 'Tổng kết'
                  : activeTab === 'settlement'
                  ? 'Thanh toán'
                  : activeTab === 'users'
                  ? 'Người dùng'
                  : activeTab === 'dashboard'
                  ? 'Báo cáo'
                  : 'Mã QR'}
              </span>
              <Menu className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-full">
            <DropdownMenuItem onClick={() => setActiveTab('roommates')}>
              Thành viên
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveTab('expenses')}>
              Chi tiêu
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveTab('summary')}>
              Tổng kết
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveTab('settlement')}>
              Thanh toán
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveTab('users')}>
              Người dùng
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveTab('dashboard')}>
              Báo cáo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveTab('qrcode')}>
              Mã QR
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop Tab Navigation */}
      <div className="hidden md:block">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-7 mb-8">
            <TabsTrigger value="roommates">Thành viên</TabsTrigger>
            <TabsTrigger value="expenses">Chi tiêu</TabsTrigger>
            <TabsTrigger value="summary">Tổng kết</TabsTrigger>
            <TabsTrigger value="settlement">Thanh toán</TabsTrigger>
            <TabsTrigger value="users">Người dùng</TabsTrigger>
            <TabsTrigger value="dashboard">Báo cáo</TabsTrigger>
            <TabsTrigger value="qrcode">Mã QR</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'roommates' && (
          <>
            <RoomManagement
              rooms={rooms}
              onAddRoom={addRoom}
              onRemoveRoom={removeRoom}
              isAdmin={userRole === 'admin'}
            />
            <RoommateManagement
              roommates={roommates}
              rooms={rooms}
              onAddRoommate={addRoommate}
              onRemoveRoommate={removeRoommate}
              isAdmin={userRole === 'admin'}
            />
          </>
        )}

        {activeTab === 'expenses' && (
          <>
            <ExpenseForm
              roommates={roommates}
              rooms={rooms}
              onAddExpense={addExpense}
            />
            <ExpenseList
              expenses={expenses}
              roommates={roommates}
              onRemoveExpense={removeExpense}
              currentUserId={userId}
              isAdmin={userRole === 'admin'}
            />
          </>
        )}

        {activeTab === 'summary' && (
          <SummaryView
            totalExpenses={totalExpenses}
            balances={calculateBalances()}
            roommates={roommates}
            expenses={expenses}
            qrCodes={qrCodes}
          />
        )}

        {activeTab === 'settlement' && (
          <SettlementView
            transactions={getSettlementTransactions()}
            roommates={roommates}
            hasRoommates={roommates.length > 0}
            hasExpenses={expenses.length > 0}
            householdId={currentHousehold}
            expenses={expenses}
          />
        )}

        {activeTab === 'users' && (
          <UserManagement
            householdId={currentHousehold}
            currentUserId={userId}
            isAdmin={userRole === 'admin'}
            roommates={roommates}
          />
        )}

        {activeTab === 'dashboard' && (
          <MonthlyDashboard expenses={expenses} roommates={roommates} />
        )}

        {activeTab === 'qrcode' && (
          <QRCodeManager
            roommates={roommates}
            householdId={currentHousehold}
            isAdmin={userRole === 'admin'}
            currentUserId={userId}
          />
        )}
      </div>
    </>
  );
}
