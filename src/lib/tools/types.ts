/** Shared lead-magnet TOOL contract (client-safe types, no I/O). A tool takes
 *  raw user input, validates it, and computes an authoritative output on the
 *  server. Every tool plugs into the registry and the shared submit endpoint. */

export type ToolParseResult<I> = { ok: true; input: I } | { ok: false; error: string };

export interface ToolDefinition<I = unknown, O = Record<string, unknown>> {
  /** Machine name, e.g. "stamp_duty". */
  name: string;
  /** Lead source written to the Lead, e.g. "tool_stamp_duty". */
  source: string;
  /** Human label (admin / UI). */
  label: string;
  /** Validate + normalize raw client input (rejects unusable/unsupported input). */
  parse(raw: unknown): ToolParseResult<I>;
  /** Authoritative computation — never trusts the client's numbers. */
  compute(input: I): O;
}
