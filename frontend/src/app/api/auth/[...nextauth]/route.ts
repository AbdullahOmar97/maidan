import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/lib/auth/auth";

/**
 * Reconstructs the NextRequest with the public forwarded host and protocol
 * so NextAuth never uses the internal Docker container hostname (e.g. 1cc81dc73854:3000).
 */
function withForwardedOrigin(req: NextRequest): NextRequest {
  const rawHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!rawHost) return req;

  const host = rawHost.split(",")[0].trim();
  const proto = (req.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
  const publicOrigin = `${proto}://${host}`;

  if (req.nextUrl.origin === publicOrigin) {
    return req;
  }

  const fixedUrl = new URL(req.nextUrl.pathname + req.nextUrl.search, publicOrigin);
  return new NextRequest(fixedUrl, req);
}

const SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-authjs.session-token.0",
  "__Secure-authjs.session-token.1",
  "authjs.session-token.0",
  "authjs.session-token.1",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
  "__Secure-authjs.callback-url",
  "authjs.callback-url",
  "__Host-authjs.csrf-token",
  "authjs.csrf-token",
];

/**
 * Appends explicit cookie-clearing headers to guarantee session termination
 * even if the browser holds stale CSRF tokens or cross-subdomain cookies.
 */
function appendSignOutCookies(res: Response, req: NextRequest): Response {
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "private, no-cache, no-store, max-age=0, must-revalidate");

  for (const name of SESSION_COOKIE_NAMES) {
    const isHostPrefix = name.startsWith("__Host-");
    const isSecure = name.startsWith("__Secure-") || isHostPrefix || req.nextUrl.protocol === "https:";
    const secureFlag = isSecure ? "; Secure" : "";

    // Expire host-only cookie
    headers.append(
      "Set-Cookie",
      `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax${secureFlag}`
    );

    // Also expire domain-scoped variants if not a __Host- cookie
    if (!isHostPrefix) {
      headers.append(
        "Set-Cookie",
        `${name}=; Path=/; Domain=.maidanjo.duckdns.org; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax${secureFlag}`
      );
    }
  }

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export async function GET(req: NextRequest) {
  const fixedReq = withForwardedOrigin(req);
  const res = await handlers.GET(fixedReq);
  if (fixedReq.nextUrl.pathname.endsWith("/signout")) {
    return appendSignOutCookies(res, fixedReq);
  }
  return res;
}

export async function POST(req: NextRequest) {
  const fixedReq = withForwardedOrigin(req);
  const isSignOut = fixedReq.nextUrl.pathname.endsWith("/signout");

  try {
    const res = await handlers.POST(fixedReq);
    if (isSignOut) {
      return appendSignOutCookies(res, fixedReq);
    }
    return res;
  } catch {
    if (isSignOut) {
      const fallback = NextResponse.json({ url: `${fixedReq.nextUrl.origin}/login` });
      return appendSignOutCookies(fallback, fixedReq);
    }
    throw new Error("Authentication request failed");
  }
}
