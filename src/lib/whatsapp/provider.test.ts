import { test } from "node:test";
import assert from "node:assert/strict";

import { whatsAppProvider, isZenithEligible, orchestrateOtpSend, type OtpAttempt } from "@/lib/whatsapp/provider";
import {
  toDigits,
  sanitizeCustomerName,
  sendZenithTemplate,
  DEFAULT_CUSTOMER_NAME,
} from "@/lib/whatsapp/zenith-otp";

const env = process.env as Record<string, string | undefined>;

function withProvider(v: string | undefined, fn: () => void | Promise<void>) {
  const old = env.WHATSAPP_PROVIDER;
  if (v === undefined) delete env.WHATSAPP_PROVIDER;
  else env.WHATSAPP_PROVIDER = v;
  try {
    return fn();
  } finally {
    if (old === undefined) delete env.WHATSAPP_PROVIDER;
    else env.WHATSAPP_PROVIDER = old;
  }
}

test("whatsAppProvider: zenith only when explicitly set, else meta", () => {
  withProvider("zenith", () => assert.equal(whatsAppProvider(), "zenith"));
  withProvider("meta", () => assert.equal(whatsAppProvider(), "meta"));
  withProvider(undefined, () => assert.equal(whatsAppProvider(), "meta"));
  withProvider("garbage", () => assert.equal(whatsAppProvider(), "meta"));
});

test("isZenithEligible: OTP + every registered multi-variable template", () => {
  assert.equal(isZenithEligible("login_otp"), true);
  // Multi-variable templates now go via Zenith (bodyParams/buttonParams).
  assert.equal(isZenithEligible("property_alert"), true);
  assert.equal(isZenithEligible("lead_assigned"), true);
  assert.equal(isZenithEligible("listing_expiry_warning"), true);
  assert.equal(isZenithEligible("dealer_approved"), true);
  assert.equal(isZenithEligible("listing_approved"), true);
  assert.equal(isZenithEligible("listing_rejected"), true);
  // An unknown template name is not eligible.
  assert.equal(isZenithEligible("totally_unknown_template"), false);
});

test("phone always digits-only — a '+' never reaches Zenith", () => {
  assert.equal(toDigits("+919288487841"), "919288487841");
  assert.equal(toDigits("91 92884 87841"), "919288487841");
  assert.equal(toDigits("919288487841"), "919288487841");
});

test("customerName is never empty — blank/whitespace → fallback constant", () => {
  assert.equal(sanitizeCustomerName(""), DEFAULT_CUSTOMER_NAME);
  assert.equal(sanitizeCustomerName("   "), DEFAULT_CUSTOMER_NAME);
  assert.equal(sanitizeCustomerName(undefined), DEFAULT_CUSTOMER_NAME);
  assert.equal(sanitizeCustomerName(null), DEFAULT_CUSTOMER_NAME);
  assert.equal(sanitizeCustomerName("  Ravi  "), "Ravi");
  assert.ok(DEFAULT_CUSTOMER_NAME.length >= 1);
});

test("adapter guards required fields — throws (no blind call) naming the field", async () => {
  await assert.rejects(
    () => sendZenithTemplate({ to: "", code: "123456" }),
    /required field "to"/,
  );
  await assert.rejects(
    () => sendZenithTemplate({ to: "919288487841", code: "" }),
    /required field "code"/,
  );
});

// ---- orchestrateOtpSend (the fallback logic) ----

const OK: OtpAttempt = { ok: true, messageId: "m1" };
function zenith(res: OtpAttempt) {
  let called = false;
  return {
    fn: async () => {
      called = true;
      return res;
    },
    wasCalled: () => called,
  };
}

test("provider=meta → Meta only, Zenith never called", async () => {
  const z = zenith(OK);
  let metaCalled = false;
  const out = await orchestrateOtpSend({
    provider: "meta",
    zenithReady: true,
    sendZenith: z.fn,
    sendMeta: async () => {
      metaCalled = true;
      return OK;
    },
  });
  assert.equal(z.wasCalled(), false);
  assert.equal(metaCalled, true);
  assert.equal(out.via, "meta");
  assert.equal(out.fellBack, false);
});

test("provider=zenith but not configured → Meta", async () => {
  const z = zenith(OK);
  const out = await orchestrateOtpSend({
    provider: "zenith",
    zenithReady: false,
    sendZenith: z.fn,
    sendMeta: async () => OK,
  });
  assert.equal(z.wasCalled(), false);
  assert.equal(out.via, "meta");
});

test("provider=zenith, Zenith delivers → via zenith, no fallback", async () => {
  let metaCalled = false;
  const out = await orchestrateOtpSend({
    provider: "zenith",
    zenithReady: true,
    sendZenith: async () => OK,
    sendMeta: async () => {
      metaCalled = true;
      return OK;
    },
  });
  assert.equal(out.via, "zenith");
  assert.equal(out.fellBack, false);
  assert.equal(metaCalled, false);
});

test("Zenith 5xx → falls back to Meta (delivered)", async () => {
  let fallbackReason: string | null = null;
  let metaCalled = false;
  const out = await orchestrateOtpSend({
    provider: "zenith",
    zenithReady: true,
    sendZenith: async () => ({ ok: false, status: 503, error: "Zenith 503" }),
    sendMeta: async () => {
      metaCalled = true;
      return OK;
    },
    onFallback: (r) => (fallbackReason = r),
  });
  assert.equal(metaCalled, true);
  assert.equal(out.via, "meta_fallback");
  assert.equal(out.fellBack, true);
  assert.equal(out.result.ok, true);
  assert.ok(fallbackReason);
});

test("Zenith timeout/network (no status) → falls back to Meta", async () => {
  let metaCalled = false;
  const out = await orchestrateOtpSend({
    provider: "zenith",
    zenithReady: true,
    sendZenith: async () => ({ ok: false, error: "Zenith timeout (8s)" }),
    sendMeta: async () => {
      metaCalled = true;
      return OK;
    },
  });
  assert.equal(metaCalled, true);
  assert.equal(out.via, "meta_fallback");
  assert.equal(out.fellBack, true);
});

test("Zenith 422 (validation) → DOES fall back to Meta", async () => {
  let metaCalled = false;
  const out = await orchestrateOtpSend({
    provider: "zenith",
    zenithReady: true,
    sendZenith: async () => ({ ok: false, status: 422, error: "Zenith 422" }),
    sendMeta: async () => {
      metaCalled = true;
      return OK;
    },
  });
  assert.equal(metaCalled, true);
  assert.equal(out.via, "meta_fallback");
  assert.equal(out.fellBack, true);
  assert.equal(out.result.ok, true);
});

test("Zenith 4xx (non-422) → does NOT fall back (Meta never called)", async () => {
  let metaCalled = false;
  const out = await orchestrateOtpSend({
    provider: "zenith",
    zenithReady: true,
    sendZenith: async () => ({ ok: false, status: 400, error: "bad template" }),
    sendMeta: async () => {
      metaCalled = true;
      return OK;
    },
  });
  assert.equal(metaCalled, false);
  assert.equal(out.via, "zenith");
  assert.equal(out.fellBack, false);
  assert.equal(out.result.ok, false);
});
