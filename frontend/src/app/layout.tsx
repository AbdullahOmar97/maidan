import type { Metadata } from "next";
import { Inter, Noto_Sans_Arabic } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { QueryClientProvider } from "@/lib/providers/query-provider";
import { SessionProvider } from "@/lib/providers/session-provider";
import { Toaster } from "sonner";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto-arabic",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "MAIDAN — Dojo Management System",
    template: "%s | MAIDAN",
  },
  description:
    "Professional martial arts academy management platform for the MENA region. Manage students, billing, attendance, and more.",
  keywords: ["martial arts", "dojo management", "BJJ", "karate", "attendance", "billing", "MENA"],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    type: "website",
    siteName: "MAIDAN Dojo Management",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${inter.variable} ${notoArabic.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SessionProvider>
            <QueryClientProvider>
              {children}
            </QueryClientProvider>
          </SessionProvider>
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
