"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

type AttendanceStatus = "Present" | "WFH" | "Half-Day" | "Leave" | "Unmarked";

interface TeamAnalyst {
  id: string;
  name: string;
  queue: string;
}

interface AnalystDayEntry {
  status: AttendanceStatus;
  checkIn: string;
  checkOut: string;
  note: string;
}

interface SharedAttendancePayload {
  roster: TeamAnalyst[];
  logsByDate: Record<string, Record<string, AnalystDayEntry>>;
  updatedAt: string;
}

const LOCAL_CACHE_KEY = "corporatebuddy_team_attendance_v1";
const INITIAL_FALLBACK_DATE = "2026-11-15";

let idSequence = 0;
function nextAnalystId(prefix: string): string {
  idSequence += 1;
  return `${prefix}-${idSequence}`;
}

function buildDefaultRoster(count: number): TeamAnalyst[] {
  const safe = Math.max(1, Math.min(500, Math.floor(count || 1)));
  return Array.from({ length: safe }, (_, idx) => {
    const num = String(idx + 1).padStart(2, "0");
    return {
      id: nextAnalystId(`a-${num}`),
      name: `Analyst ${num}`,
      queue: "General Queue",
    };
  });
}

export default function AttendanceTrackerPage() {
  const [selectedDate, setSelectedDate] = useState<string>(INITIAL_FALLBACK_DATE);
  const [roster, setRoster] = useState<TeamAnalyst[]>(() => buildDefaultRoster(10));
  const [logsByDate, setLogsByDate] = useState<Record<string, Record<string, AnalystDayEntry>>>({});
  const [syncState, setSyncState] = useState<string>("Ready");

  const [bulkInput, setBulkInput] = useState<string>("");
  const [generateCountInput, setGenerateCountInput] = useState<string>("50");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [copyStatus, setCopyStatus] = useState<string>("");

  const persistLocal = useCallback(
    (
      nextRoster: TeamAnalyst[],
      nextLogs: Record<string, Record<string, AnalystDayEntry>>
    ) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(
          LOCAL_CACHE_KEY,
          JSON.stringify({ roster: nextRoster, logsByDate: nextLogs })
        );
      } catch {
        // ignore storage quota errors
      }
    },
    []
  );

  const syncFromServer = useCallback(async () => {
    setSyncState("Syncing...");
    try {
      const res = await fetch("/api/attendance", { cache: "no-store" });
      if (!res.ok) throw new Error("API error");
      const data = (await res.json()) as SharedAttendancePayload;
      if (Array.isArray(data.roster) && data.roster.length > 0) {
        setRoster(data.roster);
      }
      if (data.logsByDate && typeof data.logsByDate === "object") {
        setLogsByDate(data.logsByDate);
      }
      setSyncState("Synced with shared log");
    } catch {
      if (typeof window !== "undefined") {
        try {
          const cached = window.localStorage.getItem(LOCAL_CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached) as {
              roster?: TeamAnalyst[];
              logsByDate?: Record<string, Record<string, AnalystDayEntry>>;
            };
            if (Array.isArray(parsed.roster) && parsed.roster.length > 0) {
              setRoster(parsed.roster);
            }
            if (parsed.logsByDate) {
              setLogsByDate(parsed.logsByDate);
            }
          }
        } catch {
          // ignore parse errors
        }
      }
      setSyncState("Local cache active");
    }
  }, []);

  const saveToServer = useCallback(
    async (
      nextRoster: TeamAnalyst[],
      nextLogs: Record<string, Record<string, AnalystDayEntry>>
    ) => {
      persistLocal(nextRoster, nextLogs);
      try {
        const res = await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roster: nextRoster,
            logsByDate: nextLogs,
          }),
        });
        if (res.ok) {
          setSyncState("Saved to shared log");
        } else {
          setSyncState("Saved locally");
        }
      } catch {
        setSyncState("Saved locally");
      }
    },
    [persistLocal]
  );

  useEffect(() => {
    const now = new Date();
    const localIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
    setSelectedDate(localIso);
    syncFromServer();
  }, [syncFromServer]);

  const currentDayMap = logsByDate[selectedDate] ?? {};

  function getEntryFor(analystId: string): AnalystDayEntry {
    return (
      currentDayMap[analystId] ?? {
        status: "Unmarked",
        checkIn: "09:30",
        checkOut: "18:30",
        note: "",
      }
    );
  }

  function updateAnalystField(
    analystId: string,
    field: keyof TeamAnalyst,
    value: string
  ) {
    const nextRoster = roster.map((a) =>
      a.id === analystId ? { ...a, [field]: value } : a
    );
    setRoster(nextRoster);
    saveToServer(nextRoster, logsByDate);
  }

  function updateDayEntry(
    analystId: string,
    patch: Partial<AnalystDayEntry>
  ) {
    const existing = getEntryFor(analystId);
    const nextDayMap: Record<string, AnalystDayEntry> = {
      ...currentDayMap,
      [analystId]: { ...existing, ...patch },
    };
    const nextLogs = {
      ...logsByDate,
      [selectedDate]: nextDayMap,
    };
    setLogsByDate(nextLogs);
    saveToServer(roster, nextLogs);
  }

  function addSingleAnalyst() {
    const nextIdx = roster.length + 1;
    const padded = String(nextIdx).padStart(2, "0");
    const nextRoster = [
      ...roster,
      {
        id: nextAnalystId(`a-${padded}`),
        name: `Analyst ${padded}`,
        queue: "General Queue",
      },
    ];
    setRoster(nextRoster);
    saveToServer(nextRoster, logsByDate);
  }

  function removeAnalyst(analystId: string) {
    const nextRoster = roster.filter((a) => a.id !== analystId);
    setRoster(nextRoster);
    saveToServer(nextRoster, logsByDate);
  }

  function handleBulkPasteImport() {
    const lines = bulkInput
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const imported: TeamAnalyst[] = lines.map((line, idx) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        id: nextAnalystId(`a-imp-${idx}`),
        name: parts[0] || `Analyst ${idx + 1}`,
        queue: parts[1] || "General Queue",
      };
    });
    const nextRoster = [...roster, ...imported];
    setRoster(nextRoster);
    setBulkInput("");
    saveToServer(nextRoster, logsByDate);
  }

  function handleGenerateRoster() {
    const count = Math.max(1, Math.min(500, Number(generateCountInput) || 50));
    const nextRoster = buildDefaultRoster(count);
    setRoster(nextRoster);
    saveToServer(nextRoster, logsByDate);
  }

  function markAllStatus(status: AttendanceStatus) {
    const nextDayMap: Record<string, AnalystDayEntry> = {};
    for (const a of roster) {
      const prev = getEntryFor(a.id);
      nextDayMap[a.id] = {
        ...prev,
        status,
      };
    }
    const nextLogs = {
      ...logsByDate,
      [selectedDate]: nextDayMap,
    };
    setLogsByDate(nextLogs);
    saveToServer(roster, nextLogs);
  }

  const summary = useMemo(() => {
    let present = 0;
    let wfh = 0;
    let halfDay = 0;
    let leave = 0;
    let unmarked = 0;

    const noteItems: Array<{
      id: string;
      name: string;
      queue: string;
      status: AttendanceStatus;
      checkIn: string;
      checkOut: string;
      note: string;
    }> = [];

    for (const a of roster) {
      const entry = currentDayMap[a.id] ?? {
        status: "Unmarked" as AttendanceStatus,
        checkIn: "09:30",
        checkOut: "18:30",
        note: "",
      };
      if (entry.status === "Present") present += 1;
      else if (entry.status === "WFH") wfh += 1;
      else if (entry.status === "Half-Day") halfDay += 1;
      else if (entry.status === "Leave") leave += 1;
      else unmarked += 1;

      noteItems.push({
        id: a.id,
        name: a.name,
        queue: a.queue,
        status: entry.status,
        checkIn: entry.checkIn,
        checkOut: entry.checkOut,
        note: entry.note,
      });
    }

    return {
      total: roster.length,
      present,
      wfh,
      halfDay,
      leave,
      unmarked,
      noteItems,
    };
  }, [roster, currentDayMap]);

  const filteredRoster = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return roster.filter((a) => {
      const entry = getEntryFor(a.id);
      if (statusFilter !== "ALL" && entry.status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.queue.toLowerCase().includes(q) ||
        entry.note.toLowerCase().includes(q)
      );
    });
  }, [roster, currentDayMap, searchQuery, statusFilter]);

  function exportCsv() {
    const headers = ["Date", "Analyst", "Queue", "Status", "Check In", "Check Out", "Attendance Note"];
    const rows = summary.noteItems.map((item) => [
      selectedDate,
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.queue.replace(/"/g, '""')}"`,
      item.status,
      item.checkIn,
      item.checkOut,
      `"${(item.note || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-attendance-${selectedDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function copyNotesFeed() {
    const lines = [
      `Team Attendance Notes (${selectedDate})`,
      `Total: ${summary.total} | Present: ${summary.present} | WFH: ${summary.wfh} | Half-Day: ${summary.halfDay} | Leave: ${summary.leave} | Unmarked: ${summary.unmarked}`,
      "",
      ...summary.noteItems.map(
        (item) =>
          `- ${item.name} (${item.queue}) — ${item.status} [${item.checkIn}-${item.checkOut}]${
            item.note ? `: ${item.note}` : ""
          }`
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyStatus("Copied notes!");
      setTimeout(() => setCopyStatus(""), 2500);
    } catch {
      setCopyStatus("Clipboard unavailable");
      setTimeout(() => setCopyStatus(""), 2500);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0f294a]">
              CorporateBuddy · Unlimited Team Roster & Daily Notes
            </p>
            <h1 className="text-xl font-bold text-[#0b192c]">Advance Attendance Tracker</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Roster size: <strong>{summary.total}</strong> analysts · {syncState}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-mono font-semibold"
            />
            <button
              type="button"
              onClick={syncFromServer}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Sync Log
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={copyNotesFeed}
              className="rounded-xl bg-[#0f294a] px-3.5 py-2 font-semibold text-white hover:bg-[#163863] cursor-pointer"
            >
              {copyStatus || "Copy Attendance Notes"}
            </button>
          </div>
        </div>

        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-slate-500">Total Analysts</p>
            <p className="mt-1 text-lg font-bold text-[#0b192c]">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-slate-500">Present</p>
            <p className="mt-1 text-lg font-bold text-emerald-700">{summary.present}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-slate-500">WFH</p>
            <p className="mt-1 text-lg font-bold text-blue-700">{summary.wfh}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-slate-500">Half-Day</p>
            <p className="mt-1 text-lg font-bold text-amber-700">{summary.halfDay}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-slate-500">Leave</p>
            <p className="mt-1 text-lg font-bold text-rose-700">{summary.leave}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-slate-500">Unmarked</p>
            <p className="mt-1 text-lg font-bold text-slate-600">{summary.unmarked}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold uppercase tracking-wider text-slate-700">
              Team Roster Controls (Any Size) & Bulk Actions
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={addSingleAnalyst}
                className="rounded-xl bg-[#0f294a] px-3 py-1.5 font-semibold text-white cursor-pointer"
              >
                + Add Analyst
              </button>
              <button
                type="button"
                onClick={() => markAllStatus("Present")}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Mark All Present
              </button>
              <button
                type="button"
                onClick={() => markAllStatus("Unmarked")}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Reset Day
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 p-3 space-y-2">
              <label className="block font-semibold text-slate-700">
                Generate N Roster Slots (Any Number)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={generateCountInput}
                  onChange={(e) => setGenerateCountInput(e.target.value)}
                  className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono"
                />
                <button
                  type="button"
                  onClick={handleGenerateRoster}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Set Roster Size
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Supports 1 to 500+ analysts freely.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-3 space-y-2 lg:col-span-2">
              <label className="block font-semibold text-slate-700">
                Bulk Paste Names / IDs (One per line, optional `Name | Queue`)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <textarea
                  rows={2}
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder={"Rohan Sharma | KYC Onboarding\nPriya Nair | AML Triage\nAmit Verma"}
                  className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5"
                />
                <button
                  type="button"
                  onClick={handleBulkPasteImport}
                  className="rounded-lg bg-[#0f294a] px-3.5 py-2 font-semibold text-white shrink-0 cursor-pointer"
                >
                  Append to Roster
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search analyst, queue, or note..."
              className="w-64 rounded-xl border border-slate-300 px-3 py-1.5"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-1.5"
            >
              <option value="ALL">All Statuses</option>
              <option value="Present">Present</option>
              <option value="WFH">WFH</option>
              <option value="Half-Day">Half-Day</option>
              <option value="Leave">Leave</option>
              <option value="Unmarked">Unmarked</option>
            </select>
            <span className="text-slate-500">
              Showing {filteredRoster.length} of {roster.length}
            </span>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Analyst Name / ID</th>
                <th className="px-3 py-2.5">Queue / Pod</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">In</th>
                <th className="px-3 py-2.5">Out</th>
                <th className="px-3 py-2.5">Daily Attendance Note</th>
                <th className="px-3 py-2.5">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRoster.map((analyst, idx) => {
                const entry = getEntryFor(analyst.id);
                return (
                  <tr key={analyst.id}>
                    <td className="px-3 py-2 font-mono text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={analyst.name}
                        onChange={(e) =>
                          updateAnalystField(analyst.id, "name", e.target.value)
                        }
                        className="w-40 rounded-lg border border-slate-200 px-2 py-1 font-medium"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={analyst.queue}
                        onChange={(e) =>
                          updateAnalystField(analyst.id, "queue", e.target.value)
                        }
                        className="w-36 rounded-lg border border-slate-200 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={entry.status}
                        onChange={(e) =>
                          updateDayEntry(analyst.id, {
                            status: e.target.value as AttendanceStatus,
                          })
                        }
                        className="rounded-lg border border-slate-200 px-2 py-1 font-semibold"
                      >
                        <option value="Unmarked">Unmarked</option>
                        <option value="Present">Present</option>
                        <option value="WFH">WFH</option>
                        <option value="Half-Day">Half-Day</option>
                        <option value="Leave">Leave</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={entry.checkIn}
                        onChange={(e) =>
                          updateDayEntry(analyst.id, { checkIn: e.target.value })
                        }
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1 font-mono"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={entry.checkOut}
                        onChange={(e) =>
                          updateDayEntry(analyst.id, { checkOut: e.target.value })
                        }
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1 font-mono"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={entry.note}
                        onChange={(e) =>
                          updateDayEntry(analyst.id, { note: e.target.value })
                        }
                        placeholder="Add daily note (e.g., 22 KYC cases cleared, half-day PM)..."
                        className="w-full min-w-[240px] rounded-lg border border-slate-200 px-2.5 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeAnalyst(analyst.id)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-semibold hover:bg-slate-100 cursor-pointer"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold uppercase tracking-wider text-slate-700">
              Rolled-Up Attendance Notes ({selectedDate})
            </h2>
            <span className="text-slate-500">
              Auto-compiled notes across all {summary.total} analysts
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {summary.noteItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#0b192c]">
                    {item.name} · <span className="font-normal text-slate-600">{item.queue}</span>
                  </span>
                  <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {item.status} ({item.checkIn}-{item.checkOut})
                  </span>
                </div>
                <p className="text-slate-700">
                  {item.note ? item.note : <span className="italic text-slate-400">No note entered</span>}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
