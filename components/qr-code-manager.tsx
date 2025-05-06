'use client';

import type React from 'react';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Download,
  Copy,
  Check,
  Trash2,
  CreditCard,
  QrCode,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Roommate } from './expense-tracker';

interface QRCodeManagerProps {
  roommates: Roommate[];
  householdId: string;
  isAdmin: boolean;
  currentUserId: string;
}

interface RoommateQRCode {
  id: string;
  roommate_id: string;
  qr_type: string;
  qr_label?: string;
  qr_image_url: string;
  qr_data?: string;
  account_number?: string;
}

interface LinkedRoommate {
  id: string;
  name: string;
  room: string;
}

export default function QRCodeManager({
  roommates,
  householdId,
  isAdmin,
  currentUserId,
}: QRCodeManagerProps) {
  const [qrCodes, setQrCodes] = useState<Record<string, RoommateQRCode[]>>({});
  const [selectedRoommate, setSelectedRoommate] = useState<Roommate | null>(
    null
  );
  const [newQrData, setNewQrData] = useState<{
    type: string;
    label: string;
    file: File | null;
    accountNumber: string;
  }>({
    type: 'momo',
    label: '',
    file: null,
    accountNumber: '',
  });
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [openAccountDialog, setOpenAccountDialog] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tableExists, setTableExists] = useState(false);
  const [linkedRoommate, setLinkedRoommate] = useState<LinkedRoommate | null>(
    null
  );
  const [showAccountNumber, setShowAccountNumber] = useState<
    Record<string, boolean>
  >({});
  const [selectedQRCodeForAccount, setSelectedQRCodeForAccount] =
    useState<RoommateQRCode | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountBank, setAccountBank] = useState('');

  const supabase = createClient();
  const { toast } = useToast();

  // Tải dữ liệu QR code từ cơ sở dữ liệu
  useEffect(() => {
    const loadQRCodes = async () => {
      if (!householdId) return;

      setIsLoading(true);
      try {
        // Kiểm tra xem bảng roommate_qrcodes có tồn tại không
        const { error: checkError } = await supabase
          .from('roommate_qrcodes')
          .select('count')
          .limit(1);

        if (checkError && checkError.code === '42P01') {
          // Bảng không tồn tại, gọi API để tạo bảng
          console.log('Bảng k tồn tại');
        } else {
          // Bảng đã tồn tại, tải dữ liệu
          setTableExists(true);
          const { data, error } = await supabase
            .from('roommate_qrcodes')
            .select('*')
            .eq('household_id', householdId);

          console.log('data', data);

          if (error) {
            console.error('Error loading QR codes:', error);
            toast({
              title: 'Lỗi',
              description: 'Không thể tải mã QR. Vui lòng thử lại sau.',
              variant: 'destructive',
            });
          } else if (data) {
            processQRCodesData(data);
          }
        }

        // Cập nhật cấu trúc bảng nếu cần
        // await updateQRCodeSchema();

        // Tìm thành viên được liên kết với người dùng hiện tại
        if (!isAdmin) {
          const { data: memberData, error: memberError } = await supabase
            .from('household_members')
            .select('linked_roommate_id')
            .eq('household_id', householdId)
            .eq('user_id', currentUserId)
            .single();

          if (!memberError && memberData && memberData.linked_roommate_id) {
            const linkedRoommateId = memberData.linked_roommate_id;
            const linkedRoommateInfo = roommates.find(
              (r) => r.id === linkedRoommateId
            );

            if (linkedRoommateInfo) {
              setLinkedRoommate({
                id: linkedRoommateInfo.id,
                name: linkedRoommateInfo.name,
                room: linkedRoommateInfo.room,
              });
            }
          }
        }
      } catch (error) {
        console.error('Unexpected error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadQRCodes();
  }, [householdId, supabase, toast, currentUserId, isAdmin, roommates]);

  // Cập nhật cấu trúc bảng QR code
  // const updateQRCodeSchema = async () => {
  //   try {
  //     const response = await fetch('/api/database/update-qrcode-schema', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //     });

  //     if (!response.ok) {
  //       console.error('Error updating QR code schema:', await response.json());
  //       return false;
  //     }

  //     return true;
  //   } catch (error) {
  //     console.error('Unexpected error updating schema:', error);
  //     return false;
  //   }
  // };

  // Xử lý dữ liệu QR codes
  const processQRCodesData = (data: any[]) => {
    // Nhóm QR codes theo roommate_id
    const groupedQrCodes: Record<string, RoommateQRCode[]> = {};
    data.forEach((qrCode) => {
      if (!groupedQrCodes[qrCode.roommate_id]) {
        groupedQrCodes[qrCode.roommate_id] = [];
      }
      groupedQrCodes[qrCode.roommate_id].push(qrCode);
    });
    setQrCodes(groupedQrCodes);
  };

  // Xử lý khi chọn file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setNewQrData({ ...newQrData, file });

    // Tạo URL xem trước
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  // Thêm QR code mới
  const addQRCode = async () => {
    const roommateId = selectedRoommate?.id || linkedRoommate?.id;

    if (!roommateId || !householdId) {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng chọn thành viên để tải lên mã QR.',
        variant: 'destructive',
      });
      return;
    }

    if (!newQrData.file && !newQrData.accountNumber) {
      toast({
        title: 'Thiếu thông tin',
        description:
          'Vui lòng tải lên hình ảnh QR code hoặc nhập số tài khoản.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Kiểm tra xem bảng có tồn tại không
      if (!tableExists) {
        console.log('Bảng k tồn tại');
      }

      let publicUrl = '';
      let filePath = '';
      let fileName = '';

      // Tải file lên storage nếu có
      if (newQrData.file) {
        const fileExt = newQrData.file.name.split('.').pop();
        fileName = `${roommateId}-${Date.now()}.${fileExt}`;
        filePath = `qrcodes/${householdId}/${fileName}`;

        // Kiểm tra xem bucket có tồn tại không
        try {
          const { data: uploadData, error: uploadError } =
            await supabase.storage
              .from('qrcodes')
              .upload(filePath, newQrData.file);

          if (uploadError) {
            if (uploadError.message.includes('bucket not found')) {
              // Bucket không tồn tại, gọi API để tạo bucket
              // await createQRCodeTableViaAPI() // API này cũng tạo bucket
              console.log('Bảng k tồn tại');

              // Thử tải lên lại
              const { data: retryData, error: retryError } =
                await supabase.storage
                  .from('qrcodes')
                  .upload(filePath, newQrData.file);

              if (retryError) {
                throw retryError;
              }
            } else {
              throw uploadError;
            }
          }
        } catch (uploadError) {
          console.error('Error uploading QR code image:', uploadError);
          toast({
            title: 'Lỗi',
            description:
              'Không thể tải lên hình ảnh QR code. Vui lòng thử lại sau.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }

        // Lấy URL công khai của file
        const { data: publicUrlData } = supabase.storage
          .from('qrcodes')
          .getPublicUrl(filePath);
        publicUrl = publicUrlData.publicUrl;
      }

      // Thêm QR code mới vào cơ sở dữ liệu
      const qrCodeData: any = {
        roommate_id: roommateId,
        household_id: householdId,
        qr_type: newQrData.type,
        qr_label: newQrData.label.trim() || undefined,
      };

      // Thêm thông tin hình ảnh nếu có
      if (newQrData.file) {
        qrCodeData.qr_image_url = publicUrl;
        qrCodeData.qr_data = filePath;
      }

      // Thêm số tài khoản nếu có
      if (newQrData.accountNumber) {
        qrCodeData.account_number = newQrData.accountNumber;
      }

      const { data, error } = await supabase
        .from('roommate_qrcodes')
        .insert([qrCodeData])
        .select();

      if (error) {
        console.error('Error adding QR code:', error);
        toast({
          title: 'Lỗi',
          description: 'Không thể thêm mã QR. Vui lòng thử lại sau.',
          variant: 'destructive',
        });
      } else if (data && data.length > 0) {
        // Cập nhật state
        const newQrCode = data[0];

        setQrCodes((prev) => {
          const updated = { ...prev };
          if (!updated[roommateId]) {
            updated[roommateId] = [];
          }
          updated[roommateId].push(newQrCode);
          return updated;
        });

        // Reset form
        setNewQrData({
          type: 'momo',
          label: '',
          file: null,
          accountNumber: '',
        });
        setPreviewUrl(null);

        toast({
          title: 'Thành công',
          description: 'Đã thêm mã QR mới.',
        });

        setOpenDialog(false);
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

  // Thêm hoặc cập nhật số tài khoản
  const updateAccountNumber = async () => {
    if (!selectedQRCodeForAccount) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('roommate_qrcodes')
        .update({
          account_number: accountNumber,
          qr_label: accountBank
            ? `${accountBank} - ${accountNumber.substring(
                accountNumber.length - 4
              )}`
            : selectedQRCodeForAccount.qr_label,
        })
        .eq('id', selectedQRCodeForAccount.id);

      if (error) {
        console.error('Error updating account number:', error);
        toast({
          title: 'Lỗi',
          description: 'Không thể cập nhật số tài khoản. Vui lòng thử lại sau.',
          variant: 'destructive',
        });
      } else {
        // Cập nhật state
        setQrCodes((prev) => {
          const updated = { ...prev };
          if (updated[selectedQRCodeForAccount.roommate_id]) {
            updated[selectedQRCodeForAccount.roommate_id] = updated[
              selectedQRCodeForAccount.roommate_id
            ].map((qr) => {
              if (qr.id === selectedQRCodeForAccount.id) {
                return {
                  ...qr,
                  account_number: accountNumber,
                  qr_label: accountBank ? `${accountBank}` : qr.qr_label,
                };
              }
              return qr;
            });
          }
          return updated;
        });

        toast({
          title: 'Thành công',
          description: 'Đã cập nhật số tài khoản.',
        });

        setOpenAccountDialog(false);
        setSelectedQRCodeForAccount(null);
        setAccountNumber('');
        setAccountBank('');
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

  // Xóa QR code
  const deleteQRCode = async (qrCode: RoommateQRCode) => {
    if (!householdId) return;

    setIsLoading(true);
    try {
      // Xóa file từ storage nếu có đường dẫn
      if (qrCode.qr_data && qrCode.qr_data.startsWith('qrcodes/')) {
        const { error: storageError } = await supabase.storage
          .from('qrcodes')
          .remove([qrCode.qr_data]);

        if (storageError) {
          console.error('Error deleting QR code image:', storageError);
          // Tiếp tục xóa bản ghi ngay cả khi không thể xóa file
        }
      }

      // Xóa bản ghi từ cơ sở dữ liệu
      const { error } = await supabase
        .from('roommate_qrcodes')
        .delete()
        .eq('id', qrCode.id);

      if (error) {
        console.error('Error deleting QR code:', error);
        toast({
          title: 'Lỗi',
          description: 'Không thể xóa mã QR. Vui lòng thử lại sau.',
          variant: 'destructive',
        });
      } else {
        // Cập nhật state
        setQrCodes((prev) => {
          const updated = { ...prev };
          if (updated[qrCode.roommate_id]) {
            updated[qrCode.roommate_id] = updated[qrCode.roommate_id].filter(
              (qr) => qr.id !== qrCode.id
            );
            if (updated[qrCode.roommate_id].length === 0) {
              delete updated[qrCode.roommate_id];
            }
          }
          return updated;
        });

        toast({
          title: 'Thành công',
          description: 'Đã xóa mã QR.',
        });
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

  // Sao chép URL hình ảnh QR hoặc số tài khoản
  const copyQRInfo = (qrCode: RoommateQRCode) => {
    const textToCopy = qrCode.account_number || qrCode.qr_image_url;
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy);
    setCopied({ ...copied, [qrCode.id]: true });
    setTimeout(() => {
      setCopied({ ...copied, [qrCode.id]: false });
    }, 2000);
  };

  // Tải QR code dưới dạng hình ảnh
  const downloadQRImage = (url: string, roommateName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `qr-${roommateName}-${new Date().getTime()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Hiển thị nhãn cho loại QR
  const getQRTypeLabel = (type: string) => {
    switch (type) {
      case 'momo':
        return 'MoMo';
      case 'banking':
        return 'Ngân hàng';
      case 'custom':
        return 'Tùy chỉnh';
      default:
        return type;
    }
  };

  // Mở dialog thêm/cập nhật số tài khoản
  const openAddAccountDialog = (qrCode: RoommateQRCode) => {
    setSelectedQRCodeForAccount(qrCode);
    setAccountNumber(qrCode.account_number || '');

    // Trích xuất tên ngân hàng từ nhãn nếu có
    if (qrCode.qr_label && qrCode.qr_label.includes(' - ')) {
      setAccountBank(qrCode.qr_label.split(' - ')[0]);
    } else {
      setAccountBank('');
    }

    setOpenAccountDialog(true);
  };

  // Kiểm tra xem người dùng có quyền quản lý QR code của thành viên không
  const canManageRoommateQR = (roommateId: string) => {
    return isAdmin || (linkedRoommate && linkedRoommate.id === roommateId);
  };

  // Lọc danh sách thành viên mà người dùng có thể quản lý
  const getManageableRoommates = () => {
    if (isAdmin) return roommates;
    if (linkedRoommate) return [linkedRoommate];
    return [];
  };

  // Hiển thị thông tin số tài khoản
  const toggleAccountNumberVisibility = (qrCodeId: string) => {
    setShowAccountNumber((prev) => ({
      ...prev,
      [qrCodeId]: !prev[qrCodeId],
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Mã QR thanh toán</span>
        </CardTitle>
        {linkedRoommate && (
          <CardDescription>
            Bạn đang được liên kết với thành viên:{' '}
            <span className="font-medium">{linkedRoommate.name}</span>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            Đang tải...
          </div>
        ) : (
          <Tabs defaultValue="view" className="w-full">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="view">Xem mã QR</TabsTrigger>
              <TabsTrigger
                value="manage"
                disabled={!isAdmin && !linkedRoommate}
              >
                Quản lý mã QR
              </TabsTrigger>
            </TabsList>

            <TabsContent value="view">
              <div className="space-y-4">
                {roommates.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    Chưa có thành viên nào.
                  </p>
                ) : (
                  roommates.map((roommate) => {
                    const roommateQRCodes = qrCodes[roommate.id] || [];
                    return (
                      <div key={roommate.id} className="border rounded-md p-4">
                        <h3 className="font-medium text-lg mb-2">
                          {roommate.name}
                        </h3>
                        {roommateQRCodes.length === 0 ? (
                          <p className="text-muted-foreground text-sm">
                            Chưa có mã QR nào.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1  gap-4">
                            {roommateQRCodes.map((qrCode) => (
                              <div
                                key={qrCode.id}
                                className="border rounded-md p-3 flex flex-col items-center"
                              >
                                <div className="mb-2 text-sm font-medium">
                                  {qrCode.qr_label ||
                                    getQRTypeLabel(qrCode.qr_type)}{' '}
                                  - {qrCode.account_number}
                                </div>

                                {qrCode.qr_image_url ? (
                                  <div className="bg-white p-2 rounded-md mb-2 w-[150px] h-[150px] flex items-center justify-center">
                                    <img
                                      src={
                                        qrCode.qr_image_url ||
                                        '/placeholder.svg'
                                      }
                                      alt={`QR code for ${roommate.name}`}
                                      className="max-w-full max-h-full object-contain cursor-pointer"
                                      onClick={() => {
                                        // Phóng to ảnh
                                        const img =
                                          document.createElement('img');
                                        img.src =
                                          qrCode.qr_image_url ||
                                          '/placeholder.svg';
                                        img.alt = `QR code for ${roommate.name}`;
                                        img.style.maxWidth = '90%';
                                        img.style.maxHeight = '90%';
                                        img.style.position = 'fixed';
                                        img.style.top = '50%';
                                        img.style.left = '50%';
                                        img.style.transform =
                                          'translate(-50%, -50%)';
                                        img.style.zIndex = '9999';
                                        img.style.cursor = 'pointer';
                                        img.style.backgroundColor =
                                          'rgba(0, 0, 0, 0.8)';
                                        img.style.padding = '10px';
                                        img.style.borderRadius = '8px';

                                        // Thêm overlay để đóng ảnh khi click ra ngoài
                                        const overlay =
                                          document.createElement('div');
                                        overlay.style.position = 'fixed';
                                        overlay.style.top = '0';
                                        overlay.style.left = '0';
                                        overlay.style.width = '100%';
                                        overlay.style.height = '100%';
                                        overlay.style.backgroundColor =
                                          'rgba(0, 0, 0, 0.5)';
                                        overlay.style.zIndex = '9998';
                                        overlay.onclick = () => {
                                          document.body.removeChild(img);
                                          document.body.removeChild(overlay);
                                        };

                                        document.body.appendChild(overlay);
                                        document.body.appendChild(img);

                                        img.onclick = () => {
                                          document.body.removeChild(img);
                                          document.body.removeChild(overlay);
                                        };
                                      }}
                                    />
                                  </div>
                                ) : qrCode.account_number ? (
                                  <div className="bg-gray-50 p-3 rounded-md mb-2 w-full text-center">
                                    <div className="flex items-center justify-center mb-2">
                                      <CreditCard className="h-6 w-6 mr-2 text-blue-500" />
                                      <span className="font-medium">
                                        Số tài khoản
                                      </span>
                                    </div>
                                    <div className="relative">
                                      <p className="font-mono text-lg">
                                        {showAccountNumber[qrCode.id]
                                          ? qrCode.account_number
                                          : qrCode.account_number?.replace(
                                              /\d/g,
                                              '•'
                                            )}
                                      </p>
                                      <button
                                        onClick={() =>
                                          toggleAccountNumberVisibility(
                                            qrCode.id
                                          )
                                        }
                                        className="absolute right-0 top-0 p-1 text-blue-500 hover:text-blue-700"
                                        title={
                                          showAccountNumber[qrCode.id]
                                            ? 'Ẩn số tài khoản'
                                            : 'Hiện số tài khoản'
                                        }
                                      >
                                        {showAccountNumber[qrCode.id]
                                          ? 'Ẩn'
                                          : 'Hiện'}
                                      </button>
                                    </div>
                                  </div>
                                ) : null}

                                <div className="flex space-x-2 mt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyQRInfo(qrCode)}
                                    disabled={
                                      !qrCode.qr_image_url &&
                                      !qrCode.account_number
                                    }
                                  >
                                    {copied[qrCode.id] ? (
                                      <Check className="h-4 w-4 mr-1" />
                                    ) : (
                                      <Copy className="h-4 w-4 mr-1" />
                                    )}
                                    {copied[qrCode.id]
                                      ? 'Đã sao chép'
                                      : 'Sao chép'}
                                  </Button>
                                  {qrCode.qr_image_url && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        downloadQRImage(
                                          qrCode.qr_image_url,
                                          roommate.name
                                        )
                                      }
                                    >
                                      <Download className="h-4 w-4 mr-1" />
                                      Tải xuống
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            <TabsContent value="manage">
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-12">
                  <h3 className="font-medium">Quản lý mã QR thanh toán</h3>
                  <div className="flex gap-2 flex-col md:flex-row w-full">
                    <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                      <DialogTrigger asChild>
                        <Button>
                          <QrCode className="h-4 w-4 mr-2 w-full" />
                          Tải lên mã QR
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Tải lên mã QR thanh toán</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          {isAdmin && (
                            <div className="space-y-2">
                              <Label htmlFor="roommate">Thành viên</Label>
                              <select
                                id="roommate"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={selectedRoommate?.id || ''}
                                onChange={(e) => {
                                  const selected = roommates.find(
                                    (r) => r.id === e.target.value
                                  );
                                  setSelectedRoommate(selected || null);
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
                          )}

                          {!isAdmin && linkedRoommate && (
                            <Alert>
                              <AlertDescription>
                                Bạn đang thêm mã QR cho thành viên:{' '}
                                <span className="font-medium">
                                  {linkedRoommate.name}
                                </span>
                              </AlertDescription>
                            </Alert>
                          )}

                          <div className="space-y-2">
                            <Label htmlFor="qrType">Loại mã QR</Label>
                            <select
                              id="qrType"
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              value={newQrData.type}
                              onChange={(e) =>
                                setNewQrData({
                                  ...newQrData,
                                  type: e.target.value,
                                })
                              }
                            >
                              <option value="momo">MoMo</option>
                              <option value="banking">Ngân hàng</option>
                              <option value="custom">Tùy chỉnh</option>
                            </select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="qrLabel">Nhãn (tùy chọn)</Label>
                            <Input
                              id="qrLabel"
                              placeholder="Ví dụ: MoMo của Minh"
                              value={newQrData.label}
                              onChange={(e) =>
                                setNewQrData({
                                  ...newQrData,
                                  label: e.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="qrImage">Hình ảnh mã QR</Label>
                            <Input
                              id="qrImage"
                              type="file"
                              accept="image/*"
                              onChange={handleFileChange}
                              className="cursor-pointer"
                            />
                            <p className="text-xs text-muted-foreground">
                              Chọn hình ảnh mã QR từ thiết bị của bạn (JPG, PNG)
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="accountNumber">
                              Số tài khoản (tùy chọn)
                            </Label>
                            <Input
                              id="accountNumber"
                              placeholder="Nhập số tài khoản"
                              value={newQrData.accountNumber}
                              onChange={(e) =>
                                setNewQrData({
                                  ...newQrData,
                                  accountNumber: e.target.value,
                                })
                              }
                            />
                            <p className="text-xs text-muted-foreground">
                              Bạn có thể nhập số tài khoản thay vì tải lên hình
                              ảnh QR
                            </p>
                          </div>

                          {previewUrl && (
                            <div className="mt-4 flex justify-center">
                              <div className="border rounded-md p-2 bg-white w-[150px] h-[150px] flex items-center justify-center">
                                <img
                                  src={previewUrl || '/placeholder.svg'}
                                  alt="QR code preview"
                                  className="max-w-full max-h-full object-contain"
                                />
                              </div>
                            </div>
                          )}

                          <Button
                            onClick={addQRCode}
                            disabled={
                              (!selectedRoommate && !linkedRoommate) ||
                              (!newQrData.file && !newQrData.accountNumber) ||
                              isLoading
                            }
                          >
                            {isLoading ? 'Đang tải lên...' : 'Tải lên mã QR'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="outline"
                      onClick={() => setOpenDialog(true)}
                    >
                      <CreditCard className="h-4 w-4 mr-2 w-full" /> Thêm số tài
                      khoản
                    </Button>
                  </div>
                </div>

                {getManageableRoommates().length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    {isAdmin
                      ? 'Chưa có thành viên nào.'
                      : 'Bạn chưa được liên kết với thành viên nào. Vui lòng liên hệ quản trị viên.'}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {getManageableRoommates().map((roommate) => {
                      const roommateQRCodes = qrCodes[roommate.id] || [];
                      return (
                        <div
                          key={roommate.id}
                          className="border rounded-md p-4"
                        >
                          <h3 className="font-medium text-lg mb-2">
                            {roommate.name}
                          </h3>
                          {roommateQRCodes.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                              Chưa có mã QR nào.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {roommateQRCodes.map((qrCode) => (
                                <div
                                  key={qrCode.id}
                                  className="flex justify-between items-center border-b pb-2"
                                >
                                  <div className="flex items-center gap-3">
                                    {qrCode.qr_image_url ? (
                                      <div className="w-10 h-10 bg-white rounded-md flex items-center justify-center overflow-hidden">
                                        <img
                                          src={
                                            qrCode.qr_image_url ||
                                            '/placeholder.svg'
                                          }
                                          alt={`QR code for ${roommate.name}`}
                                          className="max-w-full max-h-full object-contain"
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center">
                                        <CreditCard className="h-5 w-5 text-blue-500" />
                                      </div>
                                    )}
                                    <div>
                                      <span className="font-medium">
                                        {qrCode.qr_label ||
                                          getQRTypeLabel(qrCode.qr_type)}
                                      </span>
                                      {qrCode.account_number && (
                                        <div className="text-xs text-muted-foreground">
                                          {qrCode.account_number.replace(
                                            /\d/g,
                                            '•'
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              openAddAccountDialog(qrCode)
                                            }
                                          >
                                            <CreditCard className="h-4 w-4 text-blue-500" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Thêm/Cập nhật số tài khoản</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>

                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteQRCode(qrCode)}
                                      disabled={isLoading}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>

      {/* Dialog thêm/cập nhật số tài khoản */}
      <Dialog open={openAccountDialog} onOpenChange={setOpenAccountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm/Cập nhật số tài khoản</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="accountBank">Ngân hàng</Label>
              <Input
                id="accountBank"
                placeholder="Ví dụ: Vietcombank, MB Bank, ..."
                value={accountBank}
                onChange={(e) => setAccountBank(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountNumberInput">Số tài khoản</Label>
              <Input
                id="accountNumberInput"
                placeholder="Nhập số tài khoản"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenAccountDialog(false)}
            >
              Hủy
            </Button>
            <Button
              onClick={updateAccountNumber}
              disabled={!accountNumber || isLoading}
            >
              {isLoading ? 'Đang cập nhật...' : 'Lưu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
