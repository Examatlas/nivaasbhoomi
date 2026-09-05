import { NextResponse } from "next/server";

import { getDealerSession } from "@/lib/auth/middleware";
import {
  zenithOAuthConfigured,
  buildAuthorizeUrl,
} from "@/lib/zenith/oauth";

/**
 * GET /api/auth/zenith/start   [dealer auth]
 *
 * Begins the Zenith Code OAuth connect: verifies the dealer session, then
 * redirects the browser to Zenith's authorize URL with a signed `state` (CSRF)
 * bound to this dealer. Zenith returns to /oauth/zenithcode/callback with a code.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getDealerSession();
  if (!session) {
    return NextResponse.redirect(new URL("/dealer/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  }

  if (!zenithOAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/dealer/automation?error=not_configured", base()),
    );
  }

  const authorizeUrl = await buildAuthorizeUrl(session.dealerId);
  return NextResponse.redirect(authorizeUrl);
}

function base(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
