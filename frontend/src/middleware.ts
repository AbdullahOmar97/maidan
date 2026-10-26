import { auth } from "@/lib/auth/auth";
import { NextResponse } from "next/server";
import { isTenantHost } from "@/lib/auth/host";

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const isDashboard = nextUrl.pathname.startsWith("/dashboard");
  const isAuthPage =
    nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/register") ||
    nextUrl.pathname.startsWith("/forgot-password") ||
    nextUrl.pathname.startsWith("/reset-password");

  const hasValidSession =
    Boolean(session?.user) &&
    Boolean((session as any)?.accessToken) &&
    !(session as any)?.error;

  const rawHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const currentHost = rawHost.split(",")[0].trim().split(":")[0].toLowerCase();
  const isCurrentTenant = isTenantHost(currentHost);
  const sessionTenant = ((session as any)?.tenant || "").toLowerCase();
  const isSameTenant = isCurrentTenant ? sessionTenant === currentHost : !sessionTenant;

  if (isDashboard) {
    if (!hasValidSession) {
      const loginUrl = new URL("/login", nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    // If user has a valid tenant session but is on root/wrong domain, redirect to their tenant domain
    if (!isSameTenant && sessionTenant) {
      const protocol = req.headers.get("x-forwarded-proto") || "https";
      const tenantDashboardUrl = new URL(
        `${nextUrl.pathname}${nextUrl.search}`,
        `${protocol}://${sessionTenant}`
      );
      return NextResponse.redirect(tenantDashboardUrl);
    }

    if (!isSameTenant) {
      const loginUrl = new URL("/login", nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isAuthPage && hasValidSession) {
    if (isSameTenant) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
    }
    if (sessionTenant) {
      const protocol = req.headers.get("x-forwarded-proto") || "https";
      return NextResponse.redirect(new URL("/dashboard", `${protocol}://${sessionTenant}`));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|kiosk|store).*)"],
};
