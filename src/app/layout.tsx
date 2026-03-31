import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Whatt Dash",
  description: "Secure WhatsApp Business Dashboard",
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
