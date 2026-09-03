/**
 * Seed a handful of realistic APPROVED listings in ONE locality (Kanke, Ranchi)
 * so the public property, locality and filter pages can be exercised with real
 * variety - different BHK, price and purpose (sale/rent), and a plot. Uses the
 * bundled /public/samples photos (no Cloudinary needed).
 *
 * Also gives the locality 500+ chars of intro text so that, with 3+ approved
 * listings, it AUTO-ACTIVATES (Section 13) - otherwise the locality page would
 * 404. Only fills intro text if it is empty, so admin edits are preserved.
 *
 *   npm run seed:demo-listing
 *
 * Idempotent: each listing is keyed by (dealer, title) and updated in place on
 * re-run; slugs never change. Delete later from Admin -> Listings (the demo
 * dealer's phone is 919000000099; titles start with "Demo:").
 */
import "@/scripts/load-env";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { Dealer } from "@/lib/db/models/Dealer";
import { Listing } from "@/lib/db/models/Listing";
import {
  recalculateCounters,
  recalculateLocalityActivation,
} from "@/lib/locations/activation";

const DEMO_PHONE = "919000000099";
const photo = (file: string) => ({
  url: `/samples/${file}.jpg`,
  width: 1200,
  height: 900,
});

const LOCALITY_INTRO =
  "Kanke, in the north-west of Ranchi, is one of the city's most sought-after " +
  "residential pockets. Anchored by the Kanke Dam and the sprawling BIT Mesra and " +
  "university campuses nearby, it blends leafy, low-density neighbourhoods with " +
  "steadily improving connectivity to the city centre via Kanke Road. Buyers here " +
  "find a healthy mix of gated apartment societies, independent houses and " +
  "residential plots, with prices that remain more approachable than the crowded " +
  "central areas. Day-to-day needs are well served by schools, hospitals, markets " +
  "and eateries along the main road, while the dam and surrounding greenery keep " +
  "the area calm and family-friendly. Good social infrastructure, room to grow, " +
  "and clear titles make Kanke a dependable choice for both end-users and long-term " +
  "investors looking at Ranchi's expanding north corridor.";

