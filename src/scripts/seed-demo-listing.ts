/**
 * Seed ONE realistic approved listing so the public property page can be viewed
 * and tested before real dealer listings exist. Uses the bundled /public/samples
 * photos (no Cloudinary needed). Idempotent: re-running updates the same demo.
 *
 *   npm run seed:demo-listing
 *
 * Delete it later from Admin -> Listings, or:
 *   the dealer phone is 919000000099 and the title starts with "Demo:".
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

  const fields = {
    dealerId: dealer._id,
    purpose: "sale" as const,
    propertyType: "flat" as const,
    title: "Demo: Spacious 3 BHK in a gated society near Kanke Road",
    description:
      "A bright, well-ventilated 3 BHK in a well-maintained gated society, walking distance from Kanke Road. " +
      "The home has a large living-dining area, a modular kitchen, three good-sized bedrooms with wardrobes, " +
      "and a balcony with a green view. The society offers covered parking, 24x7 power backup, a lift, and a " +
      "children's play area. Close to schools, hospitals and daily-needs markets. Ideal for a family looking " +
      "for a ready-to-move home in a peaceful yet well-connected pocket of Ranchi.",
    stateId: city.stateId,
    cityId: city._id,
    localityId: locality._id,
    lat: 23.4041,
    lng: 85.3096,
    pincode: (locality.pincodes ?? [])[0],
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
    waterSource: ["Municipal", "Borewell"],
    expectedPrice: 5_200_000,
    priceNegotiable: true,
    possessionStatus: "ready-to-move",
    ownershipType: "Freehold",
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
    status: "approved" as const,
  };

  const existing = await Listing.findOne({ dealerId: dealer._id, title: fields.title });
  let listing;
  if (existing) {
    Object.assign(existing, fields);
    await existing.save();
    listing = existing;
  } else {
    listing = await Listing.create(fields);
  }

  await Promise.all([
    recalculateCounters(listing.cityId!),
    recalculateLocalityActivation(listing.localityId!),
  ]);

  console.log("\n✓ Demo listing ready.");
  console.log("  city/locality:", city.name, "/", locality.name);
  console.log("  dealer tier:", dealer.verificationTier);
  console.log("  slug:", listing.slug);
  console.log(`  URL: /property/${listing.slug}\n`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("\n✖ demo seed failed:", e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
