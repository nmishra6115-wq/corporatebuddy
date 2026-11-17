import * as XLSX from "xlsx";

export type ChangeType =
  | "added"
  | "removed"
  | "modified"
  | "moved"
  | "table_change"
  | "other";

export type VerificationStatus =
  | "Verified"
  | "Needs Manual Verification"
  | "Extraction Uncertain";

export type ReviewStatus = "Not Reviewed" | "Reviewed";

export interface SourceReference {
  documentId: string;
  fileName: string;
  page: number;
  sectionId: string;
  sectionTitle: string;
  blockId: string;
}

export interface ExtractedBlock {
  blockId: string;
  sectionId: string;
  sectionTitle: string;
  page: number;
  kind: "heading" | "paragraph" | "list_item" | "table_row";
  originalText: string;
  normalizedText: string;
}

export interface ExtractedDocument {
  documentId: string;
  fileName: string;
  fileType: string;
  fileHash: string;
  totalPages: number;
  pagesExtracted: number;
  pagesRequiringReview: number;
  tablesExtracted: number;
  extractionErrors: string[];
  extractionStatus: "complete" | "partial" | "failed";
  blocks: ExtractedBlock[];
}

export interface ChangeRegisterRecord {
  changeId: string;
  changeType: ChangeType;
  section: string;
  oldLocation: string;
  newLocation: string;
  oldSource?: SourceReference;
  newSource?: SourceReference;
  oldText: string;
  newText: string;
  exactDifference: string;
  explanation: string;
  verificationStatus: VerificationStatus;
  reviewStatus: ReviewStatus;
}

export interface CoverageReport {
  oldDoc: { totalPages: number; pagesExtracted: number; pagesRequiringReview: number; tablesExtracted: number; extractionErrors: string[] };
  newDoc: { totalPages: number; pagesExtracted: number; pagesRequiringReview: number; tablesExtracted: number; extractionErrors: string[] };
  sectionsMatched: number;
  sectionsUnmatched: number;
  changesDetected: number;
  changesRequiringVerification: number;
  completionStatus: string;
}

export function computeSimpleHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `h${(h >>> 0).toString(16)}`;
}

export function normalizeCompareText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function splitIntoSectionsAndBlocks(rawText: string, docId: string, fileName: string, defaultPage = 1): ExtractedBlock[] {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const blocks: ExtractedBlock[] = [];
  let currentSectionId = "SEC-1";
  let currentSectionTitle = "Document Body";
  let currentPage = defaultPage;
  let secCounter = 1;

  lines.forEach((line, idx) => {
    const pageMatch = line.match(/^(?:page|pg\.?)\s*(\d+)\b/i);
    if (pageMatch) {
      currentPage = Math.max(1, Number(pageMatch[1]) || currentPage);
    }
    const isHeading =
      /^(?:section\s+)?\d+(?:\.\d+)*[\s).:-]+[A-Z]/i.test(line) ||
      (line.length <= 90 && line === line.toUpperCase() && /[A-Z]/.test(line));
    if (isHeading) {
      currentSectionId = `SEC-${secCounter++}`;
      currentSectionTitle = line;
      blocks.push({
        blockId: `${docId}-B${idx + 1}`,
        sectionId: currentSectionId,
        sectionTitle: currentSectionTitle,
        page: currentPage,
        kind: "heading",
        originalText: line,
        normalizedText: normalizeCompareText(line),
      });
      return;
    }
    const isList = /^(?:[-*•]|\([a-z0-9]+\)|[a-z][.)])\s+/i.test(line);
    blocks.push({
      blockId: `${docId}-B${idx + 1}`,
      sectionId: currentSectionId,
      sectionTitle: currentSectionTitle,
      page: currentPage,
      kind: isList ? "list_item" : "paragraph",
      originalText: line,
      normalizedText: normalizeCompareText(line),
    });
  });
  return blocks;
}