async function main() {
  await connectDB();

  const city = await City.findOne({ slug: "ranchi" }).lean();
  if (!city) throw new Error("Ranchi city not found - seed locations first.");
  const locality =
    (await Locality.findOne({ cityId: city._id, name: /kanke/i }).lean()) ??
    (await Locality.findOne({ cityId: city._id }).lean());
  if (!locality) throw new Error("No locality found in Ranchi.");

  // Verified (Tier 1) dealer.
  let dealer = await Dealer.findOne({ phone: DEMO_PHONE });
  if (!dealer) {
    dealer = await Dealer.create({
      name: "Demo Dealer",
      businessName: "Ranchi Prime Properties",
      phone: DEMO_PHONE,
      slug: "ranchi-prime-properties-demo",
      documents: { pan: { verified: true }, aadhaar: { verified: true } },
      rating: 4.6,
      ratingCount: 23,
      avgResponseMinutes: 12,
      status: "active",
    });
  }

  // Give the locality intro text (only if empty) so it can auto-activate.
  if (!locality.introText || locality.introText.trim().length < 500) {
    await Locality.updateOne(
      { _id: locality._id },
      { $set: { introText: LOCALITY_INTRO, status: "approved" } },
    );
  }

  const base = {
    dealerId: dealer._id,
    stateId: city.stateId,
    cityId: city._id,
    localityId: locality._id,
    pincode: (locality.pincodes ?? [])[0],
    ownershipType: "Freehold",
    possessionStatus: "ready-to-move",
    waterSource: ["Municipal", "Borewell"],
    status: "approved" as const,
  };

  // 4 listings: 3BHK sale flat, 2BHK rent flat, 4BHK sale villa, plot for sale.
  const listings = [
    {
      ...base,
      purpose: "sale" as const,
      propertyType: "flat" as const,
      title: "Demo: Spacious 3 BHK in a gated society near Kanke Road",
      description:
        "A bright, well-ventilated 3 BHK in a well-maintained gated society, walking distance from Kanke Road. " +
        "Large living-dining area, modular kitchen, three good-sized bedrooms with wardrobes and a balcony with a " +
        "green view. Covered parking, 24x7 power backup, lift and a children's play area. Close to schools, " +
        "hospitals and daily-needs markets - ideal for a family looking for a ready-to-move home in Ranchi.",
      lat: 23.4041,
      lng: 85.3096,
      bhk: "3",
      bathrooms: 3,
      balconies: 2,
      carpetArea: 1250,
      builtUpArea: 1500,
      floor: 4,
      totalFloors: 8,
      facing: "North-East",
      ageOfProperty: "0-5 years",
      furnishing: "semi-furnished" as const,
      furnishingDetails: ["Modular kitchen", "Wardrobes", "Geysers"],
      amenities: [
        "Lift",
        "Power backup",
        "Covered parking",
        "Children's play area",
        "24x7 security",
      ],
      parking: "1 covered",
      expectedPrice: 5_200_000,
      priceNegotiable: true,
      brokerage: "No brokerage",
      maintenanceCharge: 2500,
      photos: [
        photo("apt-building"),
        photo("living-room2"),
        photo("kitchen"),
        photo("bedroom"),
        photo("balcony"),
      ],
      coverPhotoIndex: 0,
    },
    {
      ...base,
      purpose: "rent" as const,
      propertyType: "flat" as const,
      title: "Demo: Fully furnished 2 BHK for rent near Kanke",
      description:
        "A comfortable, fully furnished 2 BHK available for rent in a quiet residential building near Kanke. " +
        "Comes with beds, wardrobes, sofa, dining set, fridge, washing machine and ACs in both bedrooms. " +
        "Bright rooms, a functional kitchen and a balcony overlooking the street. Reserved two-wheeler parking, " +
        "reliable water supply and power backup. Family-preferred, close to markets and schools - move-in ready.",
      lat: 23.4053,
      lng: 85.3078,
      bhk: "2",
      bathrooms: 2,
      balconies: 1,
      carpetArea: 980,
      builtUpArea: 1150,
      floor: 2,
      totalFloors: 5,
      facing: "East",
      ageOfProperty: "5-10 years",
      furnishing: "furnished" as const,
      furnishingDetails: [
        "Beds",
        "Wardrobes",
        "Sofa",
        "Fridge",
        "Washing machine",
        "2 ACs",
      ],
      amenities: ["Power backup", "Two-wheeler parking", "Water supply"],
      parking: "1 two-wheeler",
      monthlyRent: 25_000,
      securityDeposit: 75_000,
      rentNegotiable: true,
      preferredTenant: ["Family"],
      minLeasePeriod: "11 months",
      maintenanceCharge: 1500,
      photos: [
        photo("apt-exterior"),
        photo("living-room"),
        photo("dining"),
        photo("kitchen"),
        photo("bedroom"),
      ],
      coverPhotoIndex: 0,
    },
    {
      ...base,
      purpose: "sale" as const,
      propertyType: "villa" as const,
      title: "Demo: 4 BHK independent villa with garden near Kanke",
      description:
        "A premium 4 BHK independent villa set on a corner plot in a peaceful lane off Kanke Road. Double-height " +
        "living room, a large modular kitchen, four en-suite bedrooms, a home-office/study and a private garden " +
        "with a lawn. Stilt parking for two cars, a solar water heater, and a boundary wall with a gate. Excellent " +
        "natural light and ventilation throughout - a rare, ready-to-move independent home for a large family.",
      lat: 23.4029,
      lng: 85.3112,
      bhk: "4",
      bathrooms: 4,
      balconies: 3,
      carpetArea: 2600,
      builtUpArea: 3200,
      plotArea: 3600,
      floor: 0,
      totalFloors: 2,
      facing: "North",
      ageOfProperty: "0-5 years",
      furnishing: "unfurnished" as const,
      amenities: ["Private garden", "Stilt parking", "Solar water heater", "Gated"],
      parking: "2 cars (stilt)",
      expectedPrice: 12_500_000,
      priceNegotiable: false,
      brokerage: "1% + GST",
      photos: [
        photo("villa"),
        photo("villa2"),
        photo("house-exterior"),
        photo("living-room2"),
        photo("kitchen"),
      ],
      coverPhotoIndex: 0,
    },
    {
      ...base,
      purpose: "sale" as const,
      propertyType: "plot" as const,
      title: "Demo: North-facing residential plot near Kanke",
      description:
        "A clean, north-facing residential plot in a developing pocket near Kanke, on a motorable approach road " +
        "with clear title and RERA-compliant layout. Regular rectangular shape, ready for immediate construction, " +
        "with water and electricity lines available at the boundary. Surrounded by newly built independent homes " +
        "in a rapidly growing neighbourhood - a solid pick for self-construction or long-term investment in Ranchi.",
      lat: 23.4066,
      lng: 85.3061,
      plotArea: 2400,
      facing: "North",
      expectedPrice: 3_800_000,
      priceNegotiable: true,
      brokerage: "No brokerage",
      photos: [photo("plot-land"), photo("land-plot"), photo("house-exterior")],
      coverPhotoIndex: 0,
    },
  ];

  const results: { title: string; slug?: string; purpose: string }[] = [];
  for (const fields of listings) {
    const existing = await Listing.findOne({ dealerId: dealer._id, title: fields.title });
    let doc;
    if (existing) {
      Object.assign(existing, fields);
      await existing.save();
      doc = existing;
    } else {
      doc = await Listing.create(fields);
    }
    results.push({
      title: fields.title,
      slug: doc.slug ?? undefined,
      purpose: fields.purpose,
    });
  }

  // Recalculate the affected city + locality once (drives auto-activation).
  await Promise.all([
    recalculateCounters(city._id),
    recalculateLocalityActivation(locality._id),
  ]);

  const loc = await Locality.findById(locality._id, {
    isActive: 1,
    listingCount: 1,
    name: 1,
    slug: 1,
  }).lean();

  console.log("\n──────────── DEMO LISTINGS READY ────────────");
  console.log(`  City / locality: ${city.name} / ${loc!.name}`);
  console.log(
    `  Locality active: ${loc!.isActive}  (approved listings: ${loc!.listingCount})`,
  );
  console.log(`  Dealer tier:     ${dealer.verificationTier}`);
  console.log("  Listings:");
  for (const r of results) {
    console.log(`    [${r.purpose.padEnd(4)}] /property/${r.slug}`);
  }
  console.log(`\n  Locality page:  /${city.slug}/${loc!.slug}`);
  console.log(`  Filter samples: /${city.slug}/${loc!.slug}/flats`);
  console.log(`                  /${city.slug}/${loc!.slug}/3-bhk-flats`);
  console.log(`                  /${city.slug}/${loc!.slug}/flats-for-rent`);
  console.log(`                  /${city.slug}/${loc!.slug}/plots`);
  console.log("─────────────────────────────────────────────\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("\n✖ demo seed failed:", e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
