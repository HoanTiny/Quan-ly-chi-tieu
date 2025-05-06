// app/layout.tsx
import ClientToaster from '@/components/clientToaster';
import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Quản lý chi tiêu',
  description: 'Track and split expenses with your roommates',
  icons: {
    icon: '/faicon.jpg', // đường dẫn tới icon thường
    shortcut: '/faicon.jpg', // icon cho shortcut
    apple: '/faicon.jpg', // icon cho iOS
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
        <ClientToaster />
      </body>
    </html>
  );
}
