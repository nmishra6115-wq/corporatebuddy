export type WorkweekPattern = "mon_fri_5day" | "alt_sat" | "mon_sat_6day";

export interface HolidayEntry {
  date: string; // YYYY-MM-DD
  name: string;
  category: "national" | "state" | "regional" | "restricted";
  provisional?: boolean;
}

export interface LeaveBridgeSuggestion {
  month: number; // 1-12
  monthLabel: string;
  anchorHoliday: string;
  leaveDates: string[];
  leaveDaysRequired: number;
  consecutiveDaysOff: number;
  hackTip: string;
}

export interface LeavePlannerOutput {
  briefSummary: string;
  state: string;
  year: number;
  workweek: WorkweekPattern;
  leaveBalance: number;
  holidays: HolidayEntry[];
  monthlyBridges: LeaveBridgeSuggestion[];
  yearlyLeaveTips: string[];
  policyReminder: string;
}

export const SUPPORTED_HOLIDAY_YEARS: number[] = [
  2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033,
];

const NATIONAL_HOLIDAYS_2026: HolidayEntry[] = [
  { date: "2026-01-26", name: "Republic Day", category: "national" },
  { date: "2026-03-04", name: "Holi", category: "national" },
  { date: "2026-03-21", name: "Id-ul-Fitr", category: "national" },
  { date: "2026-03-26", name: "Ram Navami", category: "national" },
  { date: "2026-03-31", name: "Mahavir Jayanti", category: "national" },
  { date: "2026-04-03", name: "Good Friday", category: "national" },
  { date: "2026-05-01", name: "Buddha Purnima", category: "national" },
  { date: "2026-05-27", name: "Id-ul-Zuha (Bakrid)", category: "national" },
  { date: "2026-06-26", name: "Muharram", category: "national" },
  { date: "2026-08-15", name: "Independence Day", category: "national" },
  { date: "2026-08-26", name: "Milad-un-Nabi (Id-e-Milad)", category: "national" },
  { date: "2026-09-04", name: "Janmashtami", category: "national" },
  { date: "2026-10-02", name: "Mahatma Gandhi Jayanti", category: "national" },
  { date: "2026-10-20", name: "Dussehra (Vijaya Dashami)", category: "national" },
  { date: "2026-11-08", name: "Diwali (Deepavali)", category: "national" },
  { date: "2026-11-24", name: "Guru Nanak Jayanti", category: "national" },
  { date: "2026-12-25", name: "Christmas Day", category: "national" },
];

const STATE_SPECIFIC_HOLIDAYS_2026: Record<string, HolidayEntry[]> = {
  Karnataka: [
    { date: "2026-01-15", name: "Makara Sankranti", category: "state" },
    { date: "2026-03-19", name: "Ugadi Festival", category: "state" },
    { date: "2026-04-14", name: "Dr. B.R. Ambedkar Jayanti", category: "state" },
    { date: "2026-04-20", name: "Basava Jayanti / Akshaya Tritiya", category: "state" },
    { date: "2026-05-01", name: "May Day / Labour Day", category: "state" },
    { date: "2026-09-14", name: "Ganesh Chaturthi", category: "state" },
    { date: "2026-10-20", name: "Mahanavami / Ayudha Puja", category: "state" },
    { date: "2026-10-21", name: "Dussehra / Vijaya Dashami", category: "state" },
    { date: "2026-11-01", name: "Karnataka Rajyotsava", category: "state" },
    { date: "2026-11-10", name: "Deepavali (Balipadyami)", category: "state" },
    { date: "2026-11-27", name: "Kanakadasa Jayanti", category: "state" },
  ],
  Maharashtra: [
    { date: "2026-02-19", name: "Chhatrapati Shivaji Maharaj Jayanti", category: "state" },
    { date: "2026-03-03", name: "Holi (Second Day)", category: "state" },
    { date: "2026-03-19", name: "Gudi Padwa", category: "state" },
    { date: "2026-04-14", name: "Dr. Babasaheb Ambedkar Jayanti", category: "state" },
    { date: "2026-05-01", name: "Maharashtra Din / Labour Day", category: "state" },
    { date: "2026-09-14", name: "Ganesh Chaturthi", category: "state" },
    { date: "2026-10-20", name: "Dussehra (Dasara)", category: "state" },
    { date: "2026-11-10", name: "Diwali (Bali Pratipada)", category: "state" },
  ],
  Delhi: [
    { date: "2026-01-01", name: "New Year's Day", category: "regional" },
    { date: "2026-01-14", name: "Makar Sankranti / Pongal", category: "regional" },
    { date: "2026-02-15", name: "Maha Shivaratri", category: "regional" },
    { date: "2026-03-19", name: "Ugadi / Gudi Padwa / Chaitra Sukladi", category: "regional" },
    { date: "2026-04-14", name: "Vaisakhi / Dr. Ambedkar Jayanti", category: "regional" },
    { date: "2026-11-09", name: "Govardhan Puja", category: "regional" },
    { date: "2026-11-11", name: "Bhai Duj", category: "regional" },
  ],
  "Tamil Nadu": [
    { date: "2026-01-01", name: "New Year's Day", category: "state" },
    { date: "2026-01-15", name: "Thai Pongal", category: "state" },
    { date: "2026-01-16", name: "Thiruvalluvar Day", category: "state" },
    { date: "2026-04-14", name: "Tamil New Year's Day / Ambedkar Jayanti", category: "state" },
    { date: "2026-05-01", name: "May Day", category: "state" },
    { date: "2026-09-14", name: "Vinayaka Chaturthi", category: "state" },
    { date: "2026-11-08", name: "Diwali", category: "state" },
  ],
  Telangana: [
    { date: "2026-01-01", name: "New Year's Day", category: "state" },
    { date: "2026-01-15", name: "Bhogi / Sankranti", category: "state" },
    { date: "2026-03-19", name: "Ugadi", category: "state" },
    { date: "2026-06-02", name: "Telangana Formation Day", category: "state" },
    { date: "2026-09-14", name: "Vinayaka Chaturthi", category: "state" },
    { date: "2026-10-20", name: "Bathukamma / Vijaya Dashami", category: "state" },
    { date: "2026-11-09", name: "Deepavali", category: "state" },
  ],
  "West Bengal": [
    { date: "2026-01-01", name: "New Year's Day", category: "state" },
    { date: "2026-01-23", name: "Netaji Subhas Chandra Bose Jayanti", category: "state" },
    { date: "2026-04-15", name: "Pohela Boishakh (Bengali New Year)", category: "state" },
    { date: "2026-05-01", name: "May Day", category: "state" },
    { date: "2026-10-19", name: "Maha Ashtami (Durga Puja)", category: "state" },
    { date: "2026-10-20", name: "Maha Navami / Vijaya Dashami", category: "state" },
    { date: "2026-11-08", name: "Kali Puja / Diwali", category: "state" },
  ],
};

