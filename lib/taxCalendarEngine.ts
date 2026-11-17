export interface TaxDeadlineItem {
  date: string;
  title: string;
  category: "Statutory" | "Employer-Specific";
  appliesTo: string;
  briefNote: string;
  source: string;
  lastVerified: string;
}

export interface FilingGuideStep {
  step: number;
  title: string;
  briefAction: string;
}

export interface TaxCalendarBrief {
  briefSummary: string;
  financialYear: string;
  assessmentYear: string;
  deadlines: TaxDeadlineItem[];
  filingSteps: FilingGuideStep[];
  conceptNotes: Record<string, string>;
  disclaimer: string;
}

export function buildTaxCalendarBrief(
  financialYear: "2026-27" | "2025-26" = "2026-27",
  question?: string
): TaxCalendarBrief {
  const assessmentYear = financialYear === "2026-27" ? "2027-28" : "2026-27";

  const deadlines: TaxDeadlineItem[] = [
    {
      date: "2026-11-30",
      title: "Belated Income Tax Return (AY 2026-27)",
      category: "Statutory",
      appliesTo: "Individual salaried taxpayers who missed July 31, 2026",
      briefNote: "Subject to late fee / interest rules where applicable.",
      source: "Income Tax Department / CBDT",
      lastVerified: "2026-11-15",
    },
    {
      date: "2026-12-15",
      title: "3rd Advance Tax Instalment (FY 2026-27)",
      category: "Statutory",
      appliesTo: "Taxpayers with net tax liability of ₹10,000 or more after TDS",
      briefNote: "Cumulative 75% advance tax benchmark.",
      source: "Income Tax Department / CBDT",
      lastVerified: "2026-11-15",
    },
    {
      date: "2026-12-31",
      title: "Revised Income Tax Return (AY 2026-27)",
      category: "Statutory",
      appliesTo: "Salaried employees correcting an earlier filed return",
      briefNote: "Available before completion of relevant assessment year / CBDT window.",
      source: "Income Tax Department / CBDT",
      lastVerified: "2026-11-15",
    },
    {
      date: "2027-01-15",
      title: "Employer Investment Proof / Declaration Window",
      category: "Employer-Specific",
      appliesTo: "Salaried employees under Old Regime or company reimbursement rules",
      briefNote: "Verify exact cut-off date with your HR / Payroll team.",
      source: "Employer Payroll Policy",
      lastVerified: "2026-11-15",
    },
    {
      date: "2027-03-15",
      title: "4th Advance Tax Instalment (FY 2026-27)",
      category: "Statutory",
      appliesTo: "Taxpayers with net tax liability of ₹10,000 or more after TDS",
      briefNote: "100% advance tax benchmark for the financial year.",
      source: "Income Tax Department / CBDT",
      lastVerified: "2026-11-15",
    },
  ];

  const filingSteps: FilingGuideStep[] = [
    { step: 1, title: "Prepare documents", briefAction: "Collect PAN, Aadhaar, Form 16 (Parts A & B), and bank interest statements." },
    { step: 2, title: "Check Form 16", briefAction: "Match gross salary, PF, and TDS deducted with payslips." },
    { step: 3, title: "Review AIS", briefAction: "Verify Annual Information Statement entries and raise feedback if mismatched." },
    { step: 4, title: "Review Form 26AS", briefAction: "Confirm tax credit (TDS/TCS) matches Form 16." },
    { step: 5, title: "Check salary income", briefAction: "Confirm basic, HRA, perquisites, and exemptions." },
    { step: 6, title: "Check other income", briefAction: "Add savings interest, FD interest, or other reported receipts." },
    { step: 7, title: "Review deductions & exemptions", briefAction: "Check standard deduction and eligible regime-specific items." },
    { step: 8, title: "Choose tax regime", briefAction: "Compare New vs. Old regime net tax liability." },
    { step: 9, title: "Select ITR form", briefAction: "Salaried individuals with standard income typically check ITR-1 or ITR-2." },
    { step: 10, title: "Review tax calculation", briefAction: "Verify tax payable or refund due before submitting." },
    { step: 11, title: "Verify & submit", briefAction: "e-Verify return (e.g., Aadhaar OTP) to complete filing." },
  ];

  const q = (question ?? "").toLowerCase();
  const matchedHint = q.includes("26as")
    ? "Form 26AS shows tax deducted and deposited against your PAN; compare it with Form 16 Part A."
    : q.includes("ais")
      ? "AIS aggregates broader financial and TDS information reported to the tax department."
      : q.includes("tds")
        ? "TDS is tax deducted at source by your employer based on projected annual taxable income."
        : q.includes("form 16")
          ? "Form 16 is your employer's TDS certificate (Part A) and salary/deduction summary (Part B)."
          : "Select a topic or step below for a plain-language salaried filing guide.";

  return {
    briefSummary: `FY ${financialYear} (AY ${assessmentYear}) · ${deadlines.length} tracked milestones · ${matchedHint}`,
    financialYear,
    assessmentYear,
    deadlines,
    filingSteps,
    conceptNotes: {
      "Form 16": "Employer TDS certificate (Part A) and salary breakup summary (Part B).",
      "Form 26AS": "Annual tax credit statement showing TDS/TCS credited to your PAN.",
      AIS: "Annual Information Statement summarizing reported income and TDS data.",
      TDS: "Tax Deducted at Source withheld monthly by payroll against estimated tax.",
      "Standard Deduction": "Flat deduction available to salaried employees under applicable tax rules.",
      "New vs. Old Regime": "Compare slab rates, standard deduction, and eligible exemptions/deductions.",
    },
    disclaimer:
      "Informational guidance only; CorporateBuddy does not file returns or access government portals.",
  };
}
