/**
 * Platform maintenance mode — reader + 503 page for the proxy (src/proxy.ts).
 *
 * The WSend platform stores a founder-controlled maintenance document in its
 * `platform_settings` table (key='maintenance', anon-readable by design).
 * This app enforces the "website" surface of that document, 100% server-side:
 * when the wall is up the proxy answers 503 and the real app never renders.
 *
 * Env (all optional — the check is inert until the first two are set):
 *   PLATFORM_SETTINGS_SUPABASE_URL       platform Supabase URL (the WSend one)
 *   PLATFORM_SETTINGS_SUPABASE_ANON_KEY  its public anon key
 *   MAINTENANCE_PREVIEW_TOKEN            secret for the ?preview=<token> bypass
 */

export interface MaintenanceState {
  enabled: boolean;
  scope: "full" | "paths";
  paths: string[];
  surfaces: Array<"panel" | "website">;
  title: string;
  message: string;
}

const DEFAULT_TITLE = "We'll be right back";
const DEFAULT_MESSAGE = "Scheduled maintenance is under way. Please check back shortly.";

export const MAINTENANCE_OFF: MaintenanceState = {
  enabled: false,
  scope: "full",
  paths: [],
  surfaces: [],
  title: DEFAULT_TITLE,
  message: DEFAULT_MESSAGE,
};

const PATH_RE = /^\/[A-Za-z0-9/_.-]{0,199}$/;

/** Coerce any stored shape into a valid state; never throws. */
export function parseMaintenance(raw: unknown): MaintenanceState {
  const o =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const title = typeof o.title === "string" ? o.title.trim().slice(0, 120) : "";
  const message = typeof o.message === "string" ? o.message.trim().slice(0, 1000) : "";
  return {
    enabled: o.enabled === true,
    scope: o.scope === "paths" ? "paths" : "full",
    paths: Array.isArray(o.paths)
      ? o.paths.filter((p): p is string => typeof p === "string" && PATH_RE.test(p)).slice(0, 20)
      : [],
    surfaces: Array.isArray(o.surfaces)
      ? [...new Set(o.surfaces.filter((s): s is "panel" | "website" => s === "panel" || s === "website"))]
      : [],
    title: title || DEFAULT_TITLE,
    message: message || DEFAULT_MESSAGE,
  };
}

// ---- cached read (~20s TTL, fail open, stale-while-error) ----

const TTL_MS = 20_000;
let cached: { state: MaintenanceState; at: number } | null = null;

export async function getMaintenance(): Promise<MaintenanceState> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.state;

  const base = (process.env.PLATFORM_SETTINGS_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const anon = process.env.PLATFORM_SETTINGS_SUPABASE_ANON_KEY ?? "";
  if (!base || !anon) return MAINTENANCE_OFF; // not configured — wall disabled

  try {
    const res = await fetch(
      `${base}/rest/v1/platform_settings?key=eq.maintenance&select=value&limit=1`,
      {
        headers: { apikey: anon, authorization: `Bearer ${anon}` },
        cache: "no-store",
        signal: AbortSignal.timeout(3_000),
      },
    );
    if (!res.ok) throw new Error(`platform_settings read ${res.status}`);
    const rows = (await res.json()) as Array<{ value?: unknown }>;
    const state = parseMaintenance(Array.isArray(rows) && rows[0] ? rows[0].value : null);
    cached = { state, at: now };
    return state;
  } catch {
    // An unreadable flag must never take the app down: keep the previous
    // answer for one more TTL (or "off" when there is none).
    cached = { state: cached?.state ?? MAINTENANCE_OFF, at: now };
    return cached.state;
  }
}

/** True when `pathname` is walled off under the given state. */
export function maintenanceBlocksPath(state: MaintenanceState, pathname: string): boolean {
  // WhatsApp webhook ingestion stays up: maintenance means humans can't
  // browse, never that customer messages get dropped (Meta retries 503s,
  // then may disable the webhook — that loss is not acceptable).
  if (pathname === "/api/webhook" || pathname.startsWith("/api/webhook/")) return false;
  if (state.scope === "paths") {
    return state.paths.some(
      (p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`),
    );
  }
  return true;
}

/** Constant-time-ish compare for the short preview token (no early exit). */
export function tokenMatches(provided: string, expected: string): boolean {
  if (expected.length === 0) return false;
  let diff = provided.length ^ expected.length;
  const n = Math.max(provided.length, expected.length);
  for (let i = 0; i < n; i++) {
    diff |= (provided.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// ---- 503 page (self-contained; no assets, no client JS) ----

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const MAINTENANCE_HEADERS: Record<string, string> = {
  "cache-control": "no-store",
  "retry-after": "600",
};

export function renderMaintenanceHtml(state: MaintenanceState): string {
  const title = escapeHtml(state.title);
  const message = escapeHtml(state.message).replace(/\n/g, "<br/>");
  const brand = escapeHtml(process.env.NEXT_PUBLIC_BRAND_NAME ?? "Whatt Dash");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>${title} — ${brand}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{min-height:100%}
  body{
    font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    background:#0b0d12;color:#e8eaf2;display:flex;align-items:center;justify-content:center;
    padding:24px;position:relative;overflow:hidden;
  }
  .blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:.3;pointer-events:none}
  .b1{width:420px;height:420px;background:#10b981;top:-140px;left:-110px}
  .b2{width:380px;height:380px;background:#3b82f6;bottom:-150px;right:-100px;opacity:.2}
  .card{
    position:relative;max-width:480px;width:100%;text-align:center;
    background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);
    border-radius:22px;padding:44px 32px;
    box-shadow:0 24px 70px rgba(0,0,0,.45);
  }
  .brand{font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:.78rem;color:#9aa3b8;margin-bottom:18px}
  .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#f6b35c;margin-right:8px;animation:pulse 1.6s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:.45}50%{opacity:1}}
  h1{font-size:1.55rem;line-height:1.25;margin-bottom:12px}
  p.msg{color:#b9c0d2;font-size:.98rem}
</style>
</head>
<body>
  <span class="blob b1"></span><span class="blob b2"></span>
  <main class="card">
    <p class="brand"><span class="dot"></span>${brand}</p>
    <h1>${title}</h1>
    <p class="msg">${message}</p>
  </main>
</body>
</html>`;
}
