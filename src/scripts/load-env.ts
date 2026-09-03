import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Load environment variables for standalone scripts (seed, db-test).
 *
 * Next.js auto-loads .env.local, but a plain `tsx script.ts` process does not,
 * so connectDB would see no MONGODB_URI. Importing this module first fills
 * process.env from .env.local then .env (without overwriting anything already
 * set in the real environment). Minimal parser - no dependency - handling
 * KEY=value, comments, blank lines and optional surrounding quotes.
 */
function loadFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue; // real env wins
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadFile(resolve(process.cwd(), ".env.local"));
loadFile(resolve(process.cwd(), ".env"));
