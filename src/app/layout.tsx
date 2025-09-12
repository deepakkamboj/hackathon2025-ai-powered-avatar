import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { APP_NAME } from '../lib/constants';

import './globals.css';

import { ThemeProvider } from 'next-themes';

const inter = Inter({ subsets: ['latin'] });

import { LOGO_IMAGE } from '../lib/constants';

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_NAME + ' - Streaming Multi-Modal Avatar',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
