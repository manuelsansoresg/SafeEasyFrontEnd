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
import { TokenRefreshProvider } from "@/components/TokenRefreshProvider";
import { JsonLd } from "@/components/JsonLd";
import { absoluteSiteUrl, getSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

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
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Drooopy | Productos y proveedores en México",
    template: "%s | Drooopy",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  icons: {
    icon: [
      {
        url: "/drooopy-favicon-256-transparente.png",
        sizes: "256x256",
        type: "image/png",
      },
    ],
    shortcut: "/drooopy-favicon-256-transparente.png",
    apple: "/drooopy-favicon-256-transparente.png",
  },
  keywords: [
    "Drooopy",
    "productos en México",
    "proveedores en México",
    "negocios en México",
    "compras online",
    "vendedores confiables",
  ],
  alternates: {
    canonical: absoluteSiteUrl("/"),
  },
  openGraph: {
    title: "Drooopy | Productos y proveedores en México",
    description: SITE_DESCRIPTION,
    url: absoluteSiteUrl("/"),
    siteName: SITE_NAME,
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Drooopy | Productos y proveedores en México",
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
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
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              name: SITE_NAME,
              url: absoluteSiteUrl("/"),
              logo: `${getSiteUrl()}/logo-drooopy.svg`,
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: SITE_NAME,
              url: absoluteSiteUrl("/"),
              potentialAction: {
                "@type": "SearchAction",
                target: `${absoluteSiteUrl("/")}?search={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            },
          ]}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(typeof window==="undefined")return;var nav=window.navigator;if(!nav||!nav.serviceWorker||!nav.serviceWorker.getRegistrations)return;nav.serviceWorker.getRegistrations().then(function(regs){if(!regs||!regs.length)return;return Promise.all(regs.map(function(r){try{return r.unregister()}catch(e){return false}})).then(function(){if(window.caches&&window.caches.keys){return window.caches.keys().then(function(keys){return Promise.all((keys||[]).map(function(k){try{return window.caches.delete(k)}catch(e){return false}}))})}}).then(function(){try{var key="safeeasy:sw_killed_v1";if(!window.sessionStorage)return;var done=window.sessionStorage.getItem(key);if(done)return;window.sessionStorage.setItem(key,"1");window.location.reload()}catch(e){}})}).catch(function(){})}catch(e){}})();`,
          }}
        />
        <ChatProvider>
          <TokenRefreshProvider>
            <LocationProvider />
            <Header />
            <main className="min-h-screen">
              {children}
            </main>
            <Footer />
            <MobileNav />
            <ChatOverlay />
          </TokenRefreshProvider>
        </ChatProvider>
      </body>
    </html>
  );
}
