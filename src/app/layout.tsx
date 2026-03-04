import type { Metadata } from "next";
import { Poppins, Varela_Round } from "next/font/google";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileNav } from "@/components/MobileNav";
import { ChatProvider } from "@/context/ChatContext";
import { ChatOverlay } from "@/components/chat/ChatOverlay";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const varelaRound = Varela_Round({
  variable: "--font-varela-round",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Drooopy - Compra y Vende Seguro",
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
        className={`${poppins.variable} ${varelaRound.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ChatProvider>
          <Header />
          <main className="pt-32 pb-16 md:pb-0 min-h-screen">
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
