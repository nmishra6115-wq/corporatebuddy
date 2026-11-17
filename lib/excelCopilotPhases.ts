import type { ParsedTable } from "@/lib/excelOsEngine";
import {
  GeneratedWorkbookSpec,
  recordListToMatrix,
  rowsToRecordList,
  sanitizeCellValue,
} from "@/lib/excelWorkbookBuilder";

export interface FormulaDoctorOutput {
  formula: string;
  explanation: string;
  example: string;
  whereToApply: string;
  compatibilityNotes: string;
}

export interface CleaningProposal {
  id: string;
  issueType: string;
  affectedCount: number;
  sample: string;
  proposedFix: string;
  approved: boolean;
}

export interface ExcelQuestionAnswer {
  directAnswer: string;
  calculations: string[];
  supportingHeaders: string[];
  supportingRows: string[][];
}

export function parseMessyTextToTable(input: string): ParsedTable {
  const trimmed = input.trim();
  if (!trimmed) {
    return { sheetName: "PastedData", headers: [], rows: [] };
  }

  const sentenceMatches = [
    ...trimmed.matchAll(
      /([A-Za-z][A-Za-z .'-]{1,40}?)\s+completed\s+(\d+)\s+cases?\s+(?:and\s+has\s+|with\s+)(\d+)\s+pending/gi
    ),
  ];

  if (sentenceMatches.length > 0) {
    const headers = ["Employee", "Completed", "Pending"];
    const matrix = sentenceMatches.map((m) => [
      sanitizeCellValue(m[1].trim()),
      String(Number(m[2])),
      String(Number(m[3])),
    ]);
    return {
      sheetName: "ExtractedCases",
      headers,
      rows: rowsToRecordList(headers, matrix),
    };
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { sheetName: "PastedData", headers: [], rows: [] };
  }

  const delimiter = lines[0].includes("\t")
    ? "\t"
    : lines[0].includes("|")
    ? "|"
    : ",";

  const splitRow = (line: string): string[] =>
    line.split(delimiter).map((cell) => sanitizeCellValue(cell.trim()));

  const headers = splitRow(lines[0]);
  const matrix = lines.slice(1).map((line) => {
    const cells = splitRow(line);
    return headers.map((_, idx) => cells[idx] ?? "");
  });

  return {
    sheetName: "PastedData",
    headers,
    rows: rowsToRecordList(headers, matrix),
  };
}

export function buildRichWorkbookSpec(
  instruction: string,
  table: ParsedTable
): GeneratedWorkbookSpec {
  const q = instruction.toLowerCase();
  const countMatch = q.match(/\b(\d{1,3})\s+(employees|analysts|staff|members|rows|items)\b/);
  const count = countMatch ? Math.min(Math.max(Number(countMatch[1]), 1), 200) : 0;

  if (q.includes("task") && (q.includes("priority") || q.includes("status") || q.includes("deadline"))) {
    const rowCount = count || 10;
    const headers = ["Task_ID", "Task_Title", "Owner", "Priority", "Status", "Deadline"];
    const rows: GeneratedWorkbookSpec["rows"] = [];
    for (let i = 1; i <= rowCount; i++) {
      rows.push([
        `TSK-${String(i).padStart(3, "0")}`,
        `Task ${i} (Placeholder)`,
        "",
        "Medium",
        "Open",
        "",
      ]);
    }
    return {
      fileName: "task_tracker.xlsx",
      sheetName: "Tasks",
      headers,
      rows,
      summaryNote: `Created ${rowCount} placeholder task rows with Priority, Status, and Deadline columns.`,
    };
  }

  if (q.includes("expense")) {
    const rowCount = count || 12;
    const headers = ["Expense_ID", "Date", "Category", "Description", "Amount_INR"];
    const rows: GeneratedWorkbookSpec["rows"] = [];
    for (let i = 1; i <= rowCount; i++) {
      rows.push([`EXP-${String(i).padStart(3, "0")}`, "", "General", "", 0]);
    }
    const totalRow = rowCount + 2;
    rows.push([
      "TOTAL",
      "",
      "",
      "Total Monthly Expense",
      { f: `SUM(E2:E${totalRow - 1})`, t: "n" },
    ]);
    return {
      fileName: "monthly_expense_tracker.xlsx",
      sheetName: "Expenses",
      headers,
      rows,
      summaryNote: `Created ${rowCount} expense rows with a SUM total formula at E${totalRow}.`,
    };
  }

  if (q.includes("shift") || q.includes("roster")) {
    const rowCount = count || 15;
    const headers = ["Employee_ID", "Employee_Name", "Shift", "Week_1", "Week_2", "Total_Shifts"];
    const rows: GeneratedWorkbookSpec["rows"] = [];
    for (let i = 1; i <= rowCount; i++) {
      const r = i + 1;
      rows.push([
        `EMP-${String(i).padStart(3, "0")}`,
        `Employee ${i} (Placeholder)`,
        "General",
        "",
        "",
        { f: `COUNTA(D${r}:E${r})`, t: "n" },
      ]);
    }
    return {
      fileName: "shift_roster.xlsx",
      sheetName: "Shift_Roster",
      headers,
      rows,
      summaryNote: `Created ${rowCount} placeholder roster rows with COUNTA shift totals.`,
    };
  }

  const headers =
    table.headers.length > 0 ? table.headers.map(sanitizeCellValue) : ["Item", "Value"];
  const matrix = recordListToMatrix(headers, table.rows);
  const rows: GeneratedWorkbookSpec["rows"] =
    matrix.length > 0 ? matrix : [headers.map(() => "")];

  return {
    fileName: "corporatebuddy_copilot_output.xlsx",
    sheetName: (table.sheetName || "Sheet1").slice(0, 31),
    headers,
    rows,
    summaryNote: `Exported ${rows.length} row(s) and ${headers.length} column(s) to .xlsx.`,
  };
}

export function runFormulaDoctor(
  prompt: string,
  table: ParsedTable
): FormulaDoctorOutput {
  const lower = prompt.toLowerCase();
  const colA = table.headers[0] ? `A2` : "C2";
  const colB = table.headers[1] ? `B2` : "D2";

  if (lower.includes("#n/a") || lower.includes("vlookup") || lower.includes("xlookup")) {
    return {
      formula: `=IFERROR(XLOOKUP(${colA}, LookupSheet!$A$2:$A$100, LookupSheet!$B$2:$B$100, "Not Found"), "Check ID")`,
      explanation:
        "Looks up an ID in another sheet and replaces #N/A or missing matches with a readable message instead of an error.",
      example: `=IFERROR(XLOOKUP(A2, Employees!$A$2:$A$50, Employees!$C$2:$C$50), "Missing")`,
      whereToApply: `Paste into a new helper column on row 2 (e.g., ${table.headers.length > 0 ? "next to " + table.headers[0] : "Column C"}) and fill down.`,
      compatibilityNotes:
        "XLOOKUP works in Excel 365 / 2021+. For older Excel, use =IFERROR(INDEX(LookupSheet!$B$2:$B$100, MATCH(A2, LookupSheet!$A$2:$A$100, 0)), \"Missing\").",
    };
  }

  if (lower.includes("weekend") || lower.includes("working days") || lower.includes("between two dates")) {
    return {
      formula: `=IF(AND(ISNUMBER(${colA}), ISNUMBER(${colB})), NETWORKDAYS(${colA}, ${colB}), "")`,
      explanation:
        "Counts working days between two dates while excluding Saturdays and Sundays.",
      example: "=NETWORKDAYS(B2, C2)",
      whereToApply: "Paste in the Duration / Working Days column on row 2 and fill down.",
      compatibilityNotes:
        "Supported in all modern Microsoft Excel versions; ensure start and end cells are valid Excel dates.",
    };
  }

  if (lower.includes("below 90") || lower.includes("if")) {
    return {
      formula: `=IF(${colB}<0.9, "Below Target", "On Track")`,
      explanation:
        "Flags rows below 90% (0.90) as 'Below Target' and marks others as 'On Track'.",
      example: '=IF(E2<90, "Below Target", "On Track")',
      whereToApply: "Paste in a status/flag column on row 2 and fill down.",
      compatibilityNotes:
        "If your percentage column stores 92 instead of 0.92, use 90 instead of 0.9.",
    };
  }

  return {
    formula: `=IFERROR(${colB}/(${colA}+${colB}), 0)`,
    explanation:
      "Calculates completion percentage safely and returns 0 if both numerator and denominator are zero.",
    example: "=IFERROR(C2/(C2+D2), 0)",
    whereToApply: "Paste in your Percentage column on row 2, format cell as Percentage (0.0%), and fill down.",
    compatibilityNotes:
      "Uses standard IFERROR supported across Excel 2007 through Microsoft 365.",
  };
}

export function buildCleaningProposals(table: ParsedTable): CleaningProposal[] {
  if (table.headers.length === 0 || table.rows.length === 0) return [];

  const proposals: CleaningProposal[] = [];
  let whitespaceCount = 0;
  let emptyCount = 0;
  const seenKeys = new Set<string>();
  let duplicateCount = 0;

  for (const row of table.rows) {
    const firstHeader = table.headers[0];
    const key = String(row[firstHeader] ?? "").trim().toLowerCase();
    if (key) {
      if (seenKeys.has(key)) duplicateCount++;
      else seenKeys.add(key);
    }
    for (const h of table.headers) {
      const s = String(row[h] ?? "");
      if (s !== s.trim() || /\s{2,}/.test(s)) whitespaceCount++;
      if (!s.trim()) emptyCount++;
    }
  }

  if (whitespaceCount > 0) {
    proposals.push({
      id: "trim-spaces",
      issueType: "Extra leading/trailing or repeated spaces",
      affectedCount: whitespaceCount,
      sample: String(table.rows[0]?.[table.headers[0]] ?? ""),
      proposedFix: "Trim outer spaces and collapse repeated spaces in text cells.",
      approved: true,
    });
  }

  if (duplicateCount > 0) {
    proposals.push({
      id: "flag-duplicates",
      issueType: `Duplicate values in first column (${table.headers[0]})`,
      affectedCount: duplicateCount,
      sample: String(table.rows[0]?.[table.headers[0]] ?? ""),
      proposedFix: "Flag duplicate keys for review without silently deleting rows.",
      approved: true,
    });
  }

  if (emptyCount > 0) {
    proposals.push({
      id: "flag-missing",
      issueType: "Missing / blank cells",
      affectedCount: emptyCount,
      sample: "(blank cell)",
      proposedFix: "Keep blank cells intact (never fabricate values) and highlight for review.",
      approved: true,
    });
  }

  return proposals;
}

export function applyApprovedCleaning(
  table: ParsedTable,
  proposals: CleaningProposal[]
): ParsedTable {
  const trimApproved = proposals.some((p) => p.id === "trim-spaces" && p.approved);
  const rows = table.rows.map((row) => {
    const next: Record<string, string> = {};
    for (const h of table.headers) {
      const raw = String(row[h] ?? "");
      const cleaned = trimApproved ? raw.trim().replace(/\s{2,}/g, " ") : raw;
      next[h] = sanitizeCellValue(cleaned);
    }
    return next;
  });
  return {
    sheetName: table.sheetName || "CleanedData",
    headers: table.headers.map(sanitizeCellValue),
    rows,
  };
}

export function answerQuestionAboutTable(
  question: string,
  table: ParsedTable
): ExcelQuestionAnswer {
  if (table.headers.length === 0 || table.rows.length === 0) {
    return {
      directAnswer:
        "No table data is loaded yet. Upload a .csv/.xlsx file or paste rows to ask questions.",
      calculations: [],
      supportingHeaders: [],
      supportingRows: [],
    };
  }

  const q = question.toLowerCase();
  const numericCol = table.headers.find((h) => {
    if (q.includes(h.toLowerCase())) return true;
    return table.rows.some((r) => r[h] !== "" && !Number.isNaN(Number(r[h])));
  });

  if (numericCol) {
    const numericRows = table.rows
      .map((r) => ({ row: r, val: Number(r[numericCol]) }))
      .filter((item) => !Number.isNaN(item.val));

    if (numericRows.length > 0) {
      const sum = numericRows.reduce((acc, item) => acc + item.val, 0);
      const maxItem = numericRows.reduce((best, cur) => (cur.val > best.val ? cur : best));
      const firstCol = table.headers[0];

      if (q.includes("most") || q.includes("highest") || q.includes("top")) {
        return {
          directAnswer: `Highest ${numericCol}: ${maxItem.val} (${maxItem.row[firstCol] ?? "Row"}).`,
          calculations: [
            `Column analysed: ${numericCol}`,
            `Maximum value: ${maxItem.val}`,
            `Total across ${numericRows.length} numeric rows: ${sum}`,
          ],
          supportingHeaders: table.headers,
          supportingRows: [table.headers.map((h) => maxItem.row[h] ?? "")],
        };
      }

      if (q.includes("below") || q.includes("less than")) {
        const thresholdMatch = q.match(/(\d+(?:\.\d+)?)/);
        const threshold = thresholdMatch ? Number(thresholdMatch[1]) : 90;
        const matches = numericRows.filter((item) => item.val < threshold);
        return {
          directAnswer: `${matches.length} row(s) have ${numericCol} below ${threshold}.`,
          calculations: [
            `Threshold: < ${threshold}`,
            `Matching rows: ${matches.length} of ${table.rows.length}`,
          ],
          supportingHeaders: table.headers,
          supportingRows: matches.map((m) => table.headers.map((h) => m.row[h] ?? "")),
        };
      }

      return {
        directAnswer: `Total ${numericCol} across ${numericRows.length} rows is ${sum}.`,
        calculations: [
          `Column analysed: ${numericCol}`,
          `Sum: ${sum}`,
          `Average: ${(sum / numericRows.length).toFixed(2)}`,
        ],
        supportingHeaders: table.headers,
        supportingRows: table.rows.slice(0, 10).map((r) => table.headers.map((h) => r[h] ?? "")),
      };
    }
  }

  return {
    directAnswer: `Workbook has ${table.headers.length} column(s) and ${table.rows.length} row(s).`,
    calculations: [`Columns: ${table.headers.join(", ")}`],
    supportingHeaders: table.headers,
    supportingRows: table.rows.slice(0, 10).map((r) => table.headers.map((h) => r[h] ?? "")),
  };
}

export function buildCorporateBuddyHandoff(
  instruction: string,
  answer: ExcelQuestionAnswer,
  table: ParsedTable
): { emailDraft: string; meetingPoints: string } {
  const summaryLine = answer.directAnswer || `Processed ${table.rows.length} rows.`;
  const emailDraft = [
    `Subject: Spreadsheet Update — ${instruction || "Excel Copilot Summary"}`,
    ``,
    `Hi Team,`,
    ``,
    `${summaryLine}`,
    ...(answer.calculations.length ? ["", ...answer.calculations.map((c) => `- ${c}`)] : []),
    ``,
    `Best regards,`,
  ].join("\n");

  const meetingPoints = [
    `Discussion Topic: ${instruction || "Spreadsheet Review"}`,
    `- Key Finding: ${summaryLine}`,
    ...answer.calculations.map((c) => `- ${c}`),
    `- Next Step: Review supporting rows before finalizing action items.`,
  ].join("\n");

  return { emailDraft, meetingPoints };
}
