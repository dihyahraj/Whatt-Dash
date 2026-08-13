import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

/**
 * No `weight` array on purpose: Plus Jakarta Sans is a variable font, so this
 * ships ONE woff2 covering 200–800 instead of six static weight files.
 */
const font = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Every Material Symbol the app renders. `icon_names` makes Google serve a
 * subsetted font: 5.2 MB (all ~3,600 icons) → ~80 KB. Add the name here when you
 * use a new icon, otherwise it renders as its own text.
 * `display=block` keeps the ligature text hidden until the font lands instead of
 * flashing words like "push_pin" on screen.
 */
const ICON_NAMES = [
  "add", "add_reaction", "archive", "arrow_back", "attach_file", "bolt", "chat", "check", "close",
  "contact_page", "content_copy", "dark_mode", "delete", "description", "desktop_windows", "done_all",
  "download", "edit", "error", "expand_more", "forum", "forward", "group", "image", "label", "label_off",
  "light_mode", "lock", "login", "logout", "mail", "mark_email_unread", "mic", "mood", "more_vert",
  "notifications_active", "notifications_off", "open_in_new", "pause", "person", "photo_library",
  "picture_as_pdf", "play_arrow", "progress_activity", "push_pin", "qr_code_2", "reply", "rotate_left",
  "rotate_right", "schedule", "search", "security", "send", "shield", "star", "star_outline",
  "verified_user", "videocam", "visibility", "visibility_off",
].join(",");

const ICON_FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" +
  `&icon_names=${ICON_NAMES}&display=block`;

const FAVICON = "https://cdn.shopify.com/s/files/1/0904/3168/4923/files/Bio_Shoo_Favicon.png?v=1767101139";

export const metadata: Metadata = {
  title: "Whatt Dash",
  description: "WhatsApp Business Dashboard",
  icons: {
    icon: [{ url: FAVICON, type: "image/png" }],
    shortcut: FAVICON,
    apple: FAVICON,
  },
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Whatt Dash" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0c1015",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${font.variable} h-full`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={ICON_FONT_HREF} />
      </head>
      <body
        className="min-h-full antialiased overscroll-none"
        style={{ fontFamily: "var(--font-plus-jakarta), system-ui, sans-serif" }}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
