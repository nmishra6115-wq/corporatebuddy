import type { PresentOSWorkbookReport } from "./presentosExcelIntelligence";
export type PresentOSMode =
  | "management"
  | "operations"
  | "client"
  | "project"
  | "training"
  | "custom";

export type PresentOSQuickAction =
  | "create"
  | "excel"
  | "document"
  | "meetingos"
  | "improve";

export interface PresentOSSourceItem {
  id: string;
  name: string;
  kind: "text" | "csv" | "xlsx" | "pdf" | "docx" | "pptx" | "meetingos";
  content: string;
  verified: boolean;
}

export interface PresentOSOutlineSlide {
  id: string;
  slideNumber: number;
  title: string;
  purpose: string;
  keyPoints: string[];
  visualSuggestion: string;
  missingInfo: string[];
  executiveTakeaway?: string;
  layoutKind?: "hero" | "kpi-grid" | "split-table" | "action-matrix";
  kpiHighlights?: Array<{ label: string; value: string; delta?: string }>;
  speakerNotes?: string;
  sourceCitations?: string[];
  structuredTable?: { headers: string[]; rows: string[][] };
  sourceGrounded: boolean;
}

export interface PresentOSSpec {
  title: string;
  tagline: string;
  mode: PresentOSMode;
  quickAction: PresentOSQuickAction;
  audience: string;
  tone: string;
  storylineSummary: string;
  isGeneralDraft: boolean;
  sourceCitations?: string[];
  workbookReport?: PresentOSWorkbookReport | null;
  slides: PresentOSOutlineSlide[];
}

export const PRESENTOS_MODES: { id: PresentOSMode; label: string; focus: string }[] = [
  { id: "management", label: "Management Review", focus: "Executive summary, KPIs, achievements, risks, recommendations, action plan" },
  { id: "operations", label: "Operations Performance Review", focus: "Productivity, SLA, backlog, quality, capacity, trends, escalations, owners" },
  { id: "client", label: "Client Business Review", focus: "Service performance, deliverables, KPI trends, resolutions, dependencies, priorities" },
  { id: "project", label: "Project Status Review", focus: "Objectives, milestones, completed work, risks, dependencies, upcoming deliverables" },
  { id: "training", label: "Training Presentation", focus: "Learning objectives, explanations, examples, process flow, knowledge checks, takeaways" },
  { id: "custom", label: "Custom AI Presentation", focus: "Adapts storyline and slide structure directly to your prompt and sources" },
];

export const PRESENTOS_QUICK_ACTIONS: { id: PresentOSQuickAction; label: string; hint: string }[] = [
  { id: "create", label: "Create Presentation", hint: "Turn a prompt or brief into a structured deck" },
  { id: "excel", label: "Excel to Slides", hint: "Convert CSV/Excel metrics into KPI & trend slides" },
  { id: "document", label: "Document to Slides", hint: "Distil reports, notes, or specs into executive slides" },
  { id: "meetingos", label: "MeetingOS to Slides", hint: "Turn meeting decisions & action items into a review" },
  { id: "improve", label: "Improve Existing PPT", hint: "Restructure rough deck notes into clearer slides" },
];

function inferModeFromPrompt(prompt: string, fallback: PresentOSMode): PresentOSMode {
  const p = prompt.toLowerCase();
  if (p.includes("client") || p.includes("qbr") || p.includes("account")) return "client";
  if (p.includes("operation") || p.includes("sla") || p.includes("backlog") || p.includes("productivity")) return "operations";
  if (p.includes("project") || p.includes("milestone") || p.includes("sprint")) return "project";
  if (p.includes("train") || p.includes("onboarding") || p.includes("workshop")) return "training";
  if (p.includes("management") || p.includes("board") || p.includes("leadership") || p.includes("executive")) return "management";
  return fallback;
}

