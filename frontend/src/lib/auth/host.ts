const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function normalizeHost(host: string): string {
  return host.split(":")[0].toLowerCase().trim();
}

export function isTenantHost(host: string): boolean {
  const hostname = normalizeHost(host);
  if (!hostname || LOCAL_HOSTS.has(hostname)) return false;

  if (hostname.endsWith(".localhost")) {
    return hostname.split(".").length > 1;
  }

  const platformDomain =
    (process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || process.env.PLATFORM_DOMAIN || "").toLowerCase().trim();

  if (!platformDomain) {
    return hostname.includes(".");
  }

  if (hostname === platformDomain) return false;
  return hostname.endsWith(`.${platformDomain}`);
}

