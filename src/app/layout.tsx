import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { getThemePreference } from "@/lib/theme";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Atala Konten",
    template: "%s · Atala Konten",
  },
  description: "Perencanaan konten, kalender unggah manual, dan Studio PNG untuk Atala Project.",
  icons: { icon: "/atala-logo.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1220" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Tema dari cookie dipasang di server: tidak ada kedip saat muat (MT-01).
  const theme = await getThemePreference();
  return (
    <html lang="id" className={jakarta.variable} data-theme={theme} suppressHydrationWarning>
      <body className="min-h-dvh bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
