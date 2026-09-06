import mongoose, { type Mongoose } from "mongoose";

/**
 * MongoDB connection helper for a serverless runtime (Vercel).
 *
 * Why the global cache:
 * Every Vercel lambda invocation re-runs module scope, but the *container* is
 * reused between invocations. Without caching we would open a fresh connection
 * pool on every request and exhaust the Atlas connection limit within minutes.
 * Stashing the connection on `globalThis` survives module re-evaluation and
 * HMR in development, so one warm container holds exactly one pool.
 *
 * We cache the in-flight *promise*, not just the connection, so that concurrent
 * requests arriving during a cold start all await the same handshake instead of
 * each starting their own.
 */

interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

// `var` is required here: `globalThis` augmentation only works with var declarations.
declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = globalThis._mongooseCache ?? {
  conn: null,
  promise: null,
};

globalThis._mongooseCache = cached;

export async function connectDB(): Promise<Mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error(
        "MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.",
      );
    }

    cached.promise = mongoose
      .connect(uri, {
        // Mongoose buffers commands while disconnected. In a lambda that turns a
        // dead connection into a 10s hang instead of an immediate, catchable error.
        bufferCommands: false,

        // Never build indexes on the request path. Otherwise a schema-declared
        // index that prod lacks triggers a slow createIndex on first model use,
        // stalling (and, under contention, failing) live requests. Indexes are
        // synced out of band instead: `npm run db:sync-indexes`.
        autoIndex: false,

        // One warm container serves requests sequentially, so a large pool is
        // wasted Atlas capacity. Small pool, many containers.
        maxPoolSize: 10,
        minPoolSize: 0,

        // Fail fast rather than holding the request open until the platform
        // timeout - the health check and API error envelope depend on this.
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 45000,

        // Close idle sockets so a scaled-down deployment releases Atlas slots.
        maxIdleTimeMS: 60000,
      })
      .then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Clear the rejected promise, otherwise every later request replays the
    // same failure forever instead of retrying the connection.
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

/** Readiness of the cached connection. 1 = connected. Used by /api/health. */
export function getConnectionState(): number {
  return mongoose.connection.readyState;
}

export default connectDB;
