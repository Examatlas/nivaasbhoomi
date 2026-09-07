import { ok, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { SITE_URL } from "@/lib/seo/site";
import { zenithRedirectUri } from "@/lib/zenith/oauth";

/**
 * GET /api/admin/zenith/redirect-debug   [admin]
 *
 * TEMPORARY diagnostic for the "redirect_uri is not registered" error. Prints
 * the EXACT redirect_uri string this deployment sends to Zenith — character by
 * character — so it can be compared byte-for-byte with the URI registered in
 * Zenith's app. Admin-only; safe to remove once the mismatch is resolved.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const redirectUri = zenithRedirectUri();
  const envRaw = (process.env.ZENITH_REDIRECT_URI ?? "").trim();
  const fallback = `${SITE_URL}/oauth/zenithcode/callback`;

  return ok({
    // The EXACT string sent to Zenith (authorize URL + token exchange, same value).
    redirectUri,
    length: redirectUri.length,
    quoted: JSON.stringify(redirectUri), // reveals any hidden / trailing chars
    charCodes: [...redirectUri].map((c) => c.charCodeAt(0)), // char-by-char
    hasTrailingSlash: redirectUri.endsWith("/"),
    // Which branch produced it, and the raw inputs.
    source: envRaw ? "ZENITH_REDIRECT_URI" : "SITE_URL fallback",
    envZenithRedirectUriSet: envRaw.length > 0,
    envZenithRedirectUriRaw: envRaw,
    siteUrl: SITE_URL,
    siteUrlFallback: fallback,
    // How it appears (single-encoded) inside the authorize query string.
    encodedInQuery: new URLSearchParams({ redirect_uri: redirectUri }).toString(),
  });
});
