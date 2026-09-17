import type { Metadata } from "next";

import { SiteViewport } from "@/components/layout/site-viewport";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "파스텔크래프트 워크스페이스",
    template: "%s | 파스텔크래프트",
  },
  description: "직원의 업무 일정과 휴가를 한곳에서 관리하는 사내 워크스페이스",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <SiteViewport>{children}</SiteViewport>
      </body>
    </html>
  );
}