function buildModeBlueprints(
  mode: PresentOSMode,
  prompt: string,
  hasSource: boolean
): Omit<PresentOSOutlineSlide, "id" | "slideNumber">[] {
  const topic = prompt.trim() || "Corporate Business Review";
  const grounded = hasSource;
  const missingDefault = hasSource ? [] : ["Attach source report or verified KPI numbers to replace general placeholders"];

  switch (mode) {
    case "operations":
      return [
        {
          title: `Executive Snapshot — ${topic.slice(0, 48)}`,
          purpose: "Establish current operational standing and primary focus areas",
          keyPoints: ["Headline volume & throughput summary", "Primary variance vs. target", "Immediate leadership attention items"],
          visualSuggestion: "KPI Summary Cards + Headline Callout",
          missingInfo: missingDefault,
          sourceGrounded: grounded,
        },
        {
          title: "Productivity & Capacity Performance",
          purpose: "Compare output against scheduled capacity and shift coverage",
          keyPoints: ["Period-over-period productivity trend", "Active capacity vs. planned headcount", "Bottlenecks by queue or process"],
          visualSuggestion: "Bar Chart (Actual vs. Target) + Capacity Callout",
          missingInfo: hasSource ? [] : ["Source productivity & headcount figures"],
          sourceGrounded: grounded,
        },
        {
          title: "SLA Adherence & Quality Scorecard",
          purpose: "Evaluate service delivery speed alongside defect/accuracy rates",
          keyPoints: ["SLA achievement % and breach drivers", "Quality score movement and error categories", "Trade-offs between speed and quality"],
          visualSuggestion: "Dual Trend Line Chart + Compact Metric Table",
          missingInfo: hasSource ? [] : ["SLA % and quality audit percentages"],
          sourceGrounded: grounded,
        },
        {
          title: "Backlog Trends & Escalation Risks",
          purpose: "Highlight aging items, escalations, and operational exposure",
          keyPoints: ["Open backlog volume and age buckets", "Active escalations and root-cause hypotheses", "Client or upstream dependencies"],
          visualSuggestion: "Stacked Bar Chart (Backlog Aging) + Risk Matrix",
          missingInfo: hasSource ? [] : ["Current backlog counts and aging split"],
          sourceGrounded: grounded,
        },
        {
          title: "Corrective Action Plan & Ownership",
          purpose: "Assign concrete owners, milestones, and target dates",
          keyPoints: ["Priority containment steps", "Process & staffing adjustments", "Owner, target date, and verification metric"],
          visualSuggestion: "Structured Action Tracker Table",
          missingInfo: ["Action owner names and target completion dates"],
          sourceGrounded: false,
        },
      ];
    case "client":
      return [
        {
          title: `Client Business Review — ${topic.slice(0, 46)}`,
          purpose: "Set context for partnership health and review period",
          keyPoints: ["Review window and scope", "Key service highlights", "Strategic alignment priorities"],
          visualSuggestion: "Title + Executive Summary Layout",
          missingInfo: missingDefault,
          sourceGrounded: grounded,
        },
        {
          title: "Service Performance & KPI Trends",
          purpose: "Demonstrate SLA reliability and operational consistency",
          keyPoints: ["Core SLA and turnaround metrics", "Multi-period trend direction", "Variance explanation"],
          visualSuggestion: "Line Chart + KPI Summary Strip",
          missingInfo: hasSource ? [] : ["Client-facing SLA and volume figures"],
          sourceGrounded: grounded,
        },
        {
          title: "Key Deliverables & Value Delivered",
          purpose: "Summarize completed milestones and business outcomes",
          keyPoints: ["Completed deliverables in period", "Cycle-time or efficiency improvements", "Stakeholder feedback"],
          visualSuggestion: "Milestone Timeline + Structured Highlights",
          missingInfo: missingDefault,
          sourceGrounded: grounded,
        },
        {
          title: "Issues, Resolutions & Dependencies",
          purpose: "Address open friction transparently with dependencies",
          keyPoints: ["Resolved incidents and root causes", "Open client dependencies or approvals", "Mitigation safeguards"],
          visualSuggestion: "Comparison Table (Issue / Status / Dependency)",
          missingInfo: ["Pending client approval dates"],
          sourceGrounded: false,
        },
        {
          title: "Upcoming Priorities & Next Steps",
          purpose: "Align on next-period roadmap and joint actions",
          keyPoints: ["Next-cycle deliverables", "Joint governance cadences", "Agreed next steps"],
          visualSuggestion: "Action Plan + Next Steps Layout",
          missingInfo: ["Target dates for next-cycle deliverables"],
          sourceGrounded: false,
        },
      ];
    case "project":
      return [
        {
          title: `Project Status — ${topic.slice(0, 50)}`,
          purpose: "Provide overall RAG status and core objectives",
          keyPoints: ["Project charter & target outcome", "Overall health status", "Critical path summary"],
          visualSuggestion: "Executive Summary + Status Indicators",
          missingInfo: missingDefault,
          sourceGrounded: grounded,
        },
        {
          title: "Milestones & Completed Work",
          purpose: "Show progress against schedule",
          keyPoints: ["Completed deliverables", "Milestone schedule variance", "In-flight workstreams"],
          visualSuggestion: "Timeline / Milestone Progress Table",
          missingInfo: missingDefault,
          sourceGrounded: grounded,
        },
        {
          title: "Risks, Blockers & Dependencies",
          purpose: "Surface delivery threats early",
          keyPoints: ["Top technical or resource risks", "External dependencies", "Mitigation actions"],
          visualSuggestion: "Risk Matrix + Dependency List",
          missingInfo: ["Risk owners and contingency dates"],
          sourceGrounded: false,
        },
        {
          title: "Upcoming Deliverables & Decisions Needed",
          purpose: "Drive leadership decisions for the next phase",
          keyPoints: ["Next 2–4 week deliverables", "Resource or scope decisions required", "Success criteria"],
          visualSuggestion: "Action Plan & Decision Table",
          missingInfo: ["Decision deadlines"],
          sourceGrounded: false,
        },
      ];
    case "training":
      return [
        {
          title: `Training Overview — ${topic.slice(0, 48)}`,
          purpose: "Define learning outcomes and session agenda",
          keyPoints: ["Who this session is for", "3–4 core learning objectives", "Expected practical takeaway"],
          visualSuggestion: "Learning Objectives Grid",
          missingInfo: missingDefault,
          sourceGrounded: grounded,
        },
        {
          title: "Core Concepts & Workflow",
          purpose: "Explain the process clearly before examples",
          keyPoints: ["Key rules and definitions", "End-to-end process flow", "Common pitfalls to avoid"],
          visualSuggestion: "Process Flow Diagram + Key Callouts",
          missingInfo: missingDefault,
          sourceGrounded: grounded,
        },
        {
          title: "Worked Examples & Knowledge Check",
          purpose: "Reinforce application with realistic scenarios",
          keyPoints: ["Walkthrough example", "Scenario-based check questions", "Summary checklist"],
          visualSuggestion: "Before/After Comparison + Checklist",
          missingInfo: missingDefault,
          sourceGrounded: grounded,
        },
      ];
    case "management":
    case "custom":
    default:
      return [
        {
          title: `Executive Summary — ${topic.slice(0, 48)}`,
          purpose: "Give leadership the headline takeaway upfront",
          keyPoints: ["Core business situation", "Primary performance signals", "Key decision or recommendation"],
          visualSuggestion: "Executive Summary + KPI Strip",
          missingInfo: missingDefault,
          sourceGrounded: grounded,
        },
        {
          title: "Performance & Key Findings",
          purpose: "Present evidence-backed observations and trends",
          keyPoints: ["Observation: what the numbers show", "Interpretation: what it may indicate", "Business impact on stakeholders"],
          visualSuggestion: "Chart + Structured Insight Blocks",
          missingInfo: hasSource ? [] : ["Verified metrics or source report values"],
          sourceGrounded: grounded,
        },
        {
          title: "Risks, Constraints & Open Questions",
          purpose: "Highlight uncertainties without fabricating causes",
          keyPoints: ["Key operational or commercial risks", "Data gaps requiring investigation", "Dependencies"],
          visualSuggestion: "Risk & Gap Table",
          missingInfo: ["Confirmed root causes where data is incomplete"],
          sourceGrounded: false,
        },
        {
          title: "Recommendations & Action Plan",
          purpose: "Translate insights into accountable next steps",
          keyPoints: ["Recommended options and trade-offs", "Action items, owners, and timelines", "Follow-up review checkpoint"],
          visualSuggestion: "Action Plan Table",
          missingInfo: ["Assigned owners and target dates"],
          sourceGrounded: false,
        },
      ];
  }
}

