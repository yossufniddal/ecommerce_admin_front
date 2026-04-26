"use client";

import { usePathname, useRouter } from "next/navigation";
import React, { useEffect } from "react";

function getStoredAuth() {
  const localToken = window.localStorage.getItem("auth_token");
  const sessionToken = window.sessionStorage.getItem("auth_token");
  const storage = localToken ? window.localStorage : window.sessionStorage;
  const token = localToken ?? sessionToken;
  const expiresAt = storage.getItem("auth_expires_at");

  return { token, expiresAt, storage };
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hasToken =
    typeof window !== "undefined" &&
    (!!window.localStorage.getItem("auth_token") ||
      !!window.sessionStorage.getItem("auth_token"));

  useEffect(() => {
    const { token, expiresAt, storage } = getStoredAuth();
    const isExpired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : true;

    if (!token || isExpired) {
      storage.removeItem("auth_token");
      storage.removeItem("auth_expires_at");
      storage.removeItem("auth_user");
      router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
      return;
    }
  }, [pathname, router]);

  if (!hasToken) {
    return null;
  }

  return <>{children}</>;
}
