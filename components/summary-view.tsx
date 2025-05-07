'use client';

import type React from 'react';

import { useState, useMemo, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Filter,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  X,
  Share2,
  QrCode,
  Download,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency } from '@/lib/utils';
import type { Roommate, Expense } from './expense-tracker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface RoommateQRCode {
  roommate_id: string;
  qr_image_url: string;
}

interface SummaryViewProps {
  totalExpenses: number;
  balances: Record<string, number>;
  roommates: Roommate[];
  expenses: Expense[];
  qrCodes?: Record<string, RoommateQRCode[]>;
}

export default function SummaryView({
  totalExpenses,
  balances,
  roommates,
  expenses,
  qrCodes,
}: SummaryViewProps) {
  const [selectedRoommate, setSelectedRoommate] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'debts' | 'credits' | null>(
    null
  );
  const [expandedExpenses, setExpandedExpenses] = useState<
    Record<string, boolean>
  >({});
  const [activeTab, setActiveTab] = useState('balances');
  const debtListRef = useRef<HTMLDivElement>(null);

  // Tính toán số dư dương (tín dụng) và số dư âm (nợ) cho mỗi thành viên
  const { positiveBalances, negativeBalances, totalPositive, totalNegative } =
    useMemo(() => {
      const positive: Record<string, number> = {};
      const negative: Record<string, number> = {};
      let totalPos = 0;
      let totalNeg = 0;

      Object.entries(balances).forEach(([id, balance]) => {
        if (balance > 0) {
          positive[id] = balance;
          totalPos += balance;
        } else if (balance < 0) {
          negative[id] = Math.abs(balance);
          totalNeg += Math.abs(balance);
        }
      });

      return {
        positiveBalances: positive,
        negativeBalances: negative,
        totalPositive: totalPos,
        totalNegative: totalNeg,
      };
    }, [balances]);

  // Tạo danh sách chi tiết khoản nợ giữa các thành viên
  const detailedDebts = useMemo(() => {
    const result: {
      from: string;
      to: string;
      amount: number;
      details: {
        description: string;
        amount: number;
        date: Date;
        multiplier?: number;
      }[];
    }[] = [];

    // Nếu không có bộ lọc, trả về danh sách trống
    if (!selectedRoommate) return result;

    // Lọc các chi phí liên quan đến thành viên đã chọn
    expenses.forEach((expense) => {
      const paidBy = expense.paidBy;
      const sharedWith = expense.sharedWith;
      const multipliers = expense.shareMultipliers || {};

      // Bỏ qua nếu không có ai chia sẻ
      if (sharedWith.length === 0) return;

      // Tính tổng hệ số
      let totalMultiplier = 0;
      sharedWith.forEach((roommateId) => {
        totalMultiplier += multipliers[roommateId] || 1;
      });

      // Trường hợp 1: Thành viên đã chọn là người trả tiền (có người khác nợ họ)
      if (filterType === 'credits' && paidBy === selectedRoommate) {
        sharedWith.forEach((roommateId) => {
          // Bỏ qua nếu người chia sẻ cũng là người trả tiền
          if (roommateId === paidBy) return;

          const roommateMultiplier = multipliers[roommateId] || 1;
          const amountForRoommate = Math.round(
            (expense.amount * roommateMultiplier) / totalMultiplier
          );

          // Tìm khoản nợ hiện có hoặc tạo mới
          const debtIndex = result.findIndex(
            (debt) => debt.from === roommateId && debt.to === paidBy
          );
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
                  multiplier:
                    roommateMultiplier > 1 ? roommateMultiplier : undefined,
                },
              ],
            });
          } else {
            result[debtIndex].amount += amountForRoommate;
            result[debtIndex].details.push({
              description: expense.description,
              amount: amountForRoommate,
              date: expense.date,
              multiplier:
                roommateMultiplier > 1 ? roommateMultiplier : undefined,
            });
          }
        });
      }

      // Trường hợp 2: Thành viên đã chọn là người chia sẻ chi phí (họ nợ người khác)
      if (
        filterType === 'debts' &&
        sharedWith.includes(selectedRoommate) &&
        paidBy !== selectedRoommate
      ) {
        const roommateMultiplier = multipliers[selectedRoommate] || 1;
        const amountForRoommate = Math.round(
          (expense.amount * roommateMultiplier) / totalMultiplier
        );

        // Tìm khoản nợ hiện có hoặc tạo mới
        const debtIndex = result.findIndex(
          (debt) => debt.from === selectedRoommate && debt.to === paidBy
        );
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
                multiplier:
                  roommateMultiplier > 1 ? roommateMultiplier : undefined,
              },
            ],
          });
        } else {
          result[debtIndex].amount += amountForRoommate;
          result[debtIndex].details.push({
            description: expense.description,
            amount: amountForRoommate,
            date: expense.date,
            multiplier: roommateMultiplier > 1 ? roommateMultiplier : undefined,
          });
        }
      }
    });

    // Sắp xếp theo số tiền giảm dần
    return result.sort((a, b) => b.amount - a.amount);
  }, [selectedRoommate, filterType, expenses]);

  // Xử lý mở rộng/thu gọn chi tiết chi phí
  const toggleExpenseDetails = (debtId: string) => {
    setExpandedExpenses((prev) => ({
      ...prev,
      [debtId]: !prev[debtId],
    }));
  };

  // Xóa bộ lọc
  const clearFilter = () => {
    setSelectedRoommate(null);
    setFilterType(null);
  };

  // Lấy tên thành viên theo ID
  const getRoommateName = (id: string) => {
    const roommate = roommates.find((r) => r.id === id);
    return roommate ? roommate.name : 'Không xác định';
  };

  // Lấy phòng của thành viên theo ID
  const getRoommateRoom = (id: string) => {
    const roommate = roommates.find((r) => r.id === id);
    return roommate ? roommate.room : '';
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <CardTitle>Tổng kết chi tiêu</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-1">
            <span>Tổng chi tiêu: {formatCurrency(totalExpenses)}</span>
            {selectedRoommate && (
              <Badge
                variant="outline"
                className="ml-2 flex items-center gap-1 mt-1 sm:mt-0"
              >
                <span className="truncate max-w-[150px]">
                  {getRoommateName(selectedRoommate)}
                  {filterType === 'debts' ? ' (Khoản nợ)' : ' (Khoản được nợ)'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 ml-1 p-0"
                  onClick={clearFilter}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
          </CardDescription>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={!roommates.length}
              className="whitespace-nowrap"
            >
              <Filter className="h-4 w-4 mr-2" /> Bộ lọc
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <div className="p-2">
              <div className="mb-2">
                <p className="text-sm font-medium mb-1">Lọc theo thành viên:</p>
                <select
                  className="w-full text-sm border rounded px-2 py-1"
                  value={selectedRoommate || ''}
                  onChange={(e) => {
                    setSelectedRoommate(e.target.value || null);
                    if (e.target.value && !filterType) {
                      setFilterType('debts');
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
                      variant={filterType === 'debts' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setFilterType('debts')}
                    >
                      Khoản nợ
                    </Button>
                    <Button
                      size="sm"
                      variant={filterType === 'credits' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setFilterType('credits')}
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
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="balances">Số dư</TabsTrigger>
            <TabsTrigger value="details">Chi tiết</TabsTrigger>
            <TabsTrigger value="debtList">Danh sách nợ</TabsTrigger>
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
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Không có khoản được nợ
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(positiveBalances)
                          .sort(([, a], [, b]) => b - a)
                          .map(([id, balance]) => (
                            <div
                              key={id}
                              className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer"
                              onClick={() => {
                                setSelectedRoommate(id);
                                setFilterType('credits');
                              }}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {getRoommateName(id)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {getRoommateRoom(id)}
                                </span>
                              </div>
                              <span className="font-semibold text-green-600">
                                {formatCurrency(balance)}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </ScrollArea>
                  <div className="mt-4 pt-2 border-t flex justify-between items-center">
                    <span className="text-sm font-medium">Tổng cộng:</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(totalPositive)}
                    </span>
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
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Không có khoản nợ
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(negativeBalances)
                          .sort(([, a], [, b]) => b - a)
                          .map(([id, balance]) => (
                            <div
                              key={id}
                              className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer"
                              onClick={() => {
                                setSelectedRoommate(id);
                                setFilterType('debts');
                              }}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {getRoommateName(id)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {getRoommateRoom(id)}
                                </span>
                              </div>
                              <span className="font-semibold text-red-600">
                                {formatCurrency(balance)}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </ScrollArea>
                  <div className="mt-4 pt-2 border-t flex justify-between items-center">
                    <span className="text-sm font-medium">Tổng cộng:</span>
                    <span className="font-bold text-red-600">
                      {formatCurrency(totalNegative)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="details">
            {!selectedRoommate ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Chọn một thành viên để xem chi tiết khoản nợ
                </p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!roommates.length}
                      className="whitespace-nowrap"
                    >
                      <Filter className="h-4 w-4 mr-2" /> Chọn thành viên
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <div className="p-2">
                      <div className="mb-2">
                        <p className="text-sm font-medium mb-1">
                          Lọc theo thành viên:
                        </p>
                        <select
                          className="w-full text-sm border rounded px-2 py-1"
                          value={selectedRoommate || ''}
                          onChange={(e) => {
                            setSelectedRoommate(e.target.value || null);
                            if (e.target.value && !filterType) {
                              setFilterType('debts');
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
                          <p className="text-sm font-medium mb-1">
                            Loại khoản:
                          </p>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant={
                                filterType === 'debts' ? 'default' : 'outline'
                              }
                              className="flex-1"
                              onClick={() => setFilterType('debts')}
                            >
                              Khoản nợ
                            </Button>
                            <Button
                              size="sm"
                              variant={
                                filterType === 'credits' ? 'default' : 'outline'
                              }
                              className="flex-1"
                              onClick={() => setFilterType('credits')}
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
              </div>
            ) : detailedDebts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {filterType === 'debts'
                    ? `${getRoommateName(selectedRoommate)} không nợ ai cả`
                    : `Không ai nợ ${getRoommateName(selectedRoommate)} cả`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted p-3 rounded-md">
                  <h3 className="font-medium mb-1">
                    {filterType === 'debts'
                      ? `${getRoommateName(selectedRoommate)} đang nợ:`
                      : `Những người đang nợ ${getRoommateName(
                          selectedRoommate
                        )}:`}
                  </h3>
                </div>

                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {detailedDebts.map((debt, index) => {
                      const debtId = `${debt.from}-${debt.to}-${index}`;
                      const isExpanded = expandedExpenses[debtId] || false;

                      return (
                        <Card key={debtId} className="overflow-hidden">
                          <div
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleExpenseDetails(debtId)}
                          >
                            <div className="flex items-center">
                              <div className="mr-3">
                                {filterType === 'debts' ? (
                                  <ArrowRight className="h-5 w-5 text-amber-500" />
                                ) : (
                                  <ArrowLeft className="h-5 w-5 text-green-500" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">
                                  {filterType === 'debts'
                                    ? getRoommateName(debt.to)
                                    : getRoommateName(debt.from)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {filterType === 'debts'
                                    ? getRoommateRoom(debt.to)
                                    : getRoommateRoom(debt.from)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">
                                {formatCurrency(
                                  Math.ceil(debt.amount / 1000) * 1000
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {debt.details.length} khoản chi tiêu
                              </p>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-4 pb-4 pt-2 border-t">
                              <p className="text-sm font-medium mb-2">
                                Chi tiết các khoản:
                              </p>
                              <div className="space-y-2">
                                {debt.details
                                  .sort((a, b) => b.amount - a.amount)
                                  .map((detail, detailIndex) => (
                                    <div
                                      key={detailIndex}
                                      className="flex justify-between items-center p-2 rounded-md bg-muted/50"
                                    >
                                      <div className="flex-1">
                                        <p className="font-medium">
                                          {detail.description}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {new Date(
                                            detail.date
                                          ).toLocaleDateString('vi-VN')}
                                          {detail.multiplier && (
                                            <Badge
                                              variant="secondary"
                                              className="ml-2"
                                            >
                                              x{detail.multiplier}
                                            </Badge>
                                          )}
                                        </p>
                                      </div>
                                      <p className="font-semibold">
                                        {formatCurrency(detail.amount)}
                                      </p>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </TabsContent>
          <TabsContent value="debtList">
            <DebtListView
              roommates={roommates}
              expenses={expenses}
              balances={balances}
              qrCodes={qrCodes}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface DebtListViewProps {
  roommates: Roommate[];
  expenses: Expense[];
  balances: Record<string, number>;
  qrCodes?: Record<string, RoommateQRCode[]>;
  onScreenshotCapture?: (dataUrl: string) => void;
}

function DebtListView({
  roommates,
  expenses,
  balances,
  qrCodes,
  onScreenshotCapture,
}: DebtListViewProps) {
  const [selectedCreditor, setSelectedCreditor] = useState<string | null>(null);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showQRCode2, setShowQRCode2] = useState(false);
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [amount, setAmount] = useState(0);

  // Lấy tên thành viên theo ID
  const getRoommateName = (id: string) => {
    const roommate = roommates.find((r) => r.id === id);
    return roommate ? roommate.name : 'Không xác định';
  };

  // Lấy phòng của thành viên theo ID
  const getRoommateRoom = (id: string) => {
    const roommate = roommates.find((r) => r.id === id);
    return roommate ? roommate.room : '';
  };

  // Lọc những người có số dư dương (được nợ)
  const creditors = useMemo(() => {
    return roommates
      .filter((roommate) => balances[roommate.id] > 0)
      .sort((a, b) => balances[b.id] - balances[a.id]);
  }, [roommates, balances]);

  // Tạo danh sách chi tiết khoản nợ cho người được chọn
  const debtorsList = useMemo(() => {
    if (!selectedCreditor) return [];

    const result: {
      debtorId: string;
      amount: number;
      details: {
        description: string;
        amount: number;
        date: Date;
        multiplier?: number;
      }[];
    }[] = [];

    // Lọc các chi phí liên quan đến người được chọn
    expenses.forEach((expense) => {
      const paidBy = expense.paidBy;
      const sharedWith = expense.sharedWith;
      const multipliers = expense.shareMultipliers || {};

      // Bỏ qua nếu không có ai chia sẻ
      if (sharedWith.length === 0) return;

      // Chỉ xử lý khi người được chọn là người trả tiền
      if (paidBy === selectedCreditor) {
        // Tính tổng hệ số
        let totalMultiplier = 0;
        sharedWith.forEach((roommateId) => {
          totalMultiplier += multipliers[roommateId] || 1;
        });

        sharedWith.forEach((roommateId) => {
          // Bỏ qua nếu người chia sẻ cũng là người trả tiền
          if (roommateId === paidBy) return;

          const roommateMultiplier = multipliers[roommateId] || 1;
          const amountForRoommate = Math.round(
            (expense.amount * roommateMultiplier) / totalMultiplier
          );

          // Tìm khoản nợ hiện có hoặc tạo mới
          const debtorIndex = result.findIndex(
            (debtor) => debtor.debtorId === roommateId
          );
          if (debtorIndex === -1) {
            result.push({
              debtorId: roommateId,
              amount: amountForRoommate,
              details: [
                {
                  description: expense.description,
                  amount: amountForRoommate,
                  date: expense.date,
                  multiplier:
                    roommateMultiplier > 1 ? roommateMultiplier : undefined,
                },
              ],
            });
          } else {
            result[debtorIndex].amount += amountForRoommate;
            result[debtorIndex].details.push({
              description: expense.description,
              amount: amountForRoommate,
              date: expense.date,
              multiplier:
                roommateMultiplier > 1 ? roommateMultiplier : undefined,
            });
          }
        });
      }
    });

    // Sắp xếp theo số tiền giảm dần
    return result.sort((a, b) => b.amount - a.amount);
  }, [selectedCreditor, expenses]);

  // Tính tổng số tiền nợ
  const totalDebt = useMemo(() => {
    return debtorsList.reduce((sum, debtor) => sum + debtor.amount, 0);
  }, [debtorsList]);

  // Xử lý chia sẻ danh sách nợ
  const handleShare = () => {
    // Tạo nội dung để chia sẻ
    const text =
      `Danh sách khoản nợ của ${getRoommateName(selectedCreditor!)}\n\n` +
      debtorsList
        .map(
          (debtor) =>
            `${getRoommateName(debtor.debtorId)}: ${formatCurrency(
              Math.ceil(debtor.amount / 1000) * 1000
            )}`
        )
        .join('\n') +
      `\n\nTổng cộng: ${formatCurrency(totalDebt)}`;

    setShowShareOptions(true);
  };

  // Xử lý sao chép danh sách nợ
  const handleCopy = () => {
    const text =
      `Danh sách khoản nợ của ${getRoommateName(selectedCreditor!)}\n\n` +
      debtorsList
        .map(
          (debtor) =>
            `${getRoommateName(debtor.debtorId)}: ${formatCurrency(
              Math.ceil(debtor.amount / 1000) * 1000
            )}`
        )
        .join('\n') +
      `\n\nTổng cộng: ${formatCurrency(totalDebt)}`;

    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert('Đã sao chép danh sách nợ vào clipboard');
        setShowShareOptions(false);
      })
      .catch((err) => {
        console.error('Lỗi khi sao chép:', err);
      });
  };

  // Hiển thị QR code
  const handleShowQRCode = () => {
    setShowQRCode(true);
  };

  const handleShowQRCode2 = (amount: number) => {
    setShowQRCode2(true);
    setAmount(amount);
  };

  // Tải xuống QR code
  const handleDownloadQRCode = () => {
    if (!qrCodeRef.current) return;

    try {
      const imgElement = qrCodeRef.current.querySelector('img');
      if (imgElement) {
        // Nếu là hình ảnh có sẵn
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = imgElement.naturalWidth || 250;
        canvas.height = imgElement.naturalHeight || 250;

        ctx?.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `qrcode_${getRoommateName(
          selectedCreditor!
        )}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        return;
      }

      const svgElement = qrCodeRef.current.querySelector('svg');
      if (!svgElement) return;

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Tạo một Image object để vẽ SVG lên canvas
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);

        // Chuyển canvas thành URL và tạo link tải xuống
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `qrcode_${getRoommateName(
          selectedCreditor!
        )}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      };

      // Chuyển SVG thành data URL
      img.src =
        'data:image/svg+xml;base64,' +
        btoa(unescape(encodeURIComponent(svgData)));
    } catch (error) {
      console.error('Lỗi khi tải xuống QR code:', error);
      alert('Có lỗi xảy ra khi tải xuống QR code');
    }
  };

  // Kiểm tra xem người dùng có QR code không
  const hasQRCode = (roommateId: string) => {
    console.log('first', qrCodes, roommateId);
    return qrCodes && qrCodes[roommateId] && qrCodes[roommateId].length > 0;
  };

  // Lấy QR code URL của người dùng
  const getQRCodeURL = (roommateId: string) => {
    if (!qrCodes || !qrCodes[roommateId] || qrCodes[roommateId].length === 0)
      return null;

    // Ưu tiên QR code có hình ảnh
    const qrWithImage = qrCodes[roommateId].find((qr) => qr.qr_image_url);
    if (qrWithImage) return qrWithImage.qr_image_url;

    return null;
  };

  if (creditors.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Không có ai được nợ tiền</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-muted p-4 rounded-md">
        <h3 className="font-medium mb-2">Chọn người để xem danh sách nợ</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {creditors.map((creditor) => (
            <Button
              key={creditor.id}
              variant={selectedCreditor === creditor.id ? 'default' : 'outline'}
              className="justify-start"
              onClick={() => setSelectedCreditor(creditor.id)}
            >
              <div className="flex flex-col items-start">
                <span>{creditor.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(balances[creditor.id])}
                </span>
              </div>
            </Button>
          ))}
        </div>
      </div>

      {selectedCreditor && (
        <Card id="debt-list-card" className="overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground pb-2">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Danh sách khoản nợ</CardTitle>
                <CardDescription className="text-primary-foreground/80">
                  Những người đang nợ {getRoommateName(selectedCreditor)}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {hasQRCode(selectedCreditor) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleShowQRCode}
                    className="whitespace-nowrap"
                  >
                    <QrCode className="h-4 w-4 mr-2" /> QR Code
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleShare}
                  className="whitespace-nowrap"
                >
                  <Share2 className="h-4 w-4 mr-2" /> Chia sẻ
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4 bg-primary/5">
              <div className="flex justify-between items-center">
                <span className="font-medium">Người nợ</span>
                <span className="font-medium">Số tiền</span>
              </div>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <div className="divide-y">
                {debtorsList.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Không có ai nợ {getRoommateName(selectedCreditor)}
                  </div>
                ) : (
                  debtorsList.map((debtor) => (
                    <div
                      key={debtor.debtorId}
                      className="p-4 hover:bg-muted/50"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">
                            {getRoommateName(debtor.debtorId)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {getRoommateRoom(debtor.debtorId)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {debtor.details.length} khoản chi tiêu
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="text-right font-bold">
                            {formatCurrency(
                              Math.ceil(debtor.amount / 1000) * 1000
                            )}
                          </div>
                          <div
                            className="flex items-center text-sm text-muted-foreground cursor-pointer hover:text-primary"
                            onClick={() => {
                              handleShowQRCode2(debtor.amount);
                            }}
                          >
                            <QrCode className="h-4 w-4 mr-2" /> QR Code
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="p-4 bg-primary/5 border-t">
              <div className="flex justify-between items-center">
                <span className="font-medium">Tổng cộng</span>
                <span className="font-bold text-lg">
                  {formatCurrency(Math.ceil(totalDebt / 1000) * 1000)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog chia sẻ */}
      <Dialog open={showShareOptions} onOpenChange={setShowShareOptions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chia sẻ danh sách nợ</DialogTitle>
            <DialogDescription>
              Chọn cách bạn muốn chia sẻ danh sách nợ
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button onClick={handleCopy} className="w-full">
              Sao chép vào clipboard
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const element = document.getElementById('debt-list-card');
                if (element) {
                  alert('Chụp màn hình phần danh sách nợ để chia sẻ');
                }
                setShowShareOptions(false);
              }}
              className="w-full"
            >
              Chụp màn hình để chia sẻ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog QR Code */}
      <Dialog
        open={showQRCode || showQRCode2}
        onOpenChange={(isOpen) => {
          setShowQRCode(isOpen);
          setShowQRCode2(isOpen);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              QR Code của {getRoommateName(selectedCreditor!)}
            </DialogTitle>
            <DialogDescription>
              Quét mã QR này để xem thông tin khoản nợ
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-4">
            <div ref={qrCodeRef} className="bg-white p-4 rounded-lg">
              {hasQRCode(selectedCreditor!) ? (
                <img
                  src={getQRCodeURL(selectedCreditor!) || '/placeholder.svg'}
                  alt={`QR code for ${getRoommateName(selectedCreditor!)}`}
                  className="w-[250px] h-[250px] object-contain"
                />
              ) : (
                <p className="text-muted-foreground text-center">
                  Không có QR code cho {getRoommateName(selectedCreditor!)}
                </p>
              )}
            </div>
            <div className="mt-4 text-center">
              <p className="font-medium">
                Tổng nợ:{' '}
                {showQRCode2
                  ? formatCurrency(Math.ceil(amount / 1000) * 1000)
                  : formatCurrency(totalDebt)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleDownloadQRCode} className="w-full">
              <Download className="h-4 w-4 mr-2" /> Tải xuống QR Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
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
  );
}
