import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { SavedExcelWorkflow } from "@/lib/excelOsEngine";

const WORKFLOW_STORE = path.join(process.cwd(), "data", "excelos-workflows.json");

const DEFAULT_WORKFLOWS: SavedExcelWorkflow[] = [
  {
    id: "wf-daily-sla",
    name: "Daily SLA & Ageing Triage",
    mode: "report",
    prompt:
      "Find records below 90% productivity or pending over 3 days, summarize by team, and highlight SLA risks.",
    keyColumn: "Case_ID",
    groupColumn: "Team",
  },
  {
    id: "wf-clean-dedup",
    name: "Morning Roster & Tracker Cleanup",
    mode: "clean",
    prompt:
      "Trim extra spaces, flag duplicate IDs, and mark missing fields without deleting any rows.",
    keyColumn: "Employee_ID",
    groupColumn: "Queue",
  },
];

async function readWorkflows(): Promise<SavedExcelWorkflow[]> {
  try {
    const raw = await fs.readFile(WORKFLOW_STORE, "utf8");
    const parsed = JSON.parse(raw) as SavedExcelWorkflow[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_WORKFLOWS;
  } catch {
    return DEFAULT_WORKFLOWS;
  }
}

export async function GET() {
  const workflows = await readWorkflows();
  return NextResponse.json({ workflows });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { workflow?: SavedExcelWorkflow };
    if (!body?.workflow?.name || !body?.workflow?.prompt) {
      return NextResponse.json({ error: "Workflow name and prompt required" }, { status: 400 });
    }
    const existing = await readWorkflows();
    const next = [body.workflow, ...existing.filter((w) => w.id !== body.workflow!.id)];
    await fs.mkdir(path.dirname(WORKFLOW_STORE), { recursive: true });
    await fs.writeFile(WORKFLOW_STORE, JSON.stringify(next, null, 2), "utf8");
    return NextResponse.json({ workflows: next });
  } catch {
    return NextResponse.json({ error: "Failed to save workflow" }, { status: 500 });
  }
}
