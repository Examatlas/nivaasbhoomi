import { test } from "node:test";
import assert from "node:assert/strict";

import { computeVerificationTier, effectiveVerificationTier } from "@/lib/dealers/tier";

const v = (verified: boolean) => ({ verified });

test("tier 0: no verified documents", () => {
  assert.equal(computeVerificationTier({}), 0);
  assert.equal(computeVerificationTier({ documents: { pan: v(true) } }), 0); // aadhaar missing
  assert.equal(computeVerificationTier({ documents: { aadhaar: v(true) } }), 0); // pan missing
});

test("tier 1: PAN + Aadhaar verified", () => {
  assert.equal(
    computeVerificationTier({ documents: { pan: v(true), aadhaar: v(true) } }),
    1,
  );
});

test("tier 2: tier 1 + (GST OR Udyam)", () => {
  const base = { pan: v(true), aadhaar: v(true) };
  assert.equal(computeVerificationTier({ documents: { ...base, gst: v(true) } }), 2);
  assert.equal(computeVerificationTier({ documents: { ...base, udyam: v(true) } }), 2);
});

test("tier 3: tier 2 + RERA", () => {
  assert.equal(
    computeVerificationTier({
      documents: {
        pan: v(true),
        aadhaar: v(true),
        gst: v(true),
        rera: v(true),
      },
    }),
    3,
  );
});

test("tier 4: tier 3 + office photo + 5 site visits + rating >= 4.0", () => {
  const docs = {
    pan: v(true),
    aadhaar: v(true),
    udyam: v(true),
    rera: v(true),
    officePhoto: v(true),
  };
  assert.equal(
    computeVerificationTier({ documents: docs, totalSiteVisits: 5, rating: 4.0 }),
    4,
  );
  // Just short on each tier-4 gate -> stays at 3.
  assert.equal(
    computeVerificationTier({ documents: docs, totalSiteVisits: 4, rating: 4.5 }),
    3,
  );
  assert.equal(
    computeVerificationTier({ documents: docs, totalSiteVisits: 9, rating: 3.9 }),
    3,
  );
  assert.equal(
    computeVerificationTier({
      documents: { ...docs, officePhoto: v(false) },
      totalSiteVisits: 9,
      rating: 5,
    }),
    3,
  );
});

test("tiers are cumulative: a gap resets to the highest fully-met tier", () => {
  // RERA verified but no GST/Udyam -> can only be tier 1, not 3.
  assert.equal(
    computeVerificationTier({
      documents: { pan: v(true), aadhaar: v(true), rera: v(true), officePhoto: v(true) },
      totalSiteVisits: 10,
      rating: 5,
    }),
    1,
  );
});

test("admin downgrade only lowers the tier, never raises it", () => {
  assert.equal(effectiveVerificationTier(4, 2), 2); // downgrade applied
  assert.equal(effectiveVerificationTier(4, null), 4); // no override
  assert.equal(effectiveVerificationTier(2, 4), 2); // override cannot raise
  assert.equal(effectiveVerificationTier(3, 0), 0); // full downgrade
});
