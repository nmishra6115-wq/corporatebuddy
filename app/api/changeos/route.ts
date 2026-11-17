import { NextResponse } from "next/server";
import {
  ChangeRegisterRecord,
  compareExtractedDocuments,
  extractDocumentFromBuffer,
} from "@/lib/changeosEngine";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const oldFile = formData.get("oldDocument");
    const newFile = formData.get("newDocument");

    if (!(oldFile instanceof File) || !(newFile instanceof File)) {
      return NextResponse.json(
        { error: "Please upload both Previous Document and Updated Document." },
        { status: 400 }
      );
    }

    const oldDoc = await extractDocumentFromBuffer(await oldFile.arrayBuffer(), oldFile.name, "doc-old");
    const newDoc = await extractDocumentFromBuffer(await newFile.arrayBuffer(), newFile.name, "doc-new");
    const { changes, coverage } = compareExtractedDocuments(oldDoc, newDoc);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || changes.length === 0) {
      return NextResponse.json({ oldDoc, newDoc, changes, coverage, mode: "deterministic-local" });
    }

    const sampleChanges = changes.slice(0, 25).map((c) => ({
      changeId: c.changeId,
      section: c.section,
      oldText: c.oldText,
      newText: c.newText,
      exactDifference: c.exactDifference,
    }));

    const prompt = [
      "You are CorporateBuddy ChangeOS. Explain each detected document change strictly from the provided oldText and newText.",
      "Rules: Never invent facts, reasons, numbers, or external policy requirements. Keep explanations concise and exact.",
      "Return ONLY JSON: { \"explanations\": [ { \"changeId\": string, \"explanation\": string } ] }",
      JSON.stringify(sampleChanges),
    ].join("\n\n");

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ oldDoc, newDoc, changes, coverage, mode: "deterministic-fallback" });
    }

    const json = await res.json();
    const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(raw);
    const expMap = new Map<string, string>();
    if (Array.isArray(parsed?.explanations)) {
      for (const item of parsed.explanations) {
        if (item?.changeId && typeof item?.explanation === "string" && item.explanation.trim()) {
          expMap.set(item.changeId, item.explanation.trim());
        }
      }
    }

    const enriched: ChangeRegisterRecord[] = changes.map((c) => ({
      ...c,
      explanation: expMap.get(c.changeId) ?? c.explanation,
    }));

    return NextResponse.json({ oldDoc, newDoc, changes: enriched, coverage, mode: "gemini-grounded" });
  } catch {
    return NextResponse.json({ error: "Unable to compare documents right now." }, { status: 500 });
  }
}