export function generatePresentOSSpec(params: {
  prompt: string;
  mode: PresentOSMode;
  quickAction: PresentOSQuickAction;
  audience: string;
  tone: string;
  slideCount: number;
  sources: PresentOSSourceItem[];
}): PresentOSSpec {
  const cleanPrompt = params.prompt.trim() || "Weekly Operations & Management Review";
  const resolvedMode = inferModeFromPrompt(cleanPrompt, params.mode);
  const hasSource = params.sources.some((s) => s.content.trim().length > 0);
  const rawBlueprints = buildModeBlueprints(resolvedMode, cleanPrompt, hasSource);

  const clampedCount = Math.max(3, Math.min(12, params.slideCount || rawBlueprints.length));
  const selected = rawBlueprints.slice(0, clampedCount);
  while (selected.length < clampedCount) {
    selected.push({
      title: `Supporting Detail — Slide ${selected.length + 1}`,
      purpose: "Expand on supporting metrics or operational context",
      keyPoints: ["Supporting data point", "Context or comparison", "Next step"],
      visualSuggestion: "Structured Bullet + Metric Card",
      missingInfo: hasSource ? [] : ["Supporting source data"],
      sourceGrounded: hasSource,
    });
  }

  const slides: PresentOSOutlineSlide[] = selected.map((s, idx) => ({
    ...s,
    id: `slide-${idx + 1}-${Date.now()}`,
    slideNumber: idx + 1,
  }));

  return {
    title: cleanPrompt.length > 72 ? `${cleanPrompt.slice(0, 69)}...` : cleanPrompt,
    tagline: "From rough ideas and business data to executive-ready presentations.",
    mode: resolvedMode,
    quickAction: params.quickAction,
    audience: params.audience.trim() || "Senior Management & Stakeholders",
    tone: params.tone.trim() || "Executive, concise, evidence-grounded",
    storylineSummary: hasSource
      ? "Structured from your uploaded/pasted source material into context, performance findings, risks, and actionable recommendations."
      : "General-purpose draft outline created from your prompt—attach source files or verified figures to ground metrics.",
    isGeneralDraft: !hasSource,
    slides,
  };
}
export function applyWorkbookIntelligenceToSpec(
  spec: PresentOSSpec,
  report: PresentOSWorkbookReport
): PresentOSSpec {
  const topMetrics = report.metrics.slice(0, 4);
  const metricBullets = topMetrics.map(
    (m) =>
      `${m.column}: avg ${m.average}, sum ${m.sum}, range ${m.min}–${m.max}, first-to-last delta ${m.delta}${m.deltaPct !== null ? ` (${m.deltaPct}%)` : ""} [${m.citation.fileName} · ${m.citation.sheetName}!${m.citation.location}]`
  );
  const insightBullets = report.insights.slice(0, 3).map(
    (ins) => `Observation: ${ins.observation} | Interpretation: ${ins.interpretation} | Recommendation: ${ins.recommendation}`
  );

  const kpiSlide = {
    id: `slide-kpi-${Date.now()}`,
    slideNumber: 2,
    title: `Verified Workbook KPIs & Trends (${report.fileName})`,
    purpose: "Present deterministic metrics and source-cited trends from uploaded spreadsheet",
    keyPoints: metricBullets.length > 0 ? metricBullets : [`Parsed ${report.rowCount} data rows across ${report.columnCount} columns.`],
    visualSuggestion: "KPI Summary Cards + Source Citations",
    missingInfo: [],
    sourceGrounded: true,
    sourceCitations: report.citations,
  };

  const tableSlide = {
    id: `slide-table-${Date.now()}`,
    slideNumber: 3,
    title: `Source Data Sample & Insight Breakdown (${report.activeSheet})`,
    purpose: "Show traceable source rows and structured business insight blocks",
    keyPoints: insightBullets.length > 0 ? insightBullets : ["Review source rows for period-over-period context."],
    visualSuggestion: "Structured Metric Table + Insight Notes",
    missingInfo: [],
    sourceGrounded: true,
    sourceCitations: report.citations,
    structuredTable:
      report.headers.length > 0 && report.sampleRows.length > 0
        ? { headers: report.headers.slice(0, 6), rows: report.sampleRows.map((r) => r.slice(0, 6)) }
        : undefined,
  };

  const baseSlides = [spec.slides[0], kpiSlide, tableSlide, ...spec.slides.slice(1)].filter(Boolean).map((sl, idx) => ({
    ...sl,
    slideNumber: idx + 1,
    sourceGrounded: true,
    sourceCitations: sl.sourceCitations && sl.sourceCitations.length > 0 ? sl.sourceCitations : report.citations,
  }));

  return {
    ...spec,
    isGeneralDraft: false,
    mode: "management",
    quickAction: "create",
    tone: "executive",
    storylineSummary: `Grounded in ${report.fileName} (${report.activeSheet}, ${report.rowCount} rows) with deterministic KPI/variance math and source citations.`,
    sourceCitations: report.citations,
    workbookReport: report,
    slides: baseSlides,
  };
}
export type PresentOSTemplateId =
  | "executive-minimal"
  | "modern-corporate"
  | "client-review"
  | "data-analytics"
  | "training-learning";

