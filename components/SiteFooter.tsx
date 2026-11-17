"use client";

import React, { useState } from "react";

type PolicyKey = "privacy" | "terms" | "cookies" | "disclaimer" | null;

interface SiteFooterProps {
  onSelectView?: (view: "home" | "salary" | "holidays" | "email" | "mom" | "notes" | "docs" | "tax" | "shift" | "presentos" | "growthos" | "changeos") => void;
}

const POLICY_CONTENT: Record<Exclude<PolicyKey, null>, { title: string; updated: string; paragraphs: string[] }> = {
  privacy: {
    title: "Privacy Policy",
    updated: "Last updated: November 2026",
    paragraphs: [
      "CorporateBuddy is designed for workplace productivity. Core calculators, planners, and text utilities process inputs in your browser or session without requiring a separate account.",
      "When AI-assisted features are invoked (such as document comparison or appraisal drafting), submitted text or files are processed to generate your requested output. Avoid uploading sensitive personal identifiers, credentials, or restricted employer data unless authorized.",
      "Third-party analytics or advertising partners (such as Google AdSense) may use cookies or similar identifiers in accordance with their respective privacy policies.",
    ],
  },
  terms: {
    title: "Terms of Service",
    updated: "Last updated: November 2026",
    paragraphs: [
      "CorporateBuddy provides productivity tools, templates, and reference utilities as-is for personal and workplace assistance.",
      "You retain responsibility for reviewing, verifying, and approving any generated outputs, salary estimates, leave plans, appraisal drafts, or document comparisons before relying on them.",
      "You agree not to upload unlawful, malicious, or unauthorized third-party materials.",
    ],
  },
  cookies: {
    title: "Cookie & Advertising Notice",
    updated: "Last updated: November 2026",
    paragraphs: [
      "CorporateBuddy uses essential browser storage to preserve workspace preferences and session state.",
      "Google and its advertising partners may use cookies (including the DoubleClick cookie) to serve ads based on prior visits to this or other websites. Users may opt out of personalized advertising via Google Ads Settings.",
    ],
  },
  disclaimer: {
    title: "Disclaimer",
    updated: "Last updated: November 2026",
    paragraphs: [
      "Information, salary/tax estimates, compliance/process comparisons, and writing drafts provided on CorporateBuddy are for general informational and productivity purposes only.",
      "Nothing on this website constitutes legal, tax, accounting, employment, or financial advice. Verify figures and policy interpretations against official statutory rules and employer guidelines.",
    ],
  },
};

export default function SiteFooter({ onSelectView }: SiteFooterProps) {
  const [activePolicy, setActivePolicy] = useState<PolicyKey>(null);
  const selectedPolicy = activePolicy ? POLICY_CONTENT[activePolicy] : null;

  return (
    <footer className="w-full mt-12 border-t border-slate-200 bg-white text-slate-700">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <p className="font-display text-base font-bold text-[#0b192c]">CorporateBuddy</p>
            <p className="text-xs leading-relaxed text-slate-600">
              Practical workplace productivity suite for salary &amp; in-hand calculations, leave and tax planning, communication &amp; meeting notes, PresentOS, Appraisal &amp; Promotion Assistant, and Document Comparison &amp; Process Change Intelligence.
            </p>
            <p className="text-[11px] text-slate-500">
              Informational workplace utility — always verify outputs against official company policies and statutory rules.
            </p>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0b192c]">Core Tools</p>
            <ul className="space-y-1.5 text-xs text-slate-600">
              {([
                ["home", "Workspace Overview"],
                ["salary", "CTC & In-Hand Calculator"],
                ["holidays", "State Holidays & Leave Planner"],
                ["tax", "Tax Deadlines Calendar"],
                ["docs", "Document Summarizer"],
              ] as const).map(([id, label]) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onSelectView?.(id)}
                    className="hover:text-[#0f294a] hover:underline text-left"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0b192c]">AI &amp; Document Studios</p>
            <ul className="space-y-1.5 text-xs text-slate-600">
              {([
                ["email", "Email Assistant"],
                ["mom", "Meeting Minutes (MOM)"],
                ["presentos", "PresentOS"],
                ["growthos", "Appraisal & Promotion Assistant"],
                ["changeos", "Document Comparison & Process Change Intelligence"],
              ] as const).map(([id, label]) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onSelectView?.(id)}
                    className="hover:text-[#0f294a] hover:underline text-left"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0b192c]">Policies &amp; Disclosures</p>
            <ul className="space-y-1.5 text-xs text-slate-600">
              {([
                ["privacy", "Privacy Policy"],
                ["terms", "Terms of Service"],
                ["cookies", "Cookie & Advertising Notice"],
                ["disclaimer", "Disclaimer"],
              ] as const).map(([key, label]) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setActivePolicy((prev) => (prev === key ? null : key))}
                    className="hover:text-[#0f294a] hover:underline text-left"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
            <p className="pt-2 text-[11px] text-slate-500">
              Contact &amp; Feedback: support@corporatebuddy.in
            </p>
          </div>
        </div>

        {selectedPolicy && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-sm font-bold text-[#0b192c]">{selectedPolicy.title}</h2>
                <p className="text-[11px] text-slate-500">{selectedPolicy.updated}</p>
              </div>
              <button
                type="button"
                onClick={() => setActivePolicy(null)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <div className="space-y-1.5 text-xs leading-relaxed text-slate-700">
              {selectedPolicy.paragraphs.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t border-slate-100 pt-5 text-[11px] text-slate-500">
          <p>© 2026 CorporateBuddy. All rights reserved.</p>
          <p>Built for Indian corporate workflows · Advertising &amp; cookie disclosures included.</p>
        </div>
      </div>
    </footer>
  );
}
