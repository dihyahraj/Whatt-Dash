import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Whatt Dash",
  description: "WhatsApp Business Dashboard",
  icons: {
    icon: [
      { url: "https://cdn.shopify.com/s/files/1/0904/3168/4923/files/Bio_Shoo_Favicon.png?v=1767101139", type: "image/png" },
    ],
    shortcut: "https://cdn.shopify.com/s/files/1/0904/3168/4923/files/Bio_Shoo_Favicon.png?v=1767101139",
    apple: "https://cdn.shopify.com/s/files/1/0904/3168/4923/files/Bio_Shoo_Favicon.png?v=1767101139",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased`}>
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" />
      </head>
      <body className="min-h-full flex flex-col" style={{ fontFamily: "var(--font-dm-sans), system-ui, sans-serif" }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
