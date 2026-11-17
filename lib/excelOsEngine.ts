export interface ParsedTable {
  sheetName: string;
  headers: string[];
  rows: Record<string, string>[];
}

export interface DataQualityFinding {
  type: "Duplicate Key" | "Missing Value" | "Whitespace / Case Mismatch" | "Numeric / Date Check";
  column: string;
  count: number;
  sample: string;
  proposedFix: string;
}

export interface DiffSummary {
  keyColumn: string;
  newCount: number;
  removedCount: number;
  changedCount: number;
  unchangedCount: number;
  samples: string[];
}

export interface SavedExcelWorkflow {
  id: string;
  name: string;
  mode: "command" | "clean" | "compare" | "report" | "formula";
  prompt: string;
  keyColumn: string;
  groupColumn: string;
}

export function parseCsvOrTsv(text: string, sheetName = "Sheet1"): ParsedTable {
  const clean = text.replace(/^\uFEFF/, "").trim();
  if (!clean) {
    return { sheetName, headers: [], rows: [] };
  }
  const delimiter = clean.includes("\t") ? "\t" : ",";
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { sheetName, headers: [], rows: [] };
  }

  const splitLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const rawHeaders = splitLine(lines[0]);
  const headers = rawHeaders.map((h, i) => h || `Column_${i + 1}`);
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < lines.length; r++) {
    const vals = splitLine(lines[r]);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] ?? "";
    });
    rows.push(obj);
  }

  return { sheetName, headers, rows };
}

