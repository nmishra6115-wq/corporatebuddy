import { NextResponse } from "next/server";

const PREFERRED_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash"
];

async function resolveModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    if (!res.ok) return PREFERRED_MODELS;
    const data = await res.json();
    const models = Array.isArray(data?.models) ? data.models : [];
    const available = models
      .filter((m: { name?: string; supportedGenerationMethods?: string[] }) =>
        Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent")
      )
      .map((m: { name?: string }) => String(m.name || "").replace(/^models\//, ""))
      .filter(Boolean);
    const matched = PREFERRED_MODELS.filter((m) => available.includes(m));
    if (matched.length > 0) return matched;
    const flashAny = available.filter((m: string) => m.includes("flash") || m.includes("pro"));
    return flashAny.length > 0 ? flashAny.slice(0, 4) : PREFERRED_MODELS;
  } catch {
    return PREFERRED_MODELS;
  }
}

export async function POST(req: Request) {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  if (!apiKey) {
    return NextResponse.json({ refined: false, reason: "no_api_key" });
  }
  try {
    const body = await req.json();
    const prompt = String(body?.prompt || "").trim();
    const templateId = String(body?.templateId || "executive-minimal");
    if (!prompt) {
      return NextResponse.json({ refined: false, reason: "empty_prompt" });
    }
    const sys = [
      "You are PresentOS, an executive presentation writer inside CorporateBuddy.",
      "Write a complete, detailed, ready-to-present 6-slide executive deck directly from the user prompt so the user does NOT have to fill blanks.",
      "Every slide must contain substantive, specific, domain-accurate content written in full executive prose/bullets—never placeholders like TBD, fill here, or generic filler.",
      "Return STRICT JSON only with exact shape:",
      "{ title: string, tagline: string, slides: [{ title: string, purpose: string, executiveTakeaway: string, layoutKind: \"hero\" | \"kpi-grid\" | \"split-table\" | \"action-matrix\", kpiHighlights: [{ label: string, value: string, delta: string }], keyPoints: string[], structuredTable: { headers: string[], rows: string[][] }, speakerNotes: string }] }.",
      "Include 4-5 detailed keyPoints per slide, 3 kpiHighlights per slide, a 3-4 column structuredTable with 3-4 concrete rows per slide, and thorough speakerNotes.",
      "Tailor every slide strictly to the user input topic."
    ].join(" ");

    const candidates = await resolveModels(apiKey);
    let lastReason = "no_model_succeeded";
    for (const model of candidates) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          contents: [{ role: "user", parts: [{ text: `Create a complete 6-slide executive presentation for: ${prompt}\nTheme: ${templateId}` }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        lastReason = `${model}_http_${res.status}: ${errText.slice(0, 100)}`;
        continue;
      }
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        lastReason = `${model}_empty`;
        continue;
      }
      const parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed?.slides) || parsed.slides.length === 0) {
        lastReason = `${model}_invalid_slides`;
        continue;
      }
      return NextResponse.json({ refined: true, model, data: parsed });
    }
    return NextResponse.json({ refined: false, reason: lastReason });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network_error";
    return NextResponse.json({ refined: false, reason: msg });
  }
}