import type { ToolDefinition } from "@/lib/tools/types";
import { stampDutyTool } from "@/lib/tools/stamp-duty-tool";
import { legalChecklistTool } from "@/lib/tools/legal-checklist-tool";
import { cntSptTool } from "@/lib/tools/cnt-spt-tool";
import { mutationTool } from "@/lib/tools/mutation-tool";

/**
 * The lead-magnet TOOL registry. Add a tool here and the shared submit endpoint
 * (/api/tools/lead) + lead flow work for it with no other backend changes —
 * this is the reusable infrastructure future tools (legal checklist, price
 * alert, locality rate checker) plug into.
 */
const TOOLS: Record<string, ToolDefinition<unknown>> = {
  [stampDutyTool.name]: stampDutyTool as ToolDefinition<unknown>,
  [legalChecklistTool.name]: legalChecklistTool as ToolDefinition<unknown>,
  [cntSptTool.name]: cntSptTool as ToolDefinition<unknown>,
  [mutationTool.name]: mutationTool as ToolDefinition<unknown>,
};

export function getTool(name: string): ToolDefinition<unknown> | null {
  return TOOLS[name] ?? null;
}

export function isKnownTool(name: string): boolean {
  return name in TOOLS;
}
