import * as XLSX from "xlsx";

export interface PresentOSSourceCitation {
  fileName: string;
  sheetName: string;
  location: string;
  formulaOrMethod: string;
}

export interface PresentOSColumnMetric {
  column: string;
  count: number;
  numericCount: number;
  missingCount: number;
  sum: number | null;
  average: number | null;
  min: number | null;
  max: number | null;
  firstValue: number | null;
  lastValue: number | null;
  delta: number | null;
  deltaPct: number | null;
  citation: PresentOSSourceCitation;
}

export interface PresentOSInsightBlock {
  metricColumn: string;
  observation: string;
  interpretation: string;
  businessImpact: string;
  recommendation: string;
  citationLabel: string;
}

export interface PresentOSWorkbookReport {
  fileName: string;
  sheetNames: string[];
  activeSheet: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  sampleRows: string[][];
  metrics: PresentOSColumnMetric[];
  insights: PresentOSInsightBlock[];
  citations: string[];
}

function toNumeric(val: unknown): number | null {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/[₹$,%\s,]/g, "").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function analyzeWorkbookBuffer(fileName: string, buffer: ArrayBuffer): PresentOSWorkbookReport {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetNames = wb.SheetNames.length > 0 ? wb.SheetNames : ["Sheet1"];
  const activeSheet = sheetNames[0];
  const ws = wb.Sheets[activeSheet];
  const rawMatrix = ws
    ? (XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][])
    : [];

  const nonEmptyRows = rawMatrix.filter((r) =>
    Array.isArray(r) && r.some((cell) => String(cell ?? "").trim() !== "")
  );

  const headerRow = (nonEmptyRows[0] ?? []).map((c, idx) => {
    const label = String(c ?? "").trim();
    return label || `Column ${idx + 1}`;
  });

  const dataRows = nonEmptyRows.slice(1);
  const columnCount = headerRow.length;
  const rowCount = dataRows.length;

  const sampleRows = dataRows.slice(0, 6).map((row) =>
    Array.from({ length: columnCount }, (_, cIdx) => String(row[cIdx] ?? ""))
  );

  const metrics: PresentOSColumnMetric[] = [];
  const insights: PresentOSInsightBlock[] = [];
  const citations: string[] = [];

  for (let cIdx = 0; cIdx < columnCount; cIdx++) {
    const colName = headerRow[cIdx];
    const values: number[] = [];
    let missingCount = 0;

    for (const row of dataRows) {
      const rawCell = row[cIdx];
      if (rawCell === null || rawCell === undefined || String(rawCell).trim() === "") {
        missingCount++;
        continue;
      }
      const num = toNumeric(rawCell);
      if (num !== null) {
        values.push(num);
      }
    }

    if (values.length === 0) continue;

    const sum = +values.reduce((a, b) => a + b, 0).toFixed(2);
    const average = +(sum / values.length).toFixed(2);
    const min = +Math.min(...values).toFixed(2);
    const max = +Math.max(...values).toFixed(2);
    const firstValue = +values[0].toFixed(2);
    const lastValue = +values[values.length - 1].toFixed(2);
    const delta = +(lastValue - firstValue).toFixed(2);
    const deltaPct =
      firstValue !== 0 ? +(((lastValue - firstValue) / Math.abs(firstValue)) * 100).toFixed(2) : null;

    const colLetter = XLSX.utils.encode_col(cIdx);
    const endRow = Math.max(2, rowCount + 1);
    const location = `${colLetter}2:${colLetter}${endRow}`;
    const citation: PresentOSSourceCitation = {
      fileName,
      sheetName: activeSheet,
      location,
      formulaOrMethod: `Deterministic sum/avg/min/max & first-to-last delta over ${values.length} numeric row(s)`,
    };
    const citationLabel = `${fileName} [${activeSheet}!${location}]`;
    citations.push(citationLabel);

    metrics.push({
      column: colName,
      count: rowCount,
      numericCount: values.length,
      missingCount,
      sum,
      average,
      min,
      max,
      firstValue,
      lastValue,
      delta,
      deltaPct,
      citation,
    });

    const deltaText =
      deltaPct !== null
        ? `${delta >= 0 ? "+" : ""}${delta} (${deltaPct >= 0 ? "+" : ""}${deltaPct}%)`
        : `${delta >= 0 ? "+" : ""}${delta}`;

    insights.push({
      metricColumn: colName,
      observation: `Verified source values for ${colName}: sum=${sum}, average=${average}, min=${min}, max=${max}, first-to-last change=${deltaText} (${missingCount} blank cell(s)).`,
      interpretation: `Observed movement in ${colName} may indicate shifting volume, throughput, or rate dynamics; causal drivers are not proven from column values alone.`,
      businessImpact: `Changes in ${colName} (${deltaText}) can affect SLA commitments, backlog aging, or resource allocation if sustained.`,
      recommendation: `Cross-check ${colName} against period targets, staffing capacity, and source exception logs before committing corrective actions.`,
      citationLabel,
    });
  }

  return {
    fileName,
    sheetNames,
    activeSheet,
    rowCount,
    columnCount,
    headers: headerRow,
    sampleRows,
    metrics,
    insights,
    citations,
  };
}

export function analyzeDelimitedText(fileName: string, text: string): PresentOSWorkbookReport {
  const wb = XLSX.read(text, { type: "string" });
  const firstSheet = wb.SheetNames[0] || "Sheet1";
  const ws = wb.Sheets[firstSheet];
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const report = analyzeWorkbookBuffer(fileName, buf);
  return { ...report, sheetNames: [firstSheet], activeSheet: firstSheet, citations: report.citations.length > 0 ? report.citations : [`${fileName} [text]`] };
}