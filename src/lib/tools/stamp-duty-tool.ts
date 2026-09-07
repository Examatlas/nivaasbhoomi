import { z } from "zod";

import { getStateStampDuty } from "@/data/stamp-duty-rates";
import { computeStampDutyBreakdown } from "@/lib/calculators/stamp-duty";
import type { ToolDefinition, ToolParseResult } from "@/lib/tools/types";

/** The stamp-duty calculator as a lead-magnet TOOL (registered in the registry).
 *  Server-authoritative: the client's numbers are never trusted — parse()
 *  validates the inputs and compute() recomputes the breakdown from the versioned
 *  rate data. A state with no verified rate is REJECTED so a wrong number can
 *  never be shown or stored. */

export const stampDutyInputSchema = z.object({
  stateSlug: z.string().trim().min(1).max(60),
  propertyValue: z.number().finite().positive().max(10_000_000_000),
  buyerType: z.enum(["male", "female", "joint"]),
  propertyType: z.enum(["residential", "commercial", "plot"]),
  areaType: z.enum(["urban", "rural"]),
});

export type StampDutyToolInput = z.infer<typeof stampDutyInputSchema>;

function parse(raw: unknown): ToolParseResult<StampDutyToolInput> {
  const parsed = stampDutyInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the calculator inputs." };
  const state = getStateStampDuty(parsed.data.stateSlug);
  if (!state) return { ok: false, error: "Unknown state." };
  if (!state.stampDuty || state.registrationPct == null) {
    // We refuse to compute (and never show a wrong number) for a null-rate state.
    return { ok: false, error: `Stamp duty data for ${state.name} is coming soon.` };
  }
  return { ok: true, input: parsed.data };
}

function compute(input: StampDutyToolInput) {
  const state = getStateStampDuty(input.stateSlug)!;
  const rates = state.stampDuty!;
  const stampDutyPct = rates[input.buyerType];
  const breakdown = computeStampDutyBreakdown({
    propertyValue: input.propertyValue,
    stampDutyPct,
    registrationPct: state.registrationPct!,
    baseStampDutyPct: rates.male,
  });
  return {
    stateName: state.name,
    stateSlug: state.slug,
    buyerType: input.buyerType,
    propertyType: input.propertyType,
    areaType: input.areaType,
    ...breakdown,
    note: state.note ?? null,
    lastUpdated: state.lastUpdated,
    source: state.source,
  };
}

export const stampDutyTool: ToolDefinition<StampDutyToolInput> = {
  name: "stamp_duty",
  source: "tool_stamp_duty",
  label: "Stamp duty calculator",
  parse,
  compute,
};
