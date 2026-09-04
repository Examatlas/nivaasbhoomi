import { test } from "node:test";
import assert from "node:assert/strict";

import {
  hasQuota,
  rankCandidates,
  decideListingLead,
  decideGenericLead,
  decideRoute,
  type DealerLite,
  type LeadLite,
} from "@/lib/leads/routing";

// ---- builders ----

let seq = 0;
function dealer(overrides: Partial<DealerLite> = {}): DealerLite {
  seq += 1;
  return {
    id: overrides.id ?? `d${seq}`,
    status: "active",
    verificationTier: 1,
    rating: 4,
    leadsUsedThisMonth: 0,
    maxLeadsPerMonth: 10,
    lastAssignedAt: null,
    coverageCities: ["cityA"],
    coverageLocalities: [],
    ...overrides,
  };
}

function lead(overrides: Partial<LeadLite> = {}): LeadLite {
  return {
    assignedDealerId: null,
    listingId: null,
    cityId: "cityA",
    localityId: null,
    ...overrides,
  };
}

// ---- CASE A: listing-based ----

test("listing lead assigns to the active in-quota owner", () => {
  const owner = dealer({ id: "owner1" });
  const d = decideListingLead(owner);
  assert.equal(d.action, "assign");
  assert.equal(d.action === "assign" && d.dealerId, "owner1");
});

test("listing lead: owner not found -> unmatched", () => {
  assert.equal(decideListingLead(null).action, "unmatched");
});

test("listing lead: owner paused/banned -> unmatched", () => {
  assert.equal(decideListingLead(dealer({ status: "paused" })).action, "unmatched");
  assert.equal(decideListingLead(dealer({ status: "banned" })).action, "unmatched");
});

test("listing lead: owner over quota -> quota-exceeded, NOT assigned", () => {
  const owner = dealer({ id: "o", leadsUsedThisMonth: 10, maxLeadsPerMonth: 10 });
  const d = decideListingLead(owner);
  assert.equal(d.action, "quota-exceeded");
  assert.equal(d.action === "quota-exceeded" && d.dealerId, "o");
});

test("listing lead is routed to the OWNER only, never another dealer", () => {
  // decideRoute for a listing lead only ever consults the owner.
  const owner = dealer({ id: "owner", status: "paused" });
  const d = decideRoute(lead({ listingId: "L1" }), {
    owner,
    dealers: [dealer({ id: "other", status: "active" })], // must be ignored
  });
  assert.equal(d.action, "unmatched"); // owner paused -> unmatched, NOT 'other'
});

// ---- hasQuota ----

test("hasQuota", () => {
  assert.equal(hasQuota(dealer({ leadsUsedThisMonth: 4, maxLeadsPerMonth: 5 })), true);
  assert.equal(hasQuota(dealer({ leadsUsedThisMonth: 5, maxLeadsPerMonth: 5 })), false);
  assert.equal(hasQuota(dealer({ leadsUsedThisMonth: 9, maxLeadsPerMonth: 5 })), false);
});

// ---- CASE B: generic ----

test("generic lead: no candidate covering the city -> unmatched", () => {
  const dealers = [dealer({ coverageCities: ["cityZ"] })];
  assert.equal(decideGenericLead(lead(), dealers).action, "unmatched");
});

test("generic lead: no city on the lead -> unmatched", () => {
  assert.equal(decideGenericLead(lead({ cityId: null }), [dealer()]).action, "unmatched");
});

test("generic lead: dealers at quota are excluded", () => {
  const full = dealer({ id: "full", leadsUsedThisMonth: 10, maxLeadsPerMonth: 10 });
  const ok = dealer({ id: "ok" });
  const d = decideGenericLead(lead(), [full, ok]);
  assert.equal(d.action, "assign");
  assert.equal(d.action === "assign" && d.dealerId, "ok");
});

test("generic lead: paused/banned dealers are excluded", () => {
  const d = decideGenericLead(lead(), [
    dealer({ id: "paused", status: "paused" }),
    dealer({ id: "active", status: "active" }),
  ]);
  assert.equal(d.action === "assign" && d.dealerId, "active");
});

// ---- ranking ----

test("ranking: higher verificationTier wins first", () => {
  const ranked = rankCandidates([
    dealer({ id: "t1", verificationTier: 1, rating: 5 }),
    dealer({ id: "t3", verificationTier: 3, rating: 2 }),
    dealer({ id: "t2", verificationTier: 2, rating: 4 }),
  ]);
  assert.deepEqual(ranked.map((d) => d.id), ["t3", "t2", "t1"]);
});

test("ranking: same tier -> higher rating wins", () => {
  const ranked = rankCandidates([
    dealer({ id: "low", verificationTier: 2, rating: 3.5 }),
    dealer({ id: "high", verificationTier: 2, rating: 4.8 }),
  ]);
  assert.deepEqual(ranked.map((d) => d.id), ["high", "low"]);
});

