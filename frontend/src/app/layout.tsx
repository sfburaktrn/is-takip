import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import "./analytics-responsive.css";
import "./responsive-shell.css";
import { AuthProvider } from "@/lib/AuthContext";
import NotificationBell from "@/components/NotificationBell";
import ScrollChromeEffect from "@/components/ScrollChromeEffect";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "İmalat Takip Sistemi",
  description: "Modern imalat takip uygulaması",
  icons: {
    icon: '/logo.png',
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f5f7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={manrope.variable}>
      <body suppressHydrationWarning={true}>
        <AuthProvider>
          <ScrollChromeEffect />
          <NotificationBell />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
