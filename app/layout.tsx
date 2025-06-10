import type React from 'react';
import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/toaster';

const inter = Inter({ subsets: ['latin'] });
export const metadata = {
  title: 'Quản lý chi tiêu',
  description: 'Track and split expenses with your roommates',
  icons: {
    icon: '/faicon.jpg', // đường dẫn tới icon thường
    shortcut: '/faicon.jpg', // icon cho shortcut
    apple: '/faicon.jpg', // icon cho iOS
  },
    generator: 'v0.dev'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="overflow-x-hidden">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
      </head>
      <body className={`${inter.className} overflow-x-hidden`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
