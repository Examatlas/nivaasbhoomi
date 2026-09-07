import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { verifyAlertToken } from "@/lib/alerts/token";
import { recordAlertVisit } from "@/lib/alerts/service";
import { FROM_ALERT_COOKIE, fromAlertCookieOptions } from "@/lib/alerts/from-alert";

/**
 * GET /api/alerts/visit/[token]  — the property-alert link target.
 *
 * Records a "visit" (resets the auto-pause counter for that phone), stamps a
 * short-lived cookie so any enquiry the buyer makes next is flagged fromAlert
 * (high intent), and forwards to /alerts. NO login required.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/alerts/visit/[token]">) {
  const { token } = await ctx.params;
  const claims = await verifyAlertToken(token);
  if (!claims) {
    return NextResponse.redirect(new URL("/alerts?error=badtoken", req.nextUrl.origin));
  }
  await recordAlertVisit(claims.phone);
  const res = NextResponse.redirect(new URL(`/alerts?t=${encodeURIComponent(token)}`, req.nextUrl.origin));
  res.cookies.set(FROM_ALERT_COOKIE, "1", fromAlertCookieOptions());
  return res;
}