export interface PresentOSTemplate {
  id: PresentOSTemplateId;
  name: string;
  description: string;
  bgHex: string;
  headerBgHex: string;
  accentHex: string;
  textHex: string;
}

export const PRESENTOS_TEMPLATES: PresentOSTemplate[] = [
  {
    id: "executive-minimal",
    name: "Executive Minimal",
    description: "Clean white canvas, deep navy headers, subtle violet accent",
    bgHex: "FFFFFF",
    headerBgHex: "0B192C",
    accentHex: "7C3AED",
    textHex: "0F172A",
  },
  {
    id: "modern-corporate",
    name: "Modern Corporate",
    description: "Slate-tinted slides with structured navy & indigo framing",
    bgHex: "F8FAFC",
    headerBgHex: "0F294A",
    accentHex: "4F46E5",
    textHex: "1E293B",
  },
  {
    id: "client-review",
    name: "Client Business Review",
    description: "Warm neutral backdrop with crisp teal/navy highlights",
    bgHex: "FAFDFC",
    headerBgHex: "112D4E",
    accentHex: "0D9488",
    textHex: "0F172A",
  },
  {
    id: "data-analytics",
    name: "Data & Analytics",
    description: "High-contrast layout tailored for KPIs, tables & trends",
    bgHex: "F1F5F9",
    headerBgHex: "091E3A",
    accentHex: "2563EB",
    textHex: "0B192C",
  },
  {
    id: "training-learning",
    name: "Training & Learning",
    description: "Structured instructional layout with clear step accents",
    bgHex: "FFFBEB",
    headerBgHex: "1E293B",
    accentHex: "D97706",
    textHex: "1E293B",
  },
];

