"use client";

import React, { useMemo, useState } from "react";

interface QueueInput {
  id: string;
  name: string;
  totalCases: string;
  completedCases: string;
  slaHours: string;
  assignedAnalysts: string;
  avgMinutesPerCase: string;
}

interface LeaveEntry {
  id: string;
  label: string;
  analystsOnLeave: string;
  startDate: string;
  endDate: string;
  daysOff: number;
  scope: string;
}

interface QueuePlanResult {
  id: string;
  name: string;
  totalCases: number;
  completedCases: number;
  slaHours: number;
  assignedAnalysts: number;
  avgMinutesPerCase: number;
  remainingCases: number;
  effectiveAnalysts: number;
  requiredAnalysts: number;
  analystGap: number;
  projectedHoursNeeded: number;
  projectedHoursAvailable: number;
  recommendedAllocation: number;
  status: "On Track" | "Tight" | "At Risk";
}

interface DailyBurnDownPoint {
  dayIndex: number;
  dayLabel: string;
  dateStr: string;
  activeLeavesStr: string;
  activeLeaves: number;
  netAnalysts: number;
  dailyCapacityCases: number;
  projectedRemainingStr: string;
  projectedRemainingCases: number;
  isRemainingOverridden: boolean;
}

const INITIAL_QUEUES: QueueInput[] = [
  {
    id: "q-1",
    name: "KYC Onboarding",
    totalCases: "240",
    completedCases: "120",
    slaHours: "24",
    assignedAnalysts: "3",
    avgMinutesPerCase: "30",
  },
  {
    id: "q-2",
    name: "AML Alert Triage",
    totalCases: "180",
    completedCases: "75",
    slaHours: "12",
    assignedAnalysts: "3",
    avgMinutesPerCase: "25",
  },
  {
    id: "q-3",
    name: "Sanctions Hits",
    totalCases: "100",
    completedCases: "40",
    slaHours: "8",
    assignedAnalysts: "2",
    avgMinutesPerCase: "20",
  },
];

const INITIAL_LEAVES: LeaveEntry[] = [
  {
    id: "lv-1",
    label: "Planned Leave Batch A",
    analystsOnLeave: "1",
    startDate: "2026-11-16",
    endDate: "2026-11-17",
    daysOff: 2,
    scope: "ALL",
  },
  {
    id: "lv-2",
    label: "Training / Offsite",
    analystsOnLeave: "1",
    startDate: "2026-11-18",
    endDate: "2026-11-18",
    daysOff: 1,
    scope: "q-2",
  },
];

function toNum(val: string, fallback = 0): number {
  if (val === "" || val === undefined || val === null) return fallback;
  const parsed = Number(val);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function computeInclusiveDays(startDate: string, endDate: string, fallback: number): number {
  if (!startDate || !endDate) return Math.max(1, fallback || 1);
  const s = new Date(startDate + "T00:00:00");
  const e = new Date(endDate + "T00:00:00");
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) {
    return Math.max(1, fallback || 1);
  }
  const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
}

