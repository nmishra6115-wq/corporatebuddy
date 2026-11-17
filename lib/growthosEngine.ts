export type GrowthTone = "professional" | "confident" | "concise";

export interface AppraisalQuestionItem {
  id: string;
  question: string;
  charLimit?: number;
  wordLimit?: number;
}

export interface DraftAnswerItem {
  questionId: string;
  question: string;
  answer: string;
  tone: GrowthTone;
  missingEvidenceNote?: string;
  charLimit?: number;
  wordLimit?: number;
}

const DEFAULT_QUESTIONS = [
  "What were your key achievements?",
  "How did you contribute to business objectives?",
  "What challenges did you overcome?",
  "What areas require improvement?",
  "What are your goals for the next performance cycle?",
];

export function parseAppraisalQuestions(rawInput: string): AppraisalQuestionItem[] {
  const cleaned = rawInput.trim();
  if (!cleaned) {
    return DEFAULT_QUESTIONS.map((q, idx) => ({
      id: `q-${idx + 1}`,
      question: q,
    }));
  }

  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);

  return lines.map((line, idx) => {
    const charMatch = line.match(/\(?\b(?:max\s*)?(\d{2,5})\s*(?:chars?|characters?)\b\)?/i);
    const wordMatch = line.match(/\(?\b(?:max\s*)?(\d{2,4})\s*words?\b\)?/i);
    return {
      id: `q-${idx + 1}-${Date.now()}`,
      question: line,
      charLimit: charMatch ? Number(charMatch[1]) : undefined,
      wordLimit: wordMatch ? Number(wordMatch[1]) : undefined,
    };
  });
}

function splitAchievements(rawAchievements: string): string[] {
  return rawAchievements
    .split(/\r?\n|(?<=\.)\s+|;\s*/)
    .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter((s) => s.length > 3);
}

