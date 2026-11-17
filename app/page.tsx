"use client";
import SiteFooter from "@/components/SiteFooter";
import ChangeOsWorkspace from "@/components/ChangeOsWorkspace";
import GrowthOsWorkspace from "@/components/GrowthOsWorkspace";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateHikePercentage,
  calculateSalary,
  INDIAN_STATES_AND_UTS,
  TaxRegime,
} from "@/lib/salaryEngine";
import { planStateLeaves, WorkweekPattern } from "@/lib/leavePlannerEngine";
import { buildSmartEmailBrief, EmailTone } from "@/lib/emailAssistantEngine";
import { buildMomBrief, MOM_AUDIENCES, MOM_TEMPLATES, MomActionItem, MomAudienceMode, MomSeriesSnapshot, MomTemplate } from "@/lib/momGeneratorEngine";
import {
  buildStickyBrief,
  extractTasksFromNote,
  StickyColor,
  StickyNoteItem,
} from "@/lib/stickyNotesEngine";
import { buildDocumentBrief } from "@/lib/documentSummarizerEngine";
import { buildTaxCalendarBrief } from "@/lib/taxCalendarEngine";
import { analyzeDelimitedText, analyzeWorkbookBuffer } from "@/lib/presentosExcelIntelligence";
import { downloadPresentOSPptx, validatePresentOSSpec } from "@/lib/presentosPptxBuilder";
import { addOutlineSlide, applyNaturalLanguageEdit, auditPresentOSSpec, createHistoryStack, pushHistory, redoHistory, removeOutlineSlide, undoHistory, type PresentOSAuditReport, type PresentOSHistoryStack } from "@/lib/presentosEditorAndAudit";
import { PRESENTOS_TEMPLATES, applyWorkbookIntelligenceToSpec, generateFromSinglePrompt, refineSpecWithGemini, type PresentOSSpec, type PresentOSTemplateId } from "@/lib/presentosEngine";

interface ModuleItem {
  id: string;
  number: string;
  title: string;
  tag: string;
  minimalInput: string;
  briefOutput: string;
  accent: string;
}

const MODULES: ModuleItem[] = [
  {
    id: "salary-calculator",
    number: "01",
    title: "Salary & CTC Calculator",
    tag: "All Indian States & UTs",
    minimalInput: "Annual CTC + State",
    briefOutput:
      "Monthly in-hand, PF, state Professional Tax, ESI check, and New vs. Old tax regime comparison.",
    accent: "bg-blue-50 text-blue-800 border-blue-200/80",
  },
  {
    id: "holiday-planner",
    number: "02",
    title: "Holiday Calendar & Leave Planner",
    tag: "Month-by-Month Hacks",
    minimalInput: "State + Leave Balance",
    briefOutput:
      "Official state holidays plus weekend-bridge combinations showing how 1 leave day unlocks 4 consecutive days off.",
    accent: "bg-teal-50 text-teal-800 border-teal-200/80",
  },
  {
    id: "email-assistant",
    number: "03",
    title: "Smart Email Assistant",
    tag: "Minimal Prompt",
    minimalInput: "1 rough line or pasted thread",
    briefOutput:
      "Send-ready subject, greeting, structured body, clear ask, and sign-off—plus shorter, firmer, or Teams variants.",
    accent: "bg-indigo-50 text-indigo-800 border-indigo-200/80",
  },
  {
    id: "meeting-minutes",
    number: "04",
    title: "Meeting Minutes (MOM) Generator",
    tag: "10 Office Templates",
    minimalInput: "Rough live meeting bullets",
    briefOutput:
      "Structured MOM with summary, decisions, owners, deadlines, and blockers—ready to share across templates.",
    accent: "bg-sky-50 text-sky-800 border-sky-200/80",
  },
  {
    id: "sticky-notes",
    number: "05",
    title: "Advanced Sticky Notes",
    tag: "Action & Reminder Ready",
    minimalInput: "Quick note or due phrase",
    briefOutput:
      "Color-coded pinned workspace notes that extract action items, dates, and clean follow-up messages.",
    accent: "bg-amber-50 text-amber-800 border-amber-200/80",
  },
  {
    id: "document-summarizer",
    number: "06",
    title: "Offer Letter & Doc Summarizer",
    tag: "PDF, DOCX, Images & OCR",
    minimalInput: "Upload offer, policy, or letter",
    briefOutput:
      "Plain-English brief covering pay split, notice/probation, bond or recovery clauses, and HR questions.",
    accent: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
  },
  {
    id: "tax-calendar",
    number: "07",
    title: "Indian Tax Calendar & Filing Guide",
    tag: "FY 2026-27 Reference",
    minimalInput: "Select year or ask a filing Q",
    briefOutput:
      "Key CBDT deadlines, step-by-step salaried ITR walkthrough, and clear Form 16 / AIS / 26AS explanations.",
    accent: "bg-slate-100 text-slate-800 border-slate-200",
  },
  { id: "shift-attendance", number: "08", title: "Shift & Attendance Tracker", tag: "Shifts · Breaks · Payable Days", minimalInput: "Shift Timing + Breaks + Logs", briefOutput: "Actual hours, overtime, night-shift allowance, late/early punches, payable days, and estimated LOP.", accent: "bg-indigo-50 text-indigo-800 border-indigo-200/80" },
  { id: "presentos", number: "09", title: "PresentOS", tag: "AI Presentation Studio", minimalInput: "Prompt, notes, Excel or report", briefOutput: "Storyline planning, editable slide outline preview, source-grounded structure, and executive presentation workflow.", accent: "bg-violet-50 text-violet-800 border-violet-200/80" },
  { id: "appraisal-promotion", number: "10", title: "Appraisal & Promotion Assistant", tag: "Evidence-Grounded Review Drafts", minimalInput: "Review questions + work wins", briefOutput: "Structured self-appraisal answers, promotion impact framing, and missing-evidence notes without invented metrics.", accent: "bg-blue-50 text-blue-800 border-blue-200/80" },
  { id: "document-comparison", number: "11", title: "Document Comparison & Process Change Intelligence", tag: "Section Diff + Source Citations", minimalInput: "Previous & updated doc versions", briefOutput: "Section-by-section change register, exact before/after diffs, source page/section references, and CSV export.", accent: "bg-teal-50 text-teal-800 border-teal-200/80" },
];

const STICKY_COLOR_STYLES: Record<StickyColor, string> = {
  amber: "bg-amber-50/90 border-amber-200",
  blue: "bg-blue-50/90 border-blue-200",
  teal: "bg-teal-50/90 border-teal-200",
  slate: "bg-slate-50 border-slate-200",
};

