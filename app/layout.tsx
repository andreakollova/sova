import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SOVA – Tvoja AI asistentka',
  description: 'Tvoja osobna AI asistentka Sona',
  icons: { icon: '/faviconsona.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk" className="dark">
      <body className={`${inter.className} min-h-screen bg-background`}>
        {children}
      </body>
    </html>
  )
}
