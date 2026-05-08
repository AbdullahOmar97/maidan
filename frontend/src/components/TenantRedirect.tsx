"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isTenantHost } from "@/lib/auth/host";

export function TenantRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (isTenantHost(hostname)) {
        router.replace("/login");
      }
    }
  }, [router]);

  return null;
}
