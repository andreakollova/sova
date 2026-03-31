import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SOVA – Soňa',
  description: 'Tvoja osobná AI asistentka',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk" className="dark">
      <body className={`${inter.className} min-h-screen bg-[#0A0614]`}>{children}</body>
    </html>
  )
}
