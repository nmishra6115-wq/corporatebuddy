"use client";

import React, { useEffect, useMemo, useState } from "react";

export type MeetingType =
  | "Floor Huddle"
  | "Team Meeting"
  | "Client Call"
  | "Quality Calibration"
  | "Daily Email Update"
  | "SOP / Doc Share";

export type TargetTeam = "All Floor" | "Analysts" | "Team Leads" | "Quality Team";

export interface MeetingRecord {
  id: string;
  title: string;
  meetingType: MeetingType;
  targetTeam: TargetTeam;
  discussedDate: string;
  loggedAt: string;
  ownerOrHost: string;
  keyDecisions: string;
  notesAndMom: string;
  docLink: string;
  pinned?: boolean;
}

const STORAGE_KEY = "corporatebuddy_ops_meeting_hub_v1";

const DEFAULT_RECORDS: MeetingRecord[] = [
  {
    id: "sample-1",
    title: "Morning Floor Huddle — SLA & Backlog Priority",
    meetingType: "Floor Huddle",
    targetTeam: "All Floor",
    discussedDate: new Date().toISOString().slice(0, 10),
    loggedAt: "Today, 09:30 AM",
    ownerOrHost: "Operations TL",
    keyDecisions:
      "1. Prioritize aging queue (>24 hrs) before 1:00 PM.\n2. Escalate missing KYC directly to QA lead.",
    notesAndMom:
      "Discussed overnight volume spike (500 cases). Analysts assigned in two batches; Quality team will run mid-day sample audit at 2:00 PM.",
    docLink: "",
    pinned: true,
  },
];

