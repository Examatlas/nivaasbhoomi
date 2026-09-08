import { test } from "node:test";
import assert from "node:assert/strict";

import {
  decodeGeo,
  encodeGeo,
  matchCityByName,
  haversineKm,
  nearestActiveCity,
  resolveCity,
  type ActiveCity,
} from "./geo";

const RANCHI: ActiveCity = { name: "Ranchi", slug: "ranchi", lat: 23.35, lng: 85.33 };
const PATNA: ActiveCity = { name: "Patna", slug: "patna", lat: 25.61, lng: 85.14 };
const MUMBAI: ActiveCity = { name: "Mumbai", slug: "mumbai", lat: 19.08, lng: 72.88 };
const CITIES = [RANCHI, PATNA, MUMBAI];

test("decodeGeo: round-trips encodeGeo and rejects junk", () => {
  const raw = encodeGeo({ city: "Ranchi", lat: 23.35, lng: 85.33 });
  assert.deepEqual(decodeGeo(raw), { city: "Ranchi", lat: 23.35, lng: 85.33 });
  assert.equal(decodeGeo(null), null);
  assert.equal(decodeGeo(""), null);
  assert.equal(decodeGeo("not-json"), null);
  // city-only (no coords) is still valid; empty object is not.
  assert.deepEqual(decodeGeo(encodeGeo({ city: "X", lat: null, lng: null })), {
    city: "X",
    lat: null,
    lng: null,
  });
  assert.equal(decodeGeo(encodeGeo({ city: null, lat: null, lng: null })), null);
});

test("matchCityByName: exact and prefix, case-insensitive", () => {
  assert.equal(matchCityByName(CITIES, "ranchi")?.slug, "ranchi");
  assert.equal(matchCityByName(CITIES, "RANCHI")?.slug, "ranchi");
  assert.equal(matchCityByName(CITIES, "Ranch")?.slug, "ranchi"); // detected prefix
  assert.equal(matchCityByName(CITIES, "Delhi"), null);
  assert.equal(matchCityByName(CITIES, null), null);
});

test("haversineKm: known distance is in the right ballpark", () => {
  const km = haversineKm(
    { lat: RANCHI.lat!, lng: RANCHI.lng! },
    { lat: PATNA.lat!, lng: PATNA.lng! },
  );
  assert.ok(km > 240 && km < 300, `expected ~250-290km, got ${km}`);
});

test("nearestActiveCity: picks the closest city with coords", () => {
  // A point just outside Ranchi resolves to Ranchi, not Patna/Mumbai.
  assert.equal(nearestActiveCity(CITIES, 23.4, 85.3)?.slug, "ranchi");
  // A point near Patna resolves to Patna.
  assert.equal(nearestActiveCity(CITIES, 25.6, 85.1)?.slug, "patna");
  // No coords anywhere → null.
  assert.equal(
    nearestActiveCity([{ name: "X", slug: "x", lat: null, lng: null }], 1, 1),
    null,
  );
});

test("resolveCity: an explicit, still-active selection wins", () => {
  const r = resolveCity({ cities: CITIES, selectedSlug: "patna", geo: { city: "Ranchi", lat: 23.3, lng: 85.3 } });
  assert.equal(r?.city.slug, "patna");
  assert.equal(r?.source, "selected");
});

test("resolveCity: a stale selection (no longer active) is ignored", () => {
  const r = resolveCity({ cities: CITIES, selectedSlug: "kolkata", geo: null });
  assert.equal(r?.source, "default");
  assert.equal(r?.city.slug, "ranchi");
});

test("resolveCity: detected active city is used", () => {
  const r = resolveCity({ cities: CITIES, geo: { city: "Patna", lat: null, lng: null } });
  assert.equal(r?.city.slug, "patna");
  assert.equal(r?.source, "detected");
});

test("resolveCity: detected-but-inactive city → nearest active by coords", () => {
  // Jamshedpur isn't active; its coords are closest to Ranchi.
  const r = resolveCity({
    cities: CITIES,
    geo: { city: "Jamshedpur", lat: 22.8, lng: 86.2 },
  });
  assert.equal(r?.source, "nearest");
  assert.equal(r?.city.slug, "ranchi");
  assert.equal(r?.detectedName, "Jamshedpur");
});

test("resolveCity: no geo, no selection → default (first active)", () => {
  const r = resolveCity({ cities: CITIES });
  assert.equal(r?.source, "default");
  assert.equal(r?.city.slug, "ranchi");
});

test("resolveCity: no active cities → null", () => {
  assert.equal(resolveCity({ cities: [] }), null);
});
