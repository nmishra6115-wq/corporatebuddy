import type { PresentOSSpec, PresentOSOutlineSlide } from "./presentosEngine";

export interface PresentOSHistoryStack {
  past: PresentOSSpec[];
  present: PresentOSSpec;
  future: PresentOSSpec[];
}

export interface PresentOSAuditFinding {
  severity: "critical" | "warning" | "suggestion";
  slideNumber: number | null;
  issue: string;
  fixHint: string;
}

export interface PresentOSAuditReport {
  score: number;
  findings: PresentOSAuditFinding[];
}

export function createHistoryStack(initial: PresentOSSpec): PresentOSHistoryStack {
  return { past: [], present: initial, future: [] };
}

export function pushHistory(stack: PresentOSHistoryStack, next: PresentOSSpec): PresentOSHistoryStack {
  return {
    past: [...stack.past.slice(-19), stack.present],
    present: next,
    future: [],
  };
}

export function undoHistory(stack: PresentOSHistoryStack): PresentOSHistoryStack {
  if (stack.past.length === 0) return stack;
  const previous = stack.past[stack.past.length - 1];
  return {
    past: stack.past.slice(0, -1),
    present: previous,
    future: [stack.present, ...stack.future],
  };
}

export function redoHistory(stack: PresentOSHistoryStack): PresentOSHistoryStack {
  if (stack.future.length === 0) return stack;
  const next = stack.future[0];
  return {
    past: [...stack.past, stack.present],
    present: next,
    future: stack.future.slice(1),
  };
}

export function addOutlineSlide(spec: PresentOSSpec, title?: string): PresentOSSpec {
  const nextNum = spec.slides.length + 1;
  const newSlide: PresentOSOutlineSlide = {
    id: `slide-custom-${Date.now()}`,
    slideNumber: nextNum,
    title: (title && title.trim()) || `Action Plan & Next Steps (${nextNum})`,
    purpose: "Capture concrete decisions, owners, and target dates",
    keyPoints: ["Owner: [Assign owner]", "Target date: [Assign date]", "Verification metric: [Define check]"],
    visualSuggestion: "Action Plan Table",
    missingInfo: ["Assigned owners and target dates"],
    sourceGrounded: false,
  };
  return {
    ...spec,
    slides: [...spec.slides, newSlide].map((s, idx) => ({ ...s, slideNumber: idx + 1 })),
  };
}

export function removeOutlineSlide(spec: PresentOSSpec, index: number): PresentOSSpec {
  if (spec.slides.length <= 1 || index < 0 || index >= spec.slides.length) return spec;
  const filtered = spec.slides.filter((_, idx) => idx !== index).map((s, idx) => ({ ...s, slideNumber: idx + 1 }));
  return { ...spec, slides: filtered };
}

export function applyNaturalLanguageEdit(spec: PresentOSSpec, instruction: string): PresentOSSpec {
  const q = instruction.trim().toLowerCase();
  if (!q) return spec;
  if (q.includes("conclusion") || q.includes("action tracker") || q.includes("action plan")) {
    return addOutlineSlide(spec, q.includes("action") ? "Action Tracker & Owners" : "Conclusion & Next Steps");
  }
  const countMatch = q.match(/(?:reduce|trim|limit|make it|set to)\s+(?:to\s+)?(\d+)\s+slides?/);
  if (countMatch) {
    const target = Math.max(3, Math.min(12, Number(countMatch[1]) || spec.slides.length));
    const trimmed = spec.slides.slice(0, target).map((s, idx) => ({ ...s, slideNumber: idx + 1 }));
    return { ...spec, slides: trimmed };
  }
  if (q.includes("senior management") || q.includes("executive")) {
    return {
      ...spec,
      audience: "Senior Management",
      tone: "Executive, concise, decision-oriented",
      slides: spec.slides.map((s) => ({
        ...s,
        keyPoints: s.keyPoints.slice(0, 3),
      })),
    };
  }
  return spec;
}

export function auditPresentOSSpec(spec: PresentOSSpec): PresentOSAuditReport {
  const findings: PresentOSAuditFinding[] = [];
  if (!spec.title.trim()) {
    findings.push({ severity: "critical", slideNumber: null, issue: "Missing presentation title.", fixHint: "Enter a clear deck title." });
  }
  if (spec.isGeneralDraft) {
    findings.push({ severity: "warning", slideNumber: null, issue: "Deck is marked as a General Draft without verified source material.", fixHint: "Upload a CSV/Excel report or paste verified source notes before sharing externally." });
  }
  spec.slides.forEach((sl, idx) => {
    const num = idx + 1;
    if (!sl.title.trim()) {
      findings.push({ severity: "critical", slideNumber: num, issue: "Slide title is empty.", fixHint: "Add a concise action- or topic-oriented slide title." });
    }
    if (sl.keyPoints.length > 4) {
      findings.push({ severity: "suggestion", slideNumber: num, issue: `Slide has ${sl.keyPoints.length} bullets, which may feel dense.`, fixHint: "Trim to 3–4 key points and move detail to a table or speaker notes." });
    }
    if (!sl.sourceGrounded && !spec.isGeneralDraft) {
      findings.push({ severity: "warning", slideNumber: num, issue: "Slide is not linked to verified source citations.", fixHint: "Attach source citations or mark unverified items explicitly." });
    }
    if (sl.missingInfo.length > 0) {
      findings.push({ severity: "suggestion", slideNumber: num, issue: `Open items noted: ${sl.missingInfo.join("; ")}.`, fixHint: "Confirm owners, dates, or source numbers before final export." });
    }
  });
  const penalty = findings.reduce((acc, f) => acc + (f.severity === "critical" ? 25 : f.severity === "warning" ? 12 : 5), 0);
  return { score: Math.max(20, 100 - penalty), findings };
}