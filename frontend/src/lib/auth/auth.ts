import NextAuth, { type JWT } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { isTenantHost } from "@/lib/auth/host";

const ACCESS_TOKEN_TTL_MS = 55 * 60 * 1000; // 55 min (refresh before 1-hour expiry)

/** Per-refresh-token promises — prevents refresh storms without cross-user token mixing */
const refreshPromises = new Map<string, Promise<JWT>>();

async function refreshAccessToken(token: JWT): Promise<JWT> {
  const internalApiUrl = process.env.NEXT_INTERNAL_API_URL || "http://backend:8000";
  const tenantHostname = (token.tenant as string) || null;

  const response = await fetch(`${internalApiUrl}/api/v1/auth/refresh/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-Proto": "https",
      ...(tenantHostname
        ? { Host: tenantHostname, "X-Forwarded-Host": tenantHostname }
        : {}),
    },
    body: JSON.stringify({ refresh: token.refreshToken }),
  });

  if (!response.ok) {
    // Invalidate token so NextAuth forces re-login instead of looping
    return { ...token, accessToken: null, refreshToken: null, error: "RefreshAccessTokenError" };
  }

  const data = await response.json();
  return {
    ...token,
    accessToken: data.access,
    accessTokenExpiry: Date.now() + ACCESS_TOKEN_TTL_MS,
    error: undefined,
  };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Use tenant host headers only when a real tenant domain/subdomain exists.
        const reqHost = request?.headers?.get("host") || "localhost:3000";
        const tenantHostname = reqHost.split(":")[0];
        const tenantAwareHost = isTenantHost(tenantHostname) ? tenantHostname : null;
        
        // Use internal Docker URL for server-side fetches
        const internalApiUrl = process.env.NEXT_INTERNAL_API_URL || "http://backend:8000";
        const apiUrl = `${internalApiUrl}/api/v1/auth/login/`;

        try {
          const response = await fetch(
            apiUrl,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Forwarded-Proto": "https",
                ...(tenantAwareHost
                  ? {
                      Host: tenantAwareHost,
                      "X-Forwarded-Host": tenantAwareHost,
                    }
                  : {}),
              },
              body: JSON.stringify({
                email: parsed.data.email,
                password: parsed.data.password,
              }),
            }
          );

          if (!response.ok) {
            if (response.status === 403) {
              const errorData = await response.json();
              if (errorData.code === "setup_required") {
                throw new Error(`SETUP_REQUIRED:${errorData.email}`);
              }
              if (errorData.error?.code === "tenant_inactive" || errorData.error?.code === "subscription_expired") {
                throw new Error(`TENANT_INACTIVE:${errorData.error.message}`);
              }
            }
            return null;
          }

          const data = await response.json();

          return {
            id: data.user.id,
            email: data.user.email,
            name: `${data.user.first_name} ${data.user.last_name}`,
            first_name: data.user.first_name,
            last_name: data.user.last_name,
            image: data.user.avatar_url,
            role: data.user.role,
            permissions: data.user.permissions,
            accessToken: data.access,
            refreshToken: data.refresh,
            tenant: tenantAwareHost,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as any).role;
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
        token.tenant = (user as any).tenant;
        token.first_name = (user as any).first_name;
        token.last_name = (user as any).last_name;
        token.permissions = (user as any).permissions;
        token.accessTokenExpiry = Date.now() + ACCESS_TOKEN_TTL_MS;
      }

      // Refresh token if expired — one in-flight refresh per refresh token (not process-global)
      if (token.accessTokenExpiry && Date.now() > (token.accessTokenExpiry as number)) {
        const rt = token.refreshToken as string | undefined;
        if (!rt) {
          return { ...token, accessToken: null, refreshToken: null, error: "RefreshAccessTokenError" };
        }
        let p = refreshPromises.get(rt);
        if (!p) {
          p = refreshAccessToken(token).finally(() => {
            refreshPromises.delete(rt);
          });
          refreshPromises.set(rt, p);
        }
        token = await p;
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      (session.user as any).first_name = token.first_name;
      (session.user as any).last_name = token.last_name;
      (session.user as any).role = token.role;
      (session.user as any).permissions = token.permissions;
      (session as any).role = token.role;
      (session as any).accessToken = token.accessToken;
      (session as any).error = token.error;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
});