export function inspectDataQuality(table: ParsedTable, keyCol?: string): DataQualityFinding[] {
  const findings: DataQualityFinding[] = [];
  if (table.rows.length === 0 || table.headers.length === 0) return findings;

  const candidateKey =
    keyCol && table.headers.includes(keyCol)
      ? keyCol
      : table.headers.find((h) => /id|case|emp|ticket|ref/i.test(h)) ?? table.headers[0];

  // Duplicate keys
  const seen = new Map<string, number>();
  for (const row of table.rows) {
    const k = (row[candidateKey] ?? "").trim();
    if (!k) continue;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const dupKeys = [...seen.entries()].filter(([, cnt]) => cnt > 1);
  if (dupKeys.length > 0) {
    findings.push({
      type: "Duplicate Key",
      column: candidateKey,
      count: dupKeys.reduce((s, [, c]) => s + (c - 1), 0),
      sample: dupKeys.slice(0, 3).map(([k, c]) => `${k} (${c}x)`).join(", "),
      proposedFix: `Flag duplicate ${candidateKey} rows for review; preserve original file untouched.`,
    });
  }

  for (const col of table.headers) {
    const missing = table.rows.filter((r) => !(r[col] ?? "").trim());
    if (missing.length > 0) {
      findings.push({
        type: "Missing Value",
        column: col,
        count: missing.length,
        sample: `${missing.length} blank row(s)`,
        proposedFix: `Mark blank ${col} entries as "Pending Review" without silently dropping rows.`,
      });
    }

    const padded = table.rows.filter((r) => {
      const v = r[col] ?? "";
      return v !== v.trim() || /\s{2,}/.test(v);
    });
    if (padded.length > 0) {
      findings.push({
        type: "Whitespace / Case Mismatch",
        column: col,
        count: padded.length,
        sample: `"${(padded[0][col] ?? "").slice(0, 28)}"`,
        proposedFix: `Trim leading/trailing spaces and collapse double spaces in ${col}.`,
      });
    }
  }

  return findings;
}

export function cleanTableNonDestructive(table: ParsedTable): {
  cleaned: ParsedTable;
  changesApplied: string[];
} {
  const changesApplied: string[] = [];
  let trimmedCount = 0;
  let blankFilledCount = 0;

  const cleanedRows = table.rows.map((row) => {
    const next: Record<string, string> = {};
    for (const h of table.headers) {
      const raw = row[h] ?? "";
      const normalized = raw.replace(/\s+/g, " ").trim();
      if (normalized !== raw) trimmedCount += 1;
      if (!normalized) {
        next[h] = "Pending Review";
        blankFilledCount += 1;
      } else {
        next[h] = normalized;
      }
    }
    return next;
  });

  if (trimmedCount > 0) changesApplied.push(`Normalized whitespace across ${trimmedCount} cell(s).`);
  if (blankFilledCount > 0) changesApplied.push(`Labeled ${blankFilledCount} blank cell(s) as "Pending Review" (0 rows deleted).`);

  return {
    cleaned: { sheetName: `${table.sheetName}_Cleaned`, headers: table.headers, rows: cleanedRows },
    changesApplied,
  };
}

export function compareTwoTables(
  prevTable: ParsedTable,
  currTable: ParsedTable,
  preferredKey?: string
): DiffSummary {
  const keyCol =
    preferredKey && currTable.headers.includes(preferredKey)
      ? preferredKey
      : currTable.headers.find((h) => /id|case|emp|ticket|ref/i.test(h)) ??
        currTable.headers[0] ??
        "ID";

  const prevMap = new Map<string, Record<string, string>>();
  for (const r of prevTable.rows) {
    const k = (r[keyCol] ?? "").trim();
    if (k) prevMap.set(k, r);
  }

  const currMap = new Map<string, Record<string, string>>();
  for (const r of currTable.rows) {
    const k = (r[keyCol] ?? "").trim();
    if (k) currMap.set(k, r);
  }

  let newCount = 0;
  let removedCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;
  const samples: string[] = [];

  for (const [k, currRow] of currMap.entries()) {
    const prevRow = prevMap.get(k);
    if (!prevRow) {
      newCount += 1;
      if (samples.length < 5) samples.push(`NEW: ${keyCol}=${k}`);
      continue;
    }
    const diffCols = currTable.headers.filter((h) => (prevRow[h] ?? "") !== (currRow[h] ?? ""));
    if (diffCols.length > 0) {
      changedCount += 1;
      if (samples.length < 5) {
        samples.push(`CHANGED: ${keyCol}=${k} (${diffCols.join(", ")})`);
      }
    } else {
      unchangedCount += 1;
    }
  }

  for (const k of prevMap.keys()) {
    if (!currMap.has(k)) {
      removedCount += 1;
      if (samples.length < 5) samples.push(`REMOVED: ${keyCol}=${k}`);
    }
  }

  return {
    keyColumn: keyCol,
    newCount,
    removedCount,
    changedCount,
    unchangedCount,
    samples,
  };
}

export function buildGroupSummary(table: ParsedTable, groupCol?: string): Array<{
  group: string;
  count: number;
  pct: number;
}> {
  if (table.rows.length === 0 || table.headers.length === 0) return [];
  const col =
    groupCol && table.headers.includes(groupCol)
      ? groupCol
      : table.headers.find((h) => /status|team|dept|queue|category|stage/i.test(h)) ??
        table.headers[0];

  const counts = new Map<string, number>();
  for (const r of table.rows) {
    const val = (r[col] ?? "").trim() || "Unspecified";
    counts.set(val, (counts.get(val) ?? 0) + 1);
  }

  const total = table.rows.length;
  return [...counts.entries()]
    .map(([group, count]) => ({
      group,
      count,
      pct: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

export function buildExcelFormulaRecommendation(instruction: string): {
  primaryFormula: string;
  compatibleVariant: string;
  explanation: string;
  whereToApply: string;
} {
  const lower = instruction.toLowerCase();
  if (lower.includes("weekend") || lower.includes("business day") || lower.includes("networkdays")) {
    return {
      primaryFormula: "=NETWORKDAYS(B2, C2)",
      compatibleVariant: "=NETWORKDAYS(B2, C2, Holidays!$A$2:$A$20)",
      explanation:
        "Calculates working days between Received Date (B2) and Closure Date (C2), excluding Saturday/Sunday (and optional holiday range).",
      whereToApply: "Add a 'Working Days' helper column in Row 2 and fill down.",
    };
  }
  if (lower.includes("lookup") || lower.includes("match") || lower.includes("pull")) {
    return {
      primaryFormula: '=XLOOKUP(A2, ReferenceSheet!$A$2:$A$500, ReferenceSheet!$B$2:$B$500, "Not Found")',
      compatibleVariant: '=IFERROR(INDEX(ReferenceSheet!$B$2:$B$500, MATCH(A2, ReferenceSheet!$A$2:$A$500, 0)), "Not Found")',
      explanation:
        "Matches key A2 against ReferenceSheet and returns the corresponding value safely without #N/A errors.",
      whereToApply: "Place in the target lookup column next to your key ID.",
    };
  }
  if (lower.includes("count") || lower.includes("sum") || lower.includes("below") || lower.includes("older")) {
    return {
      primaryFormula: '=COUNTIFS(D2:D500, "<90%", E2:E500, ">3")',
      compatibleVariant: '=SUMIFS(F2:F500, B2:B500, "Active", E2:E500, ">3")',
      explanation:
        "Counts or sums rows meeting multiple operational thresholds simultaneously using actual column ranges.",
      whereToApply: "Place in your KPI summary header block or team rollup table.",
    };
  }
  return {
    primaryFormula: '=IF(AND(D2<90, E2>3), "SLA Risk", "On Track")',
    compatibleVariant: '=IFS(E2>3, "Breach Risk", D2<90, "Watch", TRUE, "On Track")',
    explanation:
      "Classifies each row into clear operational buckets based on threshold conditions.",
    whereToApply: "Add a 'Status Flag' column to your report sheet and filter by exception.",
  };
}

export function toCsvString(table: ParsedTable): string {
  if (table.headers.length === 0) return "";
  const escapeCell = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    table.headers.map(escapeCell).join(","),
    ...table.rows.map((r) => table.headers.map((h) => escapeCell(r[h] ?? "")).join(",")),
  ];
  return lines.join("\r\n");
}
