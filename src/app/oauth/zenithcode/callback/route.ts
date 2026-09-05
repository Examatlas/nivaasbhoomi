import { type NextRequest, NextResponse } from "next/server";

import { verifyOAuthState, exchangeCodeForProfile } from "@/lib/zenith/oauth";
import { encryptSecret } from "@/lib/settings/crypto";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { revalidateDealerPublicPages } from "@/lib/listings/revalidate";

/**
 * GET /oauth/zenithcode/callback
 *
 * Zenith redirects here after the dealer authorizes. We verify the signed
 * `state`, exchange the `code` for a permanent access token + profile
 * (server-to-server), then bind the Zenith ORG to this dealer one-to-one.
 * Ownership is already proven by Zenith's OTP at authorize time, so the two
 * WhatsApp numbers may legitimately differ. On success we store the encrypted
 * token + number + plan + orgId and mark the dealer connected. All failures
 * redirect back to /dealer/automation with a friendly ?error= code (details go
 * to the server log, never the browser).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isDev = process.env.NODE_ENV !== "production";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  // Verify the signed state FIRST so we know whether this flow was opened in a
  // popup (the `popup` claim round-trips safely inside the state).
  const state = await verifyOAuthState(sp.get("state") ?? undefined);
  const popup = state?.popup ?? false;

  // Popup -> return a tiny HTML page that postMessages the result to the opener
  // and closes itself. Non-popup -> the existing full-page redirect (fallback).
  const back = (params: Record<string, string>): NextResponse => {
    if (popup) {
      const status = params.connected ? "success" : "error";
      const code = params.error ?? null;
      const payload = JSON.stringify({ source: "nivaasbhoomi-zenith", status, code });
      const html =
        `<!doctype html><html><head><meta charset="utf-8"><title>Connecting…</title></head>` +
        `<body style="font:14px system-ui,-apple-system,sans-serif;padding:24px;text-align:center;color:#57534e">` +
        `<p>Finishing up — you can close this window.</p><script>(function(){` +
        `try{if(window.opener)window.opener.postMessage(${payload},window.location.origin);}catch(e){}` +
        `setTimeout(function(){try{window.close();}catch(e){}},50);})();</script></body></html>`;
      return new NextResponse(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    const url = new URL("/dealer/automation", req.nextUrl.origin);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return NextResponse.redirect(url);
  };

  if (sp.get("error")) return back({ error: "denied" });
  if (!state) return back({ error: "bad_state" });
  const dealerId = state.dealerId;

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

    // HARD FAILURE: a registered WhatsApp number must be present (no wa.me without it).
    if (!profile.phone) {
      console.error(
        "[zenith] no phone field in profile. Available keys:",
        profile.keys.join(", "),
        "-> set ZENITH_PROFILE_PHONE_FIELD to the right key.",
      );
      return back({ error: "no_number", ...(isDev ? { keys: profile.keys.join(",") } : {}) });
    }

    // HARD FAILURE: we bind one-to-one on the Zenith org id, so it must be present.
    if (!profile.orgId) {
      console.error(
        "[zenith] no orgId in profile. Available keys:",
        profile.keys.join(", "),
        "-> set ZENITH_PROFILE_ORG_FIELD to the right key.",
      );
      return back({ error: "no_org", ...(isDev ? { keys: profile.keys.join(",") } : {}) });
    }

    // BINDING: one Zenith account <-> one dealer.
    // (a) This dealer is already bound to a DIFFERENT org -> must disconnect first.
    if (dealer.zenithOrgId && dealer.zenithOrgId !== profile.orgId) {
      return back({ error: "dealer_already_linked" });
    }
    // (b) This org is already bound to a DIFFERENT dealer -> refuse, don't overwrite.
    const existing = await Dealer.findOne(
      { zenithOrgId: profile.orgId },
      { _id: 1 },
    ).lean();
    if (existing && String(existing._id) !== dealerId) {
      return back({ error: "zenith_already_linked" });
    }
    // (same dealer + same org, or org currently unbound) -> allow (reconnect/refresh).

    dealer.zenithOrgId = profile.orgId;
    dealer.zenithAccessTokenEnc = encryptSecret(profile.accessToken);
    dealer.zenithRefreshTokenEnc = null; // Zenith issues a permanent token
    dealer.zenithTokenExpiresAt = null;
    dealer.zenithNumber = profile.phone;
    dealer.zenithPlan = profile.plan ?? "connected";
    dealer.zenithConnectedAt = new Date();
    dealer.zenithConnected = true;
    try {
      await dealer.save();
    } catch (e) {
      // Race backstop: the partial-unique index rejects a second binding to the
      // same org with a duplicate-key error -> map to the same friendly code.
      if ((e as { code?: number }).code === 11000) {
        return back({ error: "zenith_already_linked" });
      }
      throw e; // anything else -> outer catch -> ?error=server
    }

    // Cards + detail now show the WhatsApp button — refresh the dealer's public
    // pages so they don't stay on "Contact Us" for the ISR window.
    await revalidateDealerPublicPages(dealerId);

    return back({ connected: "1" });
  } catch (e) {
    console.error("[zenith] callback error:", e);
    return back({ error: "server" });
  }
}
