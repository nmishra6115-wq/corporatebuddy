"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  buildGroupSummary,
  inspectDataQuality,
  parseCsvOrTsv,
  ParsedTable,
  SavedExcelWorkflow,
  toCsvString,
} from "@/lib/excelOsEngine";
import {
  buildDeterministicWorkbookSpec,
  downloadSpecAsXlsx,
  parseExcelBinaryBuffer,
} from "@/lib/excelWorkbookBuilder";
import {
  answerQuestionAboutTable,
  applyApprovedCleaning,
  buildCleaningProposals,
  buildCorporateBuddyHandoff,
  buildRichWorkbookSpec,
  CleaningProposal,
  parseMessyTextToTable,
  runFormulaDoctor,
} from "@/lib/excelCopilotPhases";

type CopilotShortcut = "create" | "paste" | "formula" | "clean" | "analyse";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

const SHORTCUTS: Array<{ id: CopilotShortcut; label: string; prompt: string }> = [
  {
    id: "create",
    label: "1. Create Excel",
    prompt: "Create a monthly attendance tracker for 25 employees with attendance percentage.",
  },
  {
    id: "paste",
    label: "2. Paste Data to Excel",
    prompt:
      "Rahul completed 25 cases and has 5 pending. Priya completed 30 cases and has 2 pending. Amit completed 18 cases and has 7 pending.",
  },
  {
    id: "formula",
    label: "3. Fix Formula",
    prompt: "Calculate the percentage of completed cases safely with IFERROR.",
  },
  {
    id: "clean",
    label: "4. Clean My Data",
    prompt: "Remove extra spaces, standardise status values, and flag missing fields.",
  },
  {
    id: "analyse",
    label: "5. Analyse Excel",
    prompt: "Who completed the most cases?",
  },
];

const STARTER_CSV = `Employee,Team,Completed_Cases,Pending_Cases,Productivity_Pct,Status
Rahul Sharma,KYC,25,5,92,Active
Priya Nair,KYC,30,2,96,Active
Amit Verma,AML,18,7,84,Review
Neha Kulkarni,AML,28,1,95,Active`;

