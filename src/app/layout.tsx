import type { Metadata, Viewport } from "next";
import { Sora, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "AIA ILPS 基金研究台",
  description:
    "「卓達智悅 2」投資相連壽險基金目錄：增長型與派息（Z字）投資選擇、風險、價格與資產類別。",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ILPS 基金",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1c2c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className={`${sora.variable} ${sourceSans.variable}`}>
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
