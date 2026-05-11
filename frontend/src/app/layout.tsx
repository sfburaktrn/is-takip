import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import "./analytics-responsive.css";
import { AuthProvider } from "@/lib/AuthContext";
import NotificationBell from "@/components/NotificationBell";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "İmalat Takip Sistemi",
  description: "Modern imalat takip uygulaması",
  icons: {
    icon: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={manrope.className} suppressHydrationWarning={true}>
        <AuthProvider>
          <NotificationBell />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
