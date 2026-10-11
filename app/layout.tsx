import type { Metadata } from "next";
import "./globals.css";
import { assetUrl } from "@/lib/nexus/assets";

/**
 * Site-wide link-preview tags. A static SPA cannot vary them per article (crawlers don't run JS
 * or read the #/p/<slug> hash), so GitHub Pages shares the generic card; the server build serves
 * per-article tags at /a/<slug> (server/posts.ts). NEXT_PUBLIC_SITE_ORIGIN makes og:image absolute.
 */
const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_ORIGIN || "").replace(/\/$/, "");
const OG_IMAGE = SITE_ORIGIN ? SITE_ORIGIN + assetUrl("og-default.png") : assetUrl("og-default.png");
const OG_DESCRIPTION = "B.E.S.T 项目推文与项目书：教育创新项目、竞赛、科研与营地。";

export const metadata: Metadata = {
  title: "B.E.S.T · 内部超级管理系统",
  applicationName: "B.E.S.T",
  description: "连接教育创新项目、学生与教学团队的协同工作空间。",
  ...(SITE_ORIGIN ? { metadataBase: new URL(SITE_ORIGIN) } : {}),
  openGraph: {
    type: "website",
    siteName: "B.E.S.T",
    title: "B.E.S.T · 项目推文",
    description: OG_DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "B.E.S.T 项目推文" }],
    ...(SITE_ORIGIN ? { url: SITE_ORIGIN + assetUrl("") } : {}),
  },
  twitter: { card: "summary_large_image", title: "B.E.S.T · 项目推文", description: OG_DESCRIPTION, images: [OG_IMAGE] },
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
      {/* schema.org tags: read by some link-preview crawlers (incl. older WeChat clients) that skip og:*. */}
      <head><meta itemProp="name" content="B.E.S.T · 项目推文" /><meta itemProp="description" content={OG_DESCRIPTION} /><meta itemProp="image" content={OG_IMAGE} /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
