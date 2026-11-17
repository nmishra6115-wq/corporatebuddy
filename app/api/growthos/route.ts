import { NextResponse } from "next/server";
import {
  AppraisalQuestionItem,
  generateGrowthAnswers,
  GrowthTone,
} from "@/lib/growthosEngine";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const questions: AppraisalQuestionItem[] = Array.isArray(body?.questions)
      ? body.questions
      : [];
    const achievements: string =
      typeof body?.achievements === "string" ? body.achievements : "";
    const tone: GrowthTone =
      body?.tone === "confident" || body?.tone === "concise"
        ? body.tone
        : "professional";

    if (!questions.length) {
      return NextResponse.json(
        { error: "Please provide at least one appraisal question." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const answers = generateGrowthAnswers(questions, achievements, tone);
      return NextResponse.json({ answers, mode: "structured-local" });
    }

    const prompt = [
      "You are CorporateBuddy GrowthOS, a calm, accurate performance review writing assistant.",
      "Rules:",
      "- Write in natural first-person corporate language.",
      "- Use ONLY evidence from the user's achievements.",
      "- NEVER invent percentages, metrics, ratings, or unverified claims.",
      "- Respect any wordLimit or charLimit on each question.",
      `- Style mode: ${tone}.`,
      "Return ONLY valid JSON: { \"answers\": [ { \"questionId\": string, \"answer\": string, \"missingEvidenceNote\"?: string } ] }",
      `Achievements:\n${achievements || "(None provided)"}`,
      `Questions:\n${JSON.stringify(questions)}`,
    ].join("\n\n");

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!geminiRes.ok) {
      const answers = generateGrowthAnswers(questions, achievements, tone);
      return NextResponse.json({ answers, mode: "structured-fallback" });
    }

    const geminiJson = await geminiRes.json();
    const rawText =
      geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(rawText);

    if (!Array.isArray(parsed?.answers)) {
      const answers = generateGrowthAnswers(questions, achievements, tone);
      return NextResponse.json({ answers, mode: "structured-fallback" });
    }

    const answers = questions.map((q) => {
      const match = parsed.answers.find(
        (a: { questionId?: string }) => a?.questionId === q.id
      );
      return {
        questionId: q.id,
        question: q.question,
        answer:
          typeof match?.answer === "string" && match.answer.trim()
            ? match.answer.trim()
            : generateGrowthAnswers([q], achievements, tone)[0].answer,
        tone,
        missingEvidenceNote:
          typeof match?.missingEvidenceNote === "string"
            ? match.missingEvidenceNote
            : undefined,
        charLimit: q.charLimit,
        wordLimit: q.wordLimit,
      };
    });

    return NextResponse.json({ answers, mode: "gemini" });
  } catch {
    return NextResponse.json(
      { error: "Unable to generate answers right now. Please try again." },
      { status: 500 }
    );
  }
}