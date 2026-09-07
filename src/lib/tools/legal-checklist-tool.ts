import { z } from "zod";

import { getLegalState, buildChecklist } from "@/data/legal-checklist";
import type { ToolDefinition, ToolParseResult } from "@/lib/tools/types";

/** Property legal-checklist as a lead-magnet TOOL (Phase 2). Server-authoritative:
 *  parse() validates the state/type inputs and compute() assembles the checklist
 *  from the versioned legal data (generic base + verified state-specific section).
 *  Every state works (generic fallback); no fabricated law is ever shown. */

export const legalChecklistInputSchema = z.object({
  stateSlug: z.string().trim().min(1).max(60),
  propertyType: z.enum(["flat", "plot", "independent_house", "commercial", "agricultural"]),
  purchaseType: z.enum(["new_builder", "resale", "under_construction"]),
});

export type LegalChecklistInput = z.infer<typeof legalChecklistInputSchema>;

function parse(raw: unknown): ToolParseResult<LegalChecklistInput> {
  const parsed = legalChecklistInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the checklist inputs." };
  if (!getLegalState(parsed.data.stateSlug)) return { ok: false, error: "Unknown state." };
  return { ok: true, input: parsed.data };
}

function compute(input: LegalChecklistInput) {
  const state = getLegalState(input.stateSlug)!;
  return buildChecklist(input, state) as unknown as Record<string, unknown>;
}

export const legalChecklistTool: ToolDefinition<LegalChecklistInput> = {
  name: "legal_checklist",
  source: "tool_legal_checklist",
  label: "Property legal checklist",
  parse,
  compute,
};
