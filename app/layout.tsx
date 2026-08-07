import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import Navbar from "@/components/navbar"
import Preloader from "@/components/preloader"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"

import { Inter } from "next/font/google"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Illumitrace - Circuit Design & Simulation",
  description: "Advanced circuit design, PCB layout, and simulation platform",
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen antialiased`}>
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={true}>
            <Preloader />
          <div className="flex flex-col min-h-screen">
            <a 
              href="#main-content" 
              className="sr-only focus:not-sr-only focus:absolute focus:px-4 focus:py-2 focus:top-2 focus:left-2 focus:bg-primary focus:text-white focus:rounded"
            >
              Skip to content
            </a>
            <Navbar />
            <main id="main-content" className="flex-1 ">
              {children}
            </main>
          </div>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}