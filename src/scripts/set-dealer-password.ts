/**
 * Give an existing dealer an email + password so they can sign in with
 * AUTH_METHOD=password. Handy for launch/testing: the seeded demo dealer
 * ("Ranchi Prime Properties", phone 919000000099) already owns APPROVED
 * listings, so setting a password on it lets you sign in as that dealer and see
 * a buyer's "Contact Us" lead land in the dashboard — end to end.
 *
 *   npm run dealer:set-password -- <email> <password> [phone]
 *
 * phone defaults to the demo dealer (919000000099). The plaintext is hashed with
 * bcrypt and never stored. Also useful for admin-provisioning a real dealer.
 */
import "@/scripts/load-env";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { hashPassword } from "@/lib/auth/password";

const DEMO_PHONE = "919000000099";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3];
  const phone = (process.argv[4] ?? DEMO_PHONE).replace(/\D/g, "");

  if (!email || !password) {
    console.error(
      '\nUsage: npm run dealer:set-password -- <email> <password> [phone]\n\n' +
        "Example (seeded demo dealer):\n" +
        '  npm run dealer:set-password -- dealer@example.com "SomePass123"\n',
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("\n✖ Password must be at least 8 characters.\n");
    process.exit(1);
  }

  await connectDB();

  const dealer = await Dealer.findOne({ phone });
  if (!dealer) {
    console.error(
      `\n✖ No dealer found with phone ${phone}.` +
        (phone === DEMO_PHONE ? " Run `npm run seed:demo-listing` first.\n" : "\n"),
    );
    process.exit(1);
  }

  // Make sure no OTHER dealer already owns this email (email is unique).
  const clash = await Dealer.findOne({ email, _id: { $ne: dealer._id } }, { _id: 1 }).lean();
  if (clash) {
    console.error(`\n✖ Another dealer already uses ${email}. Pick a different email.\n`);
    process.exit(1);
  }

  dealer.email = email;
  dealer.passwordHash = await hashPassword(password);
  await dealer.save();

  console.log(
    `\n✔ Set login for "${dealer.businessName}" (phone ${dealer.phone}).\n` +
      `  Email:    ${email}\n` +
      `  Sign in:  /dealer/login  (AUTH_METHOD=password)\n`,
  );
  await mongoose.connection.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