function cleanSentence(s: string): string {
  const trimmed = s.trim().replace(/[.!?]+$/, "");
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function hasNumbers(text: string): boolean {
  return /\b\d+(?:\.\d+)?%?\b/.test(text);
}

export function generateGrowthAnswers(
  questions: AppraisalQuestionItem[],
  rawAchievements: string,
  tone: GrowthTone = "professional"
): DraftAnswerItem[] {
  const items = splitAchievements(rawAchievements);
  const formattedItems = items.map(cleanSentence).filter(Boolean);
  const hasQuantified = formattedItems.some(hasNumbers);

  return questions.map((q, index) => {
    const lowerQ = q.question.toLowerCase();
    const primary = formattedItems[index % Math.max(1, formattedItems.length)] || "";
    const secondary =
      formattedItems.length > 1
        ? formattedItems[(index + 1) % formattedItems.length]
        : "";

    let body = "";
    let missingEvidenceNote: string | undefined;

    if (!primary) {
      missingEvidenceNote =
        "No achievement notes added yet. Add rough work notes above so answers stay grounded in your actual work.";
      body = `During this review cycle, I focused on fulfilling my core responsibilities for "${q.question.replace(/\?$/, "")}" while coordinating reliably with teammates.`;
    } else if (lowerQ.includes("improvement") || lowerQ.includes("weakness") || lowerQ.includes("develop")) {
      body =
        tone === "concise"
          ? `Focusing on structured documentation and earlier escalation milestones to build on ${primary.toLowerCase()}.`
          : tone === "confident"
          ? `Proactively strengthening end-to-end ownership and structured tracking around ${primary.toLowerCase()} so recurring bottlenecks are caught earlier.`
          : `An area I am actively developing is building even tighter upfront tracking and handoff clarity around ${primary.toLowerCase()}, ensuring smoother execution across dependencies.`;
      if (!hasQuantified) {
        missingEvidenceNote =
          "Optional: Add a specific workflow or turnaround example if you want to reference concrete progress.";
      }
    } else if (lowerQ.includes("goal") || lowerQ.includes("next")) {
      body =
        tone === "concise"
          ? `Build on ${primary.toLowerCase()} by standardising repeatable workflows and supporting team execution.`
          : tone === "confident"
          ? `Drive higher consistency and broader team impact by scaling ${primary.toLowerCase()} into repeatable operational practices.`
          : `For the next performance cycle, I aim to build on ${primary.toLowerCase()} by standardising key steps, collaborating closely with stakeholders, and delivering dependable outcomes.`;
    } else if (lowerQ.includes("challenge") || lowerQ.includes("overcome")) {
      const pair = secondary && secondary !== primary ? ` alongside ${secondary.toLowerCase()}` : "";
      body =
        tone === "concise"
          ? `Addressed operational pressures by prioritising ${primary.toLowerCase()}${pair}.`
          : tone === "confident"
          ? `Navigated competing priorities effectively by focusing on ${primary.toLowerCase()}${pair} and keeping execution on track.`
          : `When handling competing demands, I stayed focused on ${primary.toLowerCase()}${pair}, maintaining steady communication and reliable follow-through.`;
    } else if (lowerQ.includes("leadership") || lowerQ.includes("team")) {
      const pair = secondary && secondary !== primary ? ` and ${secondary.toLowerCase()}` : "";
      body =
        tone === "concise"
          ? `Supported team alignment through ${primary.toLowerCase()}${pair}.`
          : tone === "confident"
          ? `Contributed directly to team capability and delivery by driving ${primary.toLowerCase()}${pair}.`
          : `I contributed to team performance by supporting colleagues and coordinating ${primary.toLowerCase()}${pair}.`;
    } else {
      const listPreview =
        formattedItems.length > 1
          ? `${primary}. I also contributed to ${secondary.toLowerCase()}`
          : primary;
      if (tone === "concise") {
        body = `${listPreview}.`;
      } else if (tone === "confident") {
        body = `Key contributions this cycle include ${listPreview.charAt(0).toLowerCase() + listPreview.slice(1)}.`;
      } else {
        body = `During this review period, my work centered on ${listPreview.charAt(0).toLowerCase() + listPreview.slice(1)}.`;
      }
    }

    if (!hasQuantified && !missingEvidenceNote) {
      missingEvidenceNote =
        "No numbers added—keep as-is or add real figures only if verified from your records.";
    }

    body = applyLimits(body, q.wordLimit, q.charLimit);

    return {
      questionId: q.id,
      question: q.question,
      answer: body,
      tone,
      missingEvidenceNote,
      charLimit: q.charLimit,
      wordLimit: q.wordLimit,
    };
  });
}

export function applyLimits(text: string, wordLimit?: number, charLimit?: number): string {
  let out = text.trim();
  if (wordLimit && wordLimit > 5) {
    const words = out.split(/\s+/);
    if (words.length > wordLimit) {
      out = words.slice(0, wordLimit).join(" ").replace(/[,;:\s]+$/, "") + ".";
    }
  }
  if (charLimit && charLimit > 20 && out.length > charLimit) {
    out = out.slice(0, charLimit - 1).trimEnd().replace(/[,;:\s]+$/, "") + ".";
  }
  return out;
}

export function transformAnswer(
  current: string,
  action: "shorten" | "impactful" | "regenerate",
  question: string,
  achievements: string,
  tone: GrowthTone
): string {
  if (action === "regenerate") {
    const next = generateGrowthAnswers(
      [{ id: "single", question }],
      achievements,
      tone
    )[0];
    return next ? next.answer : current;
  }
  if (action === "shorten") {
    const sentences = current
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return sentences[0] || current;
  }
  // impactful
  const cleaned = cleanSentence(current);
  if (/^I\s/i.test(cleaned)) {
    return cleaned;
  }
  return `In my role, I drove measurable ownership: ${cleaned.charAt(0).toLowerCase() + cleaned.slice(1)}.`;
}

export function formatReviewExport(answers: DraftAnswerItem[]): string {
  return answers
    .map(
      (item, idx) =>
        `Q${idx + 1}: ${item.question}\nAnswer:\n${item.answer}\n`
    )
    .join("\n---\n\n");
}
export const GROWTH_CATEGORIES = [
  "Business impact",
  "Productivity",
  "Quality",
  "Leadership",
  "Collaboration",
  "Customer experience",
  "Process improvement",
  "Training and mentoring",
  "Problem-solving",
  "Learning and development",
] as const;

export type GrowthCategory = (typeof GROWTH_CATEGORIES)[number];

export interface AchievementRecord {
  id: string;
  rawNote: string;
  professionalSummary: string;
  category: GrowthCategory;
  date: string;
  measurableResult?: string;
  selectedForReview: boolean;
}

export function suggestAchievementCategory(note: string): GrowthCategory {
  const lower = note.toLowerCase();
  if (lower.includes("train") || lower.includes("mentor") || lower.includes("onboard") || lower.includes("joiner")) return "Training and mentoring";
  if (lower.includes("lead") || lower.includes("managed") || lower.includes("coordina") || lower.includes("team")) return "Leadership";
  if (lower.includes("quality") || lower.includes("review") || lower.includes("audit") || lower.includes("accuracy")) return "Quality";
  if (lower.includes("client") || lower.includes("customer") || lower.includes("escalation")) return "Customer experience";
  if (lower.includes("process") || lower.includes("workflow") || lower.includes("automat") || lower.includes("standard")) return "Process improvement";
  if (lower.includes("pending") || lower.includes("backlog") || lower.includes("turnaround") || lower.includes("faster")) return "Productivity";
  if (lower.includes("issue") || lower.includes("bug") || lower.includes("resolv") || lower.includes("root cause")) return "Problem-solving";
  if (lower.includes("certif") || lower.includes("course") || lower.includes("learn") || lower.includes("skill")) return "Learning and development";
  if (lower.includes("collaborat") || lower.includes("cross-functional") || lower.includes("partner")) return "Collaboration";
  return "Business impact";
}

export function buildProfessionalAchievementSummary(rawNote: string): string {
  const trimmed = rawNote.trim().replace(/[.!?]+$/, "");
  if (!trimmed) return "";
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  if (/^(delivered|led|coordinated|supported|resolved|streamlined|improved|trained|built|managed)\b/i.test(capitalized)) {
    return `${capitalized}.`;
  }
  return `Executed ${capitalized.charAt(0).toLowerCase() + capitalized.slice(1)}.`;
}
