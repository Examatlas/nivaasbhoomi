import { NextResponse, type NextRequest } from "next/server";

import { verifySession } from "@/lib/auth/jwt";
import { ADMIN_COOKIE, DEALER_COOKIE } from "@/lib/auth/cookie";

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
 */
export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/dealer/:path*"],
};

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dealer")) {
    return gateDealer(req, pathname);
  }
  return gateAdmin(req, pathname);
}

async function gateDealer(req: NextRequest, pathname: string) {
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
