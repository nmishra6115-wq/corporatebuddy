"use client";

import React, { useState } from "react";
import { ChangeRegisterRecord, CoverageReport, ExtractedDocument } from "@/lib/changeosEngine";

type ChangeTab = "overview" | "register" | "sidebyside" | "ask";

export default function ChangeOsWorkspace() {
  const [oldFile, setOldFile] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChangeTab>("register");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [askQuery, setAskQuery] = useState("");
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [oldDoc, setOldDoc] = useState<ExtractedDocument | null>(null);
  const [newDoc, setNewDoc] = useState<ExtractedDocument | null>(null);
  const [changes, setChanges] = useState<ChangeRegisterRecord[]>([]);
  const [coverage, setCoverage] = useState<CoverageReport | null>(null);

  const handleCompare = async () => {
    if (!oldFile || !newFile) {
      setErrorMsg("Upload both Previous Document and Updated Document first.");
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("oldDocument", oldFile);
      fd.append("newDocument", newFile);
      const res = await fetch("/api/changeos", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || "Comparison failed.");
        return;
      }
      setOldDoc(data.oldDoc ?? null);
      setNewDoc(data.newDoc ?? null);
      setChanges(Array.isArray(data.changes) ? data.changes : []);
      setCoverage(data.coverage ?? null);
      setActiveTab("register");
    } catch {
      setErrorMsg("Unable to compare documents right now.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (!changes.length) return;
    const headers = ["Change ID", "Change Type", "Section", "Previous Location", "Updated Location", "Previous Text", "Updated Text", "Exact Difference", "Explanation", "Evidence Status", "Review Status"];
    const rows = changes.map((c) =>
      [c.changeId, c.changeType, c.section, c.oldLocation, c.newLocation, c.oldText, c.newText, c.exactDifference, c.explanation, c.verificationStatus, c.reviewStatus]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "corporatebuddy-document-comparison-register.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredChanges = changes.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.changeId.toLowerCase().includes(q) ||
      c.section.toLowerCase().includes(q) ||
      c.oldText.toLowerCase().includes(q) ||
      c.newText.toLowerCase().includes(q) ||
      c.exactDifference.toLowerCase().includes(q)
    );
  });

  const handleAsk = () => {
    const q = askQuery.trim().toLowerCase();
    if (!q) return;
    const matches = changes.filter(
      (c) =>
        c.section.toLowerCase().includes(q) ||
        c.oldText.toLowerCase().includes(q) ||
        c.newText.toLowerCase().includes(q) ||
        c.exactDifference.toLowerCase().includes(q)
    );
    if (!matches.length) {
      setAskAnswer("I could not find this information in the uploaded documents.");
      return;
    }
    setAskAnswer(
      matches
        .slice(0, 15)
        .map((m) => `${m.changeId} (${m.oldLocation} -> ${m.newLocation}): ${m.exactDifference}`)
        .join("\n")
    );
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-900">AI Document Comparison</span>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0b192c]">Document Comparison &amp; Process Change Intelligence</h1>
          <p className="mt-1 text-sm font-medium text-slate-800">Know exactly what changed between document versions.</p>
          <p className="mt-0.5 text-xs text-slate-600 max-w-2xl">
            Upload the previous and updated versions of your document. ChangeOS compares them section by section and shows every detectable change with original source references.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={oldFile ? "rounded-xl border-2 border-[#0f294a] bg-blue-50/40 p-4 space-y-2" : "rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2"}>
            <p className="text-xs font-semibold text-[#0b192c]">Previous Document</p>
            <p className="text-[11px] text-slate-600">Upload the old version.</p>
            <input
              type="file"
              accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.xls"
              onChange={(e) => setOldFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-slate-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#0f294a] file:px-3.5 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[#0b192c]"
            />
            {oldFile && <p className="text-[11px] text-slate-700">Selected: {oldFile.name} ({Math.ceil(oldFile.size / 1024)} KB)</p>}
          </div>

          <div className={newFile ? "rounded-xl border-2 border-[#0f294a] bg-blue-50/40 p-4 space-y-2" : "rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2"}>
            <p className="text-xs font-semibold text-[#0b192c]">Updated Document</p>
            <p className="text-[11px] text-slate-600">Upload the revised version.</p>
            <input
              type="file"
              accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.xls"
              onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-slate-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#0f294a] file:px-3.5 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[#0b192c]"
            />
            {newFile && <p className="text-[11px] text-slate-700">Selected: {newFile.name} ({Math.ceil(newFile.size / 1024)} KB)</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCompare}
            disabled={loading}
            className="rounded-xl bg-[#0f294a] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#0b192c] disabled:opacity-50"
          >
            {loading ? "Comparing Documents..." : "Compare Documents"}
          </button>
          {changes.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
            >
              Export CSV Register ({changes.length})
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{errorMsg}</div>
        )}
      </div>

      {(changes.length > 0 || coverage) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
            {(["overview", "register", "sidebyside", "ask"] as ChangeTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                className={
                  activeTab === t
                    ? "rounded-lg bg-[#0f294a] px-3.5 py-1.5 text-xs font-semibold text-white"
                    : "rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-medium text-slate-700"
                }
              >
                {t === "overview" && "Overview"}
                {t === "register" && `All Changes (${changes.length})`}
                {t === "sidebyside" && "Side-by-Side"}
                {t === "ask" && "Ask ChangeOS"}
              </button>
            ))}
          </div>

          {activeTab === "overview" && coverage && (
            <div className="space-y-3 text-xs text-slate-800">
              <p className="font-semibold text-[#0b192c]">Coverage &amp; Extraction Status: {coverage.completionStatus}</p>
              <p>Previous ({oldDoc?.fileName}): {coverage.oldDoc.pagesExtracted}/{coverage.oldDoc.totalPages} pages extracted · {coverage.oldDoc.tablesExtracted} tables</p>
              <p>Updated ({newDoc?.fileName}): {coverage.newDoc.pagesExtracted}/{coverage.newDoc.totalPages} pages extracted · {coverage.newDoc.tablesExtracted} tables</p>
              <p>Sections matched: {coverage.sectionsMatched} · Sections unmatched: {coverage.sectionsUnmatched} · Changes detected: {coverage.changesDetected} · Needs verification: {coverage.changesRequiringVerification}</p>
              {(coverage.oldDoc.extractionErrors.length > 0 || coverage.newDoc.extractionErrors.length > 0) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 space-y-1">
                  {[...coverage.oldDoc.extractionErrors, ...coverage.newDoc.extractionErrors].map((err, i) => (
                    <p key={i}>Extraction gap: {err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "register" && (
            <div className="space-y-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search change ID, section, old text, new text..."
                className="w-full max-w-md rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900"
              />
              <div className="space-y-2">
                {filteredChanges.map((c) => {
                  const isOpen = expandedId === c.changeId;
                  return (
                    <div key={c.changeId} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : c.changeId)}
                        className="w-full text-left flex flex-wrap items-center justify-between gap-2"
                      >
                        <span className="text-xs font-semibold text-[#0b192c]">{c.changeId} — {c.section} — {c.exactDifference}</span>
                        <span className="text-[11px] text-slate-500">{c.verificationStatus} · {c.reviewStatus}</span>
                      </button>
                      {isOpen && (
                        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5 text-xs text-slate-800">
                          <p><span className="font-semibold">Previous Location:</span> {c.oldLocation}</p>
                          <p><span className="font-semibold">Updated Location:</span> {c.newLocation}</p>
                          <p><span className="font-semibold">Previous Text:</span> {c.oldText || "(none)"}</p>
                          <p><span className="font-semibold">Updated Text:</span> {c.newText || "(none)"}</p>
                          <p><span className="font-semibold">Exact Difference:</span> {c.exactDifference}</p>
                          <p><span className="font-semibold">Explanation:</span> {c.explanation}</p>
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                setChanges((prev) =>
                                  prev.map((x) =>
                                    x.changeId === c.changeId
                                      ? { ...x, reviewStatus: x.reviewStatus === "Reviewed" ? "Not Reviewed" : "Reviewed" }
                                      : x
                                  )
                                )
                              }
                              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                            >
                              Mark {c.reviewStatus === "Reviewed" ? "Not Reviewed" : "Reviewed"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "sidebyside" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2">
                <p className="font-semibold text-[#0b192c]">Previous Version ({oldDoc?.fileName})</p>
                {changes.filter((c) => c.oldText).map((c) => (
                  <div key={c.changeId} className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <p className="text-[11px] text-slate-500">{c.oldLocation}</p>
                    <p className="text-slate-800">{c.oldText}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2">
                <p className="font-semibold text-[#0b192c]">Updated Version ({newDoc?.fileName})</p>
                {changes.filter((c) => c.newText).map((c) => (
                  <div key={c.changeId} className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <p className="text-[11px] text-slate-500">{c.newLocation}</p>
                    <p className="text-slate-800">{c.newText}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "ask" && (
            <div className="space-y-3 text-xs">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={askQuery}
                  onChange={(e) => setAskQuery(e.target.value)}
                  placeholder="Ask Document Comparison & Process Change Intelligence about a section, deadline, approval, or keyword..."
                  className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleAsk}
                  className="rounded-xl bg-[#0f294a] px-4 py-2 text-xs font-semibold text-white"
                >
                  Ask
                </button>
              </div>
              {askAnswer && (
                <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs text-slate-800 font-sans">{askAnswer}</pre>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
