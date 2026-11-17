import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export interface TeamAnalyst {
  id: string;
  name: string;
  queue: string;
}

export interface AnalystDayEntry {
  status: "Present" | "WFH" | "Half-Day" | "Leave" | "Unmarked";
  checkIn: string;
  checkOut: string;
  note: string;
}

export interface SharedAttendancePayload {
  roster: TeamAnalyst[];
  logsByDate: Record<string, Record<string, AnalystDayEntry>>;
  updatedAt: string;
}

const STORE_PATH = path.join(process.cwd(), "data", "attendance-store.json");

const DEFAULT_STORE: SharedAttendancePayload = {
  roster: [
    { id: "a-1", name: "Analyst 01", queue: "KYC Onboarding" },
    { id: "a-2", name: "Analyst 02", queue: "AML Triage" },
    { id: "a-3", name: "Analyst 03", queue: "Sanctions Hits" },
  ],
  logsByDate: {},
  updatedAt: new Date().toISOString(),
};

async function readStore(): Promise<SharedAttendancePayload> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<SharedAttendancePayload>;
    return {
      roster: Array.isArray(parsed.roster) ? parsed.roster : DEFAULT_STORE.roster,
      logsByDate:
        parsed.logsByDate && typeof parsed.logsByDate === "object"
          ? parsed.logsByDate
          : {},
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return DEFAULT_STORE;
  }
}

async function writeStore(payload: SharedAttendancePayload): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

export async function GET() {
  const store = await readStore();
  return NextResponse.json(store);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<SharedAttendancePayload>;
    const current = await readStore();
    const nextPayload: SharedAttendancePayload = {
      roster: Array.isArray(body.roster) ? body.roster : current.roster,
      logsByDate:
        body.logsByDate && typeof body.logsByDate === "object"
          ? body.logsByDate
          : current.logsByDate,
      updatedAt: new Date().toISOString(),
    };
    await writeStore(nextPayload);
    return NextResponse.json(nextPayload);
  } catch {
    return NextResponse.json(
      { error: "Invalid attendance payload" },
      { status: 400 }
    );
  }
}
