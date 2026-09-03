import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";

// Health must reflect live state, never a cached response.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const READY_STATE_LABELS: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

/**
 * GET /api/health
 *
 * Phase 0 acceptance criterion: "MongoDB connects" (DEV-SPEC.txt Section 17).
 * Returns 200 when the database answers a ping, 503 otherwise, so Vercel and
 * any external uptime monitor can distinguish "app up" from "app healthy".
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    await connectDB();

    // readyState alone can lie after a network partition; ping proves the
    // socket is actually usable.
    await mongoose.connection.db?.admin().ping();

    return NextResponse.json(
      {
        success: true,
        data: {
          status: "ok",
          uptime: Math.round(process.uptime()),
          db: {
            status: READY_STATE_LABELS[mongoose.connection.readyState] ?? "unknown",
            name: mongoose.connection.name ?? null,
            latencyMs: Date.now() - startedAt,
          },
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Database health check failed",
          // Surfaced because /api/health is disallowed in robots.txt and is an
          // operator-facing endpoint, not a public one.
          detail: message,
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
