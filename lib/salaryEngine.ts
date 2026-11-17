export type TaxRegime = "new" | "old";

export interface SalaryInput {
  annualCtc: number;
  state: string;
  taxRegime: TaxRegime;
  financialYear: "2026-27" | "2025-26";
  mode: "quick" | "advanced";
  basicPercent: number;
  hraPercentOfBasic: number;
  pfMode: "capped_1800" | "percent_of_basic" | "none";
  includeGratuity: boolean;
  variablePay: number;
  bonus: number;
  otherDeductionsMonthly: number;
  customBasicAnnual?: number;
  customHraAnnual?: number;
  customSpecialAnnual?: number;
  customConveyanceAnnual?: number;
  customOtherAllowanceAnnual?: number;
  customEmployerPfAnnual?: number;
  customEmployeePfAnnual?: number;
  customGratuityAnnual?: number;
  customProfessionalTaxMonthly?: number;
  oldRegimeDeductionsAnnual?: number;
}

export interface SalaryResult {
  briefSummary: string;
  annualCtc: number;
  monthlyCtc: number;
  monthlyGross: number;
  monthlyBasic: number;
  monthlyHra: number;
  monthlySpecial: number;
  monthlyConveyance: number;
  monthlyOtherAllowance: number;
  monthlyEmployerPf: number;
  monthlyEmployeePf: number;
  monthlyGratuity: number;
  monthlyProfessionalTax: number;
  monthlyEsiEmployee: number;
  monthlyEsiEmployer: number;
  monthlyOtherDeductions: number;
  annualTaxableIncome: number;
  annualIncomeTax: number;
  monthlyTds: number;
  estimatedMonthlyInHand: number;
  annualTakeHome: number;
  comparison: {
    newRegimeTax: number;
    oldRegimeTax: number;
    recommendedRegime: TaxRegime;
    annualTaxSavings: number;
  };
  assumptions: string[];
  explanations: Record<string, string>;
}

export const INDIAN_STATES_AND_UTS: string[] = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

// Deterministic state-wise monthly Professional Tax (standard high-slab salaried estimate; 0 where inapplicable)
const STATE_PT_MONTHLY: Record<string, number> = {
  Karnataka: 200,
  Maharashtra: 200,
  Telangana: 200,
  "Andhra Pradesh": 200,
  "Tamil Nadu": 208,
  "West Bengal": 200,
  Gujarat: 200,
  "Madhya Pradesh": 208,
  Kerala: 208,
  Odisha: 200,
  Assam: 208,
  Chhattisgarh: 208,
  Jharkhand: 208,
  Meghalaya: 208,
  Tripura: 208,
  Puducherry: 125,
};

function roundINR(val: number): number {
  return Math.round(Math.max(0, val));
}

export function getStateProfessionalTaxMonthly(state: string): number {
  return STATE_PT_MONTHLY[state] ?? 0;
}

function computeNewRegimeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  // FY 2026-27 New Regime slabs
  const slabs: Array<[number, number, number]> = [
    [0, 400000, 0],
    [400000, 800000, 0.05],
    [800000, 1200000, 0.10],
    [1200000, 1600000, 0.15],
    [1600000, 2000000, 0.20],
    [2000000, 2400000, 0.25],
    [2400000, Infinity, 0.30],
  ];

  let tax = 0;
  for (const [low, high, rate] of slabs) {
    if (taxableIncome > low) {
      const slice = Math.min(taxableIncome, high) - low;
      tax += slice * rate;
    }
  }

  // Section 87A rebate up to ₹12,00,000 taxable income under New Regime
  if (taxableIncome <= 1200000) {
    tax = 0;
  }

  // Surcharge for high income
  let surcharge = 0;
  if (taxableIncome > 50000000) surcharge = tax * 0.25;
  else if (taxableIncome > 20000000) surcharge = tax * 0.25;
  else if (taxableIncome > 10000000) surcharge = tax * 0.15;
  else if (taxableIncome > 5000000) surcharge = tax * 0.10;

  const cess = (tax + surcharge) * 0.04;
  return roundINR(tax + surcharge + cess);
}