export async function extractDocumentFromBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  docId: string
): Promise<ExtractedDocument> {
  const lower = fileName.toLowerCase();
  const bytes = new Uint8Array(buffer);
  const hash = computeSimpleHash(`${fileName}:${bytes.byteLength}:${bytes[0] ?? 0}:${bytes[bytes.length - 1] ?? 0}`);
  const errors: string[] = [];

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
    try {
      const wb = XLSX.read(buffer, { type: "array" });
      const blocks: ExtractedBlock[] = [];
      let tablesExtracted = 0;
      wb.SheetNames.forEach((sheetName, sIdx) => {
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
        if (rows.length > 0) tablesExtracted += 1;
        rows.forEach((row, rIdx) => {
          const joined = row.map((c) => String(c ?? "").trim()).filter(Boolean).join(" | ");
          if (!joined) return;
          blocks.push({
            blockId: `${docId}-S${sIdx + 1}R${rIdx + 1}`,
            sectionId: `SHEET-${sIdx + 1}`,
            sectionTitle: sheetName,
            page: sIdx + 1,
            kind: "table_row",
            originalText: joined,
            normalizedText: normalizeCompareText(joined),
          });
        });
      });
      const totalPages = Math.max(1, wb.SheetNames.length);
      return {
        documentId: docId,
        fileName,
        fileType: lower.endsWith(".csv") ? "CSV" : "XLSX",
        fileHash: hash,
        totalPages,
        pagesExtracted: totalPages,
        pagesRequiringReview: 0,
        tablesExtracted,
        extractionErrors: errors,
        extractionStatus: blocks.length ? "complete" : "partial",
        blocks,
      };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Failed to parse spreadsheet.");
    }
  }

  if (lower.endsWith(".docx")) {
    try {
      const rawXml = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const stripped = rawXml
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+\n/g, "\n")
        .trim();
      const blocks = splitIntoSectionsAndBlocks(stripped, docId, fileName, 1);
      const hasContent = blocks.length > 0;
      if (!hasContent) {
        errors.push("DOCX XML text could not be extracted cleanly; manual review required.");
      }
      return {
        documentId: docId,
        fileName,
        fileType: "DOCX",
        fileHash: hash,
        totalPages: 1,
        pagesExtracted: hasContent ? 1 : 0,
        pagesRequiringReview: hasContent ? 0 : 1,
        tablesExtracted: 0,
        extractionErrors: errors,
        extractionStatus: hasContent ? "complete" : "failed",
        blocks,
      };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Failed to parse DOCX.");
    }
  }

  if (lower.endsWith(".pdf")) {
    const rawLatin = new TextDecoder("latin1").decode(bytes);
    const textChunks: string[] = [];
    const parenMatches = rawLatin.match(/\(([^()]{2,200})\)/g) ?? [];
    for (const m of parenMatches) {
      const cleaned = m.slice(1, -1).replace(/\\[nrt]/g, " ").replace(/[^\x20-\x7E]/g, " ").trim();
      if (cleaned.length >= 3 && /[a-zA-Z]{2,}/.test(cleaned)) {
        textChunks.push(cleaned);
      }
    }
    const joined = textChunks.join("\n");
    const blocks = splitIntoSectionsAndBlocks(joined, docId, fileName, 1);
    const pageMatches = rawLatin.match(/\/Type\s*\/Page\b/g);
    const totalPages = Math.max(1, pageMatches ? pageMatches.length : 1);
    if (!blocks.length) {
      errors.push("No selectable text stream found in PDF (possibly scanned/image PDF requiring OCR or manual review).");
    }
    return {
      documentId: docId,
      fileName,
      fileType: "PDF",
      fileHash: hash,
      totalPages,
      pagesExtracted: blocks.length ? totalPages : 0,
      pagesRequiringReview: blocks.length ? 0 : totalPages,
      tablesExtracted: 0,
      extractionErrors: errors,
      extractionStatus: blocks.length ? "complete" : "partial",
      blocks,
    };
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const blocks = splitIntoSectionsAndBlocks(text, docId, fileName, 1);
  return {
    documentId: docId,
    fileName,
    fileType: lower.split(".").pop()?.toUpperCase() || "TXT",
    fileHash: hash,
    totalPages: 1,
    pagesExtracted: blocks.length ? 1 : 0,
    pagesRequiringReview: blocks.length ? 0 : 1,
    tablesExtracted: 0,
    extractionErrors: blocks.length ? [] : ["Empty or unreadable text content."],
    extractionStatus: blocks.length ? "complete" : "failed",
    blocks,
  };
}

