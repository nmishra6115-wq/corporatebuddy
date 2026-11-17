export type EmailTone = "standard" | "polite" | "assertive" | "diplomatic" | "shorter" | "teams";

export interface GeneratedEmailBrief {
  briefSummary: string;
  category: string;
  subject: string;
  body: string;
  teamsMessage: string;
  placeholdersUsed: string[];
}

function detectCategory(raw: string): string {
  const q = raw.toLowerCase();
  if (q.includes("salary") || q.includes("credited") || q.includes("payroll") || q.includes("ctc") || q.includes("pf")) {
    return "Salary & Payroll";
  }
  if (q.includes("leave") || q.includes("wfh") || q.includes("work from home") || q.includes("medical") || q.includes("sick")) {
    return "Leave & Work-From-Home";
  }
  if (q.includes("resign") || q.includes("notice") || q.includes("relieving") || q.includes("experience")) {
    return "Exit & HR Letters";
  }
  if (q.includes("escalat") || q.includes("delay") || q.includes("pending") || q.includes("follow")) {
    return "Follow-Up & Escalation";
  }
  if (q.includes("client") || q.includes("deliverable") || q.includes("review")) {
    return "Client & Stakeholder Update";
  }
  return "General Corporate";
}

function extractDuration(raw: string): string {
  const match = raw.match(/\b(\d+\s*(?:day|days|week|weeks|half[- ]day))\b/i);
  return match ? match[1] : "[Duration]";
}

export function buildSmartEmailBrief(
  rawPrompt: string,
  tone: EmailTone = "standard",
  pastedThread?: string,
  variantIndex: number = 0
): GeneratedEmailBrief {
  const cleaned = (rawPrompt || "request a status update").trim();
  const category = detectCategory(cleaned);
  const variant = ((Math.floor(variantIndex) % 3) + 3) % 3;
  const threadBlock = pastedThread?.trim()
    ? `\n\nReference Context:\n${pastedThread.trim().slice(0, 240)}${pastedThread.trim().length > 240 ? "..." : ""}`
    : "";

  if (category === "Leave & Work-From-Home") {
    const duration = extractDuration(cleaned);
    const subjects = [
      `Leave Request (${duration}) — [Start Date] to [End Date] | [Your Name]`,
      `Leave Application: ${duration} ([Start Date]–[End Date]) — [Your Name]`,
      `Request for ${duration} Leave ([Start Date] to [End Date]) — [Your Name]`,
    ];

    const openings = [
      `I am writing to request ${duration} of leave from [Start Date] to [End Date].`,
      `Please accept this email as my formal request for ${duration} of leave covering [Start Date] to [End Date].`,
      `I would like to apply for ${duration} of leave from [Start Date] to [End Date].`,
    ];

    const closures = [
      "Pending deliverables will be handed over to [Backup Owner] prior to my leave, and I will remain reachable for urgent escalations.",
      "I will ensure [Key Deliverable] is completed ahead of time; [Backup Owner] will handle urgent matters in my absence.",
      "Handover notes have been shared with [Backup Owner]. Kindly let me know if any additional coverage is required.",
    ];

    const body =
      tone === "shorter"
        ? [
            "Hi [Recipient Name],",
            "",
            `${openings[variant]} Coverage: [Backup Owner].`,
            "",
            "Best regards,",
            "[Your Name]",
          ].join("\n")
        : [
            "Hi [Recipient Name],",
            "",
            openings[variant],
            closures[variant],
            threadBlock,
            "",
            "Best regards,",
            "[Your Name]",
            "[Designation | Team]",
          ]
            .filter(Boolean)
            .join("\n");

    return {
      briefSummary: `Leave & Work-From-Home · ${tone} · Draft ${variant + 1}/3`,
      category,
      subject: subjects[variant],
      body,
      teamsMessage: `Hi [Recipient Name] — requesting ${duration} leave from [Start Date] to [End Date]. Coverage: [Backup Owner]. Thanks, [Your Name].`,
      placeholdersUsed: ["[Recipient Name]", "[Start Date]", "[End Date]", "[Backup Owner]", "[Your Name]"],
    };
  }

  if (category === "Salary & Payroll") {
    const subjects = [
      `Payroll Query: [Specific Item, e.g., Salary Credit / PF] — [Your Name] ([Emp ID])`,
      `Clarification Requested on [Payroll Item] — [Your Name]`,
      `Salary & Payroll Follow-Up: [Month / Item] — [Your Name]`,
    ];
    const bodies = [
      [
        "Hi [HR / Payroll Team],",
        "",
        `I am writing to request clarification regarding ${cleaned}.`,
        "Could you please share the status or expected resolution timeline by [Target Date]? Happy to provide any supporting details if required.",
        threadBlock,
        "",
        "Regards,",
        "[Your Name]",
        "[Employee ID | Location]",
      ],
      [
        "Hi [HR / Payroll Team],",
        "",
        `Following up on ${cleaned}.`,
        "Please let me know the current status and next steps so I can align accordingly.",
        threadBlock,
        "",
        "Best regards,",
        "[Your Name]",
        "[Employee ID | Location]",
      ],
      [
        "Hi [HR / Payroll Team],",
        "",
        `Requesting a quick status check on ${cleaned}.`,
        "Kindly confirm the expected timeline by [Target Date].",
        threadBlock,
        "",
        "Thanks,",
        "[Your Name]",
        "[Employee ID | Location]",
      ],
    ];
    return {
      briefSummary: `Salary & Payroll · ${tone} · Draft ${variant + 1}/3`,
      category,
      subject: subjects[variant],
      body: bodies[variant].filter(Boolean).join("\n"),
      teamsMessage: `Hi [HR / Payroll Team] — checking on ${cleaned}. Could you share the status by [Target Date]? Thanks, [Your Name].`,
      placeholdersUsed: ["[HR / Payroll Team]", "[Target Date]", "[Your Name]"],
    };
  }

  const subjects = [
    `Update / Action Required: [Subject Topic] — [Your Name]`,
    `Follow-Up: [Subject Topic] — [Target Date]`,
    `Status Request: [Subject Topic] — [Your Name]`,
  ];

  const bodies = [
    [
      "Hi [Recipient Name],",
      "",
      `I am writing regarding ${cleaned}.`,
      "Could you please share the current status or confirm next steps by [Target Date]? Please let me know if any input is needed from my end.",
      threadBlock,
      "",
      "Best regards,",
      "[Your Name]",
      "[Designation | Team]",
    ],
    [
      "Hi [Recipient Name],",
      "",
      `Following up on ${cleaned}.`,
      "Please confirm the owner and expected completion timeline by [Target Date] so dependent tasks stay on track.",
      threadBlock,
      "",
      "Regards,",
      "[Your Name]",
      "[Designation | Team]",
    ],
    [
      "Hi [Recipient Name],",
      "",
      `Quick check-in regarding ${cleaned}.`,
      "Kindly share an update when convenient, or let me know if we should align briefly.",
      threadBlock,
      "",
      "Best,",
      "[Your Name]",
      "[Designation | Team]",
    ],
  ];

  return {
    briefSummary: `${category} · ${tone} · Draft ${variant + 1}/3`,
    category,
    subject: subjects[variant],
    body: bodies[variant].filter(Boolean).join("\n"),
    teamsMessage: `Hi [Recipient Name] — quick note regarding ${cleaned}. Please share an update by [Target Date]. Thanks, [Your Name].`,
    placeholdersUsed: ["[Recipient Name]", "[Target Date]", "[Your Name]"],
  };
}
