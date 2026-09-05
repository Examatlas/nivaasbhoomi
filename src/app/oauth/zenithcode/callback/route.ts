import { type NextRequest, NextResponse } from "next/server";

import { verifyOAuthState, exchangeCodeForProfile } from "@/lib/zenith/oauth";
import { encryptSecret } from "@/lib/settings/crypto";
import { normalisePhone } from "@/lib/utils/whatsapp";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";

/**
 * GET /oauth/zenithcode/callback
 *
 * Zenith redirects here after the dealer authorizes. We verify the signed
 * `state`, exchange the `code` for a permanent access token + profile
 * (server-to-server), then run the MANDATORY GATE: the WhatsApp number
 * registered on Zenith must match this dealer's number. On success we store the
 * encrypted token + number + plan and mark the dealer connected. All failures
 * redirect back to /dealer/automation with a friendly ?error= code (details go
 * to the server log, never the browser).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isDev = process.env.NODE_ENV !== "production";

function back(params: Record<string, string>): NextResponse {
  const url = new URL(
    "/dealer/automation",
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  );
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  if (sp.get("error")) {
    return back({ error: "denied" });
  }

  const dealerId = await verifyOAuthState(sp.get("state") ?? undefined);
  if (!dealerId) return back({ error: "bad_state" });

  const code = sp.get("code");
  if (!code) return back({ error: "no_code" });

  try {
    const result = await exchangeCodeForProfile(code);
    if (!result.ok || !result.profile) {
      console.error("[zenith] token exchange failed:", result.error);
      return back({ error: "exchange" });
    }
    const profile = result.profile;

    await connectDB();
    const dealer = await Dealer.findById(dealerId);
    if (!dealer) return back({ error: "no_dealer" });

    // GATE 1: a registered WhatsApp number must be present.
    if (!profile.phone) {
      console.error(
        "[zenith] no phone field in profile. Available keys:",
        profile.keys.join(", "),
        "-> set ZENITH_PROFILE_PHONE_FIELD to the right key.",
      );
      return back({ error: "no_number", ...(isDev ? { keys: profile.keys.join(",") } : {}) });
    }

    // GATE 2: it must be THIS dealer's number (they can't connect someone else's).
    if (normalisePhone(dealer.phone) !== profile.phone) {
      return back({ error: "number_mismatch", znum: profile.phone });
    }

    dealer.zenithAccessTokenEnc = encryptSecret(profile.accessToken);
    dealer.zenithRefreshTokenEnc = null; // Zenith issues a permanent token
    dealer.zenithTokenExpiresAt = null;
    dealer.zenithNumber = profile.phone;
    dealer.zenithPlan = profile.plan ?? "connected";
    dealer.zenithConnectedAt = new Date();
    dealer.zenithConnected = true;
    await dealer.save();

    return back({ connected: "1" });
  } catch (e) {
    console.error("[zenith] callback error:", e);
    return back({ error: "server" });
  }
}
