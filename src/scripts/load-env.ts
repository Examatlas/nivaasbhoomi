import { resolve } from "node:path";

/**
 * Load environment variables for standalone scripts (seed, db-test).
 *
 * Next.js auto-loads .env.local, but a plain `tsx script.ts` process does not,
 * so connectDB would see no MONGODB_URI. Importing this module first fills
 * process.env from .env.local then .env.
 *
 * We use Node's built-in `process.loadEnvFile` — the same parser behind
 * `node --env-file`. It keeps the semantics we want:
 *   - a var already set in the REAL environment is never overwritten;
 *   - .env.local wins over .env (loaded first, and the second load can't
 *     overwrite an already-set var).
 * It also parses quoting correctly, unlike the previous hand-rolled parser,
 * which left the wrapping quote on values containing special characters (e.g. a
 * Mongo URI), breaking them. No extra dependency.
 */
function loadFile(path: string) {
  try {
    process.loadEnvFile(path);
  } catch {
    // Missing file (ENOENT) is expected — .env / .env.local are optional.
    // Any other parse error is also non-fatal here: the script's own checks
    // (e.g. "MONGODB_URI is not set") give a clearer message than crashing on import.
  }
}

loadFile(resolve(process.cwd(), ".env.local"));
loadFile(resolve(process.cwd(), ".env"));
