import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

const font = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Whatt Dash",
  description: "WhatsApp Business Dashboard",
  icons: {
    icon: [{ url: "https://cdn.shopify.com/s/files/1/0904/3168/4923/files/Bio_Shoo_Favicon.png?v=1767101139", type: "image/png" }],
    shortcut: "https://cdn.shopify.com/s/files/1/0904/3168/4923/files/Bio_Shoo_Favicon.png?v=1767101139",
    apple: "https://cdn.shopify.com/s/files/1/0904/3168/4923/files/Bio_Shoo_Favicon.png?v=1767101139",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${font.variable} h-full`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#0c1015" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" />
      </head>
      <body className="min-h-full antialiased overscroll-none" style={{ fontFamily: "var(--font-plus-jakarta), system-ui, sans-serif" }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