function formatDateOffset(baseIso: string, offsetDays: number): string {
  const base = new Date(baseIso + "T00:00:00");
  if (Number.isNaN(base.getTime())) return `Day +${offsetDays}`;
  base.setDate(base.getDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}

export default function SlaMonitorPage() {
  const [queues, setQueues] = useState<QueueInput[]>(INITIAL_QUEUES);
  const [leaves, setLeaves] = useState<LeaveEntry[]>(INITIAL_LEAVES);

  const [planStartDate, setPlanStartDate] = useState<string>("2026-11-16");
  const [queueCountInput, setQueueCountInput] = useState<string>("3");
  const [totalAnalystsPool, setTotalAnalystsPool] = useState<string>("8");
  const [shiftHoursPerDay, setShiftHoursPerDay] = useState<string>("8");
  const [productivityFactor, setProductivityFactor] = useState<string>("0.85");

  const [dayLeaveOverrides, setDayLeaveOverrides] = useState<Record<number, string>>({});
  const [dayRemainingOverrides, setDayRemainingOverrides] = useState<Record<number, string>>({});

  const [useCollectiveCases, setUseCollectiveCases] = useState<boolean>(false);
  const [collectiveCasesOverride, setCollectiveCasesOverride] = useState<string>("520");
  const [useCollectiveSla, setUseCollectiveSla] = useState<boolean>(false);
  const [collectiveSlaHours, setCollectiveSlaHours] = useState<string>("16");

  const [copyStatus, setCopyStatus] = useState<string>("");

  function handleQueueCountChange(raw: string) {
    setQueueCountInput(raw);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    const safeCount = Math.max(1, Math.min(20, Math.floor(parsed)));
    setQueues((prev) => {
      if (prev.length === safeCount) return prev;
      if (prev.length < safeCount) {
        const next = [...prev];
        for (let i = prev.length; i < safeCount; i++) {
          next.push({
            id: `q-${i + 1}`,
            name: `Queue ${i + 1}`,
            totalCases: "100",
            completedCases: "0",
            slaHours: "24",
            assignedAnalysts: "1",
            avgMinutesPerCase: "25",
          });
        }
        return next;
      }
      return prev.slice(0, safeCount);
    });
  }

  function updateQueue(id: string, field: keyof QueueInput, rawValue: string) {
    setQueues((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: rawValue } : q))
    );
  }

  function addLeave() {
    setLeaves((prev) => [
      ...prev,
      {
        id: `lv-${prev.length + 1}`,
        label: `Leave Window ${prev.length + 1}`,
        analystsOnLeave: "1",
        startDate: planStartDate,
        endDate: planStartDate,
        daysOff: 1,
        scope: "ALL",
      },
    ]);
  }

  function updateLeave(id: string, field: keyof LeaveEntry, rawValue: string) {
    setLeaves((prev) =>
      prev.map((lv) => {
        if (lv.id !== id) return lv;
        if (field === "label" || field === "scope" || field === "analystsOnLeave") {
          return { ...lv, [field]: rawValue };
        }
        if (field === "startDate") {
          const nextDays = computeInclusiveDays(rawValue, lv.endDate, lv.daysOff);
          return { ...lv, startDate: rawValue, daysOff: nextDays };
        }
        if (field === "endDate") {
          const nextDays = computeInclusiveDays(lv.startDate, rawValue, lv.daysOff);
          return { ...lv, endDate: rawValue, daysOff: nextDays };
        }
        return lv;
      })
    );
  }

  function removeLeave(id: string) {
    setLeaves((prev) => prev.filter((lv) => lv.id !== id));
  }

  function resetCalendarOverrides() {
    setDayLeaveOverrides({});
    setDayRemainingOverrides({});
  }

  const plan = useMemo(() => {
    const poolCount = toNum(totalAnalystsPool, 0);
    const shiftHours = Math.max(1, toNum(shiftHoursPerDay, 8));
    const efficiency = Math.min(1, Math.max(0.1, toNum(productivityFactor, 0.85)));
    const collCases = toNum(collectiveCasesOverride, 0);
    const collSla = Math.max(1, toNum(collectiveSlaHours, 16));

    const queueSumCases = queues.reduce((s, q) => s + toNum(q.totalCases, 0), 0);
    const effectiveTotalCases = useCollectiveCases ? collCases : queueSumCases;

    const totalLeaveAnalystDays = leaves.reduce(
      (s, lv) => s + toNum(lv.analystsOnLeave, 0) * lv.daysOff,
      0
    );
    const globalLeaveHeadcount = leaves
      .filter((lv) => lv.scope === "ALL")
      .reduce((s, lv) => s + toNum(lv.analystsOnLeave, 0), 0);

    const netAvailableAnalysts = Math.max(0, poolCount - globalLeaveHeadcount);

    const baseResults: QueuePlanResult[] = queues.map((q) => {
      const qRawTotal = toNum(q.totalCases, 0);
      const shareRatio = useCollectiveCases && queueSumCases > 0 ? qRawTotal / queueSumCases : 1;
      const qTotalCases = useCollectiveCases
        ? Math.round(effectiveTotalCases * shareRatio)
        : qRawTotal;
      const qCompleted = Math.min(qTotalCases, toNum(q.completedCases, 0));
      const remainingCases = Math.max(0, qTotalCases - qCompleted);

      const effectiveSla = useCollectiveSla
        ? collSla
        : Math.max(1, toNum(q.slaHours, 24));
      const queueLeaveHeadcount = leaves
        .filter((lv) => lv.scope === q.id)
        .reduce((s, lv) => s + toNum(lv.analystsOnLeave, 0), 0);

      const qAssigned = toNum(q.assignedAnalysts, 0);
      const qAvgMin = Math.max(5, toNum(q.avgMinutesPerCase, 25));
      const effectiveAnalysts = Math.max(0, qAssigned - queueLeaveHeadcount);

      const hoursPerAnalystInSla = Math.max(
        1,
        (effectiveSla / 8) * shiftHours * efficiency
      );

      const projectedHoursNeeded = (remainingCases * qAvgMin) / 60;
      const projectedHoursAvailable = effectiveAnalysts * hoursPerAnalystInSla;
      const requiredAnalysts =
        remainingCases === 0 ? 0 : Math.ceil(projectedHoursNeeded / hoursPerAnalystInSla);
      const analystGap = requiredAnalysts - effectiveAnalysts;

      return {
        ...q,
        totalCases: qTotalCases,
        completedCases: qCompleted,
        slaHours: effectiveSla,
        assignedAnalysts: qAssigned,
        avgMinutesPerCase: qAvgMin,
        remainingCases,
        effectiveAnalysts,
        requiredAnalysts,
        analystGap,
        projectedHoursNeeded,
        projectedHoursAvailable,
        recommendedAllocation: 0,
        status: "On Track",
      };
    });

    const sortedIndices = baseResults
      .map((_, idx) => idx)
      .sort((a, b) => {
        if (baseResults[a].slaHours !== baseResults[b].slaHours) {
          return baseResults[a].slaHours - baseResults[b].slaHours;
        }
        return baseResults[b].remainingCases - baseResults[a].remainingCases;
      });

    let remainingPool = netAvailableAnalysts;
    for (const idx of sortedIndices) {
      const item = baseResults[idx];
      if (item.remainingCases === 0) {
        item.recommendedAllocation = 0;
        continue;
      }
      const alloc = Math.min(remainingPool, Math.max(1, item.requiredAnalysts));
      item.recommendedAllocation = alloc;
      remainingPool = Math.max(0, remainingPool - alloc);
    }

    let ptr = 0;
    while (remainingPool > 0 && sortedIndices.length > 0) {
      const idx = sortedIndices[ptr % sortedIndices.length];
      if (baseResults[idx].remainingCases > 0) {
        baseResults[idx].recommendedAllocation += 1;
        remainingPool -= 1;
      }
      ptr += 1;
      if (ptr > sortedIndices.length * 4) break;
    }

    const queueResults: QueuePlanResult[] = baseResults.map((item) => {
      let status: "On Track" | "Tight" | "At Risk" = "On Track";
      if (item.recommendedAllocation < item.requiredAnalysts) {
        status = item.requiredAnalysts - item.recommendedAllocation >= 2 ? "At Risk" : "Tight";
      }
      return { ...item, status };
    });

    const totalRemaining = queueResults.reduce((s, q) => s + q.remainingCases, 0);
    const totalRequiredAnalysts = queueResults.reduce((s, q) => s + q.requiredAnalysts, 0);
    const overallGap = totalRequiredAnalysts - netAvailableAnalysts;

    const avgMinutesAcrossQueues =
      queueResults.length > 0
        ? queueResults.reduce((s, q) => s + q.avgMinutesPerCase, 0) / queueResults.length
        : 25;
    const casesPerAnalystPerDay = Math.max(
      1,
      Math.round((shiftHours * 60 * efficiency) / avgMinutesAcrossQueues)
    );

    let runningRemaining = totalRemaining;
    const burnDown: DailyBurnDownPoint[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = formatDateOffset(planStartDate, d);
      const computedLeaves = leaves
        .filter((lv) => {
          if (!lv.startDate || !lv.endDate) return d < lv.daysOff;
          return dateStr >= lv.startDate && dateStr <= lv.endDate;
        })
        .reduce((s, lv) => s + toNum(lv.analystsOnLeave, 0), 0);

      const hasLeaveOverride = dayLeaveOverrides[d] !== undefined;
      const activeLeavesStr = hasLeaveOverride ? dayLeaveOverrides[d] : String(computedLeaves);
      const dayLeaves = toNum(activeLeavesStr, computedLeaves);

      const dayNetAnalysts = Math.max(0, poolCount - dayLeaves);
      const dailyCapacityCases = dayNetAnalysts * casesPerAnalystPerDay;
      const autoRemaining = Math.max(0, runningRemaining - dailyCapacityCases);
      const isRemainingOverridden = dayRemainingOverrides[d] !== undefined;
      const projectedRemainingStr = isRemainingOverridden
        ? dayRemainingOverrides[d]
        : String(autoRemaining);
      const projectedRemainingCases = toNum(projectedRemainingStr, autoRemaining);

      runningRemaining = projectedRemainingCases;

      burnDown.push({
        dayIndex: d,
        dayLabel: `Day ${d + 1}`,
        dateStr,
        activeLeavesStr,
        activeLeaves: dayLeaves,
        netAnalysts: dayNetAnalysts,
        dailyCapacityCases,
        projectedRemainingStr,
        projectedRemainingCases,
        isRemainingOverridden,
      });
    }

    const aiSummary =
      overallGap <= 0
        ? `Capacity covered: ${netAvailableAnalysts} net analysts available after leaves vs. ${totalRequiredAnalysts} required. Follow the AI queue plan below to hold SLA.`
        : `Shortfall of ${overallGap} analyst(s) after leaves: ${totalRequiredAnalysts} required across ${queueResults.length} queues, but only ${netAvailableAnalysts} net analysts available. Prioritize tightest-SLA queues first.`;

    return {
      queueResults,
      burnDown,
      effectiveTotalCases,
      totalRemaining,
      totalLeaveAnalystDays,
      globalLeaveHeadcount,
      netAvailableAnalysts,
      totalRequiredAnalysts,
      overallGap,
      aiSummary,
    };
  }, [
    queues,
    leaves,
    planStartDate,
    totalAnalystsPool,
    shiftHoursPerDay,
    productivityFactor,
    dayLeaveOverrides,
    dayRemainingOverrides,
    useCollectiveCases,
    collectiveCasesOverride,
    useCollectiveSla,
    collectiveSlaHours,
  ]);

  function exportCsv() {
    const headers = [
      "Queue",
      "Total Cases",
      "Completed",
      "Remaining",
      "SLA (hrs)",
      "Min/Case",
      "Assigned",
      "Effective Analysts",
      "Required Analysts",
      "AI Recommended Allocation",
      "Status",
    ];
    const rows = plan.queueResults.map((q) => [
      `"${q.name.replace(/"/g, '""')}"`,
      q.totalCases,
      q.completedCases,
      q.remainingCases,
      q.slaHours,
      q.avgMinutesPerCase,
      q.assignedAnalysts,
      q.effectiveAnalysts,
      q.requiredAnalysts,
      q.recommendedAllocation,
      q.status,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sla-monitor-plan-${planStartDate || "export"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function copySummary() {
    const lines = [
      `CorporateBuddy SLA Monitor Plan (Start: ${planStartDate})`,
      plan.aiSummary,
      `Totals: ${plan.effectiveTotalCases} total | ${plan.totalRemaining} remaining | ${plan.netAvailableAnalysts} net analysts | ${plan.totalRequiredAnalysts} required`,
      "",
      ...plan.queueResults.map(
        (q) =>
          `- ${q.name}: ${q.remainingCases} remaining | SLA ${q.slaHours}h | Req ${q.requiredAnalysts} -> AI Plan ${q.recommendedAllocation} analysts (${q.status})`
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyStatus("Copied summary!");
      setTimeout(() => setCopyStatus(""), 2500);
    } catch {
      setCopyStatus("Clipboard unavailable");
      setTimeout(() => setCopyStatus(""), 2500);
    }
  }

  const hasCalendarOverrides =
    Object.keys(dayLeaveOverrides).length > 0 || Object.keys(dayRemainingOverrides).length > 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0f294a]">
              CorporateBuddy · AI Capacity & Queue Planner
            </p>
            <h1 className="text-xl font-bold text-[#0b192c]">SLA Monitor</h1>
            <p className="mt-0.5 text-xs text-slate-600">{plan.aiSummary}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Queues:</label>
            <input
              type="text"
              inputMode="numeric"
              value={queueCountInput}
              onChange={(e) => handleQueueCountChange(e.target.value)}
              className="w-20 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold"
            />
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={copySummary}
              className="rounded-xl bg-[#0f294a] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#163863] cursor-pointer"
            >
              {copyStatus || "Copy Summary"}
            </button>
          </div>
        </div>

        {/* Minimal Global Inputs */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Quick Inputs (Collective & Team Capacity)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
            <div className="rounded-xl border border-slate-200 p-3 space-y-1.5">
              <label className="block font-semibold text-slate-700">Plan Start Date</label>
              <input
                type="date"
                value={planStartDate}
                onChange={(e) => setPlanStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono"
              />
              <p className="text-[11px] text-slate-500">7-day leave & burn-down anchor</p>
            </div>

            <div className="rounded-xl border border-slate-200 p-3 space-y-1.5">
              <label className="flex items-center justify-between font-semibold text-slate-700">
                <span>Collective Cases</span>
                <input
                  type="checkbox"
                  checked={useCollectiveCases}
                  onChange={(e) => setUseCollectiveCases(e.target.checked)}
                />
              </label>
              <input
                type="text"
                inputMode="numeric"
                disabled={!useCollectiveCases}
                value={useCollectiveCases ? collectiveCasesOverride : String(plan.effectiveTotalCases)}
                onChange={(e) => setCollectiveCasesOverride(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono disabled:bg-slate-100"
              />
              <p className="text-[11px] text-slate-500">
                {useCollectiveCases ? "Collective override" : "Sum of queue cases"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-3 space-y-1.5">
              <label className="flex items-center justify-between font-semibold text-slate-700">
                <span>Collective SLA (hrs)</span>
                <input
                  type="checkbox"
                  checked={useCollectiveSla}
                  onChange={(e) => setUseCollectiveSla(e.target.checked)}
                />
              </label>
              <input
                type="text"
                inputMode="numeric"
                disabled={!useCollectiveSla}
                value={collectiveSlaHours}
                onChange={(e) => setCollectiveSlaHours(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono disabled:bg-slate-100"
              />
              <p className="text-[11px] text-slate-500">
                {useCollectiveSla ? "All queues" : "Per-queue SLA"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-3 space-y-1.5">
              <label className="block font-semibold text-slate-700">Total Analysts Pool</label>
              <input
                type="text"
                inputMode="numeric"
                value={totalAnalystsPool}
                onChange={(e) => setTotalAnalystsPool(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono"
              />
              <p className="text-[11px] text-slate-500">
                Net: <strong>{plan.netAvailableAnalysts}</strong>
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-3 space-y-1.5">
              <label className="block font-semibold text-slate-700">Shift Hrs / Day</label>
              <input
                type="text"
                inputMode="numeric"
                value={shiftHoursPerDay}
                onChange={(e) => setShiftHoursPerDay(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono"
              />
              <p className="text-[11px] text-slate-500">Daily shift hours</p>
            </div>

            <div className="rounded-xl border border-slate-200 p-3 space-y-1.5">
              <label className="block font-semibold text-slate-700">Net Efficiency</label>
              <input
                type="text"
                inputMode="decimal"
                value={productivityFactor}
                onChange={(e) => setProductivityFactor(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono"
              />
              <p className="text-[11px] text-slate-500">0.10 to 1.00</p>
            </div>
          </div>
        </section>

        {/* Auto-Calculated KPI Summary */}
        <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Total Cases</p>
            <p className="mt-1 text-lg font-bold text-[#0b192c]">{plan.effectiveTotalCases}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Remaining Cases</p>
            <p className="mt-1 text-lg font-bold text-amber-700">{plan.totalRemaining}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Net Analysts (Post-Leave)</p>
            <p className="mt-1 text-lg font-bold text-[#0f294a]">{plan.netAvailableAnalysts}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Required Analysts</p>
            <p className="mt-1 text-lg font-bold text-indigo-800">{plan.totalRequiredAnalysts}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Analyst Gap</p>
            <p
              className={`mt-1 text-lg font-bold ${
                plan.overallGap > 0 ? "text-rose-700" : "text-emerald-700"
              }`}
            >
              {plan.overallGap > 0 ? `+${plan.overallGap} Needed` : `${plan.overallGap} Buffer`}
            </p>
          </div>
        </section>

        {/* Queue-Wise Editable Table + AI Allocation */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Queue-Wise Cases, SLA & AI Analyst Allocation
            </h2>
            <span className="text-xs text-slate-500">
              Clear and type freely in any box — AI allocation updates automatically
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2.5">Queue</th>
                  <th className="px-3 py-2.5">Total Cases</th>
                  <th className="px-3 py-2.5">Completed</th>
                  <th className="px-3 py-2.5">Remaining</th>
                  <th className="px-3 py-2.5">SLA (hrs)</th>
                  <th className="px-3 py-2.5">Min/Case</th>
                  <th className="px-3 py-2.5">Assigned</th>
                  <th className="px-3 py-2.5">Required</th>
                  <th className="px-3 py-2.5">AI Queue Plan</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queues.map((rawQ, idx) => {
                  const q = plan.queueResults[idx];
                  if (!q) return null;
                  return (
                    <tr key={rawQ.id}>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={rawQ.name}
                          onChange={(e) => updateQueue(rawQ.id, "name", e.target.value)}
                          className="w-36 rounded-lg border border-slate-200 px-2 py-1 font-medium"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          disabled={useCollectiveCases}
                          value={useCollectiveCases ? String(q.totalCases) : rawQ.totalCases}
                          onChange={(e) => updateQueue(rawQ.id, "totalCases", e.target.value)}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1 font-mono disabled:bg-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={rawQ.completedCases}
                          onChange={(e) => updateQueue(rawQ.id, "completedCases", e.target.value)}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1 font-mono"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold">{q.remainingCases}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          disabled={useCollectiveSla}
                          value={useCollectiveSla ? String(q.slaHours) : rawQ.slaHours}
                          onChange={(e) => updateQueue(rawQ.id, "slaHours", e.target.value)}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1 font-mono disabled:bg-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={rawQ.avgMinutesPerCase}
                          onChange={(e) => updateQueue(rawQ.id, "avgMinutesPerCase", e.target.value)}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1 font-mono"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={rawQ.assignedAnalysts}
                          onChange={(e) => updateQueue(rawQ.id, "assignedAnalysts", e.target.value)}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1 font-mono"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono font-bold text-indigo-800">
                        {q.requiredAnalysts}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold text-[#0f294a]">
                        {q.recommendedAllocation} analysts
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            q.status === "On Track"
                              ? "bg-emerald-100 text-emerald-800"
                              : q.status === "Tight"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {q.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Editable 7-Day Leave Calendar & Daily Case Burn-Down */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                7-Day Leave Calendar & Daily Case Burn-Down (Editable)
              </h2>
              <p className="text-xs text-slate-500">
                Clear and type freely in any day box · Total leave impact: {plan.totalLeaveAnalystDays} analyst-days ({plan.globalLeaveHeadcount} global headcount deducted)
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasCalendarOverrides && (
                <button
                  type="button"
                  onClick={resetCalendarOverrides}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Reset Day Edits
                </button>
              )}
              <button
                type="button"
                onClick={addLeave}
                className="rounded-xl bg-[#0f294a] px-3.5 py-1.5 text-xs font-semibold text-white cursor-pointer"
              >
                + Add Leave Entry
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5 text-xs">
            {plan.burnDown.map((pt) => {
              const pctLeft =
                plan.totalRemaining > 0
                  ? Math.min(100, Math.round((pt.projectedRemainingCases / plan.totalRemaining) * 100))
                  : 0;
              return (
                <div
                  key={pt.dateStr}
                  className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0b192c]">{pt.dayLabel}</span>
                    <span className="font-mono text-[11px] text-slate-500">{pt.dateStr}</span>
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[11px] text-slate-600">
                    <span>On Leave:</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={pt.activeLeavesStr}
                      onChange={(e) =>
                        setDayLeaveOverrides((prev) => ({
                          ...prev,
                          [pt.dayIndex]: e.target.value,
                        }))
                      }
                      className="w-14 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-right font-mono font-semibold text-[#0b192c]"
                    />
                  </div>

                  <p className="text-[11px] text-slate-600">
                    Net Analysts: <strong>{pt.netAnalysts}</strong>
                  </p>
                  <p className="text-[11px] text-emerald-700">
                    Clears: <strong>{pt.dailyCapacityCases}</strong> cases
                  </p>

                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-[#0f294a]"
                      style={{ width: `${Math.max(4, 100 - pctLeft)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="font-semibold text-slate-700">
                      Rem{pt.isRemainingOverridden ? "*" : ""}:
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={pt.projectedRemainingStr}
                      onChange={(e) =>
                        setDayRemainingOverrides((prev) => ({
                          ...prev,
                          [pt.dayIndex]: e.target.value,
                        }))
                      }
                      className="w-20 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-right font-mono font-semibold text-[#0b192c]"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            {leaves.map((lv) => (
              <div
                key={lv.id}
                className="grid grid-cols-1 sm:grid-cols-6 gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs items-center"
              >
                <input
                  type="text"
                  value={lv.label}
                  onChange={(e) => updateLeave(lv.id, "label", e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                />
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">Count:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={lv.analystsOnLeave}
                    onChange={(e) => updateLeave(lv.id, "analystsOnLeave", e.target.value)}
                    className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono"
                  />
                </div>
                <input
                  type="date"
                  value={lv.startDate}
                  onChange={(e) => updateLeave(lv.id, "startDate", e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono"
                />
                <input
                  type="date"
                  value={lv.endDate}
                  onChange={(e) => updateLeave(lv.id, "endDate", e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono"
                />
                <select
                  value={lv.scope}
                  onChange={(e) => updateLeave(lv.id, "scope", e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                >
                  <option value="ALL">All Queues (Pool)</option>
                  {queues.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeLeave(lv.id)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Remove ({lv.daysOff}d)
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
