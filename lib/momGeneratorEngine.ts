export type MomTemplate =
  | "Daily operations and SLA review"
  | "Weekly team performance"
  | "Client governance call"
  | "Project status"
  | "Quality and audit review"
  | "Management review"
  | "HR discussion"
  | "Escalation meeting"
  | "Training and knowledge transfer"
  | "Standard corporate MOM";

export type MomAudienceMode =
  | "Formal MOM (Management)"
  | "Detailed Operational MOM"
  | "Client-Ready MOM"
  | "Short Executive Summary"
  | "Email-Ready MOM";

export type LiveEntryTag = "discussion" | "decision" | "action" | "question";

export interface LiveMeetingEntry {
  id: string;
  text: string;
  tag: LiveEntryTag;
}

export interface MomActionItem {
  id: string;
  task: string;
  owner: string;
  deadline: string;
  status: "Open" | "In Progress" | "Done" | "Waiting";
  priority: string;
  dependency: string;
  pendingApproval: boolean;
  needsConfirmation: boolean;
  carriedForward?: boolean;
}

export interface MomSeriesSnapshot {
  id: string;
  seriesKey: string;
  meetingTitle: string;
  dateLabel: string;
  template: MomTemplate;
  unresolvedActions: MomActionItem[];
  pendingQuestions: string[];
  keyDecisions: string[];
}

export interface GeneratedMomBrief {
  briefSummary: string;
  template: MomTemplate;
  audience: MomAudienceMode;
  meetingTitle: string;
  dateLabel: string;
  participants: string;
  executiveSummary: string;
  discussions: string[];
  decisions: string[];
  questions: string[];
  actionItems: MomActionItem[];
  continuityUpdates: string[];
  nextMeetingAgenda: string[];
  audienceOutput: string;
  momEmailSubject: string;
  momEmailBody: string;
  teamsDropText: string;
  actionTrackerText: string;
  auditCount: number;
}

export const MOM_TEMPLATES: MomTemplate[] = [
  "Daily operations and SLA review",
  "Weekly team performance",
  "Client governance call",
  "Project status",
  "Quality and audit review",
  "Management review",
  "HR discussion",
  "Escalation meeting",
  "Training and knowledge transfer",
  "Standard corporate MOM",
];

export const MOM_AUDIENCES: MomAudienceMode[] = [
  "Formal MOM (Management)",
  "Detailed Operational MOM",
  "Client-Ready MOM",
  "Short Executive Summary",
  "Email-Ready MOM",
];

const ACTION_VERB_REGEX =
  /\b(close|complete|review|share|send|follow\s*up|prepare|submit|fix|escalate|check|update|verify|align|circulate|draft|validate|assign|resolve|deliver|obtain|qc)\b/i;
const DECISION_REGEX =
  /\b(decided|agreed|approved|confirmed|locked|finalized|signed\s*off|cleared|done)\b/i;
const QUESTION_REGEX = /\?|\b(question|clarify|confirm|pending\s+approval|awaiting|waiting)\b/i;

export function inferLiveEntryTag(line: string): LiveEntryTag {
  if (QUESTION_REGEX.test(line)) return "question";
  if (DECISION_REGEX.test(line) && !ACTION_VERB_REGEX.test(line)) return "decision";
  if (ACTION_VERB_REGEX.test(line) || /\b(by\s+\w+|eod|cob|friday|monday|wednesday)\b/i.test(line)) {
    return "action";
  }
  return "discussion";
}

function extractOwner(fragment: string): { owner: string; needsConfirm: boolean } {
  const explicit = fragment.match(
    /\b(?:owner|lead|assignee|poc)\s*[:=-]\s*([A-Z][a-zA-Z0-9_/-]{1,24})/i
  );
  if (explicit) return { owner: explicit[1], needsConfirm: false };

  const dept = fragment.match(/\b(HR|Payroll|Finance|Compliance|Legal|Ops|IT|QA|QC|Product|Client)\b/);
  if (dept) return { owner: dept[1], needsConfirm: false };

  const words = fragment.trim().split(/\s+/);
  const nameWord =
    words.find((w, idx) => idx > 0 && /^[A-Z][a-z]{2,}$/.test(w)) ??
    words.find((w) => /^[A-Z][a-z]{2,}$/.test(w));

  if (nameWord) return { owner: nameWord, needsConfirm: false };
  return { owner: "Needs confirmation", needsConfirm: true };
}

