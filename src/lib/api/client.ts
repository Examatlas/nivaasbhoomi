import type { ApiErrorCode } from "@/lib/api/response";

/**
 * Browser-side fetch helper that unwraps the { success, data | error } envelope
 * (Section 7). Throws ApiClientError on failure so callers use try/catch.
 * Used by the admin panel, which is client-side and dynamic (Section 9).
 */
export class ApiClientError extends Error {
  constructor(
    public readonly code: ApiErrorCode | "NETWORK",
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** Every client API call is bounded so a hung request surfaces an error instead
 *  of spinning a button forever. Callers may pass their own signal to override. */
const REQUEST_TIMEOUT_MS = 15_000;

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch (err) {
    const timedOut = (err as Error | undefined)?.name === "TimeoutError";
    throw new ApiClientError(
      "NETWORK",
      timedOut ? "The request timed out. Please try again." : "Network error. Check your connection.",
    );
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiClientError("SERVER_ERROR", `Unexpected response (${res.status}).`);
  }

  const body = json as
    | { success: true; data: T }
    | {
        success: false;
        error: { code: ApiErrorCode; message: string; details?: unknown };
      };

  if (!body.success) {
    throw new ApiClientError(body.error.code, body.error.message, body.error.details);
  }
  return body.data;
}
