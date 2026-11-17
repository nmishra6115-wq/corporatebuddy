"use client";

import React, { useMemo, useState } from "react";
import {
  AppraisalQuestionItem,
  DraftAnswerItem,
  formatReviewExport,
  generateGrowthAnswers,
  GrowthTone,
  AchievementRecord,
  buildProfessionalAchievementSummary,
  GROWTH_CATEGORIES,
  GrowthCategory,
  parseAppraisalQuestions,
  suggestAchievementCategory,
  transformAnswer,
} from "@/lib/growthosEngine";

type GrowthTab = "workday" | "vault" | "promotion" | "goals";

export default function GrowthOsWorkspace() {
  const [activeTab, setActiveTab] = useState<GrowthTab>("workday");
  const [yearSummaryInput, setYearSummaryInput] = useState("");
  const [questionsText, setQuestionsText] = useState(
    [
      "What were your key achievements?",
      "How did you contribute to business objectives?",
      "What challenges did you overcome?",
      "What areas require improvement?",
      "What are your goals for the next performance cycle?",
    ].join("\n")
  );
  const [parsedQuestions, setParsedQuestions] = useState<AppraisalQuestionItem[]>(
    () =>
      parseAppraisalQuestions(
        [
          "What were your key achievements?",
          "How did you contribute to business objectives?",
          "What challenges did you overcome?",
          "What areas require improvement?",
          "What are your goals for the next performance cycle?",
        ].join("\n")
      )
  );
  const [achievementsText, setAchievementsText] = useState(
    "Handled team workload, supported new joiners, improved quality, managed client escalations and achieved monthly targets."
  );
  const [tone, setTone] = useState<GrowthTone>("professional");
  const [drafts, setDrafts] = useState<DraftAnswerItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
   const [achievementsVault, setAchievementsVault] = useState<AchievementRecord[]>([]);
   const [vaultQuickInput, setVaultQuickInput] = useState("");
   const [vaultResultInput, setVaultResultInput] = useState("");
   const [vaultSearch, setVaultSearch] = useState("");
   const [vaultCategoryFilter, setVaultCategoryFilter] = useState<string>("all");
   const [promoCurrentRole, setPromoCurrentRole] = useState("");
   const [promoTargetRole, setPromoTargetRole] = useState("");
   const [promoSummary, setPromoSummary] = useState<string | null>(null);
   const [goalRawInput, setGoalRawInput] = useState("");
   const [goalType, setGoalType] = useState("Performance");
   const [goalDraft, setGoalDraft] = useState<{ title: string; objective: string; successMeasure: string; targetDate: string; keyActions: string; businessRelevance: string } | null>(null);

  const handleSyncQuestions = () => {
    setParsedQuestions(parseAppraisalQuestions(questionsText));
  };

  const handleUseYearSummary = () => {
    if (!yearSummaryInput.trim()) return;
    setAchievementsText(yearSummaryInput.trim());
    setActiveTab("workday");
  };

  const handleGenerate = async () => {
    setErrorMsg(null);
    const qs = parseAppraisalQuestions(questionsText);
    setParsedQuestions(qs);

    if (!qs.length) {
      setErrorMsg("Enter at least one appraisal question first.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/growthos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: qs,
          achievements: achievementsText,
          tone,
        }),
      });
      if (!res.ok) {
        const fallback = generateGrowthAnswers(qs, achievementsText, tone);
        setDrafts(fallback);
        return;
      }
      const data = await res.json();
      setDrafts(Array.isArray(data?.answers) ? data.answers : []);
    } catch {
      const fallback = generateGrowthAnswers(qs, achievementsText, tone);
      setDrafts(fallback);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setErrorMsg("Clipboard access was blocked by the browser.");
    }
  };

  const handleDownload = () => {
    if (!drafts.length) return;
    const blob = new Blob([formatReviewExport(drafts)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "corporatebuddy-appraisal-promotion-assistant.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalWords = useMemo(
    () =>
      drafts.reduce(
        (sum, d) => sum + d.answer.trim().split(/\s+/).filter(Boolean).length,
        0
      ),
    [drafts]
  );

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-900">
              AI Appraisal &amp; Promotion Assistant
            </span>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0b192c]">
              GrowthOS
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-800">
              Your achievements, professionally presented.
            </p>
            <p className="mt-0.5 text-xs text-slate-600 max-w-2xl">
              Preparing for an appraisal or promotion? Upload your questions or tell us what you&apos;ve accomplished. GrowthOS will help you write clear, professional answers.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <textarea
            rows={2}
            value={yearSummaryInput}
            onChange={(e) => setYearSummaryInput(e.target.value)}
            placeholder="Tell me what you worked on this year..."
            aria-label="Tell me what you worked on this year"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#0f294a] focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Example: &ldquo;I managed daily operations, reduced pending cases, trained new joiners and helped the team meet its targets.&rdquo;
            </span>
            <button
              type="button"
              onClick={handleUseYearSummary}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-100"
            >
              Send to Workday Assistant
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <button
            type="button"
            onClick={() => setActiveTab("workday")}
            className={
              activeTab === "workday"
                ? "rounded-xl border border-[#0f294a] bg-[#0f294a] p-4 text-left text-white"
                : "rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-left text-slate-900 hover:bg-slate-100"
            }
          >
            <p className="text-xs font-semibold">Fill My Workday</p>
            <p
              className={
                activeTab === "workday"
                  ? "mt-1 text-[11px] text-blue-100"
                  : "mt-1 text-[11px] text-slate-600"
              }
            >
              Turn appraisal questions into professional answers.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("vault")}
            className={
              activeTab === "vault"
                ? "rounded-xl border border-[#0f294a] bg-[#0f294a] p-4 text-left text-white"
                : "rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-left text-slate-900 hover:bg-slate-100"
            }
          >
            <p className="text-xs font-semibold">My Achievements</p>
            <p
              className={
                activeTab === "vault"
                  ? "mt-1 text-[11px] text-blue-100"
                  : "mt-1 text-[11px] text-slate-600"
              }
            >
              Save and organise your work accomplishments.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("promotion")}
            className={
              activeTab === "promotion"
                ? "rounded-xl border border-[#0f294a] bg-[#0f294a] p-4 text-left text-white"
                : "rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-left text-slate-900 hover:bg-slate-100"
            }
          >
            <p className="text-xs font-semibold">Prepare My Promotion</p>
            <p
              className={
                activeTab === "promotion"
                  ? "mt-1 text-[11px] text-blue-100"
                  : "mt-1 text-[11px] text-slate-600"
              }
            >
              Build a strong case for your next role.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("goals")}
            className={
              activeTab === "goals"
                ? "rounded-xl border border-[#0f294a] bg-[#0f294a] p-4 text-left text-white"
                : "rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-left text-slate-900 hover:bg-slate-100"
            }
          >
            <p className="text-xs font-semibold">Write My Goals</p>
            <p
              className={
                activeTab === "goals"
                  ? "mt-1 text-[11px] text-blue-100"
                  : "mt-1 text-[11px] text-slate-600"
              }
            >
              Create clear performance and development goals.
            </p>
          </button>
        </div>
      </div>

      {activeTab === "workday" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[#0b192c]">
                Fill My Workday
              </h2>
              <p className="text-xs text-slate-600">
                Paste appraisal questions and rough accomplishments, then copy ready-to-paste responses into Workday or your HR portal.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["professional", "Professional"],
                  ["confident", "Confident & Impact-Focused"],
                  ["concise", "Concise"],
                ] as [GrowthTone, string][]
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setTone(val)}
                  className={
                    tone === val
                      ? "rounded-lg bg-[#0f294a] px-3 py-1.5 text-xs font-semibold text-white"
                      : "rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  1. Appraisal Questions (one per line)
                </label>
                <button
                  type="button"
                  onClick={handleSyncQuestions}
                  className="text-xs font-semibold text-blue-900 hover:underline"
                >
                  Parse Questions ({parsedQuestions.length})
                </button>
              </div>
              <textarea
                rows={6}
                value={questionsText}
                onChange={(e) => setQuestionsText(e.target.value)}
                onBlur={handleSyncQuestions}
                placeholder="Paste appraisal questions here..."
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#0f294a] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                2. What did you accomplish?
              </label>
              <textarea
                rows={6}
                value={achievementsText}
                onChange={(e) => setAchievementsText(e.target.value)}
                placeholder="Write anything you remember. It doesn't need to be professional."
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#0f294a] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="rounded-xl bg-[#0f294a] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#0b192c] disabled:opacity-50"
            >
              {loading ? "Preparing Answers..." : "Generate Workday Answers"}
            </button>

            {drafts.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">
                  {drafts.length} answers · {totalWords} words total
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy("all", formatReviewExport(drafts))
                  }
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  {copiedId === "all" ? "Copied All" : "Copy All Answers"}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  Download Review
                </button>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              {errorMsg}
            </div>
          )}

          {drafts.length > 0 && (
            <div className="space-y-4 pt-2">
              {drafts.map((item, idx) => {
                const words = item.answer
                  .trim()
                  .split(/\s+/)
                  .filter(Boolean).length;
                return (
                  <div
                    key={item.questionId}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs sm:text-sm font-semibold text-[#0b192c]">
                        Q{idx + 1}. {item.question}
                      </p>
                      <span className="shrink-0 text-[11px] text-slate-500">
                        {words} words · {item.answer.length} chars
                      </span>
                    </div>

                    {editingId === item.questionId ? (
                      <textarea
                        rows={4}
                        value={item.answer}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDrafts((prev) =>
                            prev.map((d) =>
                              d.questionId === item.questionId
                                ? { ...d, answer: val }
                                : d
                            )
                          );
                        }}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                    ) : (
                      <p className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 leading-relaxed">
                        {item.answer}
                      </p>
                    )}

                    {item.missingEvidenceNote && (
                      <p className="text-[11px] text-slate-600">
                        Note: {item.missingEvidenceNote}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(item.questionId, item.answer)}
                        className="rounded-lg bg-[#0f294a] px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        {copiedId === item.questionId
                          ? "Copied"
                          : "Copy Answer"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingId(
                            editingId === item.questionId
                              ? null
                              : item.questionId
                          )
                        }
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        {editingId === item.questionId ? "Done Editing" : "Edit"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = transformAnswer(
                            item.answer,
                            "shorten",
                            item.question,
                            achievementsText,
                            tone
                          );
                          setDrafts((prev) =>
                            prev.map((d) =>
                              d.questionId === item.questionId
                                ? { ...d, answer: updated }
                                : d
                            )
                          );
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Shorten
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = transformAnswer(
                            item.answer,
                            "impactful",
                            item.question,
                            achievementsText,
                            tone
                          );
                          setDrafts((prev) =>
                            prev.map((d) =>
                              d.questionId === item.questionId
                                ? { ...d, answer: updated }
                                : d
                            )
                          );
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Make More Impactful
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = transformAnswer(
                            item.answer,
                            "regenerate",
                            item.question,
                            achievementsText,
                            tone
                          );
                          setDrafts((prev) =>
                            prev.map((d) =>
                              d.questionId === item.questionId
                                ? { ...d, answer: updated }
                                : d
                            )
                          );
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "vault" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[#0b192c]">My Achievements</h2>
              <p className="text-xs text-slate-600">Type what you accomplished, save in seconds, and reuse confirmed notes in Workday answers.</p>
            </div>
            {achievementsVault.some((a) => a.selectedForReview) && (
              <button
                type="button"
                onClick={() => {
                  const chosen = achievementsVault.filter((a) => a.selectedForReview).map((a) => a.professionalSummary).join(" ");
                  if (chosen) {
                    setAchievementsText((prev) => (prev.trim() ? `${prev.trim()} ${chosen}` : chosen));
                  }
                  setActiveTab("workday");
                }}
                className="rounded-lg bg-[#0f294a] px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                Use Selected in Workday ({achievementsVault.filter((a) => a.selectedForReview).length})
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">What did you accomplish today?</label>
              <input
                type="text"
                value={vaultQuickInput}
                onChange={(e) => setVaultQuickInput(e.target.value)}
                placeholder="e.g. Resolved an urgent escalation, trained two new employees and completed the weekly report"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-[#0f294a] focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Measurable result (optional)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={vaultResultInput}
                  onChange={(e) => setVaultResultInput(e.target.value)}
                  placeholder="Optional verified metric"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#0f294a] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!vaultQuickInput.trim()) return;
                    const rec: AchievementRecord = {
                      id: `ach-${Date.now()}`,
                      rawNote: vaultQuickInput.trim(),
                      professionalSummary: buildProfessionalAchievementSummary(vaultQuickInput),
                      category: suggestAchievementCategory(vaultQuickInput),
                      date: new Date().toISOString().slice(0, 10),
                      measurableResult: vaultResultInput.trim() || undefined,
                      selectedForReview: true,
                    };
                    setAchievementsVault((prev) => [rec, ...prev]);
                    setVaultQuickInput("");
                    setVaultResultInput("");
                  }}
                  className="shrink-0 rounded-xl bg-[#0f294a] px-4 py-2 text-xs font-semibold text-white"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={vaultSearch}
              onChange={(e) => setVaultSearch(e.target.value)}
              placeholder="Search saved achievements..."
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800"
            />
            <select
              value={vaultCategoryFilter}
              onChange={(e) => setVaultCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800"
            >
              <option value="all">All categories ({achievementsVault.length})</option>
              {GROWTH_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          {achievementsVault.length === 0 ? (
            <p className="text-xs text-slate-500">No achievements saved yet. Type a quick note above and click Save.</p>
          ) : (
            <div className="space-y-2.5">
              {achievementsVault
                .filter((a) => {
                  const matchesCat = vaultCategoryFilter === "all" || a.category === vaultCategoryFilter;
                  const q = vaultSearch.trim().toLowerCase();
                  const matchesSearch = !q || a.professionalSummary.toLowerCase().includes(q) || a.rawNote.toLowerCase().includes(q);
                  return matchesCat && matchesSearch;
                })
                .map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.selectedForReview}
                          onChange={() =>
                            setAchievementsVault((prev) =>
                              prev.map((x) => x.id === item.id ? { ...x, selectedForReview: !x.selectedForReview } : x)
                            )
                          }
                        />
                        <span className="text-xs font-semibold text-[#0b192c]">{item.professionalSummary}</span>
                        <span className="text-[11px] text-slate-500">{item.date}</span>
                      </div>
                      {item.measurableResult && (
                        <p className="text-[11px] text-slate-600">Verified result: {item.measurableResult}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={item.category}
                        onChange={(e) => {
                          const nextCat = e.target.value as GrowthCategory;
                          setAchievementsVault((prev) =>
                            prev.map((x) => x.id === item.id ? { ...x, category: nextCat } : x)
                          );
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
                      >
                        {GROWTH_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setAchievementsVault((prev) => prev.filter((x) => x.id !== item.id))}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
      {activeTab === "promotion" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[#0b192c]">Prepare My Promotion</h2>
              <p className="text-xs text-slate-600">Build an evidence-backed promotion brief from your saved achievements and Workday notes without fabricating outcomes.</p>
            </div>
            {promoSummary && (
              <button
                type="button"
                onClick={() => handleCopy("promo", promoSummary)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
              >
                {copiedId === "promo" ? "Copied Brief" : "Copy Promotion Brief"}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">What is your current role? (optional)</label>
              <input
                type="text"
                value={promoCurrentRole}
                onChange={(e) => setPromoCurrentRole(e.target.value)}
                placeholder="e.g. Analyst / Senior Associate"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-[#0f294a] focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">What role are you aiming for? (optional)</label>
              <input
                type="text"
                value={promoTargetRole}
                onChange={(e) => setPromoTargetRole(e.target.value)}
                placeholder="e.g. Team Lead / Specialist"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-[#0f294a] focus:outline-none"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const vaultNotes = achievementsVault.map((a) => a.professionalSummary);
              const fallbackNotes = achievementsText.split(/\r?\n|(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean);
              const evidenceList = vaultNotes.length ? vaultNotes : fallbackNotes;
              const roleLine = promoCurrentRole || promoTargetRole ? `${promoCurrentRole || "Current role"} -> ${promoTargetRole || "Next role"}` : "Next-role readiness review";
              const evidenceBlock = evidenceList.length ? evidenceList.map((e, i) => `${i + 1}. ${e}`).join("\n") : "No saved achievements added yet. Add notes in My Achievements or Fill My Workday first.";
              const brief = [
                `Promotion Justification (${roleLine}):`,
                evidenceList.length ? `Based on documented work, I have consistently executed core responsibilities and supported team delivery: ${evidenceList.slice(0, 3).join(" ")}` : "Evidence status: Add verified achievements before finalizing your promotion case.",
                "",
                "Why I Am Ready for the Next Role:",
                "I bring practical operational ownership, dependable follow-through, and readiness to take on broader scope without assuming unverified metrics.",
                "",
                "Demonstrated Evidence & Leadership Contributions:",
                evidenceBlock,
                "",
                "Development Areas & Manager Discussion Points:",
                "- Confirm target-role competency expectations and specific scope gaps with your manager.",
                "- Highlight concrete handoffs, mentoring, or process improvements where additional evidence can be logged.",
                "",
                "Promotion Preparation Checklist:",
                ["[ ] Confirm role expectations / job description with manager", "[ ] Verify all cited achievements and remove unverified numbers", "[ ] Prepare 2-3 concrete examples of cross-team support", "[ ] Agree on next-cycle stretch milestones"].join("\n")
              ].join("\n");
              setPromoSummary(brief);
            }}
            className="rounded-xl bg-[#0f294a] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#0b192c]"
          >
            Generate Promotion Readiness Brief
          </button>
          {promoSummary && (
            <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs sm:text-sm text-slate-800 leading-relaxed font-sans">
              {promoSummary}
            </pre>
          )}
        </div>
      )}

      {activeTab === "goals" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[#0b192c]">Write My Goals</h2>
              <p className="text-xs text-slate-600">Turn a rough improvement idea into a structured goal draft without inventing targets.</p>
            </div>
            {goalDraft && (
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    "goal",
                    `Goal: ${goalDraft.title}\nObjective: ${goalDraft.objective}\nSuccess Measure: ${goalDraft.successMeasure}\nTarget Date: ${goalDraft.targetDate}\nKey Actions: ${goalDraft.keyActions}\nBusiness Relevance: ${goalDraft.businessRelevance}`
                  )
                }
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
              >
                {copiedId === "goal" ? "Copied Goal" : "Copy Goal"}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">What do you want to improve or achieve?</label>
              <input
                type="text"
                value={goalRawInput}
                onChange={(e) => setGoalRawInput(e.target.value)}
                placeholder="e.g. Improve team quality and reduce pending work"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-[#0f294a] focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Goal type (optional)</label>
              <select
                value={goalType}
                onChange={(e) => setGoalType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {["Performance", "Leadership", "Learning", "Process improvement", "Collaboration", "Customer service"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([
              ["smart", "Make SMART"],
              ["shorten", "Shorten"],
              ["leadership", "Make Leadership-Focused"],
            ] as ["smart" | "shorten" | "leadership", string][]).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  const base = goalRawInput.trim() || "Strengthen delivery quality and workflow reliability";
                  const cleanBase = base.replace(/[.!?]+$/, "");
                  setGoalDraft({
                    title: mode === "leadership" ? `Lead & Scale: ${cleanBase.slice(0, 60)}` : mode === "shorten" ? cleanBase.slice(0, 68) : `Deliver ${cleanBase.slice(0, 62)}`,
                    objective: mode === "shorten" ? `Improve ${cleanBase.toLowerCase()} in ${goalType.toLowerCase()}.` : mode === "leadership" ? `Guide peers and align handoffs to ${cleanBase.toLowerCase()}.` : `Translate "${cleanBase}" into consistent, verifiable ${goalType.toLowerCase()} execution.`,
                    successMeasure: "Agreed review checkpoints completed with documented outcomes (add specific targets only if verified).",
                    targetDate: "End of current performance cycle",
                    keyActions: mode === "leadership" ? "Set clear checkpoints, mentor teammates, and unblock dependencies weekly." : "Break into weekly checkpoints, log evidence in My Achievements, and review with manager.",
                    businessRelevance: "Supports reliable team delivery and reduces avoidable rework.",
                  });
                }}
                className={mode === "smart" ? "rounded-xl bg-[#0f294a] px-4 py-2 text-xs font-semibold text-white" : "rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"}
              >
                {label}
              </button>
            ))}
          </div>
          {goalDraft && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2 text-xs sm:text-sm text-slate-800">
              <p><span className="font-semibold text-[#0b192c]">Goal title:</span> {goalDraft.title}</p>
              <p><span className="font-semibold text-[#0b192c]">Objective:</span> {goalDraft.objective}</p>
              <p><span className="font-semibold text-[#0b192c]">Success measure:</span> {goalDraft.successMeasure}</p>
              <p><span className="font-semibold text-[#0b192c]">Target date:</span> {goalDraft.targetDate}</p>
              <p><span className="font-semibold text-[#0b192c]">Key actions:</span> {goalDraft.keyActions}</p>
              <p><span className="font-semibold text-[#0b192c]">Business relevance:</span> {goalDraft.businessRelevance}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
