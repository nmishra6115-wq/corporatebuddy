import * as XLSX from "xlsx";
import type { ParsedTable } from "@/lib/excelOsEngine";

export interface GeneratedWorkbookSpec {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: Array<Array<string | number | { f: string; t?: "n" | "s" }>>;
  summaryNote: string;
}

export function sanitizeCellValue(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function rowsToRecordList(
  headers: string[],
  matrixRows: string[][]
): Record<string, string>[] {
  return matrixRows.map((row) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rec[h] = sanitizeCellValue(row[idx] ?? "");
    });
    return rec;
  });
}

export function recordListToMatrix(
  headers: string[],
  records: Record<string, string>[]
): string[][] {
  return records.map((rec) =>
    headers.map((h) => sanitizeCellValue(rec[h] ?? ""))
  );
}

export function parseExcelBinaryBuffer(
  buffer: ArrayBuffer,
  fallbackFileName = "workbook.xlsx"
): ParsedTable {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0] || "Sheet1";
  const worksheet = workbook.Sheets[firstSheetName];

  if (!worksheet) {
    return {
      sheetName: firstSheetName,
      headers: [],
      rows: [],
    };
  }

  const matrix = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(
    worksheet,
    {
      header: 1,
      defval: "",
      raw: false,
    }
  );

  if (!matrix.length) {
    return {
      sheetName: firstSheetName,
      headers: [],
      rows: [],
    };
  }

  const rawHeaders = matrix[0] || [];
  const headers = rawHeaders.map((h, idx) => {
    const trimmed = String(h ?? "").trim();
    return trimmed || `Column_${idx + 1}`;
  });

  const matrixRows = matrix
    .slice(1)
    .filter((r) => Array.isArray(r) && r.some((cell) => String(cell ?? "").trim() !== ""))
    .map((r) => headers.map((_, colIdx) => String(r[colIdx] ?? "")));

  return {
    sheetName: firstSheetName || fallbackFileName,
    headers,
    rows: rowsToRecordList(headers, matrixRows),
  };
}

export function buildDeterministicWorkbookSpec(
  instruction: string,
  sourceTable: ParsedTable
): GeneratedWorkbookSpec {
  const normalized = instruction.toLowerCase();
  const countMatch = normalized.match(/\b(\d{1,3})\s+(employees|analysts|staff|members)\b/);
  const requestedCount = countMatch ? Math.min(Math.max(Number(countMatch[1]), 1), 200) : 0;

  if (normalized.includes("attendance") && requestedCount > 0) {
    const headers = [
      "Employee_ID",
      "Employee_Name",
      "Working_Days",
      "Present_Days",
      "Leave_Days",
      "Attendance_Pct",
    ];
    const rows: GeneratedWorkbookSpec["rows"] = [];

    for (let i = 1; i <= requestedCount; i++) {
      const excelRow = i + 1;
      rows.push([
        `EMP-${String(i).padStart(3, "0")}`,
        `Employee ${i} (Placeholder)`,
        26,
        0,
        0,
        { f: `IFERROR(D${excelRow}/C${excelRow},0)`, t: "n" },
      ]);
    }

    const totalRow = requestedCount + 2;
    rows.push([
      "TOTAL",
      "Summary Totals",
      { f: `SUM(C2:C${requestedCount + 1})`, t: "n" },
      { f: `SUM(D2:D${requestedCount + 1})`, t: "n" },
      { f: `SUM(E2:E${requestedCount + 1})`, t: "n" },
      { f: `IFERROR(D${totalRow}/C${totalRow},0)`, t: "n" },
    ]);

    return {
      fileName: `monthly_attendance_tracker_${requestedCount}_employees.xlsx`,
      sheetName: "Attendance_Tracker",
      headers,
      rows,
      summaryNote: `Generated ${requestedCount} placeholder employee rows with working Working_Days, Present_Days, Leave_Days, and IFERROR attendance percentage formulas.`,
    };
  }

  const sheetName = sourceTable.sheetName || "Copilot_Output";
  const headers =
    sourceTable.headers.length > 0
      ? sourceTable.headers.map((h) => sanitizeCellValue(h))
      : ["Item", "Value"];

  const matrix = recordListToMatrix(headers, sourceTable.rows);
  const rows: GeneratedWorkbookSpec["rows"] =
    matrix.length > 0 ? matrix : [headers.map(() => "")];

  return {
    fileName: "corporatebuddy_excel_copilot.xlsx",
    sheetName,
    headers,
    rows,
    summaryNote: `Prepared ${rows.length} row(s) across ${headers.length} column(s) for .xlsx export.`,
  };
}

export function downloadSpecAsXlsx(spec: GeneratedWorkbookSpec): void {
  const aoa: Array<Array<string | number | { f: string; t?: "n" | "s" }>> = [
    spec.headers,
    ...spec.rows,
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  if (spec.sheetName === "Attendance_Tracker") {
    const pctColIdx = spec.headers.indexOf("Attendance_Pct");
    if (pctColIdx >= 0) {
      for (let r = 1; r <= spec.rows.length; r++) {
        const cellRef = XLSX.utils.encode_cell({ r, c: pctColIdx });
        if (worksheet[cellRef]) {
          worksheet[cellRef].z = "0.0%";
        }
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, spec.sheetName.slice(0, 31));
  XLSX.writeFile(workbook, spec.fileName);
}
