import { NextResponse, type NextRequest } from "next/server";

import { verifySession } from "@/lib/auth/jwt";
import { ADMIN_COOKIE, DEALER_COOKIE } from "@/lib/auth/cookie";
import { dealerLoginEnabled } from "@/lib/config/flags";
import { GEO_COOKIE, encodeGeo } from "@/lib/locations/geo";

/**
 * Edge proxy (Next 16's renamed middleware) - DEV-SPEC.txt Section 8.
 *
 * Gates two private surfaces on a valid session, verified from the httpOnly
 * cookie with jose (Edge-compatible):
 *   - /admin/*  and /api/admin/*  require role 'admin'
 *   - /dealer/*                    requires role 'dealer'
 *
 * The two login pages (and the OTP + login APIs, which live under /api/auth/*
 * and are not matched here) stay public. This runs BEFORE the route; admin API
 * routes additionally call requireAdmin() for defence in depth.
 *
 * It ALSO seeds a geo companion cookie on public pages (never gating them), so
 * the static/ISR home page can detect the visitor's city client-side.
 */
export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/dealer/:path*",
    // Public content pages — geo cookie only, no gating. Excludes api, assets,
    // and the admin/dealer paths handled above.
    "/((?!api|_next/static|_next/image|favicon.ico|admin|dealer|.*\\.).*)",
  ],
};

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dealer")) {
    return gateDealer(req, pathname);
  }
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return gateAdmin(req, pathname);
  }
  // Public page: seed the geo cookie, never block or redirect.
  return withGeoCookie(req);
}

function safeDecode(v: string): string | null {
  try {
    const d = decodeURIComponent(v).trim();
    return d || null;
  } catch {
    return v.trim() || null;
  }
}

/**
 * Copy the visitor's Vercel geo (x-vercel-ip-city / -latitude / -longitude)
 * into the NON-httpOnly `nb_geo` cookie, once. No API key, no permission
 * prompt; the client reads it synchronously to detect the city.
 */
function withGeoCookie(req: NextRequest) {
  const res = NextResponse.next();
  if (req.cookies.get(GEO_COOKIE)) return res; // already resolved this visitor

  const rawCity = req.headers.get("x-vercel-ip-city");
  const rawLat = req.headers.get("x-vercel-ip-latitude");
  const rawLng = req.headers.get("x-vercel-ip-longitude");
  if (!rawCity && !rawLat) return res; // no geo (local/dev) — leave to defaults

  const lat = rawLat != null ? Number(rawLat) : NaN;
  const lng = rawLng != null ? Number(rawLng) : NaN;
  res.cookies.set(
    GEO_COOKIE,
    encodeGeo({
      city: rawCity ? safeDecode(rawCity) : null,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    }),
    { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax", httpOnly: false },
  );
  return res;
}

async function gateDealer(req: NextRequest, pathname: string) {
  // Launch: the dealer panel is parked (no WhatsApp OTP yet). Let /dealer/login
  // render its "coming soon" page; bounce every deeper /dealer/* route to it so
  // nothing 404s or leaks a half-working panel.
  if (!dealerLoginEnabled()) {
    if (pathname === "/dealer/login") return NextResponse.next();
    return NextResponse.redirect(new URL("/dealer/login", req.url));
  }

  // /dealer/register is the SELF-SIGNUP page: the visitor is here to BECOME a
  // dealer, so they hold a BUYER session, not a dealer one. Gating it dealer-only
  // sent it to /dealer/login?next=/dealer/register and looped forever. Let it
  // through — the page's own guard routes (no session → login, already a dealer
  // → dashboard, buyer session → the registration form).
  if (pathname === "/dealer/register") return NextResponse.next();

  const claims = await verifySession(req.cookies.get(DEALER_COOKIE)?.value);
  const isDealer = claims?.role === "dealer";

  // The login page is public. Send an already-authenticated dealer onward.
  if (pathname === "/dealer/login") {
    if (isDealer) {
      return NextResponse.redirect(new URL("/dealer/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (isDealer) return NextResponse.next();

  const loginUrl = new URL("/dealer/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

async function gateAdmin(req: NextRequest, pathname: string) {
  const claims = await verifySession(req.cookies.get(ADMIN_COOKIE)?.value);
  const isAdmin = claims?.role === "admin";

  // The login page is public. Send an already-authenticated admin onward.
  if (pathname === "/admin/login") {
    if (isAdmin) {
      return NextResponse.redirect(new URL("/admin/locations", req.url));
    }
    return NextResponse.next();
  }

  if (isAdmin) return NextResponse.next();

  // Unauthenticated: JSON 401 for API, redirect to login for pages.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Admin authentication required." },
      },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/admin/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}