function extractSanctionsTopic(raw: string): string {
  const cleaned = (raw || "")
    .replace(/^(please\s+)?(make|create|build|generate|write|prepare)\s+(a\s+)?(detailed\s+|comprehensive\s+|executive\s+|short\s+|quick\s+)?(presentation|ppt|deck|slides?)\s+(on|about|for|regarding)\s+/i, "")
    .replace(/,?\s*it\s+should\s+only\s+include[\s\S]*$/i, "")
    .replace(/,?\s*nothing\s+else[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Sanctions Screening";
  return cleaned
    .split(" ")
    .map((w) => (w.length <= 4 && w === w.toLowerCase() ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function buildSanctionsFocusedSlides(topic: string, promptLower: string): PresentOSOutlineSlide[] {
  const wantsWhatIs = /\bwhat\s+is\b/i.test(promptLower) || /\bdefinition\b/i.test(promptLower);
  const wantsTypes = /\btype\s+of\s+sanction|\btypes\b/i.test(promptLower);
  const wantsCountries = /\bsanction\s+country|\bcountries\b|\bcountry\b|\bregimes?\b|\bjurisdictions?\b/i.test(promptLower);
  const wantsOther = /\bother\s+sanction|\brelated\s+things|\blists?\b|\bscreening\b|\bcontrols?\b/i.test(promptLower);

  const includeAll = !wantsWhatIs && !wantsTypes && !wantsCountries && !wantsOther;
  const items: { title: string; takeaway: string; points: string[] }[] = [];

  if (includeAll || wantsWhatIs) {
    items.push({
      title: `What Is ${topic}?`,
      takeaway: `Sanctions screening checks customers, counterparties, and transactions against legal prohibitions issued by authorities and international bodies.`,
      points: [
        "Core purpose: prevent dealings with designated individuals, entities, vessels, or restricted jurisdictions.",
        "Applies across onboarding, periodic updates, counterparty changes, and payment/trade flows.",
        "Distinguishes legal prohibition/restriction obligations from broader internal risk appetite checks.",
      ],
    });
  }

  if (includeAll || wantsTypes) {
    items.push({
      title: "Types of Sanctions",
      takeaway: "Sanctions regimes differ in legal reach—ranging from targeted asset freezes to sectoral, trade, and secondary restrictions.",
      points: [
        "Targeted financial sanctions: asset freezes and prohibitions on making funds or economic resources available to listed persons/entities.",
        "Comprehensive / country-wide sanctions: broad embargoes restricting most trade, financing, or services tied to a jurisdiction.",
        "Sectoral sanctions: targeted restrictions on specific industries (e.g., energy, defense, finance, dual-use technology) or debt/equity instruments.",
        "Secondary sanctions: extraterritorial exposure where non-US/non-issuing firms face penalties for significant dealings with designated targets.",
      ],
    });
  }

  if (includeAll || wantsCountries) {
    items.push({
      title: "Sanctioned Countries & Regimes",
      takeaway: "Country and territory restrictions combine comprehensive embargoes, elevated-risk programs, and dynamic list updates.",
      points: [
        "Comprehensive country/territory programs (e.g., North Korea/DPRK, Iran, Syria, Cuba, and covered regions such as Crimea/Donetsk/Zaporizhzhia/Kherson under specific regimes).",
        "Targeted or sectoral country regimes (e.g., Russia/Belarus targeted measures, Venezuela, Myanmar, Venezuela/Sudan/Yemen/Somalia-style targeted frameworks).",
        "Geographic risk covers incorporation, residence, nationality, port/vessel flags, shipment origin/destination, and correspondent routing.",
        "Country lists evolve frequently via new designations, delistings, wind-down licenses, and general licenses.",
      ],
    });
  }

  if (includeAll || wantsOther) {
    items.push({
      title: "Key Lists, Screening Mechanics & Controls",
      takeaway: "Effective sanctions screening pairs authoritative list coverage with name/identifier matching, hit review, and change management.",
      points: [
        "Primary list sources: UN Security Council, US OFAC (SDN & Non-SDN), EU consolidated lists, UK OFSI, and applicable domestic/local lists.",
        "Screening inputs: legal name, aliases/AKAs, date/year of birth or incorporation, addresses, passport/Tax ID/LEI/BIC, and ownership/control links.",
        "Matching & tuning: exact identifier checks plus fuzzy name matching calibrated to reduce false positives without missing true hits.",
        "Hit handling & governance: hold/investigation workflow, disposition documentation, list version tracking, and periodic re-screening on list updates.",
      ],
    });
  }

  return items.map((item, idx) => ({
    id: `sanction-slide-${idx + 1}`,
    slideNumber: idx + 1,
    title: item.title,
    purpose: item.takeaway,
    executiveTakeaway: item.takeaway,
    layoutKind: idx === 0 ? "hero" : "split-table",
    kpiHighlights: [],
    keyPoints: item.points,
    structuredTable: undefined,
    visualSuggestion: idx === 0 ? "hero" : "split-table",
    missingInfo: [],
    sourceGrounded: false,
    sourceCitations: [],
    speakerNotes: undefined,
  }));
}

export function generateFromSinglePrompt(
  prompt: string,
  templateId: PresentOSTemplateId = "executive-minimal",
  sources: PresentOSSourceItem[] = []
): PresentOSSpec {
  const promptLower = (prompt || "").toLowerCase();
  const cleanTitle = extractSanctionsTopic(prompt);
  const isSanctionsPrompt = /\bsanction|\bofac|\bwatchlist|\bembargo/i.test(promptLower);

  const slides = isSanctionsPrompt
    ? buildSanctionsFocusedSlides(cleanTitle, promptLower)
    : [
        {
          id: "slide-1",
          slideNumber: 1,
          title: `${cleanTitle}: Core Overview`,
          purpose: `Key concepts and scope for ${cleanTitle}`,
          executiveTakeaway: `Structured overview of ${cleanTitle} tailored to the requested topic.`,
          layoutKind: "hero" as const,
          kpiHighlights: [],
          keyPoints: [
            `Definition and core purpose of ${cleanTitle.toLowerCase()}.`,
            "Primary categories, scope boundaries, and key terms.",
            "Practical considerations and compliance/operational implications.",
          ],
          structuredTable: undefined,
          visualSuggestion: "hero",
          missingInfo: [],
          sourceGrounded: sources.length > 0,
          sourceCitations: sources.map((s) => s.name),
          speakerNotes: undefined,
        },
      ];

  return {
    title: cleanTitle,
    tagline: cleanTitle,
    storylineSummary: `Focused presentation on ${cleanTitle}.`,
    audience: "Target Audience",
    isGeneralDraft: false,
    mode: "management",
    quickAction: "create",
    tone: "executive",
    slides,
  };
}
export function enrichSpecForExecutiveUse(spec: PresentOSSpec): PresentOSSpec {
  const enrichedSlides = spec.slides.map((sl, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === spec.slides.length - 1;
    const hasTable = Boolean(sl.structuredTable && sl.structuredTable.headers.length > 0);
    const layoutKind: "hero" | "kpi-grid" | "split-table" | "action-matrix" =
      isFirst ? "hero" : hasTable ? "split-table" : isLast ? "action-matrix" : idx === 1 ? "kpi-grid" : "split-table";

    const kpiHighlights =
      layoutKind === "kpi-grid"
        ? [
            { label: "Primary Focus", value: sl.title.slice(0, 26), delta: "Tracked" },
            { label: "Key Points", value: `${sl.keyPoints.length} items`, delta: "Structured" },
            {
              label: "Data Grounding",
              value: sl.sourceGrounded ? "Source-Backed" : "Draft",
              delta: sl.missingInfo.length > 0 ? `${sl.missingInfo.length} to verify` : "Ready",
            },
          ]
        : undefined;

    const structuredTable =
      sl.structuredTable ??
      (layoutKind === "action-matrix"
        ? {
            headers: ["Workstream / Item", "Owner", "Target Timeline", "Status"],
            rows: sl.keyPoints.slice(0, 4).map((kp, i) => [
              kp.slice(0, 48),
              `Lead ${i + 1}`,
              `Week ${i + 1}`,
              "Planned",
            ]),
          }
        : undefined);

    const executiveTakeaway =
      sl.executiveTakeaway ??
      `Core message: ${sl.purpose || sl.keyPoints[0] || sl.title}`;

    const speakerNotes =
      sl.speakerNotes ??
      [
        `Opening (${sl.title}): ${executiveTakeaway}.`,
        ...sl.keyPoints.map((kp) => `Point: ${kp}`),
        sl.missingInfo.length > 0
          ? `Confirm before presenting: ${sl.missingInfo.join("; ")}.`
          : "All points aligned with deck storyline.",
      ].join("\n");

    return {
      ...sl,
      layoutKind,
      executiveTakeaway,
      kpiHighlights,
      structuredTable,
      speakerNotes,
    };
  });

  return {
    ...spec,
    slides: enrichedSlides,
  };
}
export function buildDomainBriefSlides(prompt: string, isGrounded: boolean): PresentOSOutlineSlide[] {
  const clean = prompt.trim() || "Executive Briefing";
  const lower = clean.toLowerCase();

  if (lower.includes("kyc") || lower.includes("aml") || lower.includes("cdd") || lower.includes("edd") || lower.includes("sanction")) {
    return [
      {
        id: "kyc-1",
        slideNumber: 1,
        title: `${clean} — Executive Brief`,
        purpose: "Frame objective, target audience, and core compliance/operational takeaway",
        keyPoints: [
          `Objective: Deliver a clear, end-to-end walkthrough of ${clean}`,
          "Scope covers onboarding intake, verification, risk tiering, screening, and exceptions",
          "Designed for fast alignment across ops, risk, and stakeholder teams",
        ],
        visualSuggestion: "Title & Executive Summary",
        missingInfo: isGrounded ? [] : ["Confirm target region/entity scope and effective date"],
        sourceGrounded: isGrounded,
        layoutKind: "hero",
        executiveTakeaway: `Core message: ${clean} standardizes how customer verification, risk checks, and exceptions move from intake to sign-off.`,
        kpiHighlights: [
          { label: "Core Stages", value: "5 Stages", delta: "End-to-End" },
          { label: "Risk Controls", value: "CDD · EDD · PEP", delta: "Covered" },
          { label: "Readiness", value: isGrounded ? "Source-Backed" : "Brief Draft", delta: isGrounded ? "Verified" : "Confirm policy details" },
        ],
        speakerNotes: `Introduce ${clean} as a practical walkthrough from first customer touchpoint to final verification sign-off.`,
      },
      {
        id: "kyc-2",
        slideNumber: 2,
        title: "Customer Onboarding & CDD Flow",
        purpose: "Walk through intake, identity verification, and standard Customer Due Diligence",
        keyPoints: [
          "Collect mandatory identity, address, and beneficial ownership details at intake",
          "Validate primary KYC documents and run automated liveness / document authenticity checks",
          "Assign initial risk rating before activating restricted product capabilities",
        ],
        visualSuggestion: "Step-by-Step Process Flow",
        missingInfo: isGrounded ? [] : ["Attach exact document checklist and SLA turnaround times"],
        sourceGrounded: isGrounded,
        layoutKind: "kpi-grid",
        executiveTakeaway: "Core message: Clean intake and upfront CDD prevent downstream rework and compliance bottlenecks.",
        kpiHighlights: [
          { label: "Step 1", value: "Intake & ID", delta: "Mandatory fields" },
          { label: "Step 2", value: "Doc & Liveness", delta: "Authenticity check" },
          { label: "Step 3", value: "Risk Rating", delta: "Pre-activation" },
        ],
        speakerNotes: "Walk through how intake feeds CDD checks and where standard cases clear automatically.",
      },
      {
        id: "kyc-3",
        slideNumber: 3,
        title: "Sanctions, PEP Screening & EDD Triggers",
        purpose: "Highlight high-risk triggers, enhanced due diligence, and alert disposition",
        keyPoints: [
          "Run sanctions, watchlist, and PEP screening at onboarding and on ongoing updates",
          "Route high-risk profiles, complex ownership, or alert hits to Enhanced Due Diligence (EDD)",
          "Document clear disposition rationale and evidence before clearing or escalating",
        ],
        visualSuggestion: "Risk Matrix & Escalation Paths",
        missingInfo: isGrounded ? [] : ["Confirm EDD threshold rules and escalation queue owners"],
        sourceGrounded: isGrounded,
        layoutKind: "split-table",
        executiveTakeaway: "Core message: Screening and EDD turn high-risk signals into documented, defensible decisions.",
        structuredTable: {
          headers: ["Control Area", "Trigger", "Expected Action", "Evidence Logged"],
          rows: [
            ["Sanctions / Watchlist", "Name / entity match", "Hold & analyst review", "Match disposition note"],
            ["PEP Screening", "Politically exposed link", "EDD questionnaire + approval", "Source of wealth proof"],
            ["High-Risk Profile", "Jurisdiction / structure", "Periodic refresh & limits", "Reviewer sign-off"],
          ],
        },
        speakerNotes: "Explain how alerts and EDD triggers are handled so reviewers and stakeholders share the same expectations.",
      },
      {
        id: "kyc-4",
        slideNumber: 4,
        title: "Exceptions, Remediation & Action Plan",
        purpose: "Summarize open gaps, owners, and next steps to finalize the walkthrough",
        keyPoints: [
          "Track incomplete docs, re-verification cases, and policy edge cases in a single queue",
          "Assign explicit owners and target dates for policy/SOP confirmation",
          "Schedule sign-off review once source metrics or policy thresholds are attached",
        ],
        visualSuggestion: "Action Plan Table",
        missingInfo: isGrounded ? [] : ["Assign owners and target dates for open verification items"],
        sourceGrounded: isGrounded,
        layoutKind: "action-matrix",
        executiveTakeaway: "Core message: Clear owners and target dates convert a KYC walkthrough into tracked execution.",
        structuredTable: {
          headers: ["Workstream / Item", "Owner", "Target Timeline", "Status"],
          rows: [
            ["Confirm KYC policy & document rules", "Compliance Lead", "This Week", "In Review"],
            ["Validate screening & EDD thresholds", "Risk / Ops Lead", "This Week", "Pending Input"],
            ["Finalize walkthrough deck & sign-off", "Presenter", "Next Sync", "Ready"],
          ],
        },
        speakerNotes: "Close with clear owners and next steps so nothing stays ambiguous after the meeting.",
      },
    ];
  }

  return [
    {
      id: "brief-1",
      slideNumber: 1,
      title: `${clean} — Executive Brief`,
      purpose: "State the core thesis, context, and key takeaways upfront",
      keyPoints: [
        `Topic: ${clean}`,
        "Structured as a concise executive brief: context, current state, key findings, and next steps",
        "Built to be edited inline and exported straight to PowerPoint",
      ],
      visualSuggestion: "Executive Cover & Summary",
      missingInfo: isGrounded ? [] : ["Add specific target numbers or dates where applicable"],
      sourceGrounded: isGrounded,
      layoutKind: "hero",
      executiveTakeaway: `Core message: ${clean} summarized into decision-ready highlights and next steps.`,
      kpiHighlights: [
        { label: "Format", value: "Executive Brief", delta: "4 Core Slides" },
        { label: "Grounding", value: isGrounded ? "Source-Backed" : "Draft Brief", delta: isGrounded ? "Verified" : "Review details" },
        { label: "Export", value: "Editable .pptx", delta: "1-Click" },
      ],
      speakerNotes: `Frame ${clean} around why it matters now and what decision or alignment is needed.`,
    },
    {
      id: "brief-2",
      slideNumber: 2,
      title: "Current State & Key Signals",
      purpose: "Highlight headline metrics, progress, and notable shifts",
      keyPoints: [
        "Summarize primary performance or operational signals at a glance",
        "Separate verified data points from assumptions or open items",
        "Highlight what changed since the last review",
      ],
      visualSuggestion: "KPI Callout Cards",
      missingInfo: isGrounded ? [] : ["Attach CSV/Excel or paste notes to populate exact metrics"],
      sourceGrounded: isGrounded,
      layoutKind: "kpi-grid",
      executiveTakeaway: "Core message: Focus on the few signals that change decisions or priorities.",
      kpiHighlights: [
        { label: "Headline Signal", value: "Track & Verify", delta: "Baseline" },
        { label: "Variance", value: "Highlight Delta", delta: "Trend check" },
        { label: "Risk Watch", value: "Flag Blockers", delta: "Early signal" },
      ],
      speakerNotes: "Walk through the headline signals and call out any numbers that still need verification.",
    },
    {
      id: "brief-3",
      slideNumber: 3,
      title: "Breakdown, Risks & Trade-Offs",
      purpose: "Compare options, workstreams, or risk areas in a compact table",
      keyPoints: [
        "Compare key workstreams, drivers, or options side by side",
        "Call out dependencies, bottlenecks, and mitigations",
        "Keep bullets crisp and back claims with clear context",
      ],
      visualSuggestion: "Comparison Table",
      missingInfo: isGrounded ? [] : ["Confirm specific owner and impact per row"],
      sourceGrounded: isGrounded,
      layoutKind: "split-table",
      executiveTakeaway: "Core message: Side-by-side comparison makes trade-offs and risks obvious.",
      structuredTable: {
        headers: ["Area / Workstream", "Current Status", "Key Risk / Note", "Next Check"],
        rows: [
          ["Primary Priority", "Active", "Confirm target & dependencies", "Next review"],
          ["Secondary Stream", "In Progress", "Watch timeline & handoffs", "Next review"],
          ["Open Dependencies", "Needs Confirmation", "Verify owners & inputs", "Before sign-off"],
        ],
      },
      speakerNotes: "Use the table to compare workstreams and highlight where leadership input is needed.",
    },
    {
      id: "brief-4",
      slideNumber: 4,
      title: "Decisions & Next Steps",
      purpose: "Lock in owners, timelines, and immediate follow-ups",
      keyPoints: [
        "Confirm immediate decisions required from stakeholders",
        "Assign clear owners and target dates for follow-ups",
        "Export to .pptx for final polish and sharing",
      ],
      visualSuggestion: "Action Plan Table",
      missingInfo: isGrounded ? [] : ["Assign owners and due dates"],
      sourceGrounded: isGrounded,
      layoutKind: "action-matrix",
      executiveTakeaway: "Core message: Every brief ends with clear owners, dates, and next actions.",
      structuredTable: {
        headers: ["Action Item", "Owner", "Target Date", "Status"],
        rows: [
          ["Confirm key facts & numbers", "Owner TBD", "This Week", "Open"],
          ["Align stakeholders on next steps", "Lead TBD", "This Week", "Open"],
          ["Share finalized .pptx deck", "Presenter", "Post-Meeting", "Scheduled"],
        ],
      },
      speakerNotes: "Wrap up with concrete owners and target dates.",
    },
  ];
}
export async function refineSpecWithGemini(
  spec: PresentOSSpec,
  prompt: string,
  templateId: PresentOSTemplateId = "executive-minimal"
): Promise<{ spec: PresentOSSpec; aiRefined: boolean; reason?: string }> {
  try {
    const res = await fetch("/api/presentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, templateId }),
    });
    if (!res.ok) return { spec, aiRefined: false, reason: `http_${res.status}` };
    const json = await res.json();
    if (!json?.refined || !json?.data) {
      return { spec, aiRefined: false, reason: String(json?.reason || "not_refined") };
    }
    const incomingSlides = Array.isArray(json.data.slides) ? json.data.slides : [];
    const richSlides: PresentOSOutlineSlide[] = incomingSlides.map((inc: Record<string, unknown>, idx: number) => {
      const fallback = spec.slides[idx] || spec.slides[0];
      const keyPoints = Array.isArray(inc.keyPoints)
        ? inc.keyPoints.map((k: unknown) => String(k).trim()).filter(Boolean)
        : fallback?.keyPoints || [];
      const kpiHighlights = Array.isArray(inc.kpiHighlights)
        ? inc.kpiHighlights.slice(0, 3).map((k: unknown) => {
            const item = (k && typeof k === "object" ? k : {}) as Record<string, unknown>;
            return {
              label: String(item.label || "Focus Area"),
              value: String(item.value || "Defined"),
              delta: item.delta ? String(item.delta) : undefined,
            };
          })
        : fallback?.kpiHighlights;
      const rawTable = (inc.structuredTable && typeof inc.structuredTable === "object"
        ? inc.structuredTable
        : null) as { headers?: unknown[]; rows?: unknown[][] } | null;
      const structuredTable =
        rawTable && Array.isArray(rawTable.headers) && Array.isArray(rawTable.rows)
          ? {
              headers: rawTable.headers.map((h) => String(h)),
              rows: rawTable.rows.slice(0, 4).map((r) => (Array.isArray(r) ? r.map((c) => String(c)) : [])),
            }
          : fallback?.structuredTable;
      const layoutKind =
        inc.layoutKind === "hero" ||
        inc.layoutKind === "kpi-grid" ||
        inc.layoutKind === "split-table" ||
        inc.layoutKind === "action-matrix"
          ? inc.layoutKind
          : fallback?.layoutKind || "split-table";

      return {
        id: `gemini-${idx + 1}`,
        slideNumber: idx + 1,
        title: typeof inc.title === "string" && inc.title.trim() ? inc.title.trim() : `Slide ${idx + 1}`,
        purpose: typeof inc.purpose === "string" && inc.purpose.trim() ? inc.purpose.trim() : "",
        executiveTakeaway:
          typeof inc.executiveTakeaway === "string" && inc.executiveTakeaway.trim()
            ? inc.executiveTakeaway.trim()
            : undefined,
        layoutKind,
        kpiHighlights,
        keyPoints: keyPoints.length > 0 ? keyPoints : fallback?.keyPoints || [],
        structuredTable,
        visualSuggestion: layoutKind,
        missingInfo: [],
        sourceGrounded: true,
        sourceCitations: [`Gemini AI (${json.model || "flash"})`],
        speakerNotes:
          typeof inc.speakerNotes === "string" && inc.speakerNotes.trim()
            ? inc.speakerNotes.trim()
            : fallback?.speakerNotes,
      };
    });

    return {
      spec: enrichSpecForExecutiveUse({
        ...spec,
        title: typeof json.data.title === "string" && json.data.title.trim() ? json.data.title.trim() : prompt,
        tagline:
          typeof json.data.tagline === "string" && json.data.tagline.trim()
            ? json.data.tagline.trim()
            : spec.tagline,
        isGeneralDraft: false,
    mode: "management",
    quickAction: "create",
    tone: "executive",
        slides: richSlides.length > 0 ? richSlides : spec.slides,
      }),
      aiRefined: true,
    };
  } catch (err) {
    return { spec, aiRefined: false, reason: err instanceof Error ? err.message : "network_error" };
  }
}