export default function ExcelCopilotPage() {
  const [shortcut, setShortcut] = useState<CopilotShortcut>("create");
  const [instruction, setInstruction] = useState("");
  const [sourceText, setSourceText] = useState(STARTER_CSV);
  const [fileName, setFileName] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<SavedExcelWorkflow[]>([]);
  const [proposals, setProposals] = useState<CleaningProposal[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/excel-os", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { workflows: [] }))
      .then((data: { workflows?: SavedExcelWorkflow[] }) => {
        if (active && Array.isArray(data.workflows)) {
          setWorkflows(data.workflows);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const parsed: ParsedTable = useMemo(() => {
    if (shortcut === "paste") {
      return parseMessyTextToTable(sourceText);
    }
    return parseCsvOrTsv(sourceText);
  }, [sourceText, shortcut]);

  const issues = useMemo(() => inspectDataQuality(parsed), [parsed]);

  useEffect(() => {
    setProposals(buildCleaningProposals(parsed));
  }, [parsed]);

  const cleaned: ParsedTable = useMemo(() => {
    return applyApprovedCleaning(parsed, proposals);
  }, [parsed, proposals]);

  const rollup = useMemo(() => {
    if (parsed.headers.length < 2) return [];
    const groupCol = parsed.headers[1] || parsed.headers[0];
    return buildGroupSummary(parsed, groupCol);
  }, [parsed]);

  const formulaHelp = useMemo(() => {
    return runFormulaDoctor(
      instruction.trim() || "Calculate the percentage of completed cases using IFERROR",
      parsed
    );
  }, [instruction, parsed]);

  const qaAnswer = useMemo(() => {
    return answerQuestionAboutTable(
      instruction.trim() || "Summarise this table",
      parsed
    );
  }, [instruction, parsed]);

  const handoff = useMemo(() => {
    return buildCorporateBuddyHandoff(instruction, qaAnswer, parsed);
  }, [instruction, qaAnswer, parsed]);

  const previewTable = shortcut === "clean" ? cleaned : parsed;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorNote(null);
    setStatusNote(null);

    if (file.size > MAX_UPLOAD_BYTES) {
      setErrorNote("File exceeds the 5 MB upload limit.");
      return;
    }

    const lower = file.name.toLowerCase();
    const isExcelBinary = lower.endsWith(".xlsx") || lower.endsWith(".xls");
    const isTextTable = /\.(csv|tsv|txt)$/i.test(lower);

    if (!isExcelBinary && !isTextTable) {
      setErrorNote("Unsupported file format. Please upload .xlsx, .xls, .csv, .tsv, or .txt.");
      return;
    }

    setBusy(true);
    try {
      if (isExcelBinary) {
        const buffer = await file.arrayBuffer();
        const binaryTable = parseExcelBinaryBuffer(buffer, file.name);
        setSourceText(toCsvString(binaryTable));
        setFileName(file.name);
        setStatusNote(
          `Parsed ${file.name} (${binaryTable.rows.length} rows, ${binaryTable.headers.length} columns).`
        );
      } else {
        const content = await file.text();
        setSourceText(content);
        setFileName(file.name);
        setStatusNote(`Loaded ${file.name}.`);
      }
    } catch {
      setErrorNote("Could not parse the uploaded file.");
    } finally {
      setBusy(false);
    }
  };

  const handleRun = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNote(null);
    if (!instruction.trim() && !sourceText.trim()) {
      setErrorNote("Enter an instruction or paste/upload data first.");
      return;
    }
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      setStatusNote("Updated preview, formulas, checks, and Q&A below.");
    }, 120);
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setErrorNote("Could not copy to clipboard.");
    }
  };

  const handleDownload = () => {
    const richSpec = buildRichWorkbookSpec(instruction, previewTable);
    const spec =
      richSpec.fileName === "corporatebuddy_copilot_output.xlsx"
        ? buildDeterministicWorkbookSpec(instruction, previewTable)
        : richSpec;
    downloadSpecAsXlsx(spec);
    setStatusNote(`Downloaded ${spec.fileName} (${spec.summaryNote})`);
  };

  const toggleProposal = (id: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, approved: !p.approved } : p))
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Ask. Fix. Download. · Don&apos;t know Excel? Just tell CorporateBuddy what you need.
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-[#0b192c]">
              Excel Copilot
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Turn simple instructions into ready-to-use Excel files.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <a
              href="/"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              ← Back to CorporateBuddy
            </a>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-xl bg-[#0f294a] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#163863] cursor-pointer"
            >
              Download .xlsx
            </button>
          </div>
        </header>

        <section aria-label="Quick Actions" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {SHORTCUTS.map((item) => {
            const active = shortcut === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setShortcut(item.id);
                  if (!instruction.trim()) setInstruction(item.prompt);
                  setErrorNote(null);
                  setStatusNote(null);
                }}
                className={`rounded-xl border px-3.5 py-3 text-left transition-colors cursor-pointer ${
                  active
                    ? "border-[#0f294a] bg-[#0f294a] text-white"
                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                <div className="text-xs font-bold">{item.label}</div>
                <div
                  className={`mt-1 line-clamp-2 text-[11px] ${
                    active ? "text-slate-200" : "text-slate-500"
                  }`}
                >
                  {item.prompt}
                </div>
              </button>
            );
          })}
        </section>

        <form
          onSubmit={handleRun}
          className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4"
        >
          <div>
            <label
              htmlFor="excel-copilot-input"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              Instruction
            </label>
            <textarea
              id="excel-copilot-input"
              rows={3}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Describe what you want to create, fix or analyse in Excel..."
              className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50/60 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0f294a] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-8">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="excel-copilot-data"
                  className="text-xs font-bold uppercase tracking-wider text-slate-500"
                >
                  Data / Paste Input ({parsed.rows.length} rows)
                </label>
                {fileName && <span className="text-xs font-medium text-blue-700">{fileName}</span>}
              </div>
              <textarea
                id="excel-copilot-data"
                rows={5}
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Paste rows, CSV, TSV, or messy text..."
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-xs text-slate-800 focus:border-[#0f294a] focus:outline-none"
              />
            </div>

            <div className="lg:col-span-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-800">Upload Spreadsheet / Text</p>
              <p className="text-[11px] text-slate-500">
                Supports .xlsx, .xls, .csv, .tsv, and .txt (up to 5 MB). Processed privately.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
                >
                  Choose File
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSourceText(STARTER_CSV);
                    setFileName(null);
                    setErrorNote(null);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Reset Sample
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              {busy ? (
                <span className="font-semibold text-blue-700">Processing...</span>
              ) : errorNote ? (
                <span className="font-semibold text-rose-700">{errorNote}</span>
              ) : statusNote ? (
                <span className="font-semibold text-emerald-700">{statusNote}</span>
              ) : (
                <span className="text-slate-500">Minimum input → structured preview → download.</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopy("csv", toCsvString(previewTable))}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                {copiedId === "csv" ? "Copied CSV" : "Copy CSV"}
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#0f294a] px-5 py-2 text-xs font-semibold text-white hover:bg-[#163863] cursor-pointer"
              >
                Run
              </button>
            </div>
          </div>
        </form>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Table Preview + Q&A */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#0b192c]">Preview Before Download</h2>
                  <p className="text-xs text-slate-500">
                    {previewTable.headers.length} columns · {previewTable.rows.length} rows
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                >
                  Download .xlsx
                </button>
              </div>

              {previewTable.headers.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                  No columns detected yet. Paste data or upload a file above.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {previewTable.headers.map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {previewTable.rows.slice(0, 25).map((row, rIdx) => (
                      <tr key={rIdx}>
                        {previewTable.headers.map((h) => (
                          <td
                            key={h}
                            className="px-3 py-2 text-slate-800 whitespace-nowrap"
                          >
                            {row[h] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Phase 5: Ask Questions About My Excel */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#0b192c]">Ask Questions About Data</h2>
                <button
                  type="button"
                  onClick={() => handleCopy("qa", qaAnswer.directAnswer)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  {copiedId === "qa" ? "Copied" : "Copy Answer"}
                </button>
              </div>
              <p className="text-xs font-semibold text-slate-900">{qaAnswer.directAnswer}</p>
              {qaAnswer.calculations.length > 0 && (
                <ul className="space-y-1 text-xs text-slate-600">
                  {qaAnswer.calculations.map((calc, idx) => (
                    <li key={idx}>• {calc}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right Column: Formula Doctor + Approve/Reject Cleaning + Handoff */}
          <div className="lg:col-span-5 space-y-6">
            {/* Phase 3: Formula Doctor */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#0b192c]">Formula Doctor</h2>
                <button
                  type="button"
                  onClick={() => handleCopy("formula", formulaHelp.formula)}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100 cursor-pointer"
                >
                  {copiedId === "formula" ? "Copied" : "Copy Formula"}
                </button>
              </div>
              <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 font-mono text-xs text-emerald-300">
                {formulaHelp.formula}
              </pre>
              <p className="text-xs text-slate-700">{formulaHelp.explanation}</p>
              <p className="text-[11px] text-slate-500">
                Example: <span className="font-mono">{formulaHelp.example}</span>
              </p>
              <p className="text-[11px] text-slate-500">Where to apply: {formulaHelp.whereToApply}</p>
              <p className="text-[11px] text-slate-500">Notes: {formulaHelp.compatibilityNotes}</p>
            </div>

            {/* Phase 4: Clean My Data (Approve / Reject) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="text-base font-bold text-[#0b192c]">
                Data Cleaning ({issues.length} findings)
              </h2>
              {proposals.length === 0 ? (
                <p className="text-xs text-slate-500">No cleaning proposals needed right now.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {proposals.map((prop) => (
                    <li
                      key={prop.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800">{prop.issueType}</span>
                        <button
                          type="button"
                          onClick={() => toggleProposal(prop.id)}
                          className={`rounded-lg px-2.5 py-0.5 text-[11px] font-semibold cursor-pointer ${
                            prop.approved
                              ? "bg-emerald-100 text-emerald-900"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {prop.approved ? "Approved" : "Rejected"}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Affected: {prop.affectedCount} · {prop.proposedFix}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {rollup.length > 0 && (
                <ul className="space-y-1 text-xs pt-1">
                  {rollup.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5"
                    >
                      <span className="font-medium text-slate-700">{item.group || "(Blank)"}</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {item.count} ({item.pct}%)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Phase 6: Copyable Handoff to Email Assistant & MeetingOS */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="text-base font-bold text-[#0b192c]">CorporateBuddy Handoff</h2>
              <p className="text-[11px] text-slate-500">
                Copy verified findings for Email Assistant or MeetingOS drafts (no auto-send).
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy("email-draft", handoff.emailDraft)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  {copiedId === "email-draft" ? "Copied Email Draft" : "Copy for Email Assistant"}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy("mom-points", handoff.meetingPoints)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  {copiedId === "mom-points" ? "Copied MOM Points" : "Copy for MeetingOS"}
                </button>
              </div>
              {workflows.length > 0 && (
                <p className="text-[11px] text-slate-400">Saved workflows: {workflows.length}</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}








