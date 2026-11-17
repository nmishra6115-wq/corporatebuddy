export type SupportedDocType =
  | "Offer Letter"
  | "Appointment Letter"
  | "Increment Letter"
  | "Payslip"
  | "Experience / Relieving Letter"
  | "HR Policy / Agreement"
  | "General Workplace Document";

export interface DocumentBriefOutput {
  briefSummary: string;
  detectedType: SupportedDocType;
  overview: string;
  keyDetails: string[];
  financialDetails: string[];
  importantConditions: string[];
  redFlagsToVerify: string[];
  hrQuestions: string[];
  extractedCtc?: number;
  disclaimer: string;
}

export function detectDocumentType(fileName: string, rawText: string): SupportedDocType {
  const hay = `${fileName} ${rawText}`.toLowerCase();
  if (hay.includes("offer")) return "Offer Letter";
  if (hay.includes("appointment")) return "Appointment Letter";
  if (hay.includes("increment") || hay.includes("appraisal")) return "Increment Letter";
  if (hay.includes("payslip") || hay.includes("salary slip")) return "Payslip";
  if (hay.includes("relieving") || hay.includes("experience")) return "Experience / Relieving Letter";
  if (hay.includes("policy") || hay.includes("agreement") || hay.includes("nda")) {
    return "HR Policy / Agreement";
  }
  return "General Workplace Document";
}

export function buildDocumentBrief(
  fileName: string,
  rawText: string
): DocumentBriefOutput {
  const detectedType = detectDocumentType(fileName, rawText);
  const ctcMatch = rawText.match(/(?:ctc|package|compensation)[^\d]{0,20}(\d[\d,]{4,9})/i);
  const extractedCtc = ctcMatch ? Number(ctcMatch[1].replace(/,/g, "")) : undefined;

  const hasBond = /\b(bond|service agreement|recover|clawback|liquidated damages)\b/i.test(rawText);
  const hasNotice = /\b(notice period|days notice|buyout)\b/i.test(rawText);
  const hasProbation = /\b(probation|confirmation)\b/i.test(rawText);

  const redFlagsToVerify: string[] = [];
  if (hasBond) {
    redFlagsToVerify.push(
      "Bond / recovery or clawback language detected — verify exact conditions, duration, and whether training/relocation recovery is capped."
    );
  }
  if (!rawText.trim()) {
    redFlagsToVerify.push(
      "No text pasted/extracted yet — paste key clauses or upload supported text/document content; missing clauses are never invented."
    );
  }
  if (redFlagsToVerify.length === 0) {
    redFlagsToVerify.push(
      "No explicit bond or recovery keyword detected in snippet; confirm notice buyout and variable payout rules in writing."
    );
  }

  return {
    briefSummary: `${detectedType} · Structured brief with non-fabricated placeholders and HR questions.`,
    detectedType,
    overview: `${detectedType} brief for "${fileName || "Uploaded Document"}". Extracted values and missing clauses are separated below without inventing unstated terms.`,
    keyDetails: [
      `Document Type: ${detectedType}`,
      `Probation Clause: ${hasProbation ? "Mentioned in text (verify exact duration)" : "Not mentioned in snippet"}`,
      `Notice Period Clause: ${hasNotice ? "Mentioned in text (verify buyout terms)" : "Not mentioned in snippet"}`,
    ],
    financialDetails: [
      extractedCtc
        ? `Detected CTC figure: ₹${extractedCtc.toLocaleString("en-IN")} (verify fixed vs. variable split).`
        : "CTC / salary split: Not mentioned in snippet — enter manually or send to Module 01.",
    ],
    importantConditions: [
      "Confirm working hours, leave accrual, and variable/bonus payout triggers before signing.",
    ],
    redFlagsToVerify,
    hrQuestions: [
      "What is the exact fixed vs. variable split and PF/gratuity basis?",
      "What is the notice period during probation vs. after confirmation, and is buyout permitted?",
      "Are there any service bonds, training cost recovery, or IP/moonlighting restrictions?",
    ],
    extractedCtc,
    disclaimer:
      "Informational summary only; not legal advice. Verify exact clauses against your signed document.",
  };
}
