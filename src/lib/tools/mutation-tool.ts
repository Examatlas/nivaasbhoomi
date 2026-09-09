import { z } from "zod";

import { getMutationState, buildMutation } from "@/data/mutation-guide";
import type { ToolDefinition, ToolParseResult } from "@/lib/tools/types";

/** Mutation / dakhil-kharij guide as a lead-magnet TOOL. Server-authoritative:
 *  parse() validates the state + property/transfer type; compute() builds the
 *  guide from verified state data (Bihar/Jharkhand/UP) or a "coming soon" shell
 *  for states not yet verified. No process is fabricated. */

export const mutationInputSchema = z.object({
  stateSlug: z.string().trim().min(1).max(60),
  propertyType: z.enum(["agricultural", "residential", "commercial"]),
  transferType: z.enum(["sale", "inheritance", "gift", "partition"]),
});

export type MutationToolInput = z.infer<typeof mutationInputSchema>;

function parse(raw: unknown): ToolParseResult<MutationToolInput> {
  const parsed = mutationInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the mutation inputs." };
  if (!getMutationState(parsed.data.stateSlug)) return { ok: false, error: "Unknown state." };
  return { ok: true, input: parsed.data };
}

function compute(input: MutationToolInput) {
  const state = getMutationState(input.stateSlug)!;
  return buildMutation(input, state) as unknown as Record<string, unknown>;
}

export const mutationTool: ToolDefinition<MutationToolInput> = {
  name: "mutation_guide",
  source: "tool_mutation",
  label: "Mutation / dakhil-kharij guide",
  parse,
  compute,
};
