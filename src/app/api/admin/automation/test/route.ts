import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { getAutomationSettings } from "@/lib/settings/automation";

/**
 * POST /api/admin/automation/test   [admin]
 *
 * Best-effort connection check for the stored Zenith Code credentials. Because
 * we don't yet have Zenith's exact "verify key" endpoint, this probes the
 * configured base URL with the API key (Bearer) and reports what the host
 * returned - enough to confirm the URL resolves and the key is being accepted /
 * rejected. Swap `probePath` for Zenith's documented auth-check path once known.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 8000;

export const POST = withErrorHandling(async () => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { zenithApiKey, zenithBaseUrl } = await getAutomationSettings();
  if (!zenithBaseUrl) return fail("VALIDATION_ERROR", "Set the Zenith base URL first.");
  if (!zenithApiKey) return fail("VALIDATION_ERROR", "Set the Zenith API key first.");

  const url = zenithBaseUrl.replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${zenithApiKey}`, Accept: "application/json" },
      signal: controller.signal,
    });
    return ok({
      reachable: true,
      status: res.status,
      ok: res.ok,
      note:
        res.status === 401 || res.status === 403
          ? "Host reachable but rejected the key — check the API key (or the exact auth endpoint)."
          : res.ok
            ? "Host reachable and accepted the request."
            : `Host reachable; returned HTTP ${res.status}. Confirm the correct auth-check path in Zenith docs.`,
    });
  } catch (e) {
    return ok({
      reachable: false,
      note: e instanceof Error ? e.message : "Could not reach the Zenith base URL.",
    });
  } finally {
    clearTimeout(timer);
  }
});