test("ranking: same tier + rating -> older lastAssignedAt first (round-robin)", () => {
  const ranked = rankCandidates([
    dealer({ id: "recent", lastAssignedAt: 2000 }),
    dealer({ id: "never", lastAssignedAt: null }),
    dealer({ id: "old", lastAssignedAt: 1000 }),
  ]);
  // never (null->0) first, then old (1000), then recent (2000).
  assert.deepEqual(ranked.map((d) => d.id), ["never", "old", "recent"]);
});

test("rankCandidates does not mutate its input", () => {
  const input = [dealer({ id: "a", verificationTier: 1 }), dealer({ id: "b", verificationTier: 3 })];
  const before = input.map((d) => d.id);
  rankCandidates(input);
  assert.deepEqual(input.map((d) => d.id), before);
});

// ---- round-robin fairness (sequential) ----

test("round-robin: equal tier+rating leads spread across dealers", () => {
  // Two identical dealers; assign 4 leads in sequence, updating lastAssignedAt
  // on whichever is picked. They should alternate, ending 2 and 2.
  const dealers = [
    dealer({ id: "A", lastAssignedAt: null }),
    dealer({ id: "B", lastAssignedAt: null }),
  ];
  const counts: Record<string, number> = { A: 0, B: 0 };
  let clock = 1000;
  for (let i = 0; i < 4; i++) {
    const d = decideGenericLead(lead(), dealers);
    assert.equal(d.action, "assign");
    const picked = d.action === "assign" ? d.dealerId : "";
    counts[picked] = (counts[picked] ?? 0) + 1;
    // simulate assign() side effect: bump lastAssignedAt + a lead used
    const dd = dealers.find((x) => x.id === picked)!;
    dd.lastAssignedAt = clock++;
    dd.leadsUsedThisMonth += 1;
  }
  assert.equal(counts.A, 2, "A should get 2 of 4");
  assert.equal(counts.B, 2, "B should get 2 of 4");
});

// ---- locality narrowing ----

test("generic lead: narrows to locality coverage when that keeps a candidate", () => {
  const cityOnly = dealer({ id: "cityOnly", coverageLocalities: [] });
  const localityDealer = dealer({ id: "loc", coverageLocalities: ["locX"] });
  const d = decideGenericLead(lead({ localityId: "locX" }), [cityOnly, localityDealer]);
  assert.equal(d.action === "assign" && d.dealerId, "loc");
});

test("generic lead: keeps city-level candidates when NO dealer covers the locality", () => {
  const cityOnly = dealer({ id: "cityOnly", coverageLocalities: [] });
  const d = decideGenericLead(lead({ localityId: "locZ" }), [cityOnly]);
  // Locality match is empty -> fall back to city candidates, so still assigned.
  assert.equal(d.action === "assign" && d.dealerId, "cityOnly");
});

test("locality narrowing beats a higher tier outside the locality", () => {
  const bigCityWide = dealer({ id: "wide", verificationTier: 4, coverageLocalities: [] });
  const smallInLocality = dealer({ id: "inloc", verificationTier: 1, coverageLocalities: ["locX"] });
  const d = decideGenericLead(lead({ localityId: "locX" }), [bigCityWide, smallInLocality]);
  // After narrowing to locality coverage, only 'inloc' remains.
  assert.equal(d.action === "assign" && d.dealerId, "inloc");
});

// ---- EXCLUSIVITY ----

test("EXCLUSIVITY: an already-assigned lead is never reassigned", () => {
  const assigned = lead({ assignedDealerId: "dealerX", listingId: "L1" });
  // Even with a full set of better candidates + a valid owner, decideRoute must
  // report already-assigned and touch nobody else.
  const d = decideRoute(assigned, {
    owner: dealer({ id: "owner" }),
    dealers: [dealer({ id: "better", verificationTier: 4, rating: 5 })],
  });
  assert.equal(d.action, "already-assigned");
  assert.equal(d.action === "already-assigned" && d.dealerId, "dealerX");
});

test("EXCLUSIVITY: generic already-assigned lead also short-circuits", () => {
  const d = decideRoute(lead({ assignedDealerId: "dealerY" }), {
    dealers: [dealer({ id: "cand" })],
  });
  assert.equal(d.action, "already-assigned");
  assert.equal(d.action === "already-assigned" && d.dealerId, "dealerY");
});

// ---- IDEMPOTENCY (decision level) ----

test("IDEMPOTENCY: re-deciding an assigned lead yields the same no-op", () => {
  const first = decideRoute(lead({ listingId: "L1" }), { owner: dealer({ id: "owner" }) });
  assert.equal(first.action, "assign");
  const dealerId = first.action === "assign" ? first.dealerId : "";
  // After assignment the lead carries assignedDealerId; a second decide is a
  // no-op that never re-assigns or picks a different dealer.
  const second = decideRoute(lead({ listingId: "L1", assignedDealerId: dealerId }), {
    owner: dealer({ id: "owner" }),
  });
  assert.equal(second.action, "already-assigned");
  assert.equal(second.action === "already-assigned" && second.dealerId, dealerId);
});
