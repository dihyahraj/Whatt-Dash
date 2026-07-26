import { NextResponse, type NextRequest } from "next/server";
import {
  getMaintenance,
  maintenanceBlocksPath,
  MAINTENANCE_HEADERS,
  renderMaintenanceHtml,
  tokenMatches,
} from "@/lib/maintenance";

/**
 * Platform maintenance wall (founder-controlled from the WSend admin panel,
 * "website" surface). Enforced here — before any route renders — so when the
 * wall is up, visitors get a 503 with a self-contained page and the real app
 * (pages AND /api/*, except webhook ingestion) is never served. Inert until
 * PLATFORM_SETTINGS_SUPABASE_URL/_ANON_KEY are configured.
 *
 * Bypass (server-side only): visit any URL with ?preview=<token> where the
 * token equals MAINTENANCE_PREVIEW_TOKEN — an httpOnly cookie is set and the
 * query param is dropped, so the session keeps browsing the real app.
 */

const PREVIEW_COOKIE = "wd_maintenance_preview";

export async function proxy(request: NextRequest) {
  const maint = await getMaintenance();
  if (!maint.enabled || !maint.surfaces.includes("website")) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (!maintenanceBlocksPath(maint, pathname)) return NextResponse.next();

  const expected = process.env.MAINTENANCE_PREVIEW_TOKEN ?? "";

  // Fresh preview grant: exchange the query token for an httpOnly cookie and
  // clean the URL (the secret must not linger in history/referrers).
  const provided = request.nextUrl.searchParams.get("preview");
  if (provided !== null && tokenMatches(provided, expected)) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("preview");
    const res = NextResponse.redirect(clean);
    res.cookies.set(PREVIEW_COOKIE, expected, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return res;
  }

  // Existing preview grant: cookie value must still equal the server secret —
  // a forged or stale cookie fails closed.
  const cookie = request.cookies.get(PREVIEW_COOKIE)?.value ?? "";
  if (cookie !== "" && tokenMatches(cookie, expected)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, error: "maintenance" },
      { status: 503, headers: MAINTENANCE_HEADERS },
    );
  }
  return new NextResponse(renderMaintenanceHtml(maint), {
    status: 503,
    headers: { ...MAINTENANCE_HEADERS, "content-type": "text/html; charset=utf-8" },
  });
}

export const config = {
  // Everything except Next internals and static files — the wall must cover
  // every page and API route (webhook ingestion is exempted in code, where
  // the decision is documented).
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)"],
};
