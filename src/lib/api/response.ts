import { NextResponse } from "next/server";

/**
 * The single API envelope for the whole app (DEV-SPEC.txt Section 7):
 *   Success: { success: true,  data: ... }
 *   Error:   { success: false, error: { code, message } }
 *
 * Every route handler returns through these helpers so the shape - and the
 * error-code vocabulary - is identical everywhere.
 */

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "QUOTA_EXCEEDED"
  | "DUPLICATE"
  | "RATE_LIMITED"
  | "SERVER_ERROR";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  QUOTA_EXCEEDED: 429,
  DUPLICATE: 409,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
};

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: { code: ApiErrorCode; message: string; details?: unknown };
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): NextResponse<ApiError> {
  return NextResponse.json(
    { success: false, error: { code, message, ...(details ? { details } : {}) } },
    { status: STATUS_BY_CODE[code] },
  );
}

/**
 * Wrap a route handler so any unexpected throw becomes a structured 500 rather
 * than leaking a stack trace (Section 16: all API routes wrapped in try/catch,
 * return structured error). Known failures should still `return fail(...)`
 * explicitly; this only catches the unexpected.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error("[api] Unhandled error:", error);
      return fail("SERVER_ERROR", "Something went wrong. Please try again.");
    }
  };
}

/** Long CDN cache for the rarely-changing public location data. */
export const LOCATION_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
} as const;
