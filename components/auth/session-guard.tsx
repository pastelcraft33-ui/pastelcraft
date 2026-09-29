"use client";

import { useEffect, useRef } from "react";

const SESSION_CHECK_INTERVAL_MS = 30_000;

export function SessionGuard({ expiresAt }: { expiresAt: string }) {
  const redirectingRef = useRef(false);

  useEffect(() => {
    let disposed = false;

    function moveToLogin(reason: string) {
      if (disposed || redirectingRef.current) return;
      redirectingRef.current = true;
      window.location.replace(`/login?reason=${encodeURIComponent(reason)}`);
    }

    async function verifySession() {
      if (disposed || redirectingRef.current) return;

      if (new Date(expiresAt).getTime() <= Date.now()) {
        await fetch("/api/auth/session", { cache: "no-store" }).catch(() => null);
        moveToLogin("session-expired");
        return;
      }

      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (response.ok) return;

        const result = (await response.json().catch(() => null)) as {
          reason?: string;
        } | null;
        moveToLogin(result?.reason ?? "invalid-session");
      } catch {
        // 일시적인 네트워크 오류는 다음 확인 주기에 다시 검사합니다.
      }
    }

    const expiryDelay = Math.max(
      0,
      new Date(expiresAt).getTime() - Date.now() + 250,
    );
    const expiryTimer = window.setTimeout(
      () => void verifySession(),
      Math.min(expiryDelay, 2_147_483_647),
    );
    const interval = window.setInterval(
      () => void verifySession(),
      SESSION_CHECK_INTERVAL_MS,
    );
    const handleFocus = () => void verifySession();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void verifySession();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      disposed = true;
      window.clearTimeout(expiryTimer);
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [expiresAt]);

  return null;
}