function formatINR(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function computeTaxRegimeBreakdown(ctc: number, oldDeductions: number) {
  const safeCtc = Math.max(0, Number(ctc) || 0);
  const pf = Math.min(21600, Math.round(safeCtc * 0.12));

  // New Regime (Sec 115BAC): Rs 75,000 standard deduction + rebate u/s 87A up to Rs 12,00,000 taxable income
  const newStd = safeCtc > 0 ? 75000 : 0;
  const newTaxable = Math.max(0, safeCtc - pf - newStd);
  let newBase = 0;
  if (newTaxable > 1200000) {
    if (newTaxable > 400000) newBase += Math.min(newTaxable - 400000, 400000) * 0.05;
    if (newTaxable > 800000) newBase += Math.min(newTaxable - 800000, 400000) * 0.10;
    if (newTaxable > 1200000) newBase += Math.min(newTaxable - 1200000, 400000) * 0.15;
    if (newTaxable > 1600000) newBase += Math.min(newTaxable - 1600000, 400000) * 0.20;
    if (newTaxable > 2000000) newBase += Math.min(newTaxable - 2000000, 400000) * 0.25;
    if (newTaxable > 2400000) newBase += (newTaxable - 2400000) * 0.30;
  }
  newBase = Math.round(newBase);
  const newCess = Math.round(newBase * 0.04);
  const newTotal = newBase + newCess;

  // Old Regime: Rs 50,000 standard deduction + Chapter VI-A/other deductions + rebate u/s 87A up to Rs 5,00,000
  const oldStd = safeCtc > 0 ? 50000 : 0;
  const safeOldDed = Math.max(0, Number(oldDeductions) || 0);
  const oldTaxable = Math.max(0, safeCtc - pf - oldStd - safeOldDed);
  let oldBase = 0;
  if (oldTaxable > 500000) {
    if (oldTaxable > 250000) oldBase += Math.min(oldTaxable - 250000, 250000) * 0.05;
    if (oldTaxable > 500000) oldBase += Math.min(oldTaxable - 500000, 500000) * 0.20;
    if (oldTaxable > 1000000) oldBase += (oldTaxable - 1000000) * 0.30;
  }
  oldBase = Math.round(oldBase);
  const oldCess = Math.round(oldBase * 0.04);
  const oldTotal = oldBase + oldCess;

  return {
    safeCtc,
    pf,
    newTaxable,
    newTotal,
    newMonthly: Math.round(newTotal / 12),
    oldTaxable,
    oldTotal,
    oldMonthly: Math.round(oldTotal / 12),
    recommended: newTotal <= oldTotal ? "New Regime" : "Old Regime",
    annualSavings: Math.abs(newTotal - oldTotal),
  };
}

function buildItrHorizonRows(annualBaseAmount: number, annualReturnPct: number) {
  const horizons = [
    { label: "6 Months", years: 0.5 },
    { label: "1 Year", years: 1 },
    { label: "2 Years", years: 2 },
    { label: "3 Years", years: 3 },
    { label: "4 Years", years: 4 },
    { label: "5 Years", years: 5 },
  ];
  const r = Math.max(0, Number(annualReturnPct) || 0) / 100;
  const base = Math.max(0, Math.round(annualBaseAmount));
  return horizons.map((h) => {
    const principal = Math.round(base * h.years);
    const total = r === 0 ? principal : Math.round(base * ((Math.pow(1 + r, h.years) - 1) / r));
    const gain = Math.max(0, total - principal);
    return { label: h.label, principal, gain, total };
  });
}

export default function HomePage() {
  const [activeView, setActiveView] = useState<
    "home" | "salary" | "holidays" | "email" | "mom" | "notes" | "docs" | "tax" | "shift" | "presentos" | "growthos" | "changeos"
   | "highway">("home");
  const [moduleCategoryFilter, setModuleCategoryFilter] = useState<"all" | "pay" | "docs" | "ops">("all");
  const [quickPrompt, setQuickPrompt] = useState("");
  const openExcelOS = () => {
    if (typeof window !== "undefined") {
      window.open("/excel-os", "_blank", "noopener,noreferrer,width=1380,height=880");
    }
  };
  const openAttendanceTracker = () => {
    if (typeof window !== "undefined") {
      window.open("/attendance-tracker", "_blank", "noopener,noreferrer,width=1360,height=860");
    }
  };
  const openSlaMonitor = () => {
    if (typeof window !== "undefined") {
      window.open("/sla-monitor", "_blank", "noopener,noreferrer,width=1360,height=860");
    }
  };
  const [momResolvedMap, setMomResolvedMap] = useState<Record<string, boolean>>({});
  const [resolvedActionMap, setResolvedActionMap] = useState<Record<string, boolean>>({});
  const [selectedState, setSelectedState] = useState("Karnataka");

  // Module 1 Salary Calculator state
  const [annualCtc, setAnnualCtc] = useState<number>(1400000);
  const [annualCtcText, setAnnualCtcText] = useState<string>("1400000");
  const [salaryState, setSalaryState] = useState<string>("Karnataka");
  const [taxRegime, setTaxRegime] = useState<TaxRegime>("new");
  const [financialYear, setFinancialYear] = useState<"2026-27" | "2025-26">("2026-27");
  const [mode, setMode] = useState<"quick" | "advanced">("quick");
  const [basicPercent, setBasicPercent] = useState<number>(40);
  const [hraPercentOfBasic, setHraPercentOfBasic] = useState<number>(50);
  const [pfMode, setPfMode] = useState<"capped_1800" | "percent_of_basic" | "none">("capped_1800");
  const [includeGratuity, setIncludeGratuity] = useState<boolean>(true);
  const [variablePay, setVariablePay] = useState<number>(0);
  const [bonus, setBonus] = useState<number>(0);
  const [otherDeductionsMonthly, setOtherDeductionsMonthly] = useState<number>(0);
  const [oldRegimeDeductionsAnnual, setOldRegimeDeductionsAnnual] = useState<number>(150000);
  const [showFullBreakup, setShowFullBreakup] = useState<boolean>(true);
  const [compareCtc, setCompareCtc] = useState<number>(1800000);
  const [copied, setCopied] = useState<boolean>(false);

  // Module 2 Holiday & Leave Planner state
  const [leaveYear, setLeaveYear] = useState<number>(2026);
  const [workweek, setWorkweek] = useState<WorkweekPattern>("mon_fri_5day");
  const [leaveBalance, setLeaveBalance] = useState<number>(12);
  const [selectedBridgeMonth, setSelectedBridgeMonth] = useState<number>(0);
  const [calendarMonth, setCalendarMonth] = useState<number>(1); // 1..12 for calendar grid

  // Module 3 Smart Email Assistant state
  const [emailPrompt, setEmailPrompt] = useState<string>("2 days leave request");
  const [emailThread, setEmailThread] = useState<string>("");
  const [emailTone, setEmailTone] = useState<EmailTone>("standard");
  const [emailCopied, setEmailCopied] = useState<boolean>(false);
  const [emailVariant, setEmailVariant] = useState<number>(0);
  const [manualSubject, setManualSubject] = useState<string | null>(null);
  const [manualBody, setManualBody] = useState<string | null>(null);

  const emailBrief = useMemo(
    () => buildSmartEmailBrief(emailPrompt, emailTone, emailThread, emailVariant),
    [emailPrompt, emailTone, emailThread, emailVariant]
  );

  const activeSubject = manualSubject ?? emailBrief.subject;
  const activeBody = manualBody ?? emailBrief.body;

  function syncEmailDraft(
    nextPrompt: string,
    nextTone: EmailTone,
    nextThread: string,
    nextVariant: number = emailVariant
  ) {
    setEmailPrompt(nextPrompt);
    setEmailTone(nextTone);
    setEmailThread(nextThread);
    setEmailVariant(nextVariant);
    setManualSubject(null);
    setManualBody(null);
  }

  function handleRegenerateEmail() {
    setManualSubject(null);
    setManualBody(null);
    setEmailVariant((prev) => prev + 1);
  }

  // Module 4 Meeting Minutes (MOM) Generator state
  const [momNotes, setMomNotes] = useState<string>(
    "Backlog 500 cases due Friday. Rahul quality review. Client feedback pending. Next sync Monday."
  );
  const [momTemplate, setMomTemplate] = useState<MomTemplate>(MOM_TEMPLATES[0]);
  const [momTitle, setMomTitle] = useState<string>("");
  const [momDate, setMomDate] = useState<string>("");
  const [momAttendees, setMomAttendees] = useState<string>("");
  const [momCopied, setMomCopied] = useState<boolean>(false);
  const [momVariant, setMomVariant] = useState<number>(0);
  const [momChannel, setMomChannel] = useState<string>("full");
  const [momActions, setMomActions] = useState<MomActionItem[]>([]);
  const [momHandoffNotice, setMomHandoffNotice] = useState<string>("");
  const [manualMomOverride, setManualMomOverride] = useState<string | null>(null);

  const momBrief = useMemo(
    () =>
      buildMomBrief(
        momNotes,
        momTemplate,
        {
          title: momTitle,
          date: momDate,
          attendees: momAttendees,
        },
        momVariant,
        momActions.length > 0 ? momActions : undefined
      ),
    [momNotes, momTemplate, momTitle, momDate, momAttendees, momVariant, momActions]
  );

  const activeMomChannelText =
    momChannel === "email"
      ? ((momBrief as unknown as { stakeholderEmailText?: string }).stakeholderEmailText ?? momBrief.briefSummary ?? "")
      : momChannel === "teams"
        ? momBrief.teamsDropText
        : momChannel === "tracker"
          ? momBrief.audienceOutput
          : momBrief.audienceOutput;

  const editableMom = manualMomOverride ?? activeMomChannelText;

  function setEditableMom(nextVal: string) {
    setManualMomOverride(nextVal);
  }

  function syncMomDraft(
    nextNotes: string,
    nextTemplate: MomTemplate,
    nextTitle: string,
    nextAttendees: string,
    nextDate: string = momDate,
    nextVariant: number = momVariant
  ) {
    setMomNotes(nextNotes);
    setMomTemplate(nextTemplate);
    setMomTitle(nextTitle);
    setMomDate(nextDate);
    setMomAttendees(nextAttendees);
    setMomVariant(nextVariant);
    setMomActions([]);
    setMomHandoffNotice("");
    setManualMomOverride(null);
  }

  function handleRegenerateMom() {
    setManualMomOverride(null);
    setMomVariant((v) => v + 1);
  }

  function handleUpdateMomAction(
    actionId: string,
    patch: Partial<Pick<MomActionItem, "task" | "owner" | "deadline" | "task">>
  ) {
    const baseList = momActions.length > 0 ? momActions : momBrief.actionItems;
    const nextList = baseList.map((item) => {
      if (item.id !== actionId) return item;
      const updated = { ...item, ...patch };
      const ownerTrim = updated.owner.trim() || "[Unassigned Owner]";
      const dueTrim = updated.deadline.trim() || "[Confirm Due Date]";
      return {
        ...updated,
        owner: ownerTrim,
        deadline: dueTrim,
        missingOwner: ownerTrim.startsWith("[") || ownerTrim.toLowerCase() === "unassigned",
        missingDeadline: dueTrim.startsWith("[") || dueTrim.toLowerCase() === "tbd",
      };
    });
    setMomActions(nextList);
    setManualMomOverride(null);
  }

  function handleSendMomActionsToStickyNotes() {
    const openItems = momBrief.actionItems.filter((a) => !Boolean(momResolvedMap[String((a as { id?: string })?.id ?? JSON.stringify(a))]));
    const itemsToSend = openItems.length > 0 ? openItems : momBrief.actionItems;
    if (itemsToSend.length === 0) return;

    const newStickyNotes: StickyNoteItem[] = itemsToSend.map((act, idx) => {
      const noteBody = `${act.task} (Owner: ${act.owner}, Due: ${act.deadline})`;
      return {
        id: `mom-sticky-${Date.now()}-${idx}`,
        title: `MOM Action: ${act.owner}`,
        content: noteBody,
        color: !String(act.owner ?? "").trim() || !String(act.deadline ?? "").trim() ? "amber" : "blue",
        category: "Meetings",
        pinned: !Boolean(resolvedActionMap[`${act.owner ?? ""}-${act.task ?? ""}-${act.deadline ?? ""}`]),
        completed: Boolean(resolvedActionMap[`${act.owner ?? ""}-${act.task ?? ""}-${act.deadline ?? ""}`]),
        archived: false,
        updatedAt: "From MOM",
        extractedTasks: extractTasksFromNote(noteBody),
      };
    });

    setNotes((prev) => [...newStickyNotes, ...prev]);
    setMomHandoffNotice(`Sent ${newStickyNotes.length} action item(s) to Sticky Notes.`);
  }

  // Module 5 Advanced Sticky Notes state
  const initialNoteContent =
    "Submit weekly report Friday 4 PM and follow up with HR Tuesday on PF passbook.";
  const [notes, setNotes] = useState<StickyNoteItem[]>([
    {
      id: "note-1",
      title: "Weekly Ops & HR Follow-up",
      content: initialNoteContent,
      color: "amber",
      category: "Work Tasks",
      pinned: true,
      completed: false,
      archived: false,
      updatedAt: "Today",
      extractedTasks: extractTasksFromNote(initialNoteContent),
    },
  ]);
  const [noteTitle, setNoteTitle] = useState<string>("");
  const [noteContent, setNoteContent] = useState<string>("");
  const [noteCategory, setNoteCategory] = useState<string>("Work Tasks");
  const [noteColor, setNoteColor] = useState<StickyColor>("blue");
  const [noteSearch, setNoteSearch] = useState<string>("");
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [noteCopied, setNoteCopied] = useState<boolean>(false);

  // Module 6 Offer Letter & Document Summarizer state
  const [docFileName, setDocFileName] = useState<string>("Offer_Letter_Draft.pdf");
  const [docRawText, setDocRawText] = useState<string>(
    "Offer Letter — Annual CTC 1650000. Probation period 6 months. Notice period 60 days."
  );
  const [docUploadError, setDocUploadError] = useState<string>("");
  const [docCopied, setDocCopied] = useState<boolean>(false);

  const docBrief = useMemo(
    () => buildDocumentBrief(docFileName, docRawText),
    [docFileName, docRawText]
  );

  // Module 7 Indian Tax Calendar & Filing Guide state
  const [taxQuestion, setTaxQuestion] = useState<string>("");
  const [shiftStart, setShiftStart] = useState("09:00");
  const [shiftEnd, setShiftEnd] = useState("18:00");
  const [breakMins, setBreakMins] = useState(60);
  const [paidBreakMins, setPaidBreakMins] = useState(0);
  const [actualIn, setActualIn] = useState("09:05");
  const [actualOut, setActualOut] = useState("18:30");
  const [graceMins, setGraceMins] = useState(15);
  const [nightStart, setNightStart] = useState("22:00");
  const [nightEnd, setNightEnd] = useState("06:00");
  const [nightRate, setNightRate] = useState(150);
  const [monthlyGross, setMonthlyGross] = useState(75000);
  const [workingDays, setWorkingDays] = useState(22);
  const taxBrief = useMemo(
    () => buildTaxCalendarBrief(financialYear, taxQuestion),
    [financialYear, taxQuestion]
  );

  function handleDocFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = /\.(pdf|docx|doc|jpg|jpeg|png|txt)$/i;
    if (!allowed.test(file.name)) {
      setDocUploadError(
        "Unsupported file format. Please upload PDF, DOCX, DOC, JPG, JPEG, PNG, or paste text."
      );
      return;
    }
    setDocUploadError("");
    setDocFileName(file.name);
    if (/\.(txt)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setDocRawText(reader.result);
        }
      };
      reader.readAsText(file);
    }
  }

  function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = noteContent.trim();
    if (!trimmed) return;
    const newItem: StickyNoteItem = {
      id: `note-${Date.now()}`,
      title: noteTitle.trim() || "Quick Office Note",
      content: trimmed,
      color: noteColor,
      category: noteCategory,
      pinned: false,
      completed: false,
      archived: false,
      updatedAt: "Just now",
      extractedTasks: extractTasksFromNote(trimmed),
    };
    setNotes((prev) => [newItem, ...prev]);
    setNoteTitle("");
    setNoteContent("");
  }

  function toggleNoteFlag(id: string, key: "pinned" | "completed" | "archived") {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, [key]: !n[key] } : n))
    );
  }

  function confirmTask(noteId: string, taskIdx: number) {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== noteId) return n;
        const updatedTasks = n.extractedTasks.map((t, i) =>
          i === taskIdx ? { ...t, confirmed: !t.confirmed } : t
        );
        return { ...n, extractedTasks: updatedTasks };
      })
    );
  }

  const visibleNotes = useMemo(() => {
    const q = noteSearch.trim().toLowerCase();
    return notes
      .filter((n) => (showArchived ? n.archived : !n.archived))
      .filter(
        (n) =>
          !q ||
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.category.toLowerCase().includes(q)
      )
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [notes, noteSearch, showArchived]);

  const salaryResult = useMemo(
    () =>
      calculateSalary({
        annualCtc,
        state: salaryState,
        taxRegime,
        financialYear,
        mode,
        basicPercent,
        hraPercentOfBasic,
        pfMode,
        includeGratuity,
        variablePay,
        bonus,
        otherDeductionsMonthly,
        oldRegimeDeductionsAnnual,
      }),
    [
      annualCtc,
      salaryState,
      taxRegime,
      financialYear,
      mode,
      basicPercent,
      hraPercentOfBasic,
      pfMode,
      includeGratuity,
      variablePay,
      bonus,
      otherDeductionsMonthly,
      oldRegimeDeductionsAnnual,
    ]
  );

  const comparedResult = useMemo(
    () =>
      calculateSalary({
        annualCtc: compareCtc,
        state: salaryState,
        taxRegime,
        financialYear,
        mode: "quick",
        basicPercent,
        hraPercentOfBasic,
        pfMode,
        includeGratuity,
        variablePay: 0,
        bonus: 0,
        otherDeductionsMonthly,
        oldRegimeDeductionsAnnual,
      }),
    [
      compareCtc,
      salaryState,
      taxRegime,
      financialYear,
      basicPercent,
      hraPercentOfBasic,
      pfMode,
      includeGratuity,
      otherDeductionsMonthly,
      oldRegimeDeductionsAnnual,
    ]
  );

  const hikePercent = useMemo(
    () => calculateHikePercentage(annualCtc, compareCtc),
    [annualCtc, compareCtc]
  );

  const leavePlan = useMemo(
    () => planStateLeaves(selectedState, leaveYear, workweek, leaveBalance),
    [selectedState, leaveYear, workweek, leaveBalance]
  );

  function handleQuickStart(e: React.FormEvent) {
    e.preventDefault();
    const q = quickPrompt.toLowerCase();
    const numericMatch = q.match(/(\d+(?:\.\d+)?)\s*lpa/);
    if (numericMatch) {
      const parsed = Math.round(parseFloat(numericMatch[1]) * 100000);
      setAnnualCtc(parsed);
      setAnnualCtcText(String(parsed));
    }
    const matchedState = INDIAN_STATES_AND_UTS.find((st) =>
      q.includes(st.toLowerCase())
    );
    if (matchedState) {
      setSalaryState(matchedState);
      setSelectedState(matchedState);
    }

    if (
      q.includes("ctc") ||
      q.includes("salary") ||
      q.includes("lpa") ||
      q.includes("in-hand") ||
      numericMatch
    ) {
      setActiveView("salary");
    } else if (q.includes("holiday") || q.includes("leave")) {
      setActiveView("holidays");
    } else if (
      q.includes("mail") ||
      q.includes("hr") ||
      q.includes("manager") ||
      q.includes("email")
    ) {
      if (quickPrompt.trim()) {
        syncEmailDraft(quickPrompt, emailTone, emailThread, 0);
      }
      setActiveView("email");
    } else if (q.includes("mom") || q.includes("meeting")) {
      if (quickPrompt.trim()) {
        setMomNotes(quickPrompt);
        syncMomDraft(quickPrompt, momTemplate, momTitle, momAttendees);
      }
      setActiveView("mom");
    } else if (q.includes("note") || q.includes("remind") || q.includes("sticky")) {
      if (quickPrompt.trim()) {
        setNoteContent(quickPrompt);
      }
      setActiveView("notes");
    } else if (q.includes("offer") || q.includes("pdf") || q.includes("doc")) {
      setActiveView("docs");
    } else if (
      q.includes("tax") ||
      q.includes("itr") ||
      q.includes("26as") ||
      q.includes("ais") ||
      q.includes("tds")
    ) {
      setTaxQuestion(quickPrompt);
      setActiveView("tax");
    } else {
      setActiveView("salary");
    }
  }

  const mainRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (activeView !== "home" && mainRef.current) {
      mainRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeView]);
  const [highwayProgress, setHighwayProgress] = useState<number>(8);
  const highwayTrackRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (activeView !== "highway") return;
    const onScroll = () => {
      const el = highwayTrackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportH = window.innerHeight || 800;
      const total = Math.max(1, rect.height - viewportH * 0.45);
      const traveled = Math.min(total, Math.max(0, -rect.top + viewportH * 0.2));
      const pct = Math.min(100, Math.max(6, Math.round((traveled / total) * 100)));
      setHighwayProgress(pct);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [activeView]);

  const highwayStops = [
    { km: "KM 01", modId: "salary-calculator", viewTarget: "salary", number: "01", title: "CTC & In-Hand Salary Calculator", tag: "Pay & Tax", input: "Annual CTC, State, FY, PF mode & Tax Regime", output: "Basic/HRA split, Employee & Employer PF, PT, TDS, Monthly In-Hand & Annual Take-Home", howToUse: "Enter your CTC or send extracted CTC from Docs, switch Quick/Detailed mode or PF rule, and copy the summary." },
    { km: "KM 02", modId: "holiday-planner", viewTarget: "holidays", number: "02", title: "State Holiday Calendar & Leave Planner", tag: "Daily Ops", input: "Indian State/UT & Workweek Pattern (5-day / 6-day)", output: "State gazetted holidays, long-weekend bridge suggestions & leave policy notes", howToUse: "Pick your state and workweek pattern to spot natural holiday bridges before filing leave." },
    { km: "KM 03", modId: "email-assistant", viewTarget: "email", number: "03", title: "Smart Email Assistant", tag: "Docs & AI", input: "Rough intent/prompt, thread context & tone (standard, polite, assertive, diplomatic, shorter)", output: "Send-ready corporate email draft with tone variants", howToUse: "Paste raw bullet points or thread context, choose a tone, refine, and copy." },
    { km: "KM 04", modId: "meeting-minutes", viewTarget: "mom", number: "04", title: "Meeting Minutes (MOM) Generator", tag: "Docs & AI", input: "Rough meeting notes, template, title, attendees & date", output: "Structured MOM brief, action items, missing-info audit flags & Sticky Notes handoff", howToUse: "Drop rough call notes, pick a template, check missing-info flags, and send tasks to Sticky Notes." },
    { km: "KM 05", modId: "sticky-notes", viewTarget: "notes", number: "05", title: "Advanced Sticky Notes", tag: "Daily Ops", input: "Quick note, due phrase, color tag & search/archive filters", output: "Pinned action-ready notes with extracted tasks, reminders & follow-up snippets", howToUse: "Jot quick reminders or import MOM actions, search/archive notes, and copy follow-ups." },
    { km: "KM 06", modId: "document-summarizer", viewTarget: "docs", number: "06", title: "Offer Letter & Doc Summarizer", tag: "Docs & AI", input: "Offer letter, policy, or workplace document text/file", output: "Plain-English brief on pay split, notice/probation, recovery clauses & extracted CTC", howToUse: "Paste or upload a document, review the brief, and click Send CTC to Calculator if pay is detected." },
    { km: "KM 07", modId: "tax-calendar", viewTarget: "tax", number: "07", title: "Indian Tax Calendar & Filing Guide", tag: "Pay & Tax", input: "Financial year, salary/expense check-ins & section tab", output: "CBDT deadlines, step-by-step salaried ITR guide, Form 16/AIS/26AS notes & regime comparison", howToUse: "Switch between Tax Saving Finder, Deadlines Assistant, and Tax Calendar tabs with synced figures." },
    { km: "KM 08", modId: "shift-attendance", viewTarget: "shift", number: "08", title: "Shift & Attendance Tracker", tag: "Daily Ops", input: "Shift start/end, actual login/logout, breaks, grace mins, night window & monthly gross", output: "Actual hours, overtime, night-shift allowance, late/early punches, payable days, LOP & CSV export", howToUse: "Select a shift preset or enter punch times and export the payable-days log as CSV." },
    { km: "KM 09", modId: "presentos", viewTarget: "presentos", number: "09", title: "PresentOS", tag: "Docs & AI", input: "Presentation prompt, notes, Excel/CSV/TXT file & theme template", output: "Storyline outline, editable slide preview, audit report & PPTX download", howToUse: "Describe your deck or upload a spreadsheet, pick a theme, edit slides, and export PPTX." },
    { km: "KM 10", modId: "appraisal-promotion", viewTarget: "growthos", number: "10", title: "Appraisal & Promotion Assistant", tag: "Docs & AI", input: "Appraisal questions, work wins/achievements & tone style", output: "Evidence-grounded self-appraisal drafts & missing-evidence notes without invented metrics", howToUse: "Add your review prompts and real work wins, select tone, and copy grounded answers." },
    { km: "KM 11", modId: "document-comparison", viewTarget: "changeos", number: "11", title: "Document Comparison & Process Change Intelligence", tag: "Docs & AI", input: "Previous document and updated document files", output: "Section-by-section diff register, coverage summary & change explanations", howToUse: "Upload both versions (previous and updated) to inspect exact clause/process diffs." },
  ];
  function handleOpenModule(mod: ModuleItem) {
    if (mod.id === "salary-calculator") setActiveView("salary");
    else if (mod.id === "holiday-planner") setActiveView("holidays");
    else if (mod.id === "email-assistant") setActiveView("email");
    else if (mod.id === "meeting-minutes") setActiveView("mom");
    else if (mod.id === "sticky-notes") setActiveView("notes");
    else if (mod.id === "shift-attendance") setActiveView("shift");
    else if (mod.id === "presentos") setActiveView("presentos");
    else if (mod.id === "document-summarizer") setActiveView("docs");
    else if (mod.id === "tax-calendar") setActiveView("tax");
    else if (mod.id === "appraisal-promotion") setActiveView("growthos");
    else if (mod.id === "document-comparison") setActiveView("changeos");
  }

  async function handleCopySummary() {
    const text = [
      `CorporateBuddy Salary Brief (${salaryState}, FY ${financialYear})`,
      `Annual CTC: ${formatINR(salaryResult.annualCtc)}`,
      `Monthly Gross: ${formatINR(salaryResult.monthlyGross)}`,
      `Employee PF: ${formatINR(salaryResult.monthlyEmployeePf)} | Employer PF: ${formatINR(salaryResult.monthlyEmployerPf)}`,
      `Professional Tax (${salaryState}): ${formatINR(salaryResult.monthlyProfessionalTax)}`,
      `Estimated Monthly TDS (${taxRegime.toUpperCase()} Regime): ${formatINR(salaryResult.monthlyTds)}`,
      `Estimated Monthly In-Hand: ${formatINR(salaryResult.estimatedMonthlyInHand)}`,
      `Annual Take-Home: ${formatINR(salaryResult.annualTakeHome)}`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyEmail(textToCopy: string) {
    await navigator.clipboard.writeText(textToCopy);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  }

  async function handleCopyMom(textToCopy: string) {
    await navigator.clipboard.writeText(textToCopy);
    setMomCopied(true);
    setTimeout(() => setMomCopied(false), 2000);
  }

  async function handleCopyNoteMessage(textToCopy: string) {
    await navigator.clipboard.writeText(textToCopy);
    setNoteCopied(true);
    setTimeout(() => setNoteCopied(false), 2000);
  }

  async function handleCopyDocBrief() {
    const text = [
      `CorporateBuddy Document Brief: ${docFileName}`,
      docBrief.overview,
      ...docBrief.keyDetails,
      ...docBrief.financialDetails,
      ...docBrief.redFlagsToVerify,
      docBrief.disclaimer,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setDocCopied(true);
    setTimeout(() => setDocCopied(false), 2000);
  }

  const [presentosPrompt, setPresentosPrompt] = useState("");
  const [presentosAiRefined, setPresentosAiRefined] = useState(false);
  const [presentosUseGemini, setPresentosUseGemini] = useState(true);
  const [presentosRefining, setPresentosRefining] = useState(false);
  const [presentosStatusReason, setPresentosStatusReason] = useState("");
  const [presentosProgress, setPresentosProgress] = useState(0);
  const [presentosProgressStage, setPresentosProgressStage] = useState("");
  const [taxCtcInput, setTaxCtcInput] = useState<number>(1200000);
  const [taxFinderSalary, setTaxFinderSalary] = useState<number>(1200000);
  const [taxFinderConfirmed, setTaxFinderConfirmed] = useState<boolean>(true);
  const [taxPayRent, setTaxPayRent] = useState<"yes" | "no" | null>(null);
  const [taxRentMetro, setTaxRentMetro] = useState<boolean>(true);
  const [taxRentAmount, setTaxRentAmount] = useState<number>(240000);
  const [taxHasHealth, setTaxHasHealth] = useState<"yes" | "no" | null>(null);
  const [taxHealthParentSenior, setTaxHealthParentSenior] = useState<boolean>(false);
  const [taxHealthAmount, setTaxHealthAmount] = useState<number>(25000);
  const [taxHas80C, setTaxHas80C] = useState<"yes" | "no" | null>(null);
  const [tax80CAmount, setTax80CAmount] = useState<number>(150000);
  const [taxHasHomeLoan, setTaxHasHomeLoan] = useState<"yes" | "no" | null>(null);
  const [taxLoanLetOut, setTaxLoanLetOut] = useState<boolean>(false);
  const [taxLoanInterest, setTaxLoanInterest] = useState<number>(150000);
  const [taxOldDeductionsInput, setTaxOldDeductionsInput] = useState<number>(150000);
  const [taxReturnRateInput, setTaxReturnRateInput] = useState<number>(8);
   const [taxSubView, setTaxSubView] = useState<"finder" | "deadlines" | "calendar">("finder");
  const [presentosSourceText, setPresentosSourceText] = useState("");
  const [presentosAudience, setPresentosAudience] = useState("Leadership & Operations Stakeholders");
  const [presentosSlideCount, setPresentosSlideCount] = useState(5);
  const [presentosSpec, setPresentosSpec] = useState<PresentOSSpec | null>(null);
  const [presentosSelectedSlideIdx, setPresentosSelectedSlideIdx] = useState(0);
  const [presentosTemplate, setPresentosTemplate] = useState<PresentOSTemplateId>("executive-minimal");
  const [presentosHistory, setPresentosHistory] = useState<PresentOSHistoryStack | null>(null);
  const [presentosNlEdit, setPresentosNlEdit] = useState("");
  const [presentosAudit, setPresentosAudit] = useState<PresentOSAuditReport | null>(null);

  return (    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setActiveView("home")}
            className="flex items-center gap-3 text-left cursor-pointer"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0f294a] text-sm font-semibold tracking-tight text-white">
              CB
            </div>
            <div>
              <span className="font-display text-base font-bold tracking-tight text-[#0b192c]">
                CorporateBuddy
              </span>
              <span className="hidden sm:inline-block ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                India Workplace Suite
              </span>
            </div>
          </button>


          <div className="flex items-center gap-2.5">
            {activeView !== "home" ? (
              <button
                type="button"
                onClick={() => setActiveView("home")}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                ← Back to Home
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveView("salary")}
                className="rounded-lg bg-[#0f294a] px-3.5 py-2 text-xs sm:text-sm font-medium text-white hover:bg-[#163863] transition-colors cursor-pointer"
              >
                Open CTC Calculator
              </button>
            )}
          </div>
        </div>
      </header>

        <div className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-6 items-start">
          <aside data-launcher-rail="true" className="w-full lg:w-64 shrink-0 lg:order-1 rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-sm p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Workspace Hub</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Quick Launch</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5 text-sm font-medium">
              {[
                ["home", "Home"],
                ["highway", "Website Highway"],
                ["salary", "Salary"],
                ["holidays", "Holidays"],
                ["email", "Email"],
                ["mom", "MOM"],
                ["notes", "Notes"],
                ["docs", "Docs"],
                ["tax", "Tax"],
                ["shift", "Shift & Attendance Tracker"],
                ["presentos", "PresentOS"],
                  ["growthos", "Appraisal & Promotion Assistant"],
                  ["changeos", "Document Comparison & Process Change Intelligence"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveView(key as typeof activeView)}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-left transition-all cursor-pointer ${activeView === key ? "bg-[#0f294a] text-white font-semibold shadow-xs" : "text-slate-700 hover:bg-slate-100 hover:text-[#0b192c]"}`}
                >
                  <span>{label}</span>
                  <span className="text-[11px] opacity-60">→</span>
                </button>
              ))}
            </div>
              <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs font-semibold">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live Windows</p>
                <button type="button" onClick={openSlaMonitor} className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 hover:border-[#0f294a] hover:bg-white transition-colors cursor-pointer">
                  <span>SLA Monitor</span>
                  <span className="text-[11px] text-slate-500">↗</span>
                </button>
                <button type="button" onClick={openAttendanceTracker} className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 hover:border-[#0f294a] hover:bg-white transition-colors cursor-pointer">
                  <span>Attendance</span>
                  <span className="text-[11px] text-slate-500">↗</span>
                </button>
                <button type="button" onClick={openExcelOS} className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 hover:border-[#0f294a] hover:bg-white transition-colors cursor-pointer">
                  <span>ExcelOS</span>
                  <span className="text-[11px] text-slate-500">↗</span>
                </button>
                <a href="/excel-os" className="block w-full text-center rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-[11px] font-semibold text-blue-800 hover:bg-blue-100 transition-colors">Open /excel-os directly →</a>
              </div>
          </aside>
          <main ref={mainRef} className="flex-1 min-w-0 lg:order-2 scroll-mt-24">
                {activeView === "highway" ? (
          <section ref={highwayTrackRef} className="space-y-6">
            <div className="rounded-2xl border border-amber-300/80 bg-gradient-to-r from-[#0b192c] via-[#0f294a] to-[#133b2e] p-6 text-white shadow-md space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-200">
                  NH-CB · CorporateBuddy Indian Highway Tour
                </span>
                <span className="font-mono text-xs text-amber-200">Highway Stretched: {highwayProgress}%</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">How CorporateBuddy Works — End-to-End Highway</h1>
              <p className="text-sm text-slate-200 max-w-3xl">
                CorporateBuddy is an India-focused workplace suite built with Next.js App Router &amp; Tailwind CSS. Deterministic calculators (Salary, Holidays, Tax Calendar, Shift &amp; Attendance) run instant local math, while document and AI workspaces (Email, MOM, Sticky Notes, Docs, PresentOS, Appraisal, ChangeOS) structure briefs and fall back cleanly even without a Gemini API key.
              </p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-slate-300">
                  <span>START · NH-00 GATEWAY</span>
                  <span>CARDS 01 → 11 MILESTONES</span>
                  <span>FINISH · FULL WORKSPACE</span>
                </div>
                <div className="relative h-5 w-full rounded-full bg-slate-900/90 border border-slate-700 overflow-hidden flex items-center px-1">
                  <div className="h-2.5 rounded-full bg-gradient-to-r from-amber-500 via-white to-emerald-500 transition-all duration-150" style={{ width: `${highwayProgress}%` }} />
                  <span className="ml-2 text-[10px] font-mono font-bold tracking-widest text-amber-300 whitespace-nowrap">NH-CB · {highwayProgress}%</span>
                </div>
              </div>
            </div>
            <div className="relative pl-6 sm:pl-10 space-y-6">
              <div className="absolute left-2 sm:left-4 top-0 bottom-0 w-3 sm:w-4 rounded-full bg-slate-800 border-x-2 border-amber-400/80 overflow-hidden">
                <div className="w-full bg-gradient-to-b from-amber-500 via-white to-emerald-500 transition-all duration-150" style={{ height: `${highwayProgress}%` }} />
              </div>
              {highwayStops.map((stop) => (
                <article key={stop.modId} className="relative rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="rounded-md border-2 border-slate-900 bg-amber-400 px-2.5 py-0.5 font-mono text-xs font-extrabold text-slate-950">
                        {stop.km}
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-400">Card {stop.number}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">{stop.tag}</span>
                    </div>
                    <button type="button" onClick={() => setActiveView(stop.viewTarget as typeof activeView)} className="rounded-lg bg-[#0f294a] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#163863] cursor-pointer">
                      Open Card {stop.number} →
                    </button>
                  </div>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-[#0b192c]">{stop.title}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                      <p className="font-semibold text-slate-900">What You Give (Input)</p>
                      <p className="mt-1 text-slate-600">{stop.input}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                      <p className="font-semibold text-slate-900">What You Get (Brief / Output)</p>
                      <p className="mt-1 text-slate-600">{stop.output}</p>
                    </div>
                    <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-3">
                      <p className="font-semibold text-blue-950">How to Use It</p>
                      <p className="mt-1 text-slate-700">{stop.howToUse}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : activeView === "changeos" ? (
            <ChangeOsWorkspace />
          ) : activeView === "growthos" ? (
            <GrowthOsWorkspace />
          ) : activeView === "tax" ? (
            <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-900">Tax Workspace</span>
                    <h1 className="font-display text-xl font-bold text-[#0b192c]">Select a Tax Section</h1>
                  </div>
                  <span className="text-xs text-slate-500">Your inputs stay synced across tabs</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button type="button" onClick={() => setTaxSubView("finder")} className={taxSubView === "finder" ? "rounded-xl border border-[#0f294a] bg-[#0f294a] px-4 py-3 text-left text-white" : "rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-left text-slate-800 hover:bg-slate-100"}>
                    <p className="text-xs font-semibold">1. AI Tax Saving Opportunity Finder</p>
                    <p className={taxSubView === "finder" ? "mt-0.5 text-[11px] text-blue-100" : "mt-0.5 text-[11px] text-slate-500"}>Salary check, deductions &amp; regime comparison</p>
                  </button>
                  <button type="button" onClick={() => setTaxSubView("deadlines")} className={taxSubView === "deadlines" ? "rounded-xl border border-[#0f294a] bg-[#0f294a] px-4 py-3 text-left text-white" : "rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-left text-slate-800 hover:bg-slate-100"}>
                    <p className="text-xs font-semibold">2. AI Tax Deadline &amp; Compliance Assistant</p>
                    <p className={taxSubView === "deadlines" ? "mt-0.5 text-[11px] text-blue-100" : "mt-0.5 text-[11px] text-slate-500"}>Due dates, statutory scope &amp; CBDT alerts</p>
                  </button>
                  <button type="button" onClick={() => setTaxSubView("calendar")} className={taxSubView === "calendar" ? "rounded-xl border border-[#0f294a] bg-[#0f294a] px-4 py-3 text-left text-white" : "rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-left text-slate-800 hover:bg-slate-100"}>
                    <p className="text-xs font-semibold">3. Indian Tax Calendar &amp; Filing Guide</p>
                    <p className={taxSubView === "calendar" ? "mt-0.5 text-[11px] text-blue-100" : "mt-0.5 text-[11px] text-slate-500"}>CTC regime projection &amp; filing schedule</p>
                  </button>
                </div>
              </div>
              {taxSubView === "finder" && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#0b192c]">
                      AI Tax Saving Opportunity Finder
                    </h2>
                    <p className="text-xs text-slate-600">
                      Personal tax review of your confirmed salary &amp; expenses—eligibility, limits, and required proofs without extra spending.
                    </p>
                  </div>
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
                    Interactive Step 1–4 Reviewer
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  <div className="lg:col-span-5 space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[#0b192c]">Step 1 · Enter or Confirm Annual Salary / Document Figure</p>
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => { setTaxFinderSalary(1200000); setTaxFinderConfirmed(true); }} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100">Form 16 Preset (₹12L)</button>
                          <button type="button" onClick={() => { setTaxFinderSalary(1800000); setTaxFinderConfirmed(true); }} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100">Payslip Preset (₹18L)</button> <button type="button" onClick={() => { setTaxPayRent(null); setTaxHasHealth(null); setTaxHas80C(null); setTaxHasHomeLoan(null); setTaxRentAmount(0); setTaxHealthAmount(0); setTax80CAmount(0); setTaxLoanInterest(0); }} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100">Reset Check-Ins</button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2.5">
                        <input
                          type="number"
                          min={0}
                          step={50000}
                          placeholder="Enter annual salary (₹)"
                          value={taxFinderSalary === 0 ? "" : taxFinderSalary}
                          onChange={(e) => setTaxFinderSalary(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900"
                        />
                        <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                          <input type="checkbox" checked={taxFinderConfirmed} onChange={(e) => setTaxFinderConfirmed(e.target.checked)} className="rounded border-slate-300" />
                          I confirm these salary details (₹{taxFinderSalary.toLocaleString("en-IN")}/yr)
                        </label>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3.5">
                      <p className="text-xs font-semibold text-[#0b192c]">Step 2 · Quick Plain-English Check-Ins</p>
                      <div className="space-y-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5">
                          <span className="font-medium text-slate-800">Do you pay rent?</span>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setTaxPayRent("yes")} className={taxPayRent === "yes" ? "rounded-lg bg-[#0f294a] px-3 py-1 text-white font-semibold" : "rounded-lg border border-slate-200 bg-white px-3 py-1 text-slate-700"}>Yes</button>
                            <button type="button" onClick={() => setTaxPayRent("no")} className={taxPayRent === "no" ? "rounded-lg bg-[#0f294a] px-3 py-1 text-white font-semibold" : "rounded-lg border border-slate-200 bg-white px-3 py-1 text-slate-700"}>No</button>
                          </div>
                        </div>
                        {taxPayRent === "yes" && (
                          <div className="pl-3 border-l-2 border-blue-200 flex flex-wrap items-center gap-2.5">
                            <input type="number" min={0} step={12000} value={taxRentAmount === 0 ? "" : taxRentAmount} onChange={(e) => { const v = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)); setTaxRentAmount(v); if (v > 0) setTaxPayRent("yes"); }} placeholder="Annual rent (₹)" className="w-40 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs" />
                            <label className="inline-flex items-center gap-1.5 text-slate-700">
                              <input type="checkbox" checked={taxRentMetro} onChange={(e) => setTaxRentMetro(e.target.checked)} />
                              Metro city
                            </label>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5">
                          <span className="font-medium text-slate-800">Do you have health insurance?</span>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setTaxHasHealth("yes")} className={taxHasHealth === "yes" ? "rounded-lg bg-[#0f294a] px-3 py-1 text-white font-semibold" : "rounded-lg border border-slate-200 bg-white px-3 py-1 text-slate-700"}>Yes</button>
                            <button type="button" onClick={() => setTaxHasHealth("no")} className={taxHasHealth === "no" ? "rounded-lg bg-[#0f294a] px-3 py-1 text-white font-semibold" : "rounded-lg border border-slate-200 bg-white px-3 py-1 text-slate-700"}>No</button>
                          </div>
                        </div>
                        {taxHasHealth === "yes" && (
                          <div className="pl-3 border-l-2 border-blue-200 flex flex-wrap items-center gap-2.5">
                            <input type="number" min={0} step={5000} value={taxHealthAmount === 0 ? "" : taxHealthAmount} onChange={(e) => { const v = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)); setTaxHealthAmount(v); if (v > 0) setTaxHasHealth("yes"); }} placeholder="Premium paid (₹)" className="w-40 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs" />
                            <label className="inline-flex items-center gap-1.5 text-slate-700">
                              <input type="checkbox" checked={taxHealthParentSenior} onChange={(e) => setTaxHealthParentSenior(e.target.checked)} />
                              Senior parent (60+)
                            </label>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5">
                          <span className="font-medium text-slate-800">Do you contribute to PPF, ELSS, or life insurance?</span>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setTaxHas80C("yes")} className={taxHas80C === "yes" ? "rounded-lg bg-[#0f294a] px-3 py-1 text-white font-semibold" : "rounded-lg border border-slate-200 bg-white px-3 py-1 text-slate-700"}>Yes</button>
                            <button type="button" onClick={() => setTaxHas80C("no")} className={taxHas80C === "no" ? "rounded-lg bg-[#0f294a] px-3 py-1 text-white font-semibold" : "rounded-lg border border-slate-200 bg-white px-3 py-1 text-slate-700"}>No</button>
                          </div>
                        </div>
                        {taxHas80C === "yes" && (
                          <div className="pl-3 border-l-2 border-blue-200 flex flex-wrap items-center gap-2.5">
                            <input type="number" min={0} step={10000} value={tax80CAmount === 0 ? "" : tax80CAmount} onChange={(e) => { const v = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)); setTax80CAmount(v); if (v > 0) setTaxHas80C("yes"); }} placeholder="Annual contribution (₹)" className="w-40 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs" />
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-slate-800">Do you have a home loan?</span>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setTaxHasHomeLoan("yes")} className={taxHasHomeLoan === "yes" ? "rounded-lg bg-[#0f294a] px-3 py-1 text-white font-semibold" : "rounded-lg border border-slate-200 bg-white px-3 py-1 text-slate-700"}>Yes</button>
                            <button type="button" onClick={() => setTaxHasHomeLoan("no")} className={taxHasHomeLoan === "no" ? "rounded-lg bg-[#0f294a] px-3 py-1 text-white font-semibold" : "rounded-lg border border-slate-200 bg-white px-3 py-1 text-slate-700"}>No</button>
                          </div>
                        </div>
                        {taxHasHomeLoan === "yes" && (
                          <div className="pl-3 border-l-2 border-blue-200 flex flex-wrap items-center gap-2.5">
                            <input type="number" min={0} step={10000} value={taxLoanInterest === 0 ? "" : taxLoanInterest} onChange={(e) => { const v = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)); setTaxLoanInterest(v); if (v > 0) setTaxHasHomeLoan("yes"); }} placeholder="Annual interest (₹)" className="w-40 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs" />
                            <label className="inline-flex items-center gap-1.5 text-slate-700">
                              <input type="checkbox" checked={taxLoanLetOut} onChange={(e) => setTaxLoanLetOut(e.target.checked)} />
                              Rented out
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-7">
                    {(() => {
                      const sal = Number(taxFinderSalary) || 0;
                      const rentDed = taxPayRent === "yes" ? Math.min(taxRentAmount, Math.round(sal * (taxRentMetro ? 0.25 : 0.2))) : 0;
                      const healthCap = taxHealthParentSenior ? 75000 : 50000;
                      const healthDed = taxHasHealth === "yes" ? Math.min(taxHealthAmount, healthCap) : 0;
                      const sec80CDed = taxHas80C === "yes" ? Math.min(tax80CAmount, 150000) : 0;
                      const loanDed = taxHasHomeLoan === "yes" ? (taxLoanLetOut ? taxLoanInterest : Math.min(taxLoanInterest, 200000)) : 0;
                      const totalOldDed = 50000 + rentDed + healthDed + sec80CDed + loanDed;

                      const calcSlab = (taxable: number, isNew: boolean) => {
                        if (isNew) {
                          if (taxable <= 1200000) return 0;
                          let t = 0;
                          if (taxable > 400000) t += Math.min(taxable - 400000, 400000) * 0.05;
                          if (taxable > 800000) t += Math.min(taxable - 800000, 400000) * 0.10;
                          if (taxable > 1200000) t += Math.min(taxable - 1200000, 400000) * 0.15;
                          if (taxable > 1600000) t += Math.min(taxable - 1600000, 400000) * 0.20;
                          if (taxable > 2000000) t += Math.min(taxable - 2000000, 400000) * 0.25;
                          if (taxable > 2400000) t += (taxable - 2400000) * 0.30;
                          return Math.round(t * 1.04);
                        }
                        if (taxable <= 500000) return 0;
                        let t = 0;
                        if (taxable > 250000) t += Math.min(taxable - 250000, 250000) * 0.05;
                        if (taxable > 500000) t += Math.min(taxable - 500000, 500000) * 0.20;
                        if (taxable > 1000000) t += (taxable - 1000000) * 0.30;
                        return Math.round(t * 1.04);
                      };

                      const newTax = calcSlab(Math.max(0, sal - 75000), true);
                      const oldTax = calcSlab(Math.max(0, sal - totalOldDed), false);
                      const favRegime = newTax <= oldTax ? "New Tax Regime" : "Old Tax Regime";
                      const diff = Math.abs(oldTax - newTax);

                      return (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs text-slate-800 flex flex-wrap items-center justify-between gap-2">
                            <span>Confirmed Salary: <strong className="text-[#0b192c]">₹{sal.toLocaleString("en-IN")} / yr</strong></span>
                            <span>Old Regime Deductions: <strong className="text-[#0b192c]">₹{totalOldDed.toLocaleString("en-IN")}</strong> applied (₹{(50000 + (taxPayRent === "yes" ? taxRentAmount : 0) + (taxHasHealth === "yes" ? taxHealthAmount : 0) + (taxHas80C === "yes" ? tax80CAmount : 0) + (taxHasHomeLoan === "yes" ? taxLoanInterest : 0)).toLocaleString("en-IN")} entered · incl. ₹50,000 std. deduction)</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">New Tax Regime</p>
                              <p className="mt-1 font-display text-xl font-bold text-[#0b192c]">₹{newTax.toLocaleString("en-IN")} / yr</p>
                              <p className="text-xs text-slate-600">Standard deduction: ₹75,000 · Lower slab rates</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Old Tax Regime</p>
                              <p className="mt-1 font-display text-xl font-bold text-[#0b192c]">₹{oldTax.toLocaleString("en-IN")} / yr</p>
                              <p className="text-xs text-slate-600">Total deductions applied: ₹{totalOldDed.toLocaleString("en-IN")}</p>
                            </div>
                          </div>

                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-900">
                            More Favourable Regime: {favRegime} — saves ₹{diff.toLocaleString("en-IN")} / year ({favRegime === "New Tax Regime" ? "lower slabs beat your current deductions" : "your deductions beat the New Regime slabs"})
                          </div>

                          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3 text-xs text-slate-800">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-semibold text-sm text-[#0b192c]">How You Can Save Right Now</p>
                                <p className="text-[11px] text-slate-600">Prioritised actions based on your confirmed numbers—no unnecessary spending nudges.</p>
                              </div>
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900">
                                Save ₹{diff.toLocaleString("en-IN")}/yr (₹{Math.round(diff / 12).toLocaleString("en-IN")}/mo)
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="rounded-lg border border-blue-100 bg-white p-3 space-y-1">
                                <span className="inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-900">1 · Regime Choice</span>
                                <p className="font-semibold text-[#0b192c]">Lock in {favRegime}</p>
                                <p className="text-slate-600">Select {favRegime} in payroll &amp; ITR to keep ₹{diff.toLocaleString("en-IN")}/yr compared to the other regime.</p>
                              </div>

                              <div className="rounded-lg border border-blue-100 bg-white p-3 space-y-1">
                                <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950">2 · Existing Proofs</span>
                                <p className="font-semibold text-[#0b192c]">
                                  {(rentDed + healthDed + sec80CDed + loanDed) > 0
                                    ? `Submit ₹${(rentDed + healthDed + sec80CDed + loanDed).toLocaleString("en-IN")} confirmed proofs`
                                    : "No extra spending needed"}
                                </p>
                                <p className="text-slate-600">
                                  {(rentDed + healthDed + sec80CDed + loanDed) > 0
                                    ? "Attach rent/insurance/investment/loan proofs in Form 12BB or ITR so payroll does not over-deduct TDS."
                                    : "Stick with the New Regime ₹75,000 standard deduction—do not buy extra products just for a deduction."}
                                </p>
                              </div>

                              <div className="rounded-lg border border-blue-100 bg-white p-3 space-y-1">
                                <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-950">3 · Payroll Structure</span>
                                <p className="font-semibold text-[#0b192c]">Check Employer NPS</p>
                                <p className="text-slate-600">If offered by your employer, NPS contribution (up to 14% of Basic + DA) lowers taxable income even in the New Regime without extra out-of-pocket spend.</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 text-xs">
                            <p className="font-semibold text-[#0b192c]">Step 3 · Eligibility, Limits &amp; Required Proofs</p>
                            {!taxFinderConfirmed && (
                              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-amber-950">
                                Please confirm your salary figure in Step 1 so CorporateBuddy can finalize your regime comparison.
                              </div>
                            )}
                            {taxHasHealth === "yes" && (
                              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 space-y-1 text-amber-950">
                                <p className="font-semibold">You reported qualifying health insurance premiums (₹{taxHealthAmount.toLocaleString("en-IN")}), reflected in your old-regime estimate up to ₹{healthCap.toLocaleString("en-IN")}.</p>
                                <p>Eligibility &amp; Proofs: Old Regime Sec. 80D applies (New Regime disallows 80D). Keep policy schedule, premium receipt, and Form 12BB declaration.</p>
                              </div>
                            )}
                            {taxHas80C === "yes" && (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800">
                                {tax80CAmount >= 150000
                                  ? `PPF/ELSS/life cover (₹${tax80CAmount.toLocaleString("en-IN")}) hits the ₹1,50,000 Old Regime cap—no extra spending is needed for further deduction. Keep EPF/PPF/ELSS/policy receipts.`
                                  : `PPF/ELSS/life cover reported (₹${tax80CAmount.toLocaleString("en-IN")} applied under Old Regime Sec. 80C up to ₹1,50,000). Keep existing receipts; no extra spending required.`}
                              </div>
                            )}
                            {taxPayRent === "yes" && (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800">
                                Rent reported (₹{taxRentAmount.toLocaleString("en-IN")}/yr): ₹{rentDed.toLocaleString("en-IN")} applied under Old Regime HRA/80GG rules. Keep rent receipts, rental agreement, and landlord PAN if annual rent exceeds ₹1,00,000.
                              </div>
                            )}
                            {taxHasHomeLoan === "yes" && (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800">
                                Home loan reported: ₹{loanDed.toLocaleString("en-IN")} applied under Old Regime Sec. 24(b) (up to ₹2,00,000 for self-occupied; full interest against let-out rent). Keep bank interest certificate.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
              )}
              {taxSubView === "deadlines" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#0b192c]">
                    AI Tax Deadline &amp; Compliance Assistant
                  </h2>
                  <p className="text-xs text-slate-600">
                    Verified due dates, applicable taxpayer scope, statutory references, and active CBDT alerts.
                  </p>
                </div>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                  Alert: AY 2026-27 Audit ITR extended to Nov 21, 2026 (Circular 07/2026)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-4 font-semibold">Obligation</th>
                      <th className="py-2 px-4 font-semibold">Due Date</th>
                      <th className="py-2 px-4 font-semibold">Applies To</th>
                      <th className="py-2 pl-4 font-semibold">Official Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-2.5 pr-4 font-semibold text-slate-900">Advance Tax (FY 2026-27)</td>
                      <td className="py-2.5 px-4">Jun 15, Sep 15, Dec 15, Mar 15</td>
                      <td className="py-2.5 px-4">Net tax &ge; &#8377;10,000 (60+ non-business exempt)</td>
                      <td className="py-2.5 pl-4 text-slate-600">Sec. 408, IT Act 2025</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2.5 pr-4 font-semibold text-slate-900">ITR Filing (AY 2026-27 Audit)</td>
                      <td className="py-2.5 px-4 font-semibold text-amber-800">Nov 21, 2026 (Extended)</td>
                      <td className="py-2.5 px-4">Taxpayers under tax audit (Sec. 139(1) Expl. 2)</td>
                      <td className="py-2.5 pl-4 text-slate-600">CBDT Circular 07/2026</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2.5 pr-4 font-semibold text-slate-900">Quarterly TDS / TCS Return</td>
                      <td className="py-2.5 px-4">Jul 31, Oct 31, Jan 31, May 31</td>
                      <td className="py-2.5 px-4">Deductors / Collectors (Forms 138, 140, 144, 143)</td>
                      <td className="py-2.5 pl-4 text-slate-600">IT Act 2025 / Rules 2026</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-4 font-semibold text-slate-900">ITR Filing (Tax Year 2026-27)</td>
                      <td className="py-2.5 px-4">July 2027</td>
                      <td className="py-2.5 px-4">Salaried &amp; non-audit taxpayers (FY 2026-27)</td>
                      <td className="py-2.5 pl-4 text-slate-600">Sec. 263, IT Act 2025</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
              )}
              {taxSubView === "calendar" && (
              <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-900">
                  Module 07 · Salaried Employee Tax Reference &amp; Guide
                </span>
                <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0b192c]">
                  Indian Tax Calendar &amp; Filing Guide
                </h1>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
              <div className="max-w-sm space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600">
                  Annual CTC (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  placeholder="e.g. 1200000"
                  value={taxCtcInput === 0 ? "" : taxCtcInput}
                  onChange={(e) =>
                    setTaxCtcInput(
                      e.target.value === "" ? 0 : Math.max(0, Number(e.target.value))
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900"
                />
              </div>

              {(() => {
                const ctc = Number(taxCtcInput) || 0;
                const newStd = 75000;
                const oldStd = 50000;
                const newTaxable = Math.max(0, ctc - newStd);
                const oldTaxable = Math.max(0, ctc - oldStd);

                const calcNew = (t: number) => {
                  if (t <= 1200000) return 0;
                  let tax = 0;
                  if (t > 400000) tax += Math.min(t - 400000, 400000) * 0.05;
                  if (t > 800000) tax += Math.min(t - 800000, 400000) * 0.10;
                  if (t > 1200000) tax += Math.min(t - 1200000, 400000) * 0.15;
                  if (t > 1600000) tax += Math.min(t - 1600000, 400000) * 0.20;
                  if (t > 2000000) tax += Math.min(t - 2000000, 400000) * 0.25;
                  if (t > 2400000) tax += (t - 2400000) * 0.30;
                  return Math.round(tax * 1.04);
                };

                const calcOld = (t: number) => {
                  if (t <= 500000) return 0;
                  let tax = 0;
                  if (t > 250000) tax += Math.min(t - 250000, 250000) * 0.05;
                  if (t > 500000) tax += Math.min(t - 500000, 500000) * 0.20;
                  if (t > 1000000) tax += (t - 1000000) * 0.30;
                  return Math.round(tax * 1.04);
                };

                const newAnnual = calcNew(newTaxable);
                const oldAnnual = calcOld(oldTaxable);
                const annualDiff = Math.abs(oldAnnual - newAnnual);
                const betterRegime = newAnnual <= oldAnnual ? "New Tax Regime" : "Old Tax Regime";

                const horizons = [
                  { label: "6 Months", months: 6 },
                  { label: "1 Year", months: 12 },
                  { label: "2 Years", months: 24 },
                  { label: "3 Years", months: 36 },
                  { label: "4 Years", months: 48 },
                  { label: "5 Years", months: 60 },
                ];

                return (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          New Tax Regime Deduction
                        </p>
                        <p className="mt-1 font-display text-xl font-bold text-[#0b192c]">
                          ₹{newAnnual.toLocaleString("en-IN")} / yr
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          Monthly: ₹{Math.round(newAnnual / 12).toLocaleString("en-IN")} · Taxable: ₹{newTaxable.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Old Tax Regime Deduction
                        </p>
                        <p className="mt-1 font-display text-xl font-bold text-[#0b192c]">
                          ₹{oldAnnual.toLocaleString("en-IN")} / yr
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          Monthly: ₹{Math.round(oldAnnual / 12).toLocaleString("en-IN")} · Taxable: ₹{oldTaxable.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-900">
                      Lower Tax Regime: {betterRegime} — saves ₹{annualDiff.toLocaleString("en-IN")} / year
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="py-2 pr-4 font-semibold">Time Period</th>
                            <th className="py-2 px-4 font-semibold">New Regime Tax Deducted</th>
                            <th className="py-2 px-4 font-semibold">Old Regime Tax Deducted</th>
                            <th className="py-2 pl-4 font-semibold">Cumulative ITR Return / Savings Base</th>
                          </tr>
                        </thead>
                        <tbody>
                          {horizons.map((h) => {
                            const years = h.months / 12;
                            const newCum = Math.round(newAnnual * years);
                            const oldCum = Math.round(oldAnnual * years);
                            const itrReturnBase = Math.round(annualDiff * years);
                            return (
                              <tr key={h.label} className="border-b border-slate-100 text-slate-800">
                                <td className="py-2.5 pr-4 font-semibold">{h.label}</td>
                                <td className="py-2.5 px-4">₹{newCum.toLocaleString("en-IN")}</td>
                                <td className="py-2.5 px-4">₹{oldCum.toLocaleString("en-IN")}</td>
                                <td className="py-2.5 pl-4 font-semibold text-emerald-800">
                                  ₹{itrReturnBase.toLocaleString("en-IN")}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    </div>
                );
              })()}
            </div>
            </div>
          )}
            </section>
        ) : activeView === "docs" ? (
          <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                  Module 06 · Offer Letter & Workplace Document Brief
                </span>
                <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0b192c]">
                  Offer Letter & Document Summarizer
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {docBrief.extractedCtc && (
                  <button
                    type="button"
                    onClick={() => {
                      const val = docBrief.extractedCtc!;
                      setAnnualCtc(val);
                      setAnnualCtcText(String(val));
                      setActiveView("salary");
                    }}
                    className="rounded-lg bg-blue-50 border border-blue-200 px-3.5 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-100 cursor-pointer"
                  >
                    Send CTC to Calculator →
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopyDocBrief}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  {docCopied ? "Copied Brief" : "Copy Brief"}
                </button>
              </div>
            </div>

            <div className="floating-panel rounded-2xl p-5 border-l-4 border-l-emerald-700">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Document Brief Summary
              </p>
              <p className="mt-1 font-display text-base sm:text-lg font-bold text-[#0b192c]">
                {docBrief.briefSummary}
              </p>
              <p className="mt-1 text-xs text-slate-500">{docBrief.disclaimer}</p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5 floating-panel rounded-2xl p-5 sm:p-6 space-y-4 self-start">
                <h2 className="font-display text-lg font-bold text-[#0b192c]">
                  Upload or Paste Document Text
                </h2>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.txt"
                  onChange={handleDocFileChange}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs"
                />
                {docUploadError && (
                  <p className="text-xs font-medium text-red-700">{docUploadError}</p>
                )}
                <input
                  type="text"
                  value={docFileName}
                  onChange={(e) => setDocFileName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
                <textarea
                  rows={6}
                  value={docRawText}
                  onChange={(e) => setDocRawText(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
              </div>

              <div className="lg:col-span-7 floating-panel rounded-2xl p-5 sm:p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#0b192c]">
                  Structured Brief
                </h2>
                <p className="text-sm text-slate-600">{docBrief.overview}</p>
                <ul className="space-y-1 text-xs sm:text-sm text-slate-700">
                  {[
                    ...docBrief.keyDetails,
                    ...docBrief.financialDetails,
                    ...docBrief.importantConditions,
                    ...docBrief.redFlagsToVerify,
                    ...docBrief.hrQuestions,
                  ].map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : activeView === "notes" ? (
          <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                  Module 05 · Action-Ready Office Scratchpad
                </span>
                <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0b192c]">
                  Advanced Sticky Notes
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={noteSearch}
                  onChange={(e) => setNoteSearch(e.target.value)}
                  placeholder="Search notes..."
                  className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowArchived((prev) => !prev)}
                  className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold cursor-pointer"
                >
                  {showArchived ? "Active Notes" : "Archive"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <form
                onSubmit={handleAddNote}
                className="lg:col-span-4 floating-panel rounded-2xl p-5 sm:p-6 space-y-4 self-start"
              >
                <h2 className="font-display text-lg font-bold text-[#0b192c]">
                  Quick Note
                </h2>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
                <textarea
                  rows={4}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder='e.g. "Send weekly report Friday 4 PM"'
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={noteCategory}
                    onChange={(e) => setNoteCategory(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="Work Tasks">Work Tasks</option>
                    <option value="HR & Payroll">HR & Payroll</option>
                    <option value="Meetings">Meetings</option>
                    <option value="Follow-Ups">Follow-Ups</option>
                  </select>
                  <select
                    value={noteColor}
                    onChange={(e) => setNoteColor(e.target.value as StickyColor)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="amber">Amber</option>
                    <option value="blue">Cobalt</option>
                    <option value="teal">Teal</option>
                    <option value="slate">Slate</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#0f294a] px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                >
                  Add Sticky Note
                </button>
              </form>

              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {visibleNotes.map((note) => (
                  <article
                    key={note.id}
                    className={`rounded-2xl border p-5 space-y-3 ${STICKY_COLOR_STYLES[note.color]}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          {note.category}
                        </span>
                        <h3 className="font-display text-base font-bold text-[#0b192c]">
                          {note.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() => toggleNoteFlag(note.id, "pinned")}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] cursor-pointer"
                        >
                          {note.pinned ? "Pinned" : "Pin"}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleNoteFlag(note.id, "completed")}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] cursor-pointer"
                        >
                          {note.completed ? "Done" : "Complete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleNoteFlag(note.id, "archived")}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] cursor-pointer"
                        >
                          {note.archived ? "Restore" : "Archive"}
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700">{note.content}</p>
                    <p className="text-xs text-slate-500">{buildStickyBrief(note)}</p>
                    <div className="space-y-1.5 pt-2 border-t border-slate-200/80">
                      {note.extractedTasks.map((t, idx) => (
                        <div
                          key={`${note.id}-task-${idx}`}
                          className="flex items-center justify-between gap-2 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs"
                        >
                          <span>
                            {t.task} · <em>{t.dueHint}</em>
                          </span>
                          <button
                            type="button"
                            onClick={() => confirmTask(note.id, idx)}
                            className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-semibold cursor-pointer"
                          >
                            {t.confirmed ? "Confirmed" : "Confirm"}
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyNoteMessage(`Quick update: ${note.content}`)
                        }
                        className="text-xs font-semibold text-blue-800 hover:underline cursor-pointer"
                      >
                        {noteCopied ? "Copied Message" : "Copy as Clean Message"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : activeView === "mom" ? (
          <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-800">
                  Module 04 · Interactive Action Board, Outbound Exports & Handoff
                </span>
                <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0b192c]">
                  Meeting Minutes (MOM) Generator
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Select MOM template"
                  value={momTemplate}
                  onChange={(e) => {
                    const nextTpl = e.target.value as MomTemplate;
                    syncMomDraft(momNotes, nextTpl, momTitle, momAttendees, momDate, momVariant);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold"
                >
                  {MOM_TEMPLATES.map((tpl) => (
                    <option key={tpl} value={tpl}>
                      {tpl}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleSendMomActionsToStickyNotes}
                  className="rounded-xl bg-amber-100 border border-amber-300 px-3.5 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-200 cursor-pointer"
                >
                  Send Open Actions to Sticky Notes
                </button>
              </div>
            </div>

            <div className="floating-panel rounded-2xl p-4 sm:p-5 border-l-4 border-l-sky-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-800">
                  Signal & Accountability Brief
                </p>
                <p className="mt-0.5 text-sm font-semibold text-[#0b192c]">
                  {momBrief.briefSummary}
                </p>
                {momHandoffNotice && (
                  <p className="mt-1 text-xs font-semibold text-teal-800">
                    {momHandoffNotice}{" "}
                    <button
                      type="button"
                      onClick={() => setActiveView("notes")}
                      className="underline cursor-pointer"
                    >
                      Open Sticky Notes →
                    </button>
                  </p>
                )}
              </div>
              <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-900 shrink-0">
                Missing-Info Audit: {momBrief.auditCount} flag(s)
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5 floating-panel rounded-2xl p-5 sm:p-6 space-y-4 self-start">
                <h2 className="font-display text-lg font-bold text-[#0b192c]">
                  Rough Meeting Points
                </h2>
                <textarea
                  rows={5}
                  value={momNotes}
                  onChange={(e) =>
                    syncMomDraft(e.target.value, momTemplate, momTitle, momAttendees, momDate, momVariant)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={momTitle}
                    onChange={(e) =>
                      syncMomDraft(momNotes, momTemplate, e.target.value, momAttendees, momDate, momVariant)
                    }
                    placeholder="Meeting Title"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={momDate}
                    onChange={(e) =>
                      syncMomDraft(momNotes, momTemplate, momTitle, momAttendees, e.target.value, momVariant)
                    }
                    placeholder="Date (e.g. 15 Nov 2026)"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={momAttendees}
                    onChange={(e) =>
                      syncMomDraft(momNotes, momTemplate, momTitle, momAttendees, momDate, momVariant)
                    }
                    placeholder="Attendees"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>

                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Interactive Action Items ({momBrief.actionItems.length})
                    </h3>
                    <span className="text-[11px] text-slate-500">
                      Edit owner/due or toggle done
                    </span>
                  </div>

                  {momBrief.actionItems.map((act) => (
                    <div
                      key={act.id}
                      className={`rounded-xl border p-3 space-y-2 text-xs ${
                        Boolean(resolvedActionMap[`${act.owner ?? ""}-${act.task ?? ""}-${act.deadline ?? ""}`])
                          ? "bg-slate-50/70 border-slate-200 opacity-75"
                          : !String(act.owner ?? "").trim() || !String(act.deadline ?? "").trim()
                            ? "bg-amber-50/60 border-amber-200"
                            : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <input
                          type="text"
                          value={act.task}
                          onChange={(e) =>
                            setMomResolvedMap((prev) => ({ ...prev, [act.id]: !prev[act.id] }))
                          }
                          className={`w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium ${
                            Boolean(resolvedActionMap[`${act.owner ?? ""}-${act.task ?? ""}-${act.deadline ?? ""}`]) ? "line-through text-slate-500" : "text-[#0b192c]"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setMomResolvedMap((prev) => ({ ...prev, [act.id]: !prev[act.id] }))
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold shrink-0 cursor-pointer"
                        >
                          {Boolean(resolvedActionMap[`${act.owner ?? ""}-${act.task ?? ""}-${act.deadline ?? ""}`]) ? "Reopen" : "Mark Done"}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={act.owner}
                          onChange={(e) =>
                            setMomResolvedMap((prev) => ({ ...prev, [act.id]: !prev[act.id] }))
                          }
                          placeholder="Owner"
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px]"
                        />
                        <input
                          type="text"
                          value={act.deadline}
                          onChange={(e) =>
                            setMomResolvedMap((prev) => ({ ...prev, [act.id]: !prev[act.id] }))
                          }
                          placeholder="Due Date"
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-3.5 space-y-2">
                  <p className="text-xs font-bold text-amber-950">
                    Missing-Info Audit ({momBrief.auditCount})
                  </p>
                  {momBrief.auditCount === 0 ? (
                    <p className="text-xs text-teal-900">
                      All open owners, deadlines, and metadata fields are populated.
                    </p>
                  ) : (
                    <ul className="space-y-1.5 text-xs text-amber-950">
                      {momBrief.actionItems
                        .filter((a) => a.needsConfirmation && a.status !== "Done")
                        .map((a) => (
                          <li key={a.id}>
                            <strong>[Needs confirmation]</strong> {a.task} (Owner: {a.owner}, Due: {a.deadline})
                          </li>
                        ))}
                      {!momDate.trim() && (
                        <li>
                          <strong>[Needs confirmation]</strong> Meeting date not specified.
                        </li>
                      )}
                      {!momAttendees.trim() && (
                        <li>
                          <strong>[Needs confirmation]</strong> Participants / Attendees not specified.
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7 floating-panel rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        ["full", "Full MOM"],
                        ["email", "Stakeholder Email"],
                        ["teams", "Teams Drop"],
                        ["tracker", "Action Tracker"],
                      ] as const
                    ).map(([chKey, chLabel]) => (
                      <button
                        key={chKey}
                        type="button"
                        onClick={() => {
                          setMomChannel(chKey);
                          setManualMomOverride(null);
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                          momChannel === chKey
                            ? "bg-[#0f294a] text-white"
                            : "bg-white border border-slate-200 text-slate-700"
                        }`}
                      >
                        {chLabel}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRegenerateMom}
                      className="rounded-lg bg-[#0f294a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                    >
                      Regenerate
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyMom(momBrief.teamsDropText)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      Copy Owner Pings
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyMom(editableMom)}
                      className="rounded-lg bg-sky-50 border border-sky-200 px-3.5 py-1.5 text-xs font-semibold text-sky-900 cursor-pointer"
                    >
                      {momCopied ? "Copied" : "Copy View"}
                    </button>
                  </div>
                </div>

                <textarea
                  rows={15}
                  value={editableMom}
                  onChange={(e) => setEditableMom(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/50 p-3.5 font-mono text-xs sm:text-sm"
                />
              </div>
            </div>
          </section>
        ) : activeView === "email" ? (
          <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-800">
                  Module 03 · Minimal Input → Send-Ready Corporate Email
                </span>
                <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0b192c]">
                  Smart Email Assistant
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    "standard",
                    "polite",
                    "assertive",
                    "diplomatic",
                    "shorter",
                  ] as EmailTone[]
                ).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => syncEmailDraft(emailPrompt, tone, emailThread, emailVariant)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize cursor-pointer ${
                      emailTone === tone
                        ? "bg-[#0f294a] text-white"
                        : "bg-white border border-slate-200 text-slate-700"
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5 floating-panel rounded-2xl p-5 sm:p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#0b192c]">
                  Rough Input or Thread
                </h2>
                <textarea
                  rows={4}
                  value={emailPrompt}
                  onChange={(e) =>
                    syncEmailDraft(e.target.value, emailTone, emailThread, emailVariant)
                  }
                  placeholder='e.g. "2 days leave request"'
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
                />
                <textarea
                  rows={4}
                  value={emailThread}
                  onChange={(e) =>
                    syncEmailDraft(emailPrompt, emailTone, e.target.value, emailVariant)
                  }
                  placeholder="Optional pasted email thread..."
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
                />
              </div>

              <div className="lg:col-span-7 floating-panel rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#0b192c]">
                      Editable Email Brief
                    </h2>
                    <p className="text-[11px] font-medium text-indigo-800">
                      {emailBrief.briefSummary}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRegenerateEmail}
                      className="rounded-lg bg-[#0f294a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                    >
                      Regenerate
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyEmail(`Subject: ${activeSubject}\n\n${activeBody}`)
                      }
                      className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-900 cursor-pointer"
                    >
                      {emailCopied ? "Copied" : "Copy Email"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyEmail(emailBrief.teamsMessage)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold cursor-pointer"
                    >
                      Copy Teams Ping
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={activeSubject}
                    onChange={(e) => setManualSubject(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50/60 px-3.5 py-2 text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600">
                    Email Body
                  </label>
                  <textarea
                    rows={9}
                    value={activeBody}
                    onChange={(e) => setManualBody(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm leading-relaxed"
                  />
                </div>
              </div>
            </div>
          </section>
        ) : activeView === "holidays" ? (
          <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-800">
                  Module 02 · State Holidays & Leave Bridge Hacks
                </span>
                <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0b192c]">
                  State Holiday Calendar & Leave Planner
                </h1>
              </div>
            </div>

            <div className="floating-panel rounded-2xl p-5 border-l-4 border-l-teal-700">
              <p className="font-display text-base sm:text-lg font-bold text-[#0b192c]">
                {leavePlan.briefSummary}
              </p>
              <p className="mt-1 text-xs text-slate-500">{leavePlan.policyReminder}</p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-4 floating-panel rounded-2xl p-5 sm:p-6 space-y-4">
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
                >
                  {INDIAN_STATES_AND_UTS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={leaveYear}
                    onChange={(e) => setLeaveYear(Number(e.target.value))}
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
                  >
                    {[2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033].map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={leaveBalance}
                    onChange={(e) => setLeaveBalance(Number(e.target.value) || 0)}
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold"
                  />
                </div>

                <select
                  value={workweek}
                  onChange={(e) => setWorkweek(e.target.value as WorkweekPattern)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
                >
                  <option value="mon_fri_5day">5-day (Mon–Fri)</option>
                  <option value="alt_sat">Alternate Saturday off</option>
                  <option value="mon_sat_6day">6-day (Mon–Sat)</option>
                </select>
              </div>

              <div className="lg:col-span-8 space-y-6">
                <div className="floating-panel rounded-2xl p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h2 className="font-display text-lg font-bold text-[#0b192c]">
                      Monthly Long-Weekend & Leave Bridge Hacks ({leaveYear})
                    </h2>
                    <select
                      aria-label="Filter leave hacks by month"
                      value={selectedBridgeMonth}
                      onChange={(e) => setSelectedBridgeMonth(Number(e.target.value))}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                    >
                      <option value={0}>All Months (Jan–Dec)</option>
                      {[
                        "January",
                        "February",
                        "March",
                        "April",
                        "May",
                        "June",
                        "July",
                        "August",
                        "September",
                        "October",
                        "November",
                        "December",
                      ].map((mName, idx) => (
                        <option key={mName} value={idx + 1}>
                          {mName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {leavePlan.monthlyBridges
                      .filter(
                        (b) =>
                          selectedBridgeMonth === 0 || b.month === selectedBridgeMonth
                      )
                      .map((bridge) => (
                        <div
                          key={`${bridge.month}-${bridge.anchorHoliday}`}
                          className="rounded-xl border border-teal-100 bg-teal-50/50 p-4 space-y-1.5"
                        >
                          <p className="text-xs font-bold text-teal-900">
                            {bridge.monthLabel} · {bridge.leaveDaysRequired} Leave →{" "}
                            {bridge.consecutiveDaysOff} Days Off
                          </p>
                          <p className="text-xs text-slate-600">{bridge.hackTip}</p>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="floating-panel rounded-2xl p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-bold text-[#0b192c]">
                        {selectedState} Holiday Calendar ({leaveYear})
                      </h2>
                      <p className="text-xs text-slate-500">
                        Holidays appear directly inside each calendar date cell.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label="Select Indian state or UT for calendar"
                        value={selectedState}
                        onChange={(e) => setSelectedState(e.target.value)}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0b192c]"
                      >
                        {INDIAN_STATES_AND_UTS.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          setCalendarMonth((m) => (m <= 1 ? 12 : m - 1))
                        }
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
                      >
                        ←
                      </button>
                      <select
                        aria-label="Select calendar month"
                        value={calendarMonth}
                        onChange={(e) => setCalendarMonth(Number(e.target.value))}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0b192c]"
                      >
                        {[
                          "January",
                          "February",
                          "March",
                          "April",
                          "May",
                          "June",
                          "July",
                          "August",
                          "September",
                          "October",
                          "November",
                          "December",
                        ].map((mName, idx) => (
                          <option key={mName} value={idx + 1}>
                            {mName} {leaveYear}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          setCalendarMonth((m) => (m >= 12 ? 1 : m + 1))
                        }
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
                      >
                        →
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const monthIdx = calendarMonth - 1;
                    const firstWeekday = new Date(leaveYear, monthIdx, 1).getDay();
                    const daysInMonth = new Date(leaveYear, monthIdx + 1, 0).getDate();
                    const holidaysByDate = new Map<string, typeof leavePlan.holidays>();
                    for (const h of leavePlan.holidays) {
                      const list = holidaysByDate.get(h.date) ?? [];
                      list.push(h);
                      holidaysByDate.set(h.date, list);
                    }

                    const cells: Array<{ day: number | null; iso?: string }> = [];
                    for (let i = 0; i < firstWeekday; i++) cells.push({ day: null });
                    for (let d = 1; d <= daysInMonth; d++) {
                      const iso = `${leaveYear}-${String(calendarMonth).padStart(
                        2,
                        "0"
                      )}-${String(d).padStart(2, "0")}`;
                      cells.push({ day: d, iso });
                    }
                    while (cells.length % 7 !== 0) cells.push({ day: null });

                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                            (wd) => (
                              <div key={wd} className="py-1">
                                {wd}
                              </div>
                            )
                          )}
                        </div>

                        <div className="grid grid-cols-7 gap-1.5">
                          {cells.map((cell, idx) => {
                            if (!cell.day || !cell.iso) {
                              return (
                                <div
                                  key={`empty-${idx}`}
                                  className="min-h-[74px] rounded-xl bg-slate-50/50 border border-slate-100/70"
                                />
                              );
                            }
                            const dayHolidays = holidaysByDate.get(cell.iso) ?? [];
                            const isWeekend = idx % 7 === 0 || idx % 7 === 6;
                            return (
                              <div
                                key={cell.iso}
                                className={`min-h-[74px] rounded-xl border p-1.5 flex flex-col justify-between ${
                                  dayHolidays.length > 0
                                    ? "border-teal-300 bg-teal-50/70"
                                    : isWeekend
                                      ? "border-slate-100 bg-slate-50/70"
                                      : "border-slate-200/80 bg-white"
                                }`}
                              >
                                <span
                                  className={`text-xs font-semibold ${
                                    dayHolidays.length > 0
                                      ? "text-teal-950"
                                      : isWeekend
                                        ? "text-slate-400"
                                        : "text-slate-700"
                                  }`}
                                >
                                  {cell.day}
                                </span>
                                <div className="space-y-1">
                                  {dayHolidays.map((h) => (
                                    <div
                                      key={`${h.date}-${h.name}`}
                                      title={`${h.name} (${h.date})`}
                                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight truncate ${
                                        h.provisional
                                          ? "bg-amber-100 text-amber-900"
                                          : "bg-[#0f294a] text-white"
                                      }`}
                                    >
                                      {h.name}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </section>
        ) : activeView === "salary" ? (
          <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                  Module 01 · Deterministic Indian Payroll & Tax Engine
                </span>
                <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0b192c]">
                  CTC & In-Hand Salary Calculator
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">{([["capped_1800","Fixed ₹1,800"],["percent_of_basic","12% Basic"],["none","No PF"]] as const).map(([v,lbl]) => (<button key={v} type="button" onClick={() => setPfMode(v)} className={`rounded-md px-2.5 py-1.5 cursor-pointer ${pfMode===v?"bg-[#0f294a] text-white":"text-slate-700"}`}>{lbl}</button>))}</div>
                <button
                  type="button"
                  onClick={() => setMode("quick")}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer ${
                    mode === "quick"
                      ? "bg-[#0f294a] text-white"
                      : "bg-white border border-slate-200"
                  }`}
                >
                  Quick Mode
                </button>
                <button
                  type="button"
                  onClick={() => setMode("advanced")}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer ${
                    mode === "advanced"
                      ? "bg-[#0f294a] text-white"
                      : "bg-white border border-slate-200"
                  }`}
                >
                  Advanced Mode
                </button>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-800 cursor-pointer"
                >
                  {copied ? "Copied Brief" : "Copy Brief"}
                </button>
              </div>
            </div>

            <div className="floating-panel rounded-2xl p-5 border-l-4 border-l-blue-700">
              <p className="font-display text-base sm:text-lg font-bold text-[#0b192c]">
                {salaryResult.briefSummary}
              </p>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-blue-50/70 p-3.5">
                  <p className="text-xs text-blue-800">Est. Monthly In-Hand</p>
                  <p className="mt-1 font-display text-xl font-bold">
                    {formatINR(salaryResult.estimatedMonthlyInHand)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5">
                  <p className="text-xs text-slate-500">Monthly Gross</p>
                  <p className="mt-1 font-display text-lg font-bold">
                    {formatINR(salaryResult.monthlyGross)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5">
                  <p className="text-xs text-slate-500">
                    Monthly TDS ({taxRegime.toUpperCase()})
                  </p>
                  <p className="mt-1 font-display text-lg font-bold">
                    {formatINR(salaryResult.monthlyTds)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5">
                  <p className="text-xs text-slate-500">Annual Take-Home</p>
                  <p className="mt-1 font-display text-lg font-bold">
                    {formatINR(salaryResult.annualTakeHome)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5 floating-panel rounded-2xl p-5 sm:p-6 space-y-4">
                <label className="block text-xs font-semibold text-slate-700">
                  Annual CTC (₹)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={annualCtcText}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/[^\d]/g, "");
                    const normalized = digitsOnly.replace(/^0+(?=\d)/, "");
                    setAnnualCtcText(normalized);
                    setAnnualCtc(normalized === "" ? 0 : Number(normalized));
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold"
                />

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={salaryState}
                    onChange={(e) => setSalaryState(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
                  >
                    {INDIAN_STATES_AND_UTS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <select
                    value={taxRegime}
                    onChange={(e) => setTaxRegime(e.target.value as TaxRegime)}
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
                  >
                    <option value="new">New Tax Regime</option>
                    <option value="old">Old Tax Regime</option>
                  </select>
                </div>

                {mode === "advanced" && (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        value={basicPercent}
                        onChange={(e) => setBasicPercent(Number(e.target.value) || 0)}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        value={hraPercentOfBasic}
                        onChange={(e) =>
                          setHraPercentOfBasic(Number(e.target.value) || 0)
                        }
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={includeGratuity}
                        onChange={(e) => setIncludeGratuity(e.target.checked)}
                      />
                      Include Gratuity component
                    </label>
                  </div>
                )}
              </div>

              <div className="lg:col-span-7 space-y-6">
                <div className="floating-panel rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-bold text-[#0b192c]">
                      Monthly & Annual Breakdown
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowFullBreakup((prev) => !prev)}
                      className="text-xs font-semibold text-blue-700 cursor-pointer"
                    >
                      {showFullBreakup ? "Hide details" : "Show full breakup"}
                    </button>
                  </div>
                  {showFullBreakup && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-slate-50 p-3 flex justify-between">
                        <span>Monthly Basic</span>
                        <span className="font-semibold">
                          {formatINR(salaryResult.monthlyBasic)}
                        </span>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 flex justify-between">
                        <span>Monthly HRA</span>
                        <span className="font-semibold">
                          {formatINR(salaryResult.monthlyHra)}
                        </span>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 flex justify-between">
                        <span>Employee PF</span>
                        <span className="font-semibold">
                          -{formatINR(salaryResult.monthlyEmployeePf)}
                        </span>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 flex justify-between">
                        <span>Professional Tax ({salaryState})</span>
                        <span className="font-semibold">
                          -{formatINR(salaryResult.monthlyProfessionalTax)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="floating-panel rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-lg font-bold text-[#0b192c]">
                      Compare CTC & Hike Percentage
                    </h2>
                    <span className="rounded-full bg-blue-50 px-3 py-0.5 text-xs font-semibold text-blue-800">
                      Hike: {hikePercent >= 0 ? `+${hikePercent}%` : `${hikePercent}%`}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={compareCtc}
                    onChange={(e) => setCompareCtc(Number(e.target.value) || 0)}
                    className="mt-3 rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold"
                  />
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-50 p-3.5">
                      <p className="text-xs text-slate-500">Current Monthly In-Hand</p>
                      <p className="mt-1 font-display text-lg font-bold">
                        {formatINR(salaryResult.estimatedMonthlyInHand)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-teal-50/70 p-3.5">
                      <p className="text-xs text-teal-800">Target Monthly In-Hand</p>
                      <p className="mt-1 font-display text-lg font-bold">
                        {formatINR(comparedResult.estimatedMonthlyInHand)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : activeView === "shift" ? (
          <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            {(() => {
              const toMin = (t: string) => {
                const parts = t.split(":").map(Number);
                return (parts[0] || 0) * 60 + (parts[1] || 0);
              };
              const calcDay = (sStartStr: string, sEndStr: string, aInStr: string, aOutStr: string) => {
                const ss = toMin(sStartStr);
                let se = toMin(sEndStr);
                if (se <= ss) se += 1440;
                const ai = toMin(aInStr);
                let ao = toMin(aOutStr);
                if (ao < ai) ao += 1440;
                const unpaid = Math.max(0, breakMins - paidBreakMins);
                const schedMins = Math.max(0, se - ss - unpaid);
                const netMins = Math.max(0, ao - ai - unpaid);
                const otMins = Math.max(0, netMins - schedMins);
                const lateM = Math.max(0, ai - ss - graceMins);
                const earlyM = Math.max(0, se - ao);
                const ns = toMin(nightStart);
                const ne = toMin(nightEnd);
                let nMins = 0;
                for (let m = ai; m < ao; m += 15) {
                  const modM = m % 1440;
                  const inN = ns > ne ? modM >= ns || modM < ne : modM >= ns && modM < ne;
                  if (inN) nMins += 15;
                }
                return {
                  schedMins,
                  netMins,
                  otMins,
                  lateM,
                  earlyM,
                  netHrs: +(netMins / 60).toFixed(2),
                  otHrs: +(otMins / 60).toFixed(2),
                  nightHrs: +(nMins / 60).toFixed(2),
                };
              };

              const primary = calcDay(shiftStart, shiftEnd, actualIn, actualOut);
              const unpaidBreak = Math.max(0, breakMins - paidBreakMins);
              const hourlyGross = primary.schedMins > 0 ? monthlyGross / (workingDays * (primary.schedMins / 60)) : 0;
              const otRatePerHr = +(hourlyGross * 1.5).toFixed(0);
              const overtimePay = Math.round(primary.otHrs * otRatePerHr);
              const nightAllowance =
                primary.nightHrs >= 4
                  ? Math.max(500, Math.round(primary.nightHrs * nightRate))
                  : Math.round(primary.nightHrs * nightRate);

              const logRows = [
                { id: "d1", day: "Day 01 (Mon)", sStart: shiftStart, sEnd: shiftEnd, aIn: actualIn, aOut: actualOut },
                { id: "d2", day: "Day 02 (Tue)", sStart: shiftStart, sEnd: shiftEnd, aIn: actualIn, aOut: actualOut },
                { id: "d3", day: "Day 03 (Wed)", sStart: shiftStart, sEnd: shiftEnd, aIn: shiftStart, aOut: shiftEnd },
              ].map((r) => ({ ...r, ...calcDay(r.sStart, r.sEnd, r.aIn, r.aOut) }));

              const logTotalHrs = +logRows.reduce((acc, r) => acc + r.netHrs, 0).toFixed(2);
              const logTotalOt = +logRows.reduce((acc, r) => acc + r.otHrs, 0).toFixed(2);
              const logTotalNight = +logRows.reduce((acc, r) => acc + r.nightHrs, 0).toFixed(2);
              const logLateCount = logRows.filter((r) => r.lateM > 0).length;

              const daysInMonth = Math.max(workingDays, 30);
              const presentDays = workingDays;
              const paidLeaveDays = 1;
              const weeklyOffDays = Math.max(0, daysInMonth - workingDays - paidLeaveDays);
              const lateSlabLop = Math.floor(logLateCount / 3) * 0.5;
              const totalLopDays = +lateSlabLop.toFixed(2);
              const payableDays = Math.max(0, +(daysInMonth - totalLopDays).toFixed(2));
              const perDayGross = daysInMonth > 0 ? monthlyGross / daysInMonth : 0;
              const estimatedLop = Math.round(perDayGross * totalLopDays);
              const netEstimatedPay = Math.max(0, Math.round(monthlyGross - estimatedLop + overtimePay + nightAllowance));

              const handleExportShiftCsv = () => {
                const header = "Day,ShiftStart,ShiftEnd,ActualIn,ActualOut,NetHours,OvertimeHours,NightHours,LateMins\n";
                const rows = logRows
                  .map((r) => `${r.day},${r.sStart},${r.sEnd},${r.aIn},${r.aOut},${r.netHrs},${r.otHrs},${r.nightHrs},${r.lateM}`)
                  .join("\n");
                const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "corporatebuddy-shift-attendance.csv";
                a.click();
                URL.revokeObjectURL(url);
              };

              return (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Module 08 · BPO & Rotational Shift Attendance + LOP</span>
                      <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0b192c]">Shift & Attendance Tracker</h1>
                      <p className="mt-1 text-xs text-slate-600">Overnight shift wraps, paid/unpaid breaks, grace periods, company night-shift rules, and monthly payable/LOP calculation.</p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button type="button" onClick={handleExportShiftCsv} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 cursor-pointer">Export CSV</button>
                      <button type="button" onClick={() => setActiveView("home")} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">Back to Home</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <span className="text-xs font-semibold text-slate-600 mr-1">Shift Presets:</span>
                    <button type="button" onClick={() => { setShiftStart("06:00"); setShiftEnd("15:00"); setActualIn("06:00"); setActualOut("15:15"); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-400 cursor-pointer">Morning (06:00–15:00)</button>
                    <button type="button" onClick={() => { setShiftStart("09:00"); setShiftEnd("18:00"); setActualIn("09:05"); setActualOut("18:30"); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-400 cursor-pointer">General (09:00–18:00)</button>
                    <button type="button" onClick={() => { setShiftStart("14:30"); setShiftEnd("23:30"); setActualIn("14:35"); setActualOut("23:45"); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-400 cursor-pointer">Rotational / US Shift (14:30–23:30)</button>
                    <button type="button" onClick={() => { setShiftStart("22:00"); setShiftEnd("07:00"); setActualIn("22:00"); setActualOut("07:30"); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-400 cursor-pointer">Overnight Night Shift (22:00–07:00)</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                    <label className="text-xs font-semibold text-slate-600 space-y-1"><span>Shift Start</span><input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
                    <label className="text-xs font-semibold text-slate-600 space-y-1"><span>Shift End</span><input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
                    <label className="text-xs font-semibold text-slate-600 space-y-1"><span>Actual Login</span><input type="time" value={actualIn} onChange={(e) => setActualIn(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
                    <label className="text-xs font-semibold text-slate-600 space-y-1"><span>Actual Logout</span><input type="time" value={actualOut} onChange={(e) => setActualOut(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
                    <label className="text-xs font-semibold text-slate-600 space-y-1"><span>Total Break (mins)</span><input type="number" value={breakMins} onChange={(e) => setBreakMins(Number(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
                    <label className="text-xs font-semibold text-slate-600 space-y-1"><span>Paid Break Allowance (mins)</span><input type="number" value={paidBreakMins} onChange={(e) => setPaidBreakMins(Number(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
                    <label className="text-xs font-semibold text-slate-600 space-y-1"><span>Grace Period (mins)</span><input type="number" value={graceMins} onChange={(e) => setGraceMins(Number(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
                    <label className="text-xs font-semibold text-slate-600 space-y-1"><span>Monthly Gross Salary (₹)</span><input type="number" value={monthlyGross} onChange={(e) => setMonthlyGross(Number(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
                    <label className="text-xs font-semibold text-slate-600 space-y-1"><span>Night Window Start</span><input type="time" value={nightStart} onChange={(e) => setNightStart(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
                    <label className="text-xs font-semibold text-slate-600 space-y-1"><span>Night Window End</span><input type="time" value={nightEnd} onChange={(e) => setNightEnd(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
                    <label className="text-xs font-semibold text-slate-600 space-y-1"><span>Night Rate (₹/hr)</span><input type="number" value={nightRate} onChange={(e) => setNightRate(Number(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
                    <label className="text-xs font-semibold text-slate-600 space-y-1"><span>Working Days / Month</span><input type="number" value={workingDays} onChange={(e) => setWorkingDays(Number(e.target.value) || 1)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-medium text-slate-500">Actual Working Hours & OT</p>
                      <p className="mt-1 font-display text-xl font-bold text-slate-900">{primary.netHrs}h</p>
                      <p className="mt-1 text-xs text-emerald-700 font-medium">Overtime: {primary.otHrs}h (₹{overtimePay.toLocaleString("en-IN")})</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-medium text-slate-500">Night-Shift Hours & Allowance</p>
                      <p className="mt-1 font-display text-xl font-bold text-indigo-700">{primary.nightHrs}h · ₹{nightAllowance.toLocaleString("en-IN")}</p>
                      <p className="mt-1 text-xs text-slate-500">Window {nightStart}–{nightEnd} ({primary.nightHrs >= 4 ? "≥4h shift rule applied" : "hourly rate applied"})</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-medium text-slate-500">Late Login & Early Logout</p>
                      <p className="mt-1 font-display text-xl font-bold text-amber-700">{primary.lateM}m late · {primary.earlyM}m early</p>
                      <p className="mt-1 text-xs text-slate-500">After {graceMins}m grace · Unpaid break: {unpaidBreak}m</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-medium text-slate-500">Payable Days & Est. LOP</p>
                      <p className="mt-1 font-display text-xl font-bold text-slate-900">{payableDays} / {daysInMonth} days</p>
                      <p className="mt-1 text-xs text-rose-700 font-medium">Est. LOP: ₹{estimatedLop.toLocaleString("en-IN")} ({totalLopDays}d) · Net Est.: ₹{netEstimatedPay.toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-display text-base font-bold text-[#0b192c]">Multi-Day Shift Log Snapshot</h2>
                      <span className="text-xs text-slate-500">3-day roll-up: {logTotalHrs}h net · {logTotalOt}h OT · {logTotalNight}h night · {logLateCount} late</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="py-2 pr-3">Day</th>
                            <th className="py-2 pr-3">Shift</th>
                            <th className="py-2 pr-3">Punch</th>
                            <th className="py-2 pr-3">Net Hrs</th>
                            <th className="py-2 pr-3">OT Hrs</th>
                            <th className="py-2 pr-3">Night Hrs</th>
                            <th className="py-2">Late</th>
                          </tr>
                        </thead>
                        <tbody>
                          {logRows.map((row) => (
                            <tr key={row.id} className="border-b border-slate-100 text-slate-800">
                              <td className="py-2 pr-3 font-medium">{row.day}</td>
                              <td className="py-2 pr-3">{row.sStart}-{row.sEnd}</td>
                              <td className="py-2 pr-3">{row.aIn}-{row.aOut}</td>
                              <td className="py-2 pr-3">{row.netHrs}h</td>
                              <td className="py-2 pr-3 text-emerald-700">{row.otHrs}h</td>
                              <td className="py-2 pr-3 text-indigo-700">{row.nightHrs}h</td>
                              <td className="py-2 text-amber-700">{row.lateM}m</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                      <h2 className="font-display text-base font-bold text-[#0b192c]">Monthly Attendance & Payable Days Breakdown</h2>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Present Days</p><p className="mt-1 font-bold text-slate-900">{presentDays}d</p></div>
                        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Paid Leave</p><p className="mt-1 font-bold text-slate-900">{paidLeaveDays}d</p></div>
                        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Weekly Offs</p><p className="mt-1 font-bold text-slate-900">{weeklyOffDays}d</p></div>
                        <div className="rounded-xl bg-rose-50 p-3"><p className="text-xs text-rose-700">Total LOP</p><p className="mt-1 font-bold text-rose-800">{totalLopDays}d</p></div>
                      </div>
                      <p className="text-xs text-slate-600">Scheduled shift: {(primary.schedMins / 60).toFixed(2)}h net/day · Per-day gross base: ₹{Math.round(perDayGross).toLocaleString("en-IN")}/day across {daysInMonth} calendar days.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2.5">
                      <h2 className="font-display text-base font-bold text-[#0b192c]">Company Shift & LOP Rule Summary</h2>
                      <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                        <li><strong className="text-slate-800">Overnight Wrap:</strong> Automatically adds 24h (1,440m) when shift end or logout crosses midnight.</li>
                        <li><strong className="text-slate-800">Break & Grace:</strong> Deducts unpaid break ({unpaidBreak}m) from raw punch span and applies {graceMins}m grace before flagging late login.</li>
                        <li><strong className="text-slate-800">Night-Shift Window:</strong> Measures overlap inside {nightStart}–{nightEnd}; ≥4h overlap applies company shift allowance floor or ₹{nightRate}/hr.</li>
                        <li><strong className="text-slate-800">Late-Slab LOP:</strong> Tracks late instances against a 3-late = 0.5d LOP slab and computes payable days and estimated LOP.</li>
                      </ul>
                    </div>
                  </div>
                </>
              );
            })()}
          </section>
        ) : activeView === "presentos" ? (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
  <button
    type="button"
    onClick={() => setPresentosUseGemini((v) => !v)}
    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
      presentosUseGemini
        ? "border-violet-600 bg-violet-50 text-violet-900"
        : "border-slate-300 bg-slate-100 text-slate-600"
    }`}
  >
    Gemini AI: {presentosUseGemini ? "ON" : "OFF"}
  </button>
  {presentosSpec && (
     <>
       <button
         type="button"
         disabled={presentosRefining}
         onClick={() => {
           setPresentosRefining(true);
           setPresentosProgress(15);
           setPresentosProgressStage("Connecting to Gemini...");
           const __p1 = window.setTimeout(() => { setPresentosProgress(45); setPresentosProgressStage("Authoring 6-slide structure..."); }, 400);
           const __p2 = window.setTimeout(() => { setPresentosProgress(75); setPresentosProgressStage("Writing KPIs, tables & notes..."); }, 1100);
           const __p3 = window.setTimeout(() => { setPresentosProgress(90); setPresentosProgressStage("Finalizing deck..."); }, 1900);
           void refineSpecWithGemini(presentosSpec, presentosPrompt || presentosSpec.title, presentosTemplate).then((res) => {
             window.clearTimeout(__p1);
             window.clearTimeout(__p2);
             window.clearTimeout(__p3);
             setPresentosProgress(100);
             setPresentosProgressStage(res.aiRefined ? "Complete" : "Fallback ready");
             setPresentosSpec(res.spec);
             setPresentosAiRefined(res.aiRefined);
             setPresentosStatusReason(res.reason || "");
             setPresentosRefining(false);
           });
         }}
         className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-violet-500 cursor-pointer"
       >
         {presentosRefining ? "Refining with Gemini..." : "Refine with Gemini"}
       </button>
       {presentosRefining && (
         <span className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5">
           <span className="h-2 w-28 sm:w-36 overflow-hidden rounded-full bg-violet-200">
             <span
               className="block h-full rounded-full bg-violet-700 transition-all duration-300"
               style={{ width: `${Math.min(100, Math.max(10, presentosProgress))}%` }}
             />
           </span>
           <span className="text-[11px] font-semibold tabular-nums text-violet-900">
             {presentosProgress}%
           </span>
           <span className="hidden md:inline text-[11px] text-violet-800">
             {presentosProgressStage}
           </span>
         </span>
       )}
     </>
   )}
  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
    {presentosRefining
      ? "Gemini Refining..."
      : presentosAiRefined
      ? "Gemini AI"
      : presentosStatusReason
      ? `Smart Blueprint (${presentosStatusReason})`
      : "Smart Blueprint"}
  </span>
</div>
          
<section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0b192c]">PresentOS</h1>
                <p className="text-sm text-slate-600">One prompt in — executive slide layouts, KPIs, tables, speaker notes & editable .pptx out.</p>
              </div>
              <div className="flex items-center gap-2">
                {presentosSpec && (
                  <button type="button" onClick={() => { void downloadPresentOSPptx(presentosSpec, presentosTemplate); }} className="rounded-xl bg-[#0f294a] px-4 py-2 text-xs font-semibold text-white hover:bg-violet-800 cursor-pointer">
                    Download Editable .pptx
                  </button>
                )}
                <a href="https://slidesgo.com/business" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-violet-400">100+ PPT Templates ↗</a>
                  <button type="button" onClick={() => setActiveView("home")} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  Back
                </button>
              </div>
            </div>
            <div className="col-span-full w-full rounded-2xl border border-slate-200 bg-white p-5 space-y-4 mb-6">
              <textarea rows={3} value={presentosPrompt} onChange={(e) => setPresentosPrompt(e.target.value)} placeholder="What do you need to present? e.g. Q4 operations review with SLA recovery, backlog reduction & owner action plan..." className="w-full rounded-xl border border-slate-200 p-3.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <input type="file" accept=".xlsx,.xls,.csv,.txt,.md" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const lower = f.name.toLowerCase(); const rep = (lower.endsWith(".xlsx") || lower.endsWith(".xls")) ? analyzeWorkbookBuffer(f.name, await f.arrayBuffer()) : analyzeDelimitedText(f.name, await f.text()); const nextSpec = generateFromSinglePrompt(presentosPrompt || f.name, presentosTemplate, [{ id: "f-1", name: f.name, kind: "xlsx", content: rep.citations.join(", "), verified: true }]); const grounded = applyWorkbookIntelligenceToSpec(nextSpec, rep); setPresentosSpec(grounded); setPresentosSelectedSlideIdx(0); }} className="text-xs text-slate-600" />
                <button type="button" onClick={() => { const spec = generateFromSinglePrompt(presentosPrompt, presentosTemplate); setPresentosSpec(spec); setPresentosSelectedSlideIdx(0); setPresentosAiRefined(false); void refineSpecWithGemini(spec, presentosPrompt, presentosTemplate).then((res) => { setPresentosSpec(res.spec); setPresentosAiRefined(res.aiRefined); }); }} className="rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 cursor-pointer">
                  Generate Executive Deck
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-semibold text-slate-500">Theme:</span>
                {PRESENTOS_TEMPLATES.map((tpl) => (
                  <button key={tpl.id} type="button" onClick={() => setPresentosTemplate(tpl.id)} title={tpl.description} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${presentosTemplate === tpl.id ? "border-violet-700 bg-violet-50 text-violet-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>
            {presentosSpec && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Deck Structure ({presentosSpec.slides.length})</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{presentosAiRefined ? "AI Refined" : presentosSpec.isGeneralDraft ? "Draft" : "Grounded"}</span>
                  </div>
                  {presentosSpec.slides.map((sl, idx) => (
                    <button key={sl.id} type="button" onClick={() => setPresentosSelectedSlideIdx(idx)} className={`w-full text-left rounded-xl border p-3 cursor-pointer ${presentosSelectedSlideIdx === idx ? "border-violet-600 bg-violet-50/60" : "border-slate-200"}`}>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span>0{idx + 1}</span>
                        <span className="uppercase">{sl.layoutKind || "slide"}</span>
                      </div>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900 truncate">{sl.title}</p>
                    </button>
                  ))}
                </div>
                <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                  {(() => {
                    const activeSlide = presentosSpec.slides[presentosSelectedSlideIdx] || presentosSpec.slides[0];
                    const activeTpl = PRESENTOS_TEMPLATES.find((t) => t.id === presentosTemplate) || PRESENTOS_TEMPLATES[0];
                    if (!activeSlide) return null;
                    return (
                      <div className="space-y-4">
                        <div className="rounded-xl p-4 border-l-4 min-w-0 overflow-hidden" style={{ backgroundColor: `#${activeTpl.bgHex}`, borderLeftColor: `#${activeTpl.accentHex}`, color: `#${activeTpl.textHex}` }}>
                          <span className="text-[11px] uppercase tracking-wider opacity-75">Slide {presentosSelectedSlideIdx + 1} of {presentosSpec.slides.length} · {activeTpl.name}</span>
                          <input type="text" value={activeSlide.title} onChange={(e) => { const nextTitle = e.target.value; setPresentosSpec((prev) => prev ? { ...prev, slides: prev.slides.map((item, i) => i === presentosSelectedSlideIdx ? { ...item, title: nextTitle } : item) } : prev); }} className="mt-1 w-full min-w-0 bg-transparent font-display text-lg sm:text-xl font-bold break-words focus:outline-none" />
                        </div>
                        {activeSlide.executiveTakeaway && (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-800">
                            {activeSlide.executiveTakeaway}
                          </div>
                        )}
                        {activeSlide.kpiHighlights && activeSlide.kpiHighlights.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {activeSlide.kpiHighlights.map((kpi, ki) => (
                              <div key={ki} className="rounded-xl border border-slate-200 bg-white p-3">
                                <p className="text-[11px] text-slate-500">{kpi.label}</p>
                                <p className="mt-0.5 font-display text-base font-bold text-slate-900">{kpi.value}</p>
                                {kpi.delta && <p className="text-[11px] font-semibold text-violet-700">{kpi.delta}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="space-y-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Key Points (Click to Edit)</p>
                          {activeSlide.keyPoints.map((kp, kIdx) => (
                            <input key={kIdx} type="text" value={kp} onChange={(e) => { const nextKp = e.target.value; setPresentosSpec((prev) => prev ? { ...prev, slides: prev.slides.map((item, i) => i === presentosSelectedSlideIdx ? { ...item, keyPoints: item.keyPoints.map((oldKp, oi) => oi === kIdx ? nextKp : oldKp) } : item) } : prev); }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
                          ))}
                        </div>
                        {activeSlide.structuredTable && activeSlide.structuredTable.headers.length > 0 && (
                          <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-900 text-white">
                                <tr>{activeSlide.structuredTable.headers.map((h, hi) => (<th key={hi} className="px-3 py-2 font-semibold">{h}</th>))}</tr>
                              </thead>
                              <tbody>
                                {activeSlide.structuredTable.rows.map((row, ri) => (
                                  <tr key={ri} className="border-t border-slate-200">{row.map((cell, ci) => (<td key={ci} className="px-3 py-2 text-slate-700">{cell}</td>))}</tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {activeSlide.speakerNotes && (
                          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Speaker Notes</p>
                            <p className="whitespace-pre-line text-xs text-slate-700">{activeSlide.speakerNotes}</p>
                          </div>
                        )}
                        {activeSlide.sourceCitations && activeSlide.sourceCitations.length > 0 && (
                          <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">Sources: {activeSlide.sourceCitations.join(" · ")}</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </section>
    </>
  ) : (          <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-6 space-y-5">
                <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0b192c]">
                  Your Corporate Life.{" "}
                  <span className="text-blue-700">Simplified.</span>
                </h1>
                <p className="text-base text-slate-600">
                  Seven focused tools for salary, leaves, emails, MOMs, notes,
                  documents, and Indian tax deadlines.
                </p>
                <form
                  onSubmit={handleQuickStart}
                  className="floating-panel rounded-2xl p-2 flex flex-col sm:flex-row gap-2"
                >
                  <input
                    type="text"
                    value={quickPrompt}
                    onChange={(e) => setQuickPrompt(e.target.value)}
                    placeholder='Try "14 LPA Karnataka", "leave hacks", or "2 days leave request"...'
                    className="flex-1 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-[#0f294a] px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
                  >
                    Start Brief
                  </button>
                </form>
              </div>

              <div className="lg:col-span-6 floating-panel rounded-2xl p-6 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                  Quick Snapshot · {selectedState}
                </p>
                <p className="font-display text-xl font-bold text-[#0b192c]">
                  {formatINR(annualCtc)} CTC →{" "}
                  {formatINR(salaryResult.estimatedMonthlyInHand)}/mo est. in-hand
                </p>
                <p className="text-xs text-slate-600">{leavePlan.briefSummary}</p>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              {([
                ["all", "All Tools"],
                ["pay", "Pay & Tax"],
                ["docs", "Documents & AI"],
                ["ops", "Daily Ops"],
              ] as const).map(([catKey, catLabel]) => (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setModuleCategoryFilter(catKey)}
                  className={
                    moduleCategoryFilter === catKey
                      ? "rounded-full bg-[#0f294a] px-3.5 py-1.5 text-xs font-semibold text-white"
                      : "rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:border-[#0f294a]"
                  }
                >
                  {catLabel}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {MODULES.filter((mod) => {
                if (moduleCategoryFilter === "all") return true;
                const id = String(mod.id || "");
                if (moduleCategoryFilter === "pay") return id.includes("salary") || id.includes("tax");
                if (moduleCategoryFilter === "docs") return id.includes("document") || id.includes("presentos") || id.includes("growthos") || id.includes("changeos") || id.includes("email") || id.includes("meeting");
                return true;
              }).map((mod) => (
                <article
                  key={mod.id}
                  onClick={() => handleOpenModule(mod)}
                  className="corporate-card rounded-2xl p-5 flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-400">
                        {mod.number}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${mod.accent}`}
                      >
                        {mod.tag}
                      </span>
                    </div>
                    <h3 className="mt-4 font-display text-lg font-bold text-[#0b192c]">
                      {mod.title}
                    </h3>
                    <p className="mt-2 text-xs text-slate-500">
                      Input: <span className="text-slate-700">{mod.minimalInput}</span>
                    </p>
                    <p className="mt-2 text-sm text-slate-600">{mod.briefOutput}</p>
                  </div>
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-700">
                    <span>Open Module</span>
                    <span>→</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
          </main>
        </div>
        <SiteFooter onSelectView={setActiveView} />
      </div>
  );
}






