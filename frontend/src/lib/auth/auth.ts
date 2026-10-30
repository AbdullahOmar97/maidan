import NextAuth from "next-auth";
import { type JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { isTenantHost } from "@/lib/auth/host";

const ACCESS_TOKEN_TTL_MS = 55 * 60 * 1000; // 55 min (refresh before 1-hour expiry)

/** Per-refresh-token promises — prevents refresh storms without cross-user token mixing */
const refreshPromises = new Map<string, Promise<JWT>>();

async function refreshAccessToken(token: JWT): Promise<JWT> {
  const internalApiUrl = process.env.NEXT_INTERNAL_API_URL || "http://backend:8000";
  const tenantHostname = (token.tenant as string) || null;
  const tenantHeaders: Record<string, string> = tenantHostname
    ? { Host: tenantHostname, "X-Forwarded-Host": tenantHostname }
    : {};

  try {
    const response = await fetch(`${internalApiUrl}/api/v1/auth/refresh/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-Proto": "https",
        ...tenantHeaders,
      },
      body: JSON.stringify({ refresh: token.refreshToken }),
    });

    if (!response.ok) {
      return { ...token, accessToken: null, refreshToken: null, error: "RefreshAccessTokenError" };
    }

    const data = await response.json();
    const newAccessToken = data.access;
    const newRefreshToken = data.refresh || token.refreshToken;

    // Synchronize live user profile, role, and effective permissions from backend
    let syncedFields: Record<string, unknown> = {};
    try {
      const meResponse = await fetch(`${internalApiUrl}/api/v1/auth/me/`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${newAccessToken}`,
          "X-Forwarded-Proto": "https",
          ...tenantHeaders,
        },
      });
      if (meResponse.ok) {
        const meData = await meResponse.json();
        if (meData.is_active === false) {
          return { ...token, accessToken: null, refreshToken: null, error: "RefreshAccessTokenError" };
        }
        syncedFields = {
          role: meData.role ?? token.role,
          permissions: meData.permissions ?? token.permissions,
          first_name: meData.first_name ?? token.first_name,
          last_name: meData.last_name ?? token.last_name,
          name: `${meData.first_name ?? token.first_name ?? ""} ${meData.last_name ?? token.last_name ?? ""}`.trim(),
          picture: meData.avatar_url ?? token.picture,
          language_pref: meData.language_pref ?? token.language_pref,
          notification_preferences: meData.notification_preferences ?? token.notification_preferences,
          ui_preferences: meData.ui_preferences ?? token.ui_preferences,
        };
      }
    } catch {
      // Non-fatal: keep existing profile claims if /auth/me/ is unreachable
    }

    return {
      ...token,
      ...syncedFields,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiry: Date.now() + ACCESS_TOKEN_TTL_MS,
      error: undefined,
    };
  } catch {
    return { ...token, accessToken: null, refreshToken: null, error: "RefreshAccessTokenError" };
  }
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

        const reqHost = request?.headers?.get("host") || "localhost:3000";
        const tenantHostname = reqHost.split(":")[0];
        const tenantAwareHost = isTenantHost(tenantHostname) ? tenantHostname : null;

        const internalApiUrl = process.env.NEXT_INTERNAL_API_URL || "http://backend:8000";
        const apiUrl = `${internalApiUrl}/api/v1/auth/login/`;

        let response: Response;
        try {
          response = await fetch(apiUrl, {
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
          });
        } catch {
          return null;
        }

        if (!response.ok) {
          let errorData: any = {};
          try {
            errorData = await response.json();
          } catch {
            // ignore json parse error
          }

          if (response.status === 429 || errorData?.error?.code === "account_locked") {
            throw new Error(
              `ACCOUNT_LOCKED:${errorData?.error?.message || "تم إيقاف محاولات الدخول مؤقتاً. يرجى المحاولة بعد 15 دقيقة."}`
            );
          }

          if (response.status === 403) {
            if (errorData.code === "setup_required") {
              throw new Error(`SETUP_REQUIRED:${errorData.email}`);
            }
            if (errorData.code === "force_password_reset") {
              throw new Error(`FORCE_PASSWORD_RESET:${errorData.token}`);
            }
            if (
              errorData.error?.code === "tenant_inactive" ||
              errorData.error?.code === "subscription_expired"
            ) {
              throw new Error(`TENANT_INACTIVE:${errorData.error.message}`);
            }
          }
          return null;
        }

        const data = await response.json();

        return {
          id: data.user.id,
          email: data.user.email,
          name: `${data.user.first_name} ${data.user.last_name}`.trim(),
          first_name: data.user.first_name,
          last_name: data.user.last_name,
          image: data.user.avatar_url || null,
          role: data.user.role,
          permissions: data.user.permissions,
          language_pref: data.user.language_pref,
          notification_preferences: data.user.notification_preferences,
          ui_preferences: data.user.ui_preferences,
          accessToken: data.access,
          refreshToken: data.refresh,
          tenant: tenantAwareHost,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as any).role;
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
        token.tenant = (user as any).tenant;
        token.first_name = (user as any).first_name;
        token.last_name = (user as any).last_name;
        token.name = user.name;
        token.picture = (user as any).image ?? null;
        token.permissions = (user as any).permissions;
        token.language_pref = (user as any).language_pref;
        token.notification_preferences = (user as any).notification_preferences;
        token.ui_preferences = (user as any).ui_preferences;
        token.accessTokenExpiry = Date.now() + ACCESS_TOKEN_TTL_MS;
      }

      if (trigger === "update" && session) {
        if (session.first_name !== undefined) token.first_name = session.first_name;
        if (session.last_name !== undefined) token.last_name = session.last_name;
        if (session.first_name !== undefined || session.last_name !== undefined) {
          token.name = `${token.first_name ?? ""} ${token.last_name ?? ""}`.trim();
        }
        if (session.image !== undefined) token.picture = session.image;
        if (session.role !== undefined) token.role = session.role;
        if (session.permissions !== undefined) token.permissions = session.permissions;
        if (session.language_pref !== undefined) token.language_pref = session.language_pref;
        if (session.notification_preferences !== undefined) {
          token.notification_preferences = session.notification_preferences;
        }
        if (session.ui_preferences !== undefined) {
          token.ui_preferences = session.ui_preferences;
        }
        if (session.accessToken !== undefined) {
          token.accessToken = session.accessToken;
          token.accessTokenExpiry = Date.now() + ACCESS_TOKEN_TTL_MS;
        }
        if (session.refreshToken !== undefined) {
          token.refreshToken = session.refreshToken;
        }
      }

      // Refresh token if expired — one in-flight refresh per refresh token
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
      if (token.error === "RefreshAccessTokenError" || !token.accessToken) {
        return null as any;
      }
      session.user.id = token.id as string;
      session.user.name = (token.name as string) ?? session.user.name;
      session.user.image = (token.picture as string | null) ?? null;
      (session.user as any).first_name = token.first_name;
      (session.user as any).last_name = token.last_name;
      (session.user as any).role = token.role;
      (session.user as any).permissions = token.permissions;
      (session.user as any).language_pref = token.language_pref;
      (session.user as any).notification_preferences = token.notification_preferences;
      (session.user as any).ui_preferences = token.ui_preferences;
      (session as any).role = token.role;
      (session as any).accessToken = token.accessToken;
      (session as any).refreshToken = token.refreshToken;
      (session as any).tenant = token.tenant;
      (session as any).error = token.error;
      return session;
    },
  },
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
});
