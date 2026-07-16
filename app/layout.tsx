import type { Metadata } from 'next'
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import Link from 'next/link'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Escribetuciancion - Dashboard',
  description: 'Escribetuciancion - Dashboard',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <header className="flex justify-between items-center p-4 gap-4 h-16 border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 z-50">
              <nav className="flex items-center gap-4">
                <Link 
                  href="/" 
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  Órdenes
                </Link>
                <Link 
                  href="/inbox" 
                  className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1"
                >
                  Inbox
                  <span className="text-[10px] bg-green-500/20 text-green-400 px-1 rounded">WA</span>
                </Link>
                <Link 
                  href="/statistics" 
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  Estadísticas
                </Link>
                <Link 
                  href="/tiktok-ads" 
                  className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1"
                >
                  TikTok Ads
                  <span className="text-[10px] bg-pink-500/20 text-pink-400 px-1 rounded">Beta</span>
                </Link>
              </nav>
              <div className="flex items-center gap-4">
                <SignedOut>
                  <SignInButton />
                  <SignUpButton />
                </SignedOut>
                <SignedIn>
                  <UserButton />
                </SignedIn>
              </div>
            </header>
            <div className="min-h-screen bg-transparent">
              <main>{children}</main>
            </div>
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
