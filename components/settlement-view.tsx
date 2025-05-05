'use client';

import { Label } from '@/components/ui/label';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileSpreadsheet,
  PlusCircle,
  Filter,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { Roommate, Expense } from './expense-tracker';
import { formatCurrency } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface SettlementViewProps {
  transactions: { from: string; to: string; amount: number }[];
  roommates: Roommate[];
  hasRoommates: boolean;
  hasExpenses: boolean;
  householdId: string;
  expenses: Expense[];
}

interface PaymentStatus {
  id: string;
  from_id: string;
  to_id: string;
  expense_id?: string;
  amount: number;
  is_paid: boolean;
  household_id: string;
  created_at: string;
}

interface DetailedTransaction {
  from: string;
  to: string;
  amount: number;
  expenseId: string;
  expenseDescription: string;
  date: Date;
  sharedWith: string[];
}

interface GroupedTransaction {
  description: string;
  transactions: DetailedTransaction[];
  totalAmount: number;
}

// Hàm làm tròn số tiền
const roundAmount = (amount: number): number => {
  // Làm tròn lên đến 1.000 gần nhất
  return Math.ceil(amount / 1000) * 1000;
};

export default function SettlementView({
  transactions,
  roommates,
  hasRoommates,
  hasExpenses,
  householdId,
  expenses,
}: SettlementViewProps) {
  const [paymentStatuses, setPaymentStatuses] = useState<
    Record<string, boolean>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [tableExists, setTableExists] = useState(true);
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [detailedTransactions, setDetailedTransactions] = useState<
    DetailedTransaction[]
  >([]);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedPayer, setSelectedPayer] = useState<string | null>(null);
  const [selectedReceiver, setSelectedReceiver] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] =
    useState<DetailedTransaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('grouped');
  const [hidePaid, setHidePaid] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();

  // Lấy tên người dùng theo ID
  const getRoommateName = (id: string) => {
    const roommate = roommates.find((r) => r.id === id);
    return roommate ? `${roommate.name}` : 'Không xác định';
  };

  // Tạo ID duy nhất cho mỗi giao dịch
  const getTransactionId = (from: string, to: string, expenseId?: string) => {
    return expenseId ? `${from}-${to}-${expenseId}` : `${from}-${to}`;
  };

  // Tạo bảng payment_statuses nếu chưa tồn tại
  const createPaymentStatusTable = async () => {
    setIsCreatingTable(true);
    try {
      const { error } = await supabase.rpc('create_payment_statuses_table');

      if (error) {
        console.error('Lỗi khi tạo bảng:', error);
        toast({
          title: 'Lỗi',
          description:
            'Không thể tạo bảng trạng thái thanh toán. Vui lòng liên hệ quản trị viên.',
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'Thành công',
        description: 'Đã tạo bảng trạng thái thanh toán.',
      });

      setTableExists(true);
      return true;
    } catch (error) {
      console.error('Lỗi không mong muốn khi tạo bảng:', error);
      toast({
        title: 'Lỗi',
        description: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsCreatingTable(false);
    }
  };

  // Lưu trạng thái thanh toán trong bộ nhớ cục bộ
  const savePaymentStatusLocally = (
    from: string,
    to: string,
    isPaid: boolean,
    expenseId?: string
  ) => {
    const transactionId = getTransactionId(from, to, expenseId);
    const newStatuses = { ...paymentStatuses, [transactionId]: isPaid };
    setPaymentStatuses(newStatuses);

    // Lưu vào localStorage để giữ trạng thái giữa các lần tải trang
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        `payment_status_${householdId}`,
        JSON.stringify(newStatuses)
      );
    }

    return true;
  };

  // Cập nhật trạng thái thanh toán
  const updatePaymentStatus = async (
    from: string,
    to: string,
    amount: number,
    isPaid: boolean,
    expenseId?: string
  ) => {
    setIsLoading(true);
    const transactionId = getTransactionId(from, to, expenseId);

    try {
      // Nếu bảng không tồn tại, chỉ lưu cục bộ
      if (!tableExists) {
        const success = savePaymentStatusLocally(from, to, isPaid, expenseId);
        if (success) {
          toast({
            title: 'Đã cập nhật',
            description: isPaid
              ? `Đã đánh dấu khoản thanh toán từ ${getRoommateName(
                  from
                )} cho ${getRoommateName(to)} là đã thanh toán.`
              : `Đã đánh dấu khoản thanh toán từ ${getRoommateName(
                  from
                )} cho ${getRoommateName(to)} là chưa thanh toán.`,
          });
        }
        setIsLoading(false);
        return;
      }

      // Kiểm tra xem bản ghi đã tồn tại chưa
      let query = supabase
        .from('payment_statuses')
        .select('*')
        .eq('from_id', from)
        .eq('to_id', to)
        .eq('household_id', householdId);

      if (expenseId) {
        query = query.eq('expense_id', expenseId);
      }

      const { data: existingData, error: checkError } =
        await query.maybeSingle();

      if (checkError) {
        if (checkError.code === '42P01') {
          // Bảng không tồn tại
          setTableExists(false);
          savePaymentStatusLocally(from, to, isPaid, expenseId);
          toast({
            title: 'Thông báo',
            description:
              'Dữ liệu thanh toán được lưu cục bộ do bảng dữ liệu chưa được tạo.',
          });
          setIsLoading(false);
          return;
        } else {
          console.error('Lỗi khi kiểm tra trạng thái thanh toán:', checkError);
          toast({
            title: 'Lỗi',
            description:
              'Không thể cập nhật trạng thái thanh toán. Vui lòng thử lại sau.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
      }

      if (existingData) {
        // Cập nhật bản ghi hiện có
        const { error: updateError } = await supabase
          .from('payment_statuses')
          .update({ is_paid: isPaid })
          .eq('id', existingData.id);

        if (updateError) {
          console.error('Lỗi khi cập nhật trạng thái thanh toán:', updateError);
          toast({
            title: 'Lỗi',
            description:
              'Không thể cập nhật trạng thái thanh toán. Vui lòng thử lại sau.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
      } else {
        // Tạo bản ghi mới
        const newRecord: any = {
          from_id: from,
          to_id: to,
          amount: amount,
          is_paid: isPaid,
          household_id: householdId,
        };

        if (expenseId) {
          newRecord.expense_id = expenseId;
        }

        const { error: insertError } = await supabase
          .from('payment_statuses')
          .insert([newRecord]);

        if (insertError) {
          if (insertError.code === '42P01') {
            // Bảng không tồn tại
            setTableExists(false);
            savePaymentStatusLocally(from, to, isPaid, expenseId);
            toast({
              title: 'Thông báo',
              description:
                'Dữ liệu thanh toán được lưu cục bộ do bảng dữ liệu chưa được tạo.',
            });
          } else {
            console.error('Lỗi khi tạo trạng thái thanh toán:', insertError);
            toast({
              title: 'Lỗi',
              description:
                'Không thể cập nhật trạng thái thanh toán. Vui lòng thử lại sau.',
              variant: 'destructive',
            });
          }
          setIsLoading(false);
          return;
        }
      }

      // Cập nhật state
      setPaymentStatuses({
        ...paymentStatuses,
        [transactionId]: isPaid,
      });

      toast({
        title: 'Thành công',
        description: isPaid
          ? `Đã đánh dấu khoản thanh toán từ ${getRoommateName(
              from
            )} cho ${getRoommateName(to)} là đã thanh toán.`
          : `Đã đánh dấu khoản thanh toán từ ${getRoommateName(
              from
            )} cho ${getRoommateName(to)} là chưa thanh toán.`,
      });
    } catch (error) {
      console.error('Lỗi không mong muốn:', error);
      toast({
        title: 'Lỗi',
        description: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Tải trạng thái thanh toán từ cơ sở dữ liệu hoặc localStorage
  const loadPaymentStatuses = async () => {
    if (!householdId) return;

    // Trước tiên, kiểm tra localStorage
    if (typeof window !== 'undefined') {
      const localData = localStorage.getItem(`payment_status_${householdId}`);
      if (localData) {
        try {
          setPaymentStatuses(JSON.parse(localData));
        } catch (e) {
          console.error('Lỗi phân tích dữ liệu cục bộ:', e);
        }
      }
    }

    // Sau đó thử tải từ cơ sở dữ liệu
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_statuses')
        .select('*')
        .eq('household_id', householdId);

      if (error) {
        if (error.code === '42P01') {
          // Bảng không tồn tại
          setTableExists(false);
        } else {
          console.error('Lỗi khi tải trạng thái thanh toán:', error);
        }
        return;
      }

      if (data) {
        const statuses: Record<string, boolean> = {};
        data.forEach((item: PaymentStatus) => {
          const transactionId = getTransactionId(
            item.from_id,
            item.to_id,
            item.expense_id
          );
          statuses[transactionId] = item.is_paid;
        });
        setPaymentStatuses(statuses);
      }
    } catch (error) {
      console.error('Lỗi không mong muốn:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Tạo chi tiết giao dịch từ các chi phí
  const generateDetailedTransactions = () => {
    const detailed: DetailedTransaction[] = [];

    expenses.forEach((expense) => {
      const paidBy = expense.paidBy;
      const sharedWith = expense.sharedWith;

      if (sharedWith.length === 0) return;

      const amountPerPerson = roundAmount(expense.amount / sharedWith.length);

      // Với mỗi người chia sẻ chi phí, tạo một giao dịch chi tiết
      sharedWith.forEach((roommateId) => {
        // Bỏ qua nếu người chia sẻ cũng là người trả tiền
        if (roommateId === paidBy) return;

        detailed.push({
          from: roommateId,
          to: paidBy,
          amount: amountPerPerson,
          expenseId: expense.id,
          expenseDescription: expense.description,
          date: expense.date,
          sharedWith: expense.sharedWith,
        });
      });
    });

    setDetailedTransactions(detailed);
  };

  // Lọc giao dịch theo tháng
  const getFilteredByMonth = () => {
    if (selectedMonth === 'all') {
      return detailedTransactions;
    }

    const [year, month] = selectedMonth.split('-');
    return detailedTransactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date);
      return (
        transactionDate.getFullYear() === Number.parseInt(year) &&
        transactionDate.getMonth() === Number.parseInt(month) - 1
      );
    });
  };

  // Lọc giao dịch theo tab và bộ lọc
  const filteredTransactions = useMemo(() => {
    let result = getFilteredByMonth();

    // Lọc theo tab
    if (activeTab === 'expense') {
      // Khoản chi - người dùng phải trả tiền cho người khác
      result = result.filter((t) => t.from !== selectedPayer);
    } else if (activeTab === 'income') {
      // Khoản thu - người dùng nhận tiền từ người khác
      result = result.filter((t) => t.to !== selectedReceiver);
    } else if (activeTab === 'paid') {
      // Đã thanh toán
      result = result.filter((t) => {
        const id = getTransactionId(t.from, t.to, t.expenseId);
        return paymentStatuses[id];
      });
    }

    // Lọc theo người trả
    if (selectedPayer) {
      result = result.filter((t) => t.from === selectedPayer);
    }

    // Lọc theo người nhận
    if (selectedReceiver) {
      result = result.filter((t) => t.to === selectedReceiver);
    }

    // Lọc theo từ khóa tìm kiếm
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(
        (t) =>
          getRoommateName(t.from).toLowerCase().includes(term) ||
          getRoommateName(t.to).toLowerCase().includes(term) ||
          t.expenseDescription.toLowerCase().includes(term) ||
          formatCurrency(t.amount).toLowerCase().includes(term)
      );
    }

    // Lọc các khoản đã thanh toán nếu hidePaid = true
    if (hidePaid) {
      result = result.filter((t) => {
        const id = getTransactionId(t.from, t.to, t.expenseId);
        return !paymentStatuses[id];
      });
    }

    return result;
  }, [
    detailedTransactions,
    activeTab,
    selectedMonth,
    selectedPayer,
    selectedReceiver,
    paymentStatuses,
    searchTerm,
    hidePaid,
  ]);

  // Nhóm các giao dịch theo mô tả
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, GroupedTransaction> = {};

    filteredTransactions.forEach((transaction) => {
      const key = transaction.expenseDescription;
      if (!groups[key]) {
        groups[key] = {
          description: key,
          transactions: [],
          totalAmount: 0,
        };
      }
      groups[key].transactions.push(transaction);
      groups[key].totalAmount += transaction.amount;
    });

    return Object.values(groups).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredTransactions]);

  // Tạo danh sách các tháng có giao dịch
  const getAvailableMonths = () => {
    const months = new Set<string>();

    expenses.forEach((expense) => {
      const date = new Date(expense.date);
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, '0')}`;
      months.add(monthKey);
    });

    return Array.from(months).sort().reverse();
  };

  // Tính tổng số tiền theo người nhận
  const getTotalByRecipient = () => {
    const totals: Record<string, number> = {};

    filteredTransactions.forEach((transaction) => {
      if (!totals[transaction.to]) {
        totals[transaction.to] = 0;
      }
      totals[transaction.to] += transaction.amount;
    });

    return totals;
  };

  // Tính tổng số tiền theo người trả
  const getTotalByPayer = () => {
    const totals: Record<string, number> = {};

    filteredTransactions.forEach((transaction) => {
      if (!totals[transaction.from]) {
        totals[transaction.from] = 0;
      }
      totals[transaction.from] += transaction.amount;
    });

    return totals;
  };

  // Tải trạng thái thanh toán khi component được tải
  useEffect(() => {
    loadPaymentStatuses();
    generateDetailedTransactions();
  }, [householdId, expenses]);

  // Xuất dữ liệu ra file CSV
  const exportToCSV = () => {
    if (filteredTransactions.length === 0) return;

    // Tạo nội dung CSV
    let csvContent =
      'Người trả,Phòng,Người nhận,Phòng,Mô tả chi phí,Ngày,Số tiền,Đã thanh toán\n';

    filteredTransactions.forEach((transaction) => {
      const fromName = getRoommateName(transaction.from);
      const fromRoom =
        roommates.find((r) => r.id === transaction.from)?.room || '';
      const toName = getRoommateName(transaction.to);
      const toRoom = roommates.find((r) => r.id === transaction.to)?.room || '';
      const description = transaction.expenseDescription;
      const date = format(new Date(transaction.date), 'dd/MM/yyyy');
      const amount = formatCurrency(transaction.amount);
      const transactionId = getTransactionId(
        transaction.from,
        transaction.to,
        transaction.expenseId
      );
      const isPaid = paymentStatuses[transactionId]
        ? 'Đã thanh toán'
        : 'Chưa thanh toán';

      csvContent += `"${fromName}","${fromRoom}","${toName}","${toRoom}","${description}","${date}","${amount}","${isPaid}"\n`;
    });

    // Thêm phần tổng hợp ai nợ ai
    csvContent += '\n\nTổng hợp khoản nợ\n';
    csvContent += 'Người trả,Phòng,Người nhận,Phòng,Tổng số tiền\n';

    // Tạo bảng tổng hợp ai nợ ai
    const debtSummary: Record<
      string,
      {
        from: string;
        fromRoom: string;
        to: string;
        toRoom: string;
        amount: number;
      }
    > = {};

    filteredTransactions.forEach((transaction) => {
      const key = `${transaction.from}-${transaction.to}`;
      if (!debtSummary[key]) {
        debtSummary[key] = {
          from: transaction.from,
          fromRoom:
            roommates.find((r) => r.id === transaction.from)?.room || '',
          to: transaction.to,
          toRoom: roommates.find((r) => r.id === transaction.to)?.room || '',
          amount: 0,
        };
      }
      debtSummary[key].amount += transaction.amount;
    });

    // Thêm tổng hợp vào CSV
    Object.values(debtSummary).forEach((summary) => {
      const fromName = getRoommateName(summary.from);
      const toName = getRoommateName(summary.to);
      const amount = formatCurrency(summary.amount);
      csvContent += `"${fromName}","${summary.fromRoom}","${toName}","${summary.toRoom}","${amount}"\n`;
    });

    // Tạo blob với BOM (Byte Order Mark) để đảm bảo Excel hiển thị đúng ký tự Unicode
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const monthText = selectedMonth === 'all' ? 'tat-ca' : selectedMonth;
    link.setAttribute('download', `thanh-toan-${monthText}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Xử lý mở rộng/thu gọn tất cả các nhóm
  const toggleAllGroups = (expand: boolean) => {
    const newExpandedGroups: Record<string, boolean> = {};
    groupedTransactions.forEach((group) => {
      newExpandedGroups[group.description] = expand;
    });
    setExpandedGroups(newExpandedGroups);
  };

  // Xử lý mở rộng/thu gọn một nhóm
  const toggleGroup = (description: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [description]: !prev[description],
    }));
  };

  const availableMonths = getAvailableMonths();
  const totalByRecipient = getTotalByRecipient();
  const totalByPayer = getTotalByPayer();

  // Tính số giao dịch đã thanh toán
  const paidTransactionsCount = filteredTransactions.filter((t) => {
    const id = getTransactionId(t.from, t.to, t.expenseId);
    return paymentStatuses[id];
  }).length;

  // Tính tổng số tiền
  const totalAmount = filteredTransactions.reduce(
    (sum, t) => sum + t.amount,
    0
  );

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row gap-2 items-center justify-between">
        <div>
          <CardTitle>Kế hoạch thanh toán</CardTitle>
          <CardDescription>
            Để thanh toán tất cả chi phí, các khoản thanh toán sau đây cần được
            thực hiện:
          </CardDescription>
        </div>
        <div className="flex space-x-2">
          {!tableExists && (
            <Button
              variant="outline"
              size="sm"
              onClick={createPaymentStatusTable}
              disabled={isCreatingTable}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              {isCreatingTable ? 'Đang tạo bảng...' : 'Tạo bảng thanh toán'}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" /> Bộ lọc
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <div className="p-2">
                <div className="mb-2">
                  <p className="text-sm font-medium mb-1">Lọc theo tháng:</p>
                  <select
                    className="w-full text-sm border rounded px-2 py-1"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  >
                    <option value="all">Tất cả</option>
                    {availableMonths.map((month) => {
                      const [year, monthNum] = month.split('-');
                      return (
                        <option key={month} value={month}>
                          Tháng {monthNum}/{year}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="mb-2">
                  <p className="text-sm font-medium mb-1">Người trả:</p>
                  <select
                    className="w-full text-sm border rounded px-2 py-1"
                    value={selectedPayer || ''}
                    onChange={(e) => setSelectedPayer(e.target.value || null)}
                  >
                    <option value="">Tất cả</option>
                    {roommates.map((roommate) => (
                      <option key={roommate.id} value={roommate.id}>
                        {roommate.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-2">
                  <p className="text-sm font-medium mb-1">Người nhận:</p>
                  <select
                    className="w-full text-sm border rounded px-2 py-1"
                    value={selectedReceiver || ''}
                    onChange={(e) =>
                      setSelectedReceiver(e.target.value || null)
                    }
                  >
                    <option value="">Tất cả</option>
                    {roommates.map((roommate) => (
                      <option key={roommate.id} value={roommate.id}>
                        {roommate.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-2 flex items-center space-x-2">
                  <Checkbox
                    id="hidePaid"
                    checked={hidePaid}
                    onCheckedChange={(checked) => setHidePaid(!!checked)}
                  />
                  <Label htmlFor="hidePaid">Ẩn khoản đã thanh toán</Label>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => {
                    setSelectedPayer(null);
                    setSelectedReceiver(null);
                    setSelectedMonth('all');
                    setHidePaid(false);
                  }}
                >
                  Xóa bộ lọc
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {detailedTransactions.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Xuất CSV
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!tableExists && (
          <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded-md border border-yellow-200">
            <p className="text-sm">
              <strong>Lưu ý:</strong> Bảng dữ liệu thanh toán chưa được tạo. Bạn
              vẫn có thể đánh dấu thanh toán, nhưng dữ liệu sẽ chỉ được lưu cục
              bộ trên trình duyệt này. Nhấn nút "Tạo bảng thanh toán" để lưu trữ
              dữ liệu lâu dài.
            </p>
          </div>
        )}

        {detailedTransactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            {!hasRoommates
              ? 'Thêm thành viên và chi phí để tạo kế hoạch thanh toán.'
              : !hasExpenses
              ? 'Thêm chi phí để tạo kế hoạch thanh toán.'
              : 'Không cần thanh toán. Tất cả số dư đã được cân bằng!'}
          </p>
        ) : (
          <div className="space-y-4">
            <Tabs
              defaultValue="all"
              value={activeTab}
              onValueChange={setActiveTab}
            >
              <TabsList className="mb-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-2 mb-8">
                <TabsTrigger value="all">Tất cả</TabsTrigger>
                <TabsTrigger value="expense">Khoản chi</TabsTrigger>
                <TabsTrigger value="income">Khoản thu</TabsTrigger>
                <TabsTrigger value="paid">Đã thanh toán</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                <div className="flex flex-col space-y-4">
                  {/* Thanh tìm kiếm và công cụ */}
                  <div className="flex flex-col md:flex-row justify-between gap-2 mb-2">
                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Tìm kiếm..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      {searchTerm && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full"
                          onClick={() => setSearchTerm('')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-col md:flex-row items-center gap-2">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setViewMode(
                              viewMode === 'list' ? 'grouped' : 'list'
                            )
                          }
                        >
                          {viewMode === 'list'
                            ? 'Xem theo nhóm'
                            : 'Xem danh sách'}
                        </Button>
                      </div>
                      {viewMode === 'grouped' && (
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleAllGroups(true)}
                          >
                            <ChevronDown className="h-4 w-4 mr-1" /> Mở tất cả
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleAllGroups(false)}
                          >
                            <ChevronUp className="h-4 w-4 mr-1" /> Thu gọn tất
                            cả
                          </Button>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHidePaid(!hidePaid)}
                          className={hidePaid ? 'bg-muted' : ''}
                        >
                          {hidePaid ? (
                            <>
                              <Eye className="h-4 w-4 mr-1" /> Hiện tất cả
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-4 w-4 mr-1" /> Ẩn đã thanh
                              toán
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Hiển thị theo chế độ xem */}
                  {viewMode === 'list' ? (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Người trả</TableHead>
                            <TableHead>Người nhận</TableHead>
                            <TableHead>Mô tả</TableHead>
                            <TableHead className="text-right">
                              Số tiền
                            </TableHead>
                            <TableHead className="text-center">
                              Trạng thái
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTransactions.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="text-center py-4 text-muted-foreground"
                              >
                                Không có dữ liệu thanh toán cho bộ lọc đã chọn
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredTransactions.map((transaction, index) => {
                              const transactionId = getTransactionId(
                                transaction.from,
                                transaction.to,
                                transaction.expenseId
                              );
                              const isPaid =
                                paymentStatuses[transactionId] || false;
                              const sharedCount = transaction.sharedWith.length;

                              return (
                                <TableRow
                                  key={index}
                                  className="cursor-pointer hover:bg-muted/80"
                                  onClick={() =>
                                    setSelectedTransaction(transaction)
                                  }
                                >
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-1">
                                      {getRoommateName(transaction.from)}
                                      {sharedCount > 1 && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Badge
                                                variant="outline"
                                                className="ml-1"
                                              >
                                                +{sharedCount - 1}
                                              </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>
                                                Chia sẻ với {sharedCount} người
                                              </p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {getRoommateName(transaction.to)}
                                  </TableCell>
                                  <TableCell>
                                    {transaction.expenseDescription}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(transaction.amount)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center">
                                      <Checkbox
                                        checked={isPaid}
                                        onCheckedChange={(checked) => {
                                          updatePaymentStatus(
                                            transaction.from,
                                            transaction.to,
                                            transaction.amount,
                                            checked as boolean,
                                            transaction.expenseId
                                          );
                                        }}
                                        disabled={isLoading}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <span
                                        className={`ml-2 text-xs ${
                                          isPaid
                                            ? 'text-green-600'
                                            : 'text-amber-600'
                                        }`}
                                      >
                                        {isPaid
                                          ? 'Đã thanh toán'
                                          : 'Chưa thanh toán'}
                                      </span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="border rounded-md overflow-hidden">
                      {groupedTransactions.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                          Không có dữ liệu thanh toán cho bộ lọc đã chọn
                        </div>
                      ) : (
                        <Accordion
                          type="multiple"
                          className="w-full"
                          value={Object.keys(expandedGroups).filter(
                            (key) => expandedGroups[key]
                          )}
                        >
                          {groupedTransactions.map((group) => (
                            <AccordionItem
                              key={group.description}
                              value={group.description}
                            >
                              <AccordionTrigger
                                onClick={(e) => {
                                  e.preventDefault();
                                  toggleGroup(group.description);
                                }}
                                className="px-4 py-2 hover:bg-muted/50"
                              >
                                <div className="flex justify-between items-center w-full pr-4">
                                  <div className="flex items-center">
                                    <span className="font-medium">
                                      {group.description}
                                    </span>
                                    <Badge className="ml-2" variant="secondary">
                                      {group.transactions.length}
                                    </Badge>
                                  </div>
                                  <span className="font-bold">
                                    {formatCurrency(group.totalAmount)}
                                  </span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="px-4 pb-2">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Người trả</TableHead>
                                        <TableHead>Người nhận</TableHead>
                                        <TableHead className="text-right">
                                          Số tiền
                                        </TableHead>
                                        <TableHead className="text-center">
                                          Trạng thái
                                        </TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {group.transactions.map(
                                        (transaction, index) => {
                                          const transactionId =
                                            getTransactionId(
                                              transaction.from,
                                              transaction.to,
                                              transaction.expenseId
                                            );
                                          const isPaid =
                                            paymentStatuses[transactionId] ||
                                            false;

                                          return (
                                            <TableRow
                                              key={index}
                                              className="cursor-pointer hover:bg-muted/80"
                                              onClick={() =>
                                                setSelectedTransaction(
                                                  transaction
                                                )
                                              }
                                            >
                                              <TableCell>
                                                {getRoommateName(
                                                  transaction.from
                                                )}
                                              </TableCell>
                                              <TableCell>
                                                {getRoommateName(
                                                  transaction.to
                                                )}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {formatCurrency(
                                                  transaction.amount
                                                )}
                                              </TableCell>
                                              <TableCell className="text-center">
                                                <div className="flex items-center justify-center">
                                                  <Checkbox
                                                    checked={isPaid}
                                                    onCheckedChange={(
                                                      checked
                                                    ) => {
                                                      updatePaymentStatus(
                                                        transaction.from,
                                                        transaction.to,
                                                        transaction.amount,
                                                        checked as boolean,
                                                        transaction.expenseId
                                                      );
                                                    }}
                                                    disabled={isLoading}
                                                    onClick={(e) =>
                                                      e.stopPropagation()
                                                    }
                                                  />
                                                  <span
                                                    className={`ml-2 text-xs ${
                                                      isPaid
                                                        ? 'text-green-600'
                                                        : 'text-amber-600'
                                                    }`}
                                                  >
                                                    {isPaid
                                                      ? 'Đã thanh toán'
                                                      : 'Chưa thanh toán'}
                                                  </span>
                                                </div>
                                              </TableCell>
                                            </TableRow>
                                          );
                                        }
                                      )}
                                    </TableBody>
                                  </Table>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      )}
                    </div>
                  )}

                  <div className="mt-6 p-4 bg-muted rounded-md">
                    <h3 className="font-semibold mb-3">Tổng quan thanh toán</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white p-3 rounded-md shadow-sm">
                        <p className="text-sm text-muted-foreground">
                          Tổng số giao dịch
                        </p>
                        <p className="text-2xl font-bold">
                          {filteredTransactions.length}
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded-md shadow-sm">
                        <p className="text-sm text-muted-foreground">
                          Đã thanh toán
                        </p>
                        <p className="text-2xl font-bold text-green-600">
                          {paidTransactionsCount}
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded-md shadow-sm">
                        <p className="text-sm text-muted-foreground">
                          Chưa thanh toán
                        </p>
                        <p className="text-2xl font-bold text-amber-600">
                          {filteredTransactions.length - paidTransactionsCount}
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded-md shadow-sm">
                        <p className="text-sm text-muted-foreground ">
                          Tổng số tiền
                        </p>
                        <p className="text-md md:text-2xl font-bold">
                          {formatCurrency(totalAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Dialog chi tiết giao dịch */}
            <Dialog
              open={!!selectedTransaction}
              onOpenChange={(open) => !open && setSelectedTransaction(null)}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Chi tiết giao dịch</DialogTitle>
                  <DialogDescription>
                    Thông tin chi tiết về khoản thanh toán
                  </DialogDescription>
                </DialogHeader>

                {selectedTransaction && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Ngày giao dịch
                        </p>
                        <p className="font-medium">
                          {format(
                            new Date(selectedTransaction.date),
                            'dd/MM/yyyy',
                            { locale: vi }
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Số tiền</p>
                        <p className="font-medium">
                          {formatCurrency(selectedTransaction.amount)}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Mô tả</p>
                      <p className="font-medium">
                        {selectedTransaction.expenseDescription}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Người trả
                        </p>
                        <p className="font-medium">
                          {getRoommateName(selectedTransaction.from)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {
                            roommates.find(
                              (r) => r.id === selectedTransaction.from
                            )?.room
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Người nhận
                        </p>
                        <p className="font-medium">
                          {getRoommateName(selectedTransaction.to)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {
                            roommates.find(
                              (r) => r.id === selectedTransaction.to
                            )?.room
                          }
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">
                        Chia sẻ với
                      </p>
                      <div className="mt-1 space-y-1">
                        {selectedTransaction.sharedWith.map((id) => (
                          <div key={id} className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-primary mr-2"></div>
                            <span>{getRoommateName(id)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t pt-4 mt-4">
                      <p className="text-sm text-muted-foreground mb-2">
                        Trạng thái thanh toán
                      </p>
                      <div className="flex items-center">
                        <Checkbox
                          checked={
                            paymentStatuses[
                              getTransactionId(
                                selectedTransaction.from,
                                selectedTransaction.to,
                                selectedTransaction.expenseId
                              )
                            ] || false
                          }
                          onCheckedChange={(checked) => {
                            updatePaymentStatus(
                              selectedTransaction.from,
                              selectedTransaction.to,
                              selectedTransaction.amount,
                              checked as boolean,
                              selectedTransaction.expenseId
                            );
                          }}
                          disabled={isLoading}
                        />
                        <span className="ml-2">Đánh dấu là đã thanh toán</span>
                      </div>
                    </div>
                  </div>
                )}

                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Đóng
                  </Button>
                </DialogClose>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
