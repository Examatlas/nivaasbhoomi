/**
 * Quick MongoDB connection test.
 *   npm run db:test
 * Loads .env.local, connects via the app's connect helper, pings the server,
 * and prints a masked summary + current location counts. No writes.
 */
import "@/scripts/load-env";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";

function mask(uri: string): string {
  return uri.replace(/(:\/\/[^:/@]+:)[^@]+(@)/, "$1****$2");
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("\n✖ MONGODB_URI is not set (checked .env.local and .env).\n");
    process.exit(1);
  }

  console.log(`\nConnecting to: ${mask(uri)}`);
  const started = Date.now();

  await connectDB();
  const db = mongoose.connection.db!;
  const ping = await db.admin().ping();
  const info = await db
    .admin()
    .serverInfo()
    .catch(() => null);

  console.log(`✓ Connected in ${Date.now() - started}ms`);
  console.log(`  database:      ${mongoose.connection.name}`);
  console.log(`  readyState:    ${mongoose.connection.readyState} (1 = connected)`);
  console.log(`  ping ok:       ${ping.ok === 1}`);
  if (info) console.log(`  server:        MongoDB ${info.version}`);

  const [states, cities, localities] = await Promise.all([
    db.collection("states").countDocuments(),
    db.collection("cities").countDocuments(),
    db.collection("localities").countDocuments(),
  ]);
  console.log("\n  Current location counts:");
  console.log(`    states:     ${states.toLocaleString()}`);
  console.log(`    cities:     ${cities.toLocaleString()}`);
  console.log(`    localities: ${localities.toLocaleString()}`);

  await mongoose.disconnect();
  console.log("\n✓ Connection test passed.\n");
  process.exit(0);
}

main().catch(async (err) => {
  console.error("\n✖ Connection FAILED.\n");
  console.error(`  ${err?.name ?? "Error"}: ${err?.message ?? err}`);
  const code = err?.code ?? err?.cause?.code;
  if (code) console.error(`  code: ${code}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