export default function UpdatesVaultWorkspace() {
  const [records, setRecords] = useState<MeetingRecord[]>(DEFAULT_RECORDS);
  const [title, setTitle] = useState("");
  const [meetingType, setMeetingType] = useState<MeetingType>("Floor Huddle");
  const [targetTeam, setTargetTeam] = useState<TargetTeam>("All Floor");
  const [discussedDate, setDiscussedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [ownerOrHost, setOwnerOrHost] = useState("");
  const [keyDecisions, setKeyDecisions] = useState("");
  const [notesAndMom, setNotesAndMom] = useState("");
  const [docLink, setDocLink] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("All");
  const [filterTeam, setFilterTeam] = useState<string>("All");
  const [filterDate, setFilterDate] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecords(parsed);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  const persistRecords = (next: MeetingRecord[]) => {
    setRecords(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore
    }
  };

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !notesAndMom.trim()) return;

    const newItem: MeetingRecord = {
      id: `rec-${Date.now()}`,
      title: title.trim() || `${meetingType} — ${discussedDate}`,
      meetingType,
      targetTeam,
      discussedDate: discussedDate || new Date().toISOString().slice(0, 10),
      loggedAt: new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      ownerOrHost: ownerOrHost.trim() || "Team Lead",
      keyDecisions: keyDecisions.trim(),
      notesAndMom: notesAndMom.trim(),
      docLink: docLink.trim(),
      pinned: false,
    };

    persistRecords([newItem, ...records]);
    setTitle("");
    setKeyDecisions("");
    setNotesAndMom("");
    setDocLink("");
  };

  const handleTogglePin = (id: string) => {
    persistRecords(
      records.map((r) => (r.id === id ? { ...r, pinned: !r.pinned } : r))
    );
  };

  const handleDelete = (id: string) => {
    persistRecords(records.filter((r) => r.id !== id));
  };

  const handleExportCsv = () => {
    const headers = [
      "Discussed Date",
      "Meeting Type",
      "Audience",
      "Title",
      "Host",
      "Key Decisions",
      "MOM / Notes",
      "Doc Link",
    ];
    const rows = filteredRecords.map((r) =>
      [
        r.discussedDate,
        r.meetingType,
        r.targetTeam,
        r.title,
        r.ownerOrHost,
        r.keyDecisions,
        r.notesAndMom,
        r.docLink,
      ]
        .map((v) => `"${String(v || "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([headers.join(",") + "\n" + rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Floor-MOM-Log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records
      .filter((r) => filterType === "All" || r.meetingType === filterType)
      .filter((r) => filterTeam === "All" || r.targetTeam === filterTeam)
      .filter((r) => !filterDate || r.discussedDate === filterDate)
      .filter(
        (r) =>
          !q ||
          r.title.toLowerCase().includes(q) ||
          r.notesAndMom.toLowerCase().includes(q) ||
          r.keyDecisions.toLowerCase().includes(q) ||
          r.ownerOrHost.toLowerCase().includes(q)
      )
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [records, filterType, filterTeam, filterDate, searchQuery]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-800">
            Floor Operations Knowledge Hub
          </span>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0b192c]">
            Huddle, Meeting MOM & Process Archive
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Central log for Analysts, Team Leads & Quality Team to find what was discussed and when.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
        >
          Export Log (.CSV)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleAddRecord}
          className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs"
        >
          <h2 className="font-display text-lg font-bold text-[#0b192c]">
            Log Call, Huddle or Doc
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Type
              </label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value as MeetingType)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
              >
                <option value="Floor Huddle">Floor Huddle</option>
                <option value="Team Meeting">Team Meeting</option>
                <option value="Client Call">Client Call</option>
                <option value="Quality Calibration">Quality Calibration</option>
                <option value="Daily Email Update">Daily Email Update</option>
                <option value="SOP / Doc Share">SOP / Doc Share</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Team
              </label>
              <select
                value={targetTeam}
                onChange={(e) => setTargetTeam(e.target.value as TargetTeam)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
              >
                <option value="All Floor">All Floor</option>
                <option value="Analysts">Analysts</option>
                <option value="Team Leads">Team Leads</option>
                <option value="Quality Team">Quality Team</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Date
              </label>
              <input
                type="date"
                value={discussedDate}
                onChange={(e) => setDiscussedDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Host / Sender
              </label>
              <input
                type="text"
                value={ownerOrHost}
                onChange={(e) => setOwnerOrHost(e.target.value)}
                placeholder="e.g. Rahul (TL)"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Topic / Subject
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New Rejection Code Rules"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Key Decisions
            </label>
            <textarea
              rows={2}
              value={keyDecisions}
              onChange={(e) => setKeyDecisions(e.target.value)}
              placeholder="Bullet points of what changed..."
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              MOM / Notes
            </label>
            <textarea
              rows={4}
              required
              value={notesAndMom}
              onChange={(e) => setNotesAndMom(e.target.value)}
              placeholder="Paste discussion details..."
              className="w-full rounded-xl border border-slate-300 p-3 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Shared Doc Link
            </label>
            <input
              type="text"
              value={docLink}
              onChange={(e) => setDocLink(e.target.value)}
              placeholder="Optional link..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-[#0f294a] px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
          >
            Save to Knowledge Hub
          </button>
        </form>

        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search keyword..."
                className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
              />
              <input
                type="date"
                aria-label="Filter by discussed date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              {filterDate && (
                <button
                  type="button"
                  onClick={() => setFilterDate("")}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5">
                {["All", "All Floor", "Analysts", "Team Leads", "Quality Team"].map(
                  (team) => (
                    <button
                      key={team}
                      type="button"
                      onClick={() => setFilterTeam(team)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                        filterTeam === team
                          ? "bg-[#0f294a] text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {team}
                    </button>
                  )
                )}
              </div>
              <select
                aria-label="Filter by meeting type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold"
              >
                <option value="All">All Types</option>
                <option value="Floor Huddle">Floor Huddle</option>
                <option value="Team Meeting">Team Meeting</option>
                <option value="Client Call">Client Call</option>
                <option value="Quality Calibration">Quality Calibration</option>
                <option value="Daily Email Update">Daily Email Update</option>
                <option value="SOP / Doc Share">SOP / Doc Share</option>
              </select>
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
              <p className="text-sm font-semibold text-slate-700">No records found</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredRecords.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-2xl border bg-white p-5 space-y-3 shadow-xs ${
                    item.pinned
                      ? "border-indigo-400 ring-1 ring-indigo-100"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-900">
                        {item.meetingType}
                      </span>
                      <span className="rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-[11px] font-semibold text-teal-900">
                        For: {item.targetTeam}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        Discussed: {item.discussedDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTogglePin(item.id)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-[11px] cursor-pointer"
                      >
                        {item.pinned ? "Pinned" : "Pin"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="rounded-md border border-rose-200 px-2 py-1 text-[11px] text-rose-700 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-[#0b192c]">
                    {item.title}
                  </h3>
                  {item.keyDecisions && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                      <p className="text-[11px] font-bold uppercase text-amber-900">
                        Key Decisions
                      </p>
                      <p className="whitespace-pre-line text-xs font-medium text-amber-950">
                        {item.keyDecisions}
                      </p>
                    </div>
                  )}
                  <p className="whitespace-pre-line text-xs sm:text-sm text-slate-700">
                    {item.notesAndMom}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}