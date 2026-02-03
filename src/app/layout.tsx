import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileNav } from "@/components/MobileNav";
import { ChatProvider } from "@/context/ChatContext";
import { ChatOverlay } from "@/components/chat/ChatOverlay";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SafeEasy - Compra y Vende Seguro",
  description: "Tu plataforma segura para compras y ventas online.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ChatProvider>
          <Header />
          <main className="pt-16 pb-16 md:pb-0 min-h-screen">
            {children}
          </main>
          <Footer />
          <MobileNav />
          <ChatOverlay />
        </ChatProvider>
      </body>
    </html>
  );
}
