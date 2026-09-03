/**
 * Generate a bcrypt hash for the admin password (DEV-SPEC.txt Section 8).
 *
 *   npm run admin:hash -- "your-chosen-password"
 *
 * Copy the printed hash into .env.local as ADMIN_PASSWORD_HASH (and set
 * ADMIN_EMAIL). The plaintext is never stored anywhere.
 */
import { hashPassword } from "@/lib/auth/password";

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error(
      '\nUsage: npm run admin:hash -- "your-password"\n\n' +
        "Wrap the password in quotes. Choose something long and unique.\n",
    );
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("\n✖ Please choose a password of at least 10 characters.\n");
    process.exit(1);
  }

  const hash = await hashPassword(password);
  console.log("\nAdd these to .env.local:\n");
  console.log("ADMIN_EMAIL=you@example.com");
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log(
    "\n(Also make sure JWT_SECRET is set to a long random string in .env.local.)\n",
  );
  process.exit(0);
}

main();
