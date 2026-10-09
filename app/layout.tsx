import type { Metadata } from "next";
import "./globals.css";
import { assetUrl } from "@/lib/nexus/assets";

export const metadata: Metadata = {
  title: "PROJECT NEXUS · 创新项目协同管理平台",
  description: "连接教育创新项目、学生与教学团队的协同工作空间。",
  manifest: assetUrl("manifest.webmanifest"),
  icons: {
    icon: assetUrl("favicon.svg"),
    shortcut: assetUrl("favicon.svg"),
  },
};

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f8f7fc' };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
