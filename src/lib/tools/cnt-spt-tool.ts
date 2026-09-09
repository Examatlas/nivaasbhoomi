import { z } from "zod";

import { getCntSptDistrict, buildCntSpt } from "@/data/cnt-spt-districts";
import type { ToolDefinition, ToolParseResult } from "@/lib/tools/types";

/** Jharkhand CNT/SPT land checker as a lead-magnet TOOL. Server-authoritative:
 *  parse() validates the district + buyer/land type; compute() builds the
 *  verified, conservative verdict from the versioned CNT/SPT data. No law is
 *  ever fabricated — unknown districts are rejected. */

export const cntSptInputSchema = z.object({
  districtSlug: z.string().trim().min(1).max(60),
  buyerType: z.enum(["tribal", "non_tribal", "sc", "obc", "company_trust"]),
  landType: z.enum(["agricultural", "residential", "commercial"]),
});

export type CntSptToolInput = z.infer<typeof cntSptInputSchema>;

function parse(raw: unknown): ToolParseResult<CntSptToolInput> {
  const parsed = cntSptInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the CNT/SPT inputs." };
  if (!getCntSptDistrict(parsed.data.districtSlug)) return { ok: false, error: "Unknown district." };
  return { ok: true, input: parsed.data };
}

function compute(input: CntSptToolInput) {
  const district = getCntSptDistrict(input.districtSlug)!;
  return buildCntSpt(input, district) as unknown as Record<string, unknown>;
}

export const cntSptTool: ToolDefinition<CntSptToolInput> = {
  name: "cnt_spt_check",
  source: "tool_cnt_spt",
  label: "CNT/SPT land check",
  parse,
  compute,
};