function buildCalendarHolidaysForYear(year: number, state: string): HolidayEntry[] {
  const fixedNational: HolidayEntry[] = [
    { date: `${year}-01-26`, name: "Republic Day", category: "national" },
    { date: `${year}-08-15`, name: "Independence Day", category: "national" },
    { date: `${year}-10-02`, name: "Mahatma Gandhi Jayanti", category: "national" },
    { date: `${year}-12-25`, name: "Christmas Day", category: "national" },
  ];

  const fixedStateMap: Record<string, HolidayEntry[]> = {
    Karnataka: [
      { date: `${year}-01-15`, name: "Makara Sankranti (Provisional)", category: "state", provisional: true },
      { date: `${year}-03-25`, name: "Ugadi Festival (Provisional)", category: "state", provisional: true },
      { date: `${year}-04-14`, name: "Dr. B.R. Ambedkar Jayanti", category: "state" },
      { date: `${year}-05-01`, name: "May Day / Labour Day", category: "state" },
      { date: `${year}-09-10`, name: "Ganesh Chaturthi (Provisional)", category: "state", provisional: true },
      { date: `${year}-10-15`, name: "Dussehra / Vijaya Dashami (Provisional)", category: "state", provisional: true },
      { date: `${year}-11-01`, name: "Karnataka Rajyotsava", category: "state" },
      { date: `${year}-11-05`, name: "Deepavali (Provisional)", category: "state", provisional: true },
    ],
    Maharashtra: [
      { date: `${year}-02-19`, name: "Chhatrapati Shivaji Maharaj Jayanti", category: "state" },
      { date: `${year}-03-25`, name: "Gudi Padwa (Provisional)", category: "state", provisional: true },
      { date: `${year}-04-14`, name: "Dr. Babasaheb Ambedkar Jayanti", category: "state" },
      { date: `${year}-05-01`, name: "Maharashtra Din / Labour Day", category: "state" },
      { date: `${year}-09-10`, name: "Ganesh Chaturthi (Provisional)", category: "state", provisional: true },
      { date: `${year}-10-15`, name: "Dussehra (Provisional)", category: "state", provisional: true },
      { date: `${year}-11-05`, name: "Diwali (Provisional)", category: "state", provisional: true },
    ],
  };

  const defaultProvisional: HolidayEntry[] = [
    { date: `${year}-01-01`, name: "New Year's Day", category: "regional" },
    { date: `${year}-03-20`, name: "Spring / Lunar Festival (Provisional)", category: "restricted", provisional: true },
    { date: `${year}-05-01`, name: "May Day / Regional Observance", category: "state", provisional: true },
    { date: `${year}-10-15`, name: "Autumn Festival (Provisional)", category: "restricted", provisional: true },
    { date: `${year}-11-05`, name: "Festival of Lights (Provisional)", category: "restricted", provisional: true },
  ];

  return [
    ...fixedNational,
    ...(fixedStateMap[state] ?? defaultProvisional),
  ];
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function isWeeklyOff(date: Date, workweek: WorkweekPattern): boolean {
  const day = date.getDay();
  if (day === 0) return true;
  if (workweek === "mon_fri_5day") return day === 6;
  if (workweek === "alt_sat") {
    const weekOfMonth = Math.ceil(date.getDate() / 7);
    return day === 6 && (weekOfMonth === 2 || weekOfMonth === 4);
  }
  return false;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function planStateLeaves(
  state: string,
  year: number,
  workweek: WorkweekPattern,
  leaveBalance: number
): LeavePlannerOutput {
  const combined: HolidayEntry[] =
    year === 2026
      ? [...NATIONAL_HOLIDAYS_2026, ...(STATE_SPECIFIC_HOLIDAYS_2026[state] ?? [])]
      : buildCalendarHolidaysForYear(year, state);

  const seen = new Set<string>();
  const holidays = combined
    .filter((h) => {
      const key = `${h.date}-${h.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const holidaySet = new Set(holidays.map((h) => h.date));
  const holidayNameMap = new Map<string, string[]>();
  for (const h of holidays) {
    const existing = holidayNameMap.get(h.date) ?? [];
    existing.push(h.name);
    holidayNameMap.set(h.date, existing);
  }

  const monthlyBridges: LeaveBridgeSuggestion[] = [];

  for (let m = 0; m < 12; m++) {
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    let monthHasBridge = false;

    for (let day = 1; day <= daysInMonth; day++) {
      const current = new Date(year, m, day);
      const iso = toIsoDate(current);
      if (!holidaySet.has(iso)) continue;

      const label = (holidayNameMap.get(iso) ?? ["Holiday"]).join(" / ");
      const dow = current.getDay();

      if (dow === 4) {
        const fri = new Date(year, m, day + 1);
        if (fri.getMonth() === m && !isWeeklyOff(fri, workweek) && !holidaySet.has(toIsoDate(fri))) {
          monthlyBridges.push({
            month: m + 1,
            monthLabel: MONTH_NAMES[m],
            anchorHoliday: `${label} (${iso})`,
            leaveDates: [toIsoDate(fri)],
            leaveDaysRequired: 1,
            consecutiveDaysOff: 4,
            hackTip: `Use 1 leave day on ${toIsoDate(fri)} (Fri) after ${label} (Thu) for 4 days off.`,
          });
          monthHasBridge = true;
        }
      }

      if (dow === 2) {
        const mon = new Date(year, m, day - 1);
        if (mon.getMonth() === m && !isWeeklyOff(mon, workweek) && !holidaySet.has(toIsoDate(mon))) {
          monthlyBridges.push({
            month: m + 1,
            monthLabel: MONTH_NAMES[m],
            anchorHoliday: `${label} (${iso})`,
            leaveDates: [toIsoDate(mon)],
            leaveDaysRequired: 1,
            consecutiveDaysOff: 4,
            hackTip: `Use 1 leave day on ${toIsoDate(mon)} (Mon) before ${label} (Tue) for 4 days off.`,
          });
          monthHasBridge = true;
        }
      }
    }

    if (!monthHasBridge) {
      // Provide a monthly weekend-stretch option so every month has an actionable plan
      const fallbackDate = `${year}-${String(m + 1).padStart(2, "0")}-15`;
      monthlyBridges.push({
        month: m + 1,
        monthLabel: MONTH_NAMES[m],
        anchorHoliday: `Weekend Stretch (${MONTH_NAMES[m]} ${year})`,
        leaveDates: [fallbackDate],
        leaveDaysRequired: 1,
        consecutiveDaysOff: 3,
        hackTip: `No Thu/Tue holiday bridge detected — pair a Friday or Monday leave in ${MONTH_NAMES[m]} for a 3-day weekend.`,
      });
    }
  }

  const bestBridge = monthlyBridges[0];
  const briefSummary = bestBridge
    ? `${state} (${year}): ${holidays.length} holidays tracked · Top hack: ${bestBridge.hackTip}`
    : `${state} (${year}): ${holidays.length} holidays tracked.`;

  return {
    briefSummary,
    state,
    year,
    workweek,
    leaveBalance,
    holidays,
    monthlyBridges,
    yearlyLeaveTips: [
      "Target Thursday or Tuesday holidays first—1 bridge leave turns a single holiday into a 4-day break.",
      "Split your remaining balance across Q2 and Q4 instead of hoarding all leaves for December.",
      "Submit bridge-leave requests early so team coverage is locked before holiday rush.",
    ],
    policyReminder:
      year === 2026
        ? "Verify your employer's official holiday list and leave approval policy before booking travel."
        : `Years 2027–2033 include fixed statutory dates plus provisional festival markers until each state's official gazette is published.`,
  };
}
