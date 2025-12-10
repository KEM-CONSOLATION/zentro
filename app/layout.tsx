import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import AuthProvider from '@/components/AuthProvider'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'CountPadi - Inventory Management System',
  description:
    'Track opening stock, closing stock, and daily sales with CountPadi. Your friendly inventory management partner. Streamline your inventory management with real-time tracking, multi-branch support, and comprehensive reporting.',
  keywords:
    'inventory management, stock tracking, inventory system, restaurant inventory, inventory software, CountPadi, Nigerian inventory management',
  authors: [{ name: 'CountPadi' }],
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'CountPadi - Inventory Management System',
    description:
      'Your friendly inventory management partner. Streamline your inventory management with real-time tracking and comprehensive reporting',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CountPadi - Inventory Management System',
    description:
      'Your friendly inventory management partner. Streamline your inventory management with real-time tracking',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
  },
  themeColor: '#3B82F6',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
