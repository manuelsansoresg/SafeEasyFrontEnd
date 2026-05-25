import type { Metadata } from "next";
import { Poppins, Varela_Round } from "next/font/google";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "react-quill-new/dist/quill.snow.css";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileNav } from "@/components/MobileNav";
import { ChatProvider } from "@/context/ChatContext";
import { ChatOverlay } from "@/components/chat/ChatOverlay";
import { LocationProvider } from "@/components/LocationProvider";

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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(typeof window==="undefined")return;var nav=window.navigator;if(!nav||!nav.serviceWorker||!nav.serviceWorker.getRegistrations)return;nav.serviceWorker.getRegistrations().then(function(regs){if(!regs||!regs.length)return;return Promise.all(regs.map(function(r){try{return r.unregister()}catch(e){return false}})).then(function(){if(window.caches&&window.caches.keys){return window.caches.keys().then(function(keys){return Promise.all((keys||[]).map(function(k){try{return window.caches.delete(k)}catch(e){return false}}))})}}).then(function(){try{var key="safeeasy:sw_killed_v1";if(!window.sessionStorage)return;var done=window.sessionStorage.getItem(key);if(done)return;window.sessionStorage.setItem(key,"1");window.location.reload()}catch(e){}})}).catch(function(){})}catch(e){}})();`,
          }}
        />
        <ChatProvider>
          <LocationProvider />
          <Header />
          <main className="min-h-screen">
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
