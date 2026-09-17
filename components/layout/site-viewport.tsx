"use client";

import { Monitor, Smartphone } from "lucide-react";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

export function SiteViewport({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mobilePreviewUrl, setMobilePreviewUrl] = useState<string | null>(null);
  const isWorkspacePage = ![
    "/",
    "/login",
    "/register",
    "/account-recovery",
  ].includes(pathname);

  const openMobilePreview = () => {
    setMobilePreviewUrl(window.location.href);
  };

  const closeMobilePreview = () => {
    let destination = window.location.href;

    try {
      destination = iframeRef.current?.contentWindow?.location.href ?? destination;
    } catch {
      // Same-origin pages are expected, but keep the current page as a safe fallback.
    }

    window.location.assign(destination);
  };

  return (
    <>
      <button
        type="button"
        onClick={mobilePreviewUrl ? closeMobilePreview : openMobilePreview}
        className={cn(
          "fixed z-[100] hidden h-11 items-center gap-2 rounded-full border border-[#d7dfd9] bg-white px-4 text-[13px] font-extrabold text-[#405048] shadow-[0_8px_28px_rgba(30,53,39,0.14)] transition hover:border-[#9fc5ac] hover:bg-[#f5faf6] focus:outline-none focus:ring-3 focus:ring-emerald-100 lg:inline-flex",
          isWorkspacePage && !mobilePreviewUrl
            ? "bottom-[88px] left-3 w-[220px] justify-center"
            : "right-5 top-5",
        )}
      >
        {mobilePreviewUrl ? <Monitor className="size-4" /> : <Smartphone className="size-4" />}
        {mobilePreviewUrl ? "PC 화면으로 보기" : "모바일 화면으로 보기"}
      </button>

      {mobilePreviewUrl ? (
        <div className="flex min-h-screen items-start justify-center overflow-auto bg-[#e9eeea] p-8">
          <iframe
            ref={iframeRef}
            src={mobilePreviewUrl}
            title="파스텔크래프트 모바일 화면"
            className="h-[min(844px,calc(100vh-64px))] w-[390px] max-w-full shrink-0 rounded-[32px] border border-[#d3dbd5] bg-white shadow-[0_28px_80px_rgba(28,52,37,0.22)]"
          />
        </div>
      ) : (
        children
      )}
    </>
  );
}