function computeExactDiff(oldText: string, newText: string): string {
  if (oldText === newText) return "No text difference";
  const oldWords = oldText.split(/\s+/);
  const newWords = newText.split(/\s+/);
  let prefix = 0;
  while (prefix < oldWords.length && prefix < newWords.length && oldWords[prefix] === newWords[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < oldWords.length - prefix &&
    suffix < newWords.length - prefix &&
    oldWords[oldWords.length - 1 - suffix] === newWords[newWords.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const oldMid = oldWords.slice(prefix, oldWords.length - suffix).join(" ") || "(none)";
  const newMid = newWords.slice(prefix, newWords.length - suffix).join(" ") || "(none)";
  return `${oldMid} -> ${newMid}`;
}

export function compareExtractedDocuments(
  oldDoc: ExtractedDocument,
  newDoc: ExtractedDocument
): { changes: ChangeRegisterRecord[]; coverage: CoverageReport } {
  const changes: ChangeRegisterRecord[] = [];
  let seq = 1;
  const nextId = () => `CHG-${String(seq++).padStart(4, "0")}`;

  const oldMap = new Map<string, ExtractedBlock[]>();
  for (const b of oldDoc.blocks) {
    const arr = oldMap.get(b.normalizedText) ?? [];
    arr.push(b);
    oldMap.set(b.normalizedText, arr);
  }

  const newMap = new Map<string, ExtractedBlock[]>();
  for (const b of newDoc.blocks) {
    const arr = newMap.get(b.normalizedText) ?? [];
    arr.push(b);
    newMap.set(b.normalizedText, arr);
  }

  let matched = 0;
  const unmatchedOld: ExtractedBlock[] = [];
  const unmatchedNew: ExtractedBlock[] = [];

  for (const b of oldDoc.blocks) {
    if (newMap.has(b.normalizedText)) {
      matched += 1;
    } else {
      unmatchedOld.push(b);
    }
  }

  for (const b of newDoc.blocks) {
    if (!oldMap.has(b.normalizedText)) {
      unmatchedNew.push(b);
    }
  }

  const pairedCount = Math.min(unmatchedOld.length, unmatchedNew.length);
  for (let i = 0; i < pairedCount; i += 1) {
    const ob = unmatchedOld[i];
    const nb = unmatchedNew[i];
    const isTable = ob.kind === "table_row" || nb.kind === "table_row";
    const exact = computeExactDiff(ob.originalText, nb.originalText);
    const uncertain = ob.sectionTitle !== nb.sectionTitle;
    changes.push({
      changeId: nextId(),
      changeType: isTable ? "table_change" : "modified",
      section: nb.sectionTitle || ob.sectionTitle,
      oldLocation: `Page ${ob.page} · ${ob.sectionTitle}`,
      newLocation: `Page ${nb.page} · ${nb.sectionTitle}`,
      oldSource: { documentId: oldDoc.documentId, fileName: oldDoc.fileName, page: ob.page, sectionId: ob.sectionId, sectionTitle: ob.sectionTitle, blockId: ob.blockId },
      newSource: { documentId: newDoc.documentId, fileName: newDoc.fileName, page: nb.page, sectionId: nb.sectionId, sectionTitle: nb.sectionTitle, blockId: nb.blockId },
      oldText: ob.originalText,
      newText: nb.originalText,
      exactDifference: exact,
      explanation: `Source text changed from "${ob.originalText}" to "${nb.originalText}" (${exact}).`,
      verificationStatus: uncertain ? "Needs Manual Verification" : "Verified",
      reviewStatus: "Not Reviewed",
    });
  }

  for (let i = pairedCount; i < unmatchedOld.length; i += 1) {
    const ob = unmatchedOld[i];
    changes.push({
      changeId: nextId(),
      changeType: ob.kind === "table_row" ? "table_change" : "removed",
      section: ob.sectionTitle,
      oldLocation: `Page ${ob.page} · ${ob.sectionTitle}`,
      newLocation: "Removed in Updated Document",
      oldSource: { documentId: oldDoc.documentId, fileName: oldDoc.fileName, page: ob.page, sectionId: ob.sectionId, sectionTitle: ob.sectionTitle, blockId: ob.blockId },
      oldText: ob.originalText,
      newText: "",
      exactDifference: `Removed: ${ob.originalText}`,
      explanation: `Removed from ${oldDoc.fileName} (Page ${ob.page}, ${ob.sectionTitle}).`,
      verificationStatus: oldDoc.extractionStatus === "complete" ? "Verified" : "Extraction Uncertain",
      reviewStatus: "Not Reviewed",
    });
  }

  for (let i = pairedCount; i < unmatchedNew.length; i += 1) {
    const nb = unmatchedNew[i];
    changes.push({
      changeId: nextId(),
      changeType: nb.kind === "table_row" ? "table_change" : "added",
      section: nb.sectionTitle,
      oldLocation: "Not in Previous Document",
      newLocation: `Page ${nb.page} · ${nb.sectionTitle}`,
      newSource: { documentId: newDoc.documentId, fileName: newDoc.fileName, page: nb.page, sectionId: nb.sectionId, sectionTitle: nb.sectionTitle, blockId: nb.blockId },
      oldText: "",
      newText: nb.originalText,
      exactDifference: `Added: ${nb.originalText}`,
      explanation: `Added in ${newDoc.fileName} (Page ${nb.page}, ${nb.sectionTitle}).`,
      verificationStatus: newDoc.extractionStatus === "complete" ? "Verified" : "Extraction Uncertain",
      reviewStatus: "Not Reviewed",
    });
  }

  const changesRequiringVerification = changes.filter((c) => c.verificationStatus !== "Verified").length;
  const hasFailures = oldDoc.extractionErrors.length > 0 || newDoc.extractionErrors.length > 0;

  const coverage: CoverageReport = {
    oldDoc: {
      totalPages: oldDoc.totalPages,
      pagesExtracted: oldDoc.pagesExtracted,
      pagesRequiringReview: oldDoc.pagesRequiringReview,
      tablesExtracted: oldDoc.tablesExtracted,
      extractionErrors: oldDoc.extractionErrors,
    },
    newDoc: {
      totalPages: newDoc.totalPages,
      pagesExtracted: newDoc.pagesExtracted,
      pagesRequiringReview: newDoc.pagesRequiringReview,
      tablesExtracted: newDoc.tablesExtracted,
      extractionErrors: newDoc.extractionErrors,
    },
    sectionsMatched: matched,
    sectionsUnmatched: Math.max(unmatchedOld.length, unmatchedNew.length),
    changesDetected: changes.length,
    changesRequiringVerification,
    completionStatus: hasFailures ? "Completed with warnings (review extraction gaps)" : "Completed (deterministic extraction + diff)",
  };

  return { changes, coverage };
}