function extractDeadline(fragment: string): { deadline: string; needsConfirm: boolean } {
  const match = fragment.match(
    /\b(today|tomorrow|eod|cob|by\s+(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+(?:week|monday|tuesday|wednesday|thursday|friday)|\d{1,2}\s*(?:am|pm)|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)\b/i
  );
  if (match) return { deadline: match[0], needsConfirm: false };
  return { deadline: "Needs confirmation", needsConfirm: true };
}

export function buildMomBrief(
  roughNotes: string,
  template: MomTemplate = "Standard corporate MOM",
  optionalMeta?: {
    title?: string;
    date?: string;
    attendees?: string;
    audience?: MomAudienceMode;
    liveEntries?: LiveMeetingEntry[];
    previousSnapshot?: MomSeriesSnapshot | null;
  },
  variantIndex: number = 0,
  customActions?: MomActionItem[]
): GeneratedMomBrief {
  const audience = optionalMeta?.audience ?? "Formal MOM (Management)";
  const variant = ((Math.floor(variantIndex) % 3) + 3) % 3;
  const meetingTitle = optionalMeta?.title?.trim() || `${template} — [Topic]`;
  const dateLabel = optionalMeta?.date?.trim() || "[Date]";
  const participants = optionalMeta?.attendees?.trim() || "[Attendees]";

  const rawLines = roughNotes
    .split(/\n|\.|;/)
    .map((s) => s.trim())
    .filter(Boolean);

  const entries: LiveMeetingEntry[] =
    optionalMeta?.liveEntries && optionalMeta.liveEntries.length > 0
      ? optionalMeta.liveEntries
      : (rawLines.length > 0 ? rawLines : ["Discussed current status and pending items."]).map(
          (text, idx) => ({
            id: `entry-${idx}`,
            text,
            tag: inferLiveEntryTag(text),
          })
        );

  const discussions = entries.filter((e) => e.tag === "discussion").map((e) => e.text);
  const decisions = entries.filter((e) => e.tag === "decision").map((e) => e.text);
  const questions = entries.filter((e) => e.tag === "question").map((e) => e.text);

  const parsedActions: MomActionItem[] =
    customActions && customActions.length > 0
      ? customActions.map((a) => ({
          ...a,
          needsConfirmation:
            a.owner.trim() === "" ||
            a.owner === "Needs confirmation" ||
            a.deadline.trim() === "" ||
            a.deadline === "Needs confirmation",
        }))
      : entries
          .filter((e) => e.tag === "action")
          .map((e, idx) => {
            const o = extractOwner(e.text);
            const d = extractDeadline(e.text);
            return {
              id: `act-${idx}-${e.id}`,
              task: e.text,
              owner: o.owner,
              deadline: d.deadline,
              status: /\b(done|completed)\b/i.test(e.text) ? "Done" : "Open",
              priority: /\b(urgent|p0|critical|escalation)\b/i.test(e.text) ? "High" : "Standard",
              dependency: /\b(client|pending|waiting|awaiting|docs|approval)\b/i.test(e.text)
                ? "Has dependency / approval"
                : "None noted",
              pendingApproval: /\b(approval|approve|sign[- ]?off)\b/i.test(e.text),
              needsConfirmation: o.needsConfirm || d.needsConfirm,
            };
          });

  const continuityUpdates: string[] = [];
  const carriedForwardActions: MomActionItem[] = [];

  if (optionalMeta?.previousSnapshot) {
    const prev = optionalMeta.previousSnapshot;
    for (const prevAct of prev.unresolvedActions) {
      const matchingUpdate = entries.find((e) =>
        e.text.toLowerCase().includes(prevAct.owner.toLowerCase().replace(/[^a-z]/g, "")) ||
        e.text.toLowerCase().includes("remaining") ||
        e.text.toLowerCase().includes("completed")
      );

      if (matchingUpdate) {
        const updatedDue = extractDeadline(matchingUpdate.text);
        continuityUpdates.push(
          `From ${prev.meetingTitle} (${prev.dateLabel}): "${prevAct.task}" -> ${matchingUpdate.text} (Due: ${
            updatedDue.needsConfirm ? prevAct.deadline : updatedDue.deadline
          })`
        );
        if (!/\b(done|completed\s+all|100%)\b/i.test(matchingUpdate.text)) {
          carriedForwardActions.push({
            ...prevAct,
            id: `cf-${prevAct.id}`,
            task: `${prevAct.task} (${matchingUpdate.text})`,
            deadline: updatedDue.needsConfirm ? prevAct.deadline : updatedDue.deadline,
            status: "In Progress",
            carriedForward: true,
          });
        }
      } else {
        continuityUpdates.push(
          `Carried forward from ${prev.meetingTitle}: "${prevAct.task}" (Owner: ${prevAct.owner}, Due: ${prevAct.deadline}, Status: ${prevAct.status})`
        );
        carriedForwardActions.push({
          ...prevAct,
          id: `cf-${prevAct.id}`,
          carriedForward: true,
        });
      }
    }
  }

  const allActions = [...carriedForwardActions, ...parsedActions];
  const auditCount =
    allActions.filter((a) => a.needsConfirmation).length +
    (optionalMeta?.attendees?.trim() ? 0 : 1) +
    (optionalMeta?.date?.trim() ? 0 : 1);

  const executiveSummary =
    variant === 1
      ? `${template} (${audience}): ${decisions.length} decision(s), ${allActions.filter((a) => a.status !== "Done").length} active action(s), and ${continuityUpdates.length} continuity link(s).`
      : variant === 2
        ? `MeetingOS summary across ${entries.length} captured point(s): ${allActions.length} tracked commitment(s), ${auditCount} item(s) flagged for confirmation.`
        : `${template}: Structured ${entries.length} live point(s) into decisions, owner actions, and next-meeting prep.`;

  const nextMeetingAgenda: string[] = [
    ...allActions
      .filter((a) => a.status !== "Done")
      .map((a) => `Review action: ${a.task} (${a.owner} · Due: ${a.deadline})`),
    ...questions.map((q) => `Resolve open question: ${q}`),
    ...(optionalMeta?.previousSnapshot?.pendingQuestions ?? []).map(
      (pq) => `Carried-forward question: ${pq}`
    ),
  ];

  const audienceOutput =
    audience === "Short Executive Summary"
      ? [
          `${meetingTitle} (${dateLabel}) — Executive Brief`,
          `Summary: ${executiveSummary}`,
          `Key Decisions: ${decisions.join("; ") || "[Confirm decisions]"}`,
          `Key Actions: ${allActions.map((a) => `${a.task} [${a.owner}, ${a.deadline}]`).join("; ") || "[None]"}`,
          `Next Agenda: ${nextMeetingAgenda.slice(0, 3).join(" | ") || "[Set next sync]"}`,
        ].join("\n")
      : audience === "Client-Ready MOM"
        ? [
            `Client Governance Summary — ${meetingTitle}`,
            `Date: ${dateLabel} | Participants: ${participants}`,
            "",
            "Overview:",
            executiveSummary,
            "",
            "Agreed Milestones & Decisions:",
            ...(decisions.length > 0 ? decisions.map((d) => `- ${d}`) : ["- [Confirm client milestones]"]),
            "",
            "Action Plan & Owners:",
            ...allActions.map((a) => `- ${a.task} — Lead: ${a.owner} | Target: ${a.deadline}`),
            "",
            "Next Steps:",
            ...nextMeetingAgenda.map((n) => `- ${n}`),
          ].join("\n")
        : audience === "Detailed Operational MOM"
          ? [
              `# ${meetingTitle} (Operational Log)`,
              `Date: ${dateLabel} | Template: ${template} | Participants: ${participants}`,
              "",
              "## Previous Meeting Continuity",
              ...(continuityUpdates.length > 0
                ? continuityUpdates.map((c) => `- ${c}`)
                : ["- No prior MOM linked"]),
              "",
              "## Decisions",
              ...(decisions.length > 0 ? decisions.map((d) => `- ${d}`) : ["- [None logged]"]),
              "",
              "## Action Intelligence Table",
              ...allActions.map(
                (a) =>
                  `- [${a.status}] ${a.task} | Owner: ${a.owner} | Due: ${a.deadline} | Priority: ${a.priority} | Dependency: ${a.dependency}`
              ),
              "",
              "## Open Questions & Discussions",
              ...[...questions.map((q) => `- [Q] ${q}`), ...discussions.map((d) => `- ${d}`)],
              "",
              "## Next Meeting Prep Agenda",
              ...nextMeetingAgenda.map((n) => `- ${n}`),
            ].join("\n")
          : [
              `# ${meetingTitle}`,
              `Date: ${dateLabel} | Template: ${template} | Audience: ${audience}`,
              `Participants: ${participants}`,
              "",
              "## Executive Summary",
              executiveSummary,
              "",
              ...(continuityUpdates.length > 0
                ? ["## Continuity from Previous Meeting", ...continuityUpdates.map((c) => `- ${c}`), ""]
                : []),
              "## Decisions",
              ...(decisions.length > 0 ? decisions.map((d) => `- ${d}`) : ["- [Confirm decisions]"]),
              "",
              "## Action Items",
              ...allActions.map(
                (a) =>
                  `- ${a.task} — Owner: ${a.owner} | Due: ${a.deadline} | Status: ${a.status}`
              ),
              "",
              "## Next Meeting Prep",
              ...nextMeetingAgenda.map((n) => `- ${n}`),
            ].join("\n");

  const momEmailSubject = `MOM & Action Tracker: ${meetingTitle} (${dateLabel})`;
  const momEmailBody = [
    `Hi ${participants},`,
    "",
    `Sharing the MOM and action items from ${meetingTitle} (${dateLabel}).`,
    "",
    `Summary: ${executiveSummary}`,
    "",
    "Decisions:",
    ...(decisions.length > 0 ? decisions.map((d) => `• ${d}`) : ["• [Confirm locked decisions]"]),
    "",
    "Action Items:",
    ...allActions.map((a) => `• ${a.task} — Owner: ${a.owner} | Due: ${a.deadline} (${a.status})`),
    "",
    "Next Meeting Prep:",
    ...nextMeetingAgenda.map((n) => `• ${n}`),
    "",
    "Best regards,",
    "[Your Name]",
  ].join("\n");

  const teamsDropText = [
    `*MeetingOS — ${meetingTitle}* (${dateLabel})`,
    `• *Summary:* ${executiveSummary}`,
    ...allActions.map((a) => `• *Action:* ${a.task} — *Owner:* ${a.owner} — *Due:* ${a.deadline}`),
    `• *Next Sync Prep:* ${nextMeetingAgenda[0] ?? "[Set next sync]"}`,
  ].join("\n");

  const actionTrackerText = [
    "Task | Owner | Due | Status | Priority | Dependency",
    "--- | --- | --- | --- | --- | ---",
    ...allActions.map(
      (a) => `${a.task} | ${a.owner} | ${a.deadline} | ${a.status} | ${a.priority} | ${a.dependency}`
    ),
  ].join("\n");

  return {
    briefSummary: `${template} · ${allActions.length} action(s), ${continuityUpdates.length} continuity item(s), ${auditCount} audit check(s) (Variant ${variant + 1}/3)`,
    template,
    audience,
    meetingTitle,
    dateLabel,
    participants,
    executiveSummary,
    discussions,
    decisions,
    questions,
    actionItems: allActions,
    continuityUpdates,
    nextMeetingAgenda,
    audienceOutput,
    momEmailSubject,
    momEmailBody,
    teamsDropText,
    actionTrackerText,
    auditCount,
  };
}