function computeOldRegimeTax(taxableIncome: number): number {
  if (taxableIncome <= 250000) return 0;
  let tax = 0;
  if (taxableIncome > 250000) {
    tax += Math.min(taxableIncome - 250000, 250000) * 0.05;
  }
  if (taxableIncome > 500000) {
    tax += Math.min(taxableIncome - 500000, 500000) * 0.20;
  }
  if (taxableIncome > 1000000) {
    tax += (taxableIncome - 1000000) * 0.30;
  }

  // Section 87A rebate up to ₹5,00,000 taxable income
  if (taxableIncome <= 500000) {
    tax = Math.max(0, tax - 12500);
  }

  let surcharge = 0;
  if (taxableIncome > 5000000) surcharge = tax * 0.10;
  if (taxableIncome > 10000000) surcharge = tax * 0.15;

  const cess = (tax + surcharge) * 0.04;
  return roundINR(tax + surcharge + cess);
}

export function calculateSalary(input: SalaryInput): SalaryResult {
  const annualCtc = Math.max(0, input.annualCtc);
  const monthlyCtc = annualCtc / 12;

  const basicAnnual =
    input.mode === "advanced" && typeof input.customBasicAnnual === "number"
      ? input.customBasicAnnual
      : annualCtc * (input.basicPercent / 100);

  const hraAnnual =
    input.mode === "advanced" && typeof input.customHraAnnual === "number"
      ? input.customHraAnnual
      : basicAnnual * (input.hraPercentOfBasic / 100);

  const conveyanceAnnual =
    input.mode === "advanced" && typeof input.customConveyanceAnnual === "number"
      ? input.customConveyanceAnnual
      : 0;

  const otherAllowanceAnnual =
    input.mode === "advanced" && typeof input.customOtherAllowanceAnnual === "number"
      ? input.customOtherAllowanceAnnual
      : 0;

  const employerPfAnnual =
    input.mode === "advanced" && typeof input.customEmployerPfAnnual === "number"
      ? input.customEmployerPfAnnual
      : input.pfMode === "none"
        ? 0
        : input.pfMode === "capped_1800"
          ? Math.min(basicAnnual * 0.12, 1800 * 12)
          : basicAnnual * 0.12;

  const employeePfAnnual =
    input.mode === "advanced" && typeof input.customEmployeePfAnnual === "number"
      ? input.customEmployeePfAnnual
      : input.pfMode === "none"
        ? 0
        : input.pfMode === "capped_1800"
          ? Math.min(basicAnnual * 0.12, 1800 * 12)
          : basicAnnual * 0.12;

  const gratuityAnnual =
    input.mode === "advanced" && typeof input.customGratuityAnnual === "number"
      ? input.customGratuityAnnual
      : input.includeGratuity
        ? basicAnnual * 0.0481
        : 0;

  const specialAnnual =
    input.mode === "advanced" && typeof input.customSpecialAnnual === "number"
      ? input.customSpecialAnnual
      : Math.max(
          0,
          annualCtc -
            input.variablePay -
            input.bonus -
            basicAnnual -
            hraAnnual -
            conveyanceAnnual -
            otherAllowanceAnnual -
            employerPfAnnual -
            gratuityAnnual
        );

  const grossAnnual =
    basicAnnual +
    hraAnnual +
    specialAnnual +
    conveyanceAnnual +
    otherAllowanceAnnual;

  const monthlyGross = grossAnnual / 12;
  const monthlyBasic = basicAnnual / 12;
  const monthlyHra = hraAnnual / 12;
  const monthlySpecial = specialAnnual / 12;
  const monthlyConveyance = conveyanceAnnual / 12;
  const monthlyOtherAllowance = otherAllowanceAnnual / 12;
  const monthlyEmployerPf = employerPfAnnual / 12;
  const monthlyEmployeePf = employeePfAnnual / 12;
  const monthlyGratuity = gratuityAnnual / 12;

  const monthlyProfessionalTax =
    input.mode === "advanced" && typeof input.customProfessionalTaxMonthly === "number"
      ? input.customProfessionalTaxMonthly
      : getStateProfessionalTaxMonthly(input.state);

  // ESI applies only when monthly gross <= ₹21,000
  const esiEligible = monthlyGross <= 21000;
  const monthlyEsiEmployee = esiEligible ? monthlyGross * 0.0075 : 0;
  const monthlyEsiEmployer = esiEligible ? monthlyGross * 0.0325 : 0;

  const standardDeduction = input.financialYear === "2026-27" ? 75000 : 75000;
  const newRegimeTaxable = Math.max(
    0,
    grossAnnual + input.variablePay + input.bonus - standardDeduction - employerPfAnnual
  );
  const newRegimeTax = computeNewRegimeTax(newRegimeTaxable);

  const oldExtraDeductions = input.oldRegimeDeductionsAnnual ?? 0;
  const oldRegimeTaxable = Math.max(
    0,
    grossAnnual +
      input.variablePay +
      input.bonus -
      50000 -
      employerPfAnnual -
      employeePfAnnual -
      oldExtraDeductions
  );
  const oldRegimeTax = computeOldRegimeTax(oldRegimeTaxable);

  const recommendedRegime: TaxRegime =
    newRegimeTax <= oldRegimeTax ? "new" : "old";
  const annualTaxSavings = Math.abs(newRegimeTax - oldRegimeTax);

  const annualIncomeTax =
    input.taxRegime === "new" ? newRegimeTax : oldRegimeTax;
  const monthlyTds = annualIncomeTax / 12;

  const estimatedMonthlyInHand =
    monthlyGross -
    monthlyEmployeePf -
    monthlyProfessionalTax -
    monthlyEsiEmployee -
    monthlyTds -
    input.otherDeductionsMonthly;

  const annualTakeHome =
    estimatedMonthlyInHand * 12 + input.variablePay + input.bonus;

  const briefSummary = `Est. In-Hand: ₹${roundINR(estimatedMonthlyInHand).toLocaleString("en-IN")}/mo | Gross: ₹${roundINR(monthlyGross).toLocaleString("en-IN")}/mo | PT (${input.state}): ₹${roundINR(monthlyProfessionalTax)}/mo | Best Regime: ${recommendedRegime.toUpperCase()}`;

  return {
    briefSummary,
    annualCtc: roundINR(annualCtc),
    monthlyCtc: roundINR(monthlyCtc),
    monthlyGross: roundINR(monthlyGross),
    monthlyBasic: roundINR(monthlyBasic),
    monthlyHra: roundINR(monthlyHra),
    monthlySpecial: roundINR(monthlySpecial),
    monthlyConveyance: roundINR(monthlyConveyance),
    monthlyOtherAllowance: roundINR(monthlyOtherAllowance),
    monthlyEmployerPf: roundINR(monthlyEmployerPf),
    monthlyEmployeePf: roundINR(monthlyEmployeePf),
    monthlyGratuity: roundINR(monthlyGratuity),
    monthlyProfessionalTax: roundINR(monthlyProfessionalTax),
    monthlyEsiEmployee: roundINR(monthlyEsiEmployee),
    monthlyEsiEmployer: roundINR(monthlyEsiEmployer),
    monthlyOtherDeductions: roundINR(input.otherDeductionsMonthly),
    annualTaxableIncome: roundINR(
      input.taxRegime === "new" ? newRegimeTaxable : oldRegimeTaxable
    ),
    annualIncomeTax,
    monthlyTds: roundINR(monthlyTds),
    estimatedMonthlyInHand: roundINR(estimatedMonthlyInHand),
    annualTakeHome: roundINR(annualTakeHome),
    comparison: {
      newRegimeTax,
      oldRegimeTax,
      recommendedRegime,
      annualTaxSavings,
    },
    assumptions: [
      `Basic defaults to ${input.basicPercent}% of CTC; HRA defaults to ${input.hraPercentOfBasic}% of Basic.`,
      `PF mode: ${input.pfMode} (employer PF is excluded from taxable gross in tax computation).`,
      `ESI applies only if Monthly Gross is ₹21,000 or less (0.75% employee, 3.25% employer).`,
      `Professional Tax uses standard state rule for ${input.state} (₹0 where state does not levy PT).`,
    ],
    explanations: {
      basic: "Core fixed salary component; used as base for PF and gratuity.",
      hra: "House Rent Allowance; part of monthly gross.",
      pf: "Provident Fund contribution; employee share reduces in-hand, employer share is part of CTC.",
      pt: "State-level Professional Tax; applied only in states/UTs that levy it.",
      esi: "Employee State Insurance; active only when monthly gross is up to ₹21,000.",
      tds: "Estimated monthly income tax spread across 12 months under selected regime.",
    },
  };
}

export function calculateHikePercentage(oldCtc: number, newCtc: number): number {
  if (oldCtc <= 0) return 0;
  return Number((((newCtc - oldCtc) / oldCtc) * 100).toFixed(2));
}
