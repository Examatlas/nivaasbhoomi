import { NextResponse, type NextRequest } from "next/server";

import { verifySession } from "@/lib/auth/jwt";
import { ADMIN_COOKIE } from "@/lib/auth/cookie";

/**
 * Edge proxy (Next 16's renamed middleware) - DEV-SPEC.txt Section 8.
 *
 * Gates every /admin/* page and every /api/admin/* route on a valid admin
 * session, verified from the httpOnly cookie with jose (Edge-compatible). The
 * login page and login API sit outside these matchers so they stay reachable.
 * This runs BEFORE the route, and each admin route additionally calls
 * requireAdmin() - defence in depth, so a single layer failing never exposes
 * admin data.
 */
export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const claims = await verifySession(token);
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
