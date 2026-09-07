/**
 * One-off cleanup of TRIAL data — keeps two real dealers and ALL their data,
 * and never touches the location master data (State / City / Locality).
 *
 * SAFETY MODEL
 *   • DRY RUN by default: prints exactly what WOULD change and deletes nothing.
 *       npm run db:cleanup-trial
 *   • Real deletion only with an explicit flag, after a 5-second countdown:
 *       npm run db:cleanup-trial -- --confirm
 *   • MONGODB_URI comes from the environment / .env.local only (no hardcoded
 *     connection string). The target database name is printed up front so this
 *     can never be run against the wrong DB unnoticed.
 *   • CLI only — this is a plain tsx script, not importable by any API route.
 *
 * KEEP LIST (exact businessName, case-insensitive + trimmed — NOT substring, so
 * "Singh Pro" is deleted while "Singh Bro Property" is kept):
 *     1. "Atlas"
 *     2. "Singh Bro Property"
 * GUARD: each keep name must match EXACTLY ONE dealer (2 total). Any other count
 * aborts the run before anything is deleted — no guessing.
 *
 * WHAT IS REMOVED
 *   Dealer          — every dealer except the two keepers
 *   Listing         — listings of the removed dealers (keepers' listings stay)
 *   Lead            — ALL leads (trial data, including the keepers')
 *   Otp, OtpRequestLog, ContactMessage — all
 *   User            — NEVER deleted; only dealerId is unset where it points at a
 *                     removed dealer (those users stay as buyers). Keepers'
 *                     linked users are left untouched.
 */
import "@/scripts/load-env";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { Listing } from "@/lib/db/models/Listing";
import { Lead } from "@/lib/db/models/Lead";
import { Otp } from "@/lib/db/models/Otp";
import { OtpRequestLog } from "@/lib/db/models/OtpRequestLog";
import { ContactMessage } from "@/lib/db/models/ContactMessage";
import { User } from "@/lib/db/models/User";

/** Exact keep names, normalized (trim + lowercase + collapse inner whitespace). */
const KEEP_NAMES = ["Atlas", "Singh Bro Property"];

