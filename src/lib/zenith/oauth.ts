import { SignJWT, jwtVerify } from "jose";

import { SITE_URL } from "@/lib/seo/site";
import { normalisePhone } from "@/lib/utils/whatsapp";

/**
 * Zenith Code OAuth (per-dealer connect). Zenith's flow is a simplified
 * authorization-code grant — NO scopes, NO PKCE:
 *
 *   1. We send the dealer's browser to ZENITH_OAUTH_AUTHORIZE_URL with
 *      client_id, redirect_uri, response_type=code and a signed `state` (CSRF).
 *   2. Zenith redirects back to the callback with `?code=…` (valid ~60s).
 *   3. Our SERVER immediately POSTs { code, client_id, client_secret,
 *      redirect_uri } to ZENITH_OAUTH_TOKEN_URL and gets back, in one response,
 *      a PERMANENT access_token PLUS the dealer's profile (registered WhatsApp
 *      number + plan). The browser never sees this step.
 *
 * The exact request shape in step 3 is per Zenith's docs. The profile FIELD
 * NAMES aren't fixed here — we look up common names and allow env overrides
 * (ZENITH_PROFILE_PHONE_FIELD / ZENITH_PROFILE_PLAN_FIELD), and the callback
 * surfaces the actual keys in development if a lookup misses, so mapping is a
 * config change, not a code change.
 */

export interface ZenithProfile {
  accessToken: string;
  phone: string | null;
  plan: string | null;
  /** Top-level keys of the profile response — shown in dev to fix field mapping. */
  keys: string[];
}

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function zenithOAuthConfigured(): boolean {
  return Boolean(
    env("ZENITH_CLIENT_ID") &&
      env("ZENITH_CLIENT_SECRET") &&
      env("ZENITH_OAUTH_AUTHORIZE_URL") &&
      tokenUrl(),
  );
}

/** Human-readable list of what's missing, for a dev-friendly error. */
export function zenithConfigProblems(): string[] {
  const missing: string[] = [];
  if (!env("ZENITH_CLIENT_ID")) missing.push("ZENITH_CLIENT_ID");
  if (!env("ZENITH_CLIENT_SECRET")) missing.push("ZENITH_CLIENT_SECRET");
  if (!env("ZENITH_OAUTH_AUTHORIZE_URL")) missing.push("ZENITH_OAUTH_AUTHORIZE_URL");
  if (!tokenUrl()) missing.push("ZENITH_OAUTH_TOKEN_URL (or ZENITH_API_BASE_URL)");
  return missing;
}

/** Token endpoint: explicit URL, else {API_BASE}/api/oauth/token. */
function tokenUrl(): string {
  const explicit = env("ZENITH_OAUTH_TOKEN_URL");
  if (explicit) return explicit;
  const base = env("ZENITH_API_BASE_URL");
  return base ? `${base.replace(/\/+$/, "")}/api/oauth/token` : "";
}

export function zenithRedirectUri(): string {
  return env("ZENITH_REDIRECT_URI") || `${SITE_URL}/oauth/zenithcode/callback`;
}

// ---- CSRF state (a short-lived signed JWT tying the flow to one dealer) ----

function stateSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) throw new Error("JWT_SECRET is required.");
  return new TextEncoder().encode(secret);
}

export async function signOAuthState(dealerId: string): Promise<string> {
  return new SignJWT({ purpose: "zenith_oauth", dealerId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(stateSecret());
}

export async function verifyOAuthState(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, stateSecret(), { algorithms: ["HS256"] });
    if (payload.purpose !== "zenith_oauth" || typeof payload.dealerId !== "string") return null;
    return payload.dealerId;
  } catch {
    return null;
  }
}

// ---- Authorize redirect ----

export async function buildAuthorizeUrl(dealerId: string): Promise<string> {
  const url = new URL(env("ZENITH_OAUTH_AUTHORIZE_URL"));
  url.searchParams.set("client_id", env("ZENITH_CLIENT_ID"));
  url.searchParams.set("redirect_uri", zenithRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", await signOAuthState(dealerId));
  return url.toString();
}

// ---- Token exchange (server-to-server) ----

export interface ExchangeResult {
  ok: boolean;
  profile?: ZenithProfile;
  error?: string;
}

export async function exchangeCodeForProfile(code: string): Promise<ExchangeResult> {
  const url = tokenUrl();
  if (!url) return { ok: false, error: "Zenith token endpoint is not configured." };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        code,
        client_id: env("ZENITH_CLIENT_ID"),
        client_secret: env("ZENITH_CLIENT_SECRET"),
        redirect_uri: zenithRedirectUri(),
        grant_type: "authorization_code",
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Token request failed." };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Zenith token exchange ${res.status}: ${text.slice(0, 200)}` };
  }

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json) return { ok: false, error: "Zenith returned a non-JSON token response." };

  const accessToken = String(
    findField(json, ["access_token", "accessToken", "token"]) ?? "",
  );
  if (!accessToken) {
    return { ok: false, error: "No access_token in Zenith's response." };
  }

  const phoneRaw = findField(json, [
    env("ZENITH_PROFILE_PHONE_FIELD"),
    "whatsapp_number",
    "whatsappNumber",
    "whatsapp",
    "wa_number",
    "phone_number",
    "phoneNumber",
    "phone",
    "number",
    "msisdn",
    "mobile",
  ]);
  const planRaw = findField(json, [
    env("ZENITH_PROFILE_PLAN_FIELD"),
    "plan",
    "plan_name",
    "planName",
    "subscription",
    "subscription_plan",
    "tier",
    "status",
  ]);

  return {
    ok: true,
    profile: {
      accessToken,
      phone: phoneRaw != null ? normalisePhone(String(phoneRaw)) : null,
      plan: planRaw != null ? String(planRaw) : null,
      keys: profileKeys(json),
    },
  };
}

/**
 * Look up a field by any of several names, checking the top level and common
 * containers (profile/user/data/account) one level deep. Empty names ignored.
 */
function findField(obj: Record<string, unknown>, names: (string | undefined)[]): unknown {
  const containers: Record<string, unknown>[] = [obj];
  for (const c of ["profile", "user", "data", "account"]) {
    const nested = obj[c];
    if (nested && typeof nested === "object") containers.push(nested as Record<string, unknown>);
  }
  for (const name of names) {
    if (!name) continue;
    for (const c of containers) {
      if (c[name] != null && c[name] !== "") return c[name];
    }
  }
  return undefined;
}

/** Keys across the top level + common containers, for the dev field-mapping hint. */
function profileKeys(obj: Record<string, unknown>): string[] {
  const keys = new Set<string>();
  for (const k of Object.keys(obj)) if (k !== "access_token" && k !== "token") keys.add(k);
  for (const c of ["profile", "user", "data", "account"]) {
    const nested = obj[c];
    if (nested && typeof nested === "object") {
      for (const k of Object.keys(nested as Record<string, unknown>)) keys.add(`${c}.${k}`);
    }
  }
  return [...keys];
}
