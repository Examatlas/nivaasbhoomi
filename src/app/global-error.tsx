"use client";

/**
 * Last-resort error boundary for the whole app. Next renders this (replacing the
 * root layout) when an uncaught error escapes a route, so it must supply its own
 * <html>/<body>. It shows a friendly recovery screen — never a stack trace — and
 * offers a retry. Detailed errors go to the console/Sentry, not the user.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "24px",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#f8f7f4",
          color: "#1c1917",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
          Something went wrong
        </h1>
        <p style={{ maxWidth: "28rem", color: "#57534e", margin: 0 }}>
          An unexpected error occurred on our side. Please try again — if it keeps
          happening, come back in a little while.
        </p>
        <button
          onClick={() => reset()}
          style={{
            appearance: "none",
            border: "none",
            borderRadius: "8px",
            background: "#1c1917",
            color: "#fff",
            padding: "12px 24px",
            fontSize: "1rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        {error?.digest && (
          <p style={{ fontSize: "0.75rem", color: "#a8a29e", margin: 0 }}>
            Reference: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
