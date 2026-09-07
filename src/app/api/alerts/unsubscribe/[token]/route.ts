import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { verifyAlertToken } from "@/lib/alerts/token";
import { unsubscribeAll } from "@/lib/alerts/service";

/**
 * GET /api/alerts/unsubscribe/[token]
 *
 * One-click, NO-LOGIN unsubscribe from a property-alert link. Verifies the
 * signed token, turns off every alert for that phone (never notified again
 * until the buyer re-enables from /alerts), and redirects to /alerts.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/alerts/unsubscribe/[token]">) {
  const { token } = await ctx.params;
  const claims = await verifyAlertToken(token);
  if (!claims) {
    return NextResponse.redirect(new URL("/alerts?error=badtoken", req.nextUrl.origin));
  }
  await unsubscribeAll(claims.phone);
  return NextResponse.redirect(new URL("/alerts?unsubscribed=1", req.nextUrl.origin));
}
