import { connectDB } from "@/lib/db/connect";
import { Lead } from "@/lib/db/models/Lead";
import { findDuplicateLead } from "@/lib/leads/dedupe";
import type { ToolDefinition } from "@/lib/tools/types";

/**
 * Create a lead-magnet TOOL lead — the shared path every tool uses.
 *
 * The lead is UNASSIGNED and never auto-routed: no dealer, no listing, isLocked
 * false. It waits in the admin queue for a manual assignment. Deduped on
 * phone + tool source + 24h through the SHARED dedup rule (extended with the
 * `source` key), so one buyer + one tool + one day = one lead.
 */
export interface CreateToolLeadArgs {
  tool: ToolDefinition<unknown>;
  input: unknown;
  output: Record<string, unknown>;
  phone: string; // canonical 91XXXXXXXXXX
  name?: string | null;
}

export interface CreateToolLeadResult {
  leadId: string;
  deduped: boolean;
}

export async function createToolLead(args: CreateToolLeadArgs): Promise<CreateToolLeadResult> {
  await connectDB();

  // Same buyer + same tool within 24h → reuse the existing lead.
  const dup = await findDuplicateLead({ phone: args.phone, source: args.tool.source });
  if (dup) return { leadId: dup, deduped: true };

  const lead = await Lead.create({
    phone: args.phone,
    name: args.name ?? undefined,
    source: args.tool.source,
    status: "unassigned",
    assignedDealerId: null,
    listingId: null,
    isLocked: false, // not locked until an admin assigns it
    toolData: {
      tool: args.tool.name,
      input: args.input,
      output: args.output,
      capturedAt: new Date(),
    },
  });
  return { leadId: String(lead._id), deduped: false };
}