function norm(s: string): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function mask(uri: string): string {
  return uri.replace(/(:\/\/[^:/@]+:)[^@]+(@)/, "$1****$2");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("\n✖ MONGODB_URI is not set (checked the environment, .env.local and .env).\n");
    process.exit(1);
  }

  console.log(`\n${confirm ? "⚠ LIVE DELETE" : "DRY RUN"} — trial data cleanup`);
  console.log(`Connecting to: ${mask(uri)}`);
  await connectDB();
  console.log(`Database:      ${mongoose.connection.name}\n`);

  // ---- Resolve + GUARD the keep list (exact, one match each) ----
  const allDealers = await Dealer.find({}, { businessName: 1, phone: 1 }).lean();
  const matchesByName = KEEP_NAMES.map((name) => ({
    name,
    docs: allDealers.filter((d) => norm(d.businessName) === norm(name)),
  }));

  const bad = matchesByName.filter((m) => m.docs.length !== 1);
  if (bad.length > 0) {
    console.error("✖ GUARD FAILED — the keep list must match EXACTLY ONE dealer per name.\n");
    for (const m of matchesByName) {
      console.error(`  "${m.name}" → ${m.docs.length} match(es)`);
      for (const d of m.docs) {
        console.error(`      ${String(d._id)}  ${d.businessName}  +${d.phone}`);
      }
    }
    console.error("\nNothing was deleted. Fix the keep list / data and re-run.\n");
    await mongoose.disconnect();
    process.exit(1);
  }

  const keepDealers = matchesByName.flatMap((m) => m.docs);
  const keepIds = keepDealers.map((d) => d._id);

  console.log("Keeping these 2 dealers (and all their data):");
  for (const d of keepDealers) {
    console.log(`  ✓ ${String(d._id)}  ${d.businessName}  +${d.phone}`);
  }
  console.log("");

  // ---- Figure out what will be removed ----
  const dealersToDelete = allDealers.filter(
    (d) => !keepIds.some((k) => String(k) === String(d._id)),
  );
  const deleteIds = dealersToDelete.map((d) => d._id);

  const [
    listingsToDelete,
    listingsSurviving,
    leadsTotal,
    otpTotal,
    otpLogTotal,
    contactTotal,
    usersToClear,
  ] = await Promise.all([
    Listing.countDocuments({ dealerId: { $in: deleteIds } }),
    Listing.countDocuments({ dealerId: { $in: keepIds } }),
    Lead.countDocuments({}),
    Otp.countDocuments({}),
    OtpRequestLog.countDocuments({}),
    ContactMessage.countDocuments({}),
    User.countDocuments({ dealerId: { $in: deleteIds } }),
  ]);

  console.log(`Dealers to delete: ${dealersToDelete.length}`);
  for (const d of dealersToDelete) {
    console.log(`    ✗ ${d.businessName}  +${d.phone}`);
  }
  console.log("");
  console.log("Collections:");
  console.log(`    Listing        delete ${listingsToDelete}, keep ${listingsSurviving} (keepers')`);
  console.log(`    Lead           delete ${leadsTotal} (ALL)`);
  console.log(`    Otp            delete ${otpTotal} (ALL)`);
  console.log(`    OtpRequestLog  delete ${otpLogTotal} (ALL)`);
  console.log(`    ContactMessage delete ${contactTotal} (ALL)`);
  console.log(`    User           delete 0 — unset dealerId on ${usersToClear} user(s)`);
  console.log("");

  if (!confirm) {
    console.log("DRY RUN complete. Nothing was changed.");
    console.log("Re-run with:  npm run db:cleanup-trial -- --confirm\n");
    await mongoose.disconnect();
    process.exit(0);
  }

  // ---- Live delete: countdown, then run each step; stop on any failure ----
  console.log("⚠ Proceeding with LIVE deletion in…");
  for (let s = 5; s >= 1; s--) {
    console.log(`   ${s}…`);
    await sleep(1000);
  }
  console.log("");

  try {
    const dealerRes = await Dealer.deleteMany({ _id: { $in: deleteIds } });
    console.log(`✓ Dealer:         deleted ${dealerRes.deletedCount ?? 0}`);

    const listingRes = await Listing.deleteMany({ dealerId: { $in: deleteIds } });
    console.log(`✓ Listing:        deleted ${listingRes.deletedCount ?? 0}`);

    const leadRes = await Lead.deleteMany({});
    console.log(`✓ Lead:           deleted ${leadRes.deletedCount ?? 0}`);

    const otpRes = await Otp.deleteMany({});
    console.log(`✓ Otp:            deleted ${otpRes.deletedCount ?? 0}`);

    const otpLogRes = await OtpRequestLog.deleteMany({});
    console.log(`✓ OtpRequestLog:  deleted ${otpLogRes.deletedCount ?? 0}`);

    const contactRes = await ContactMessage.deleteMany({});
    console.log(`✓ ContactMessage: deleted ${contactRes.deletedCount ?? 0}`);

    const userRes = await User.updateMany(
      { dealerId: { $in: deleteIds } },
      { $set: { dealerId: null } },
    );
    console.log(`✓ User:           cleared dealerId on ${userRes.modifiedCount ?? 0} (none deleted)`);
  } catch (err) {
    const e = err as { name?: string; message?: string };
    console.error(`\n✖ A step FAILED — stopping. ${e.name ?? "Error"}: ${e.message ?? err}`);
    console.error("Some earlier steps may have completed. Re-run the DRY RUN to see remaining data.\n");
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log("\n✓ Cleanup complete. State / City / Locality were never touched.\n");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("\n✖ Cleanup aborted:", err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
