"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api/client";


interface TenantContextType {
  tenant: any | null;
  loading: boolean;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  loading: true,
  refreshTenant: async () => {},
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTenant = async () => {
    try {
      const res = await api.tenants.me();
      setTenant(res.data);
    } catch (error) {
      console.error("Failed to fetch tenant branding info", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenant();
  }, []);

  useEffect(() => {
    if (tenant?.favicon) {
      // Dynamically update favicon
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = tenant.favicon;
    }
  }, [tenant]);

  return (
    <TenantContext.Provider value={{ tenant, loading, refreshTenant: fetchTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);
