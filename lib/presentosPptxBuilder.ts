import PptxGenJS from "pptxgenjs";
import {
  PRESENTOS_TEMPLATES,
  type PresentOSOutlineSlide,
  type PresentOSSpec,
  type PresentOSTemplateId,
} from "./presentosEngine";

export interface PresentOSValidationResult {
  ok: boolean;
  issues: string[];
}

function fitTitleFontSize(text: string, maxPt: number, minPt: number): number {
  const len = (text || "").trim().length;
  if (len <= 34) return maxPt;
  if (len <= 48) return Math.max(minPt, maxPt - 5);
  if (len <= 64) return Math.max(minPt, maxPt - 9);
  return minPt;
}

function templateThemeExtras(templateId: PresentOSTemplateId) {
  switch (templateId) {
    case "modern-corporate":
      return { bannerFill: "E0E7FF", bannerLine: "818CF8", leftStripe: true, kpiFill: "EEF2FF", label: "MODERN CORPORATE BRIEF" };
    case "client-review":
      return { bannerFill: "CCFBF1", bannerLine: "2DD4BF", leftStripe: false, kpiFill: "F0FDFA", label: "CLIENT BUSINESS REVIEW" };
    case "data-analytics":
      return { bannerFill: "DBEAFE", bannerLine: "60A5FA", leftStripe: true, kpiFill: "EFF6FF", label: "DATA & ANALYTICS BRIEF" };
    case "training-learning":
      return { bannerFill: "FEF3C7", bannerLine: "F59E0B", leftStripe: false, kpiFill: "FFFBEB", label: "LEARNING & ENABLEMENT MODULE" };
    case "executive-minimal":
    default:
      return { bannerFill: "F1F5F9", bannerLine: "CBD5E1", leftStripe: false, kpiFill: "FFFFFF", label: "PRESENTOS EXECUTIVE BRIEF" };
  }
}

export function validatePresentOSSpec(spec: PresentOSSpec): PresentOSValidationResult {
  const issues: string[] = [];
  if (!spec.title?.trim()) issues.push("Deck title is required.");
  if (!Array.isArray(spec.slides) || spec.slides.length === 0) {
    issues.push("At least one slide is required.");
  }
  spec.slides.forEach((s, idx) => {
    if (!s.title?.trim()) issues.push(`Slide ${idx + 1} is missing a title.`);
    if (!Array.isArray(s.keyPoints) || s.keyPoints.length === 0) {
      issues.push(`Slide ${idx + 1} needs at least one key point.`);
    }
  });
  return { ok: issues.length === 0, issues };
}

export function buildSpeakerNotes(slide: PresentOSOutlineSlide, audience: string): string {
  const lines: string[] = [];
  lines.push(`Audience: ${audience}`);
  if (slide.purpose) lines.push(`Objective: ${slide.purpose}`);
  if (slide.executiveTakeaway) lines.push(`Key Takeaway: ${slide.executiveTakeaway}`);
  if (slide.keyPoints?.length) {
    lines.push("Talking Points:");
    slide.keyPoints.forEach((kp) => lines.push(`- ${kp}`));
  }
  return lines.join("\n");
}

export async function downloadPresentOSPptx(
  spec: PresentOSSpec,
  templateId: PresentOSTemplateId = "executive-minimal"
): Promise<PresentOSValidationResult> {
  const validation = validatePresentOSSpec(spec);
  if (!validation.ok) return validation;

  const tpl = PRESENTOS_TEMPLATES.find((t) => t.id === templateId) || PRESENTOS_TEMPLATES[0];
  const extras = templateThemeExtras(tpl.id);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "CorporateBuddy PresentOS";
  pptx.company = "CorporateBuddy";
  pptx.subject = spec.title;
  pptx.title = spec.title;

  // Title Slide strictly bounded inside 13.333" x 7.5"
  const titleSlide = pptx.addSlide();
  const isLightCover = tpl.id === "training-learning" || tpl.id === "client-review";
  titleSlide.background = { color: isLightCover ? tpl.bgHex : tpl.headerBgHex };
  if (extras.leftStripe) {
    titleSlide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 0.24,
      h: 7.5,
      fill: { color: tpl.accentHex },
      line: { color: tpl.accentHex, pt: 0 },
    });
  }
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0.75,
    y: 0.72,
    w: 1.5,
    h: 0.09,
    fill: { color: tpl.accentHex },
    line: { color: tpl.accentHex, pt: 0 },
  });
  titleSlide.addText(extras.label, {
    x: 0.75,
    y: 0.98,
    w: 11.7,
    h: 0.35,
    fontSize: 11,
    bold: true,
    wrap: true,
    color: isLightCover ? tpl.accentHex : "CBD5E1",
  });
  const coverTitleSize = fitTitleFontSize(spec.title, 30, 20);
  titleSlide.addText(spec.title, {
    x: 0.75,
    y: 1.48,
    w: 11.7,
    h: 1.85,
    fontSize: coverTitleSize,
    bold: true,
    wrap: true,
    valign: "top",
    color: isLightCover ? tpl.textHex : "FFFFFF",
  });
  titleSlide.addText(spec.tagline || spec.storylineSummary || "", {
    x: 0.75,
    y: 3.5,
    w: 11.5,
    h: 1.2,
    fontSize: 14,
    wrap: true,
    valign: "top",
    color: isLightCover ? "475569" : "E2E8F0",
  });
  titleSlide.addText(
    `Audience: ${spec.audience}    |    Slides: ${spec.slides.length}    |    ${
      spec.isGeneralDraft ? "Draft Brief" : "Source-Grounded"
    }`,
    {
      x: 0.75,
      y: 6.55,
      w: 11.7,
      h: 0.4,
      fontSize: 11,
      wrap: true,
      color: isLightCover ? "64748B" : "94A3B8",
    }
  );
  titleSlide.addNotes(`Deck: ${spec.title}\n${spec.storylineSummary || ""}`);

  // Content Slides with non-overlapping bands & per-template structure
  spec.slides.forEach((slide, idx) => {
    const s = pptx.addSlide();
    s.background = { color: tpl.bgHex };
    s.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.333,
      h: 7.5,
      fill: { color: tpl.bgHex },
      line: { color: tpl.bgHex, pt: 0 },
    });

    if (extras.leftStripe) {
      s.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: 0.16,
        h: 7.5,
        fill: { color: tpl.accentHex },
        line: { color: tpl.accentHex, pt: 0 },
      });
    } else {
      s.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: 13.333,
        h: 0.12,
        fill: { color: tpl.headerBgHex },
        line: { color: tpl.headerBgHex, pt: 0 },
      });
    }

    s.addText(
      `SLIDE ${String(idx + 1).padStart(2, "0")}  ·  ${(slide.layoutKind || "BRIEF").toUpperCase()}  ·  ${tpl.name.toUpperCase()}`,
      {
        x: 0.65,
        y: 0.26,
        w: 11.9,
        h: 0.28,
        fontSize: 9.5,
        bold: true,
        wrap: true,
        color: tpl.accentHex,
      }
    );

    const slideTitleSize = fitTitleFontSize(slide.title, 20, 15);
    s.addText(slide.title, {
      x: 0.65,
      y: 0.56,
      w: 11.95,
      h: 0.65,
      fontSize: slideTitleSize,
      bold: true,
      wrap: true,
      valign: "top",
      color: tpl.textHex,
    });

    const takeaway = slide.executiveTakeaway || slide.purpose || "";
    s.addShape(pptx.ShapeType.rect, {
      x: 0.65,
      y: 1.26,
      w: 11.95,
      h: 0.46,
      fill: { color: extras.bannerFill },
      line: { color: extras.bannerLine, pt: 0.75 },
    });
    s.addText(takeaway, {
      x: 0.8,
      y: 1.31,
      w: 11.65,
      h: 0.36,
      fontSize: 10.5,
      bold: true,
      wrap: true,
      color: tpl.textHex,
    });

    s.addText(slide.purpose || "", {
      x: 0.65,
      y: 1.78,
      w: 11.95,
      h: 0.3,
      fontSize: 10.5,
      italic: true,
      wrap: true,
      color: "475569",
    });

    const hasKpis = Boolean(slide.kpiHighlights && slide.kpiHighlights.length > 0);
    if (hasKpis && slide.kpiHighlights) {
      slide.kpiHighlights.slice(0, 3).forEach((kpi, ki) => {
        const kx = 0.65 + ki * 4.08;
        s.addShape(pptx.ShapeType.rect, {
          x: kx,
          y: 2.14,
          w: 3.84,
          h: 0.88,
          fill: { color: extras.kpiFill },
          line: { color: extras.bannerLine, pt: 0.75 },
        });
        s.addText(kpi.label, {
          x: kx + 0.14,
          y: 2.2,
          w: 3.55,
          h: 0.22,
          fontSize: 9,
          wrap: true,
          color: "64748B",
        });
        s.addText(kpi.value, {
          x: kx + 0.14,
          y: 2.42,
          w: 3.55,
          h: 0.3,
          fontSize: 13.5,
          bold: true,
          wrap: true,
          color: tpl.textHex,
        });
        if (kpi.delta) {
          s.addText(kpi.delta, {
            x: kx + 0.14,
            y: 2.72,
            w: 3.55,
            h: 0.2,
            fontSize: 9,
            bold: true,
            wrap: true,
            color: tpl.accentHex,
          });
        }
      });
    }

    const contentTop = hasKpis ? 3.14 : 2.16;
    const hasTable = Boolean(slide.structuredTable && slide.structuredTable.headers.length > 0);

    if (hasTable && slide.structuredTable) {
      const bulletRuns = slide.keyPoints.slice(0, 5).map((kp) => ({
        text: kp,
        options: { breakLine: true, bullet: { code: "2022" }, fontSize: 11.5, color: tpl.textHex },
      }));
      s.addText(bulletRuns, {
        x: 0.65,
        y: contentTop,
        w: 5.8,
        h: 3.45,
        valign: "top",
        wrap: true,
      });

      const tableRows = [
        slide.structuredTable.headers.map((h) => ({
          text: h,
          options: { bold: true, color: "FFFFFF", fill: { color: tpl.headerBgHex } },
        })),
        ...slide.structuredTable.rows.slice(0, 5).map((r) =>
          r.map((cell) => ({
            text: cell,
            options: { color: tpl.textHex, fill: { color: "FFFFFF" } },
          }))
        ),
      ];
      s.addTable(tableRows, {
        x: 6.7,
        y: contentTop,
        w: 5.95,
        h: 3.4,
        fontSize: 10,
        border: { type: "solid", pt: 0.5, color: "CBD5E1" },
        margin: 0.08,
      });
    } else {
      const bulletRuns = slide.keyPoints.slice(0, 6).map((kp) => ({
        text: kp,
        options: { breakLine: true, bullet: { code: "2022" }, fontSize: 12.5, color: tpl.textHex },
      }));
      s.addText(bulletRuns, {
        x: 0.65,
        y: contentTop,
        w: 11.95,
        h: 3.5,
        valign: "top",
        wrap: true,
      });
    }

    s.addShape(pptx.ShapeType.line, {
      x: 0.65,
      y: 6.68,
      w: 11.95,
      h: 0,
      line: { color: "CBD5E1", pt: 0.75 },
    });
    const footerLeft =
      slide.sourceCitations && slide.sourceCitations.length > 0
        ? `Sources: ${slide.sourceCitations.join(" · ")}`
        : slide.missingInfo && slide.missingInfo.length > 0
          ? `To confirm: ${slide.missingInfo[0]}`
          : "PresentOS Executive Brief";
    s.addText(footerLeft, {
      x: 0.65,
      y: 6.76,
      w: 10.2,
      h: 0.32,
      fontSize: 9,
      wrap: true,
      color: "64748B",
    });
    s.addText(`${idx + 1} / ${spec.slides.length}`, {
      x: 11.2,
      y: 6.76,
      w: 1.4,
      h: 0.32,
      fontSize: 9,
      bold: true,
      align: "right",
      color: "64748B",
    });

    const baseNotes = slide.speakerNotes || buildSpeakerNotes(slide, spec.audience);
    const notesWithSrc =
      slide.sourceCitations && slide.sourceCitations.length > 0
        ? `${baseNotes}\nSources: ${slide.sourceCitations.join("; ")}`
        : baseNotes;
    s.addNotes(notesWithSrc);
  });

  const safeName = `${spec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "presentos-deck"}.pptx`;
  await pptx.writeFile({ fileName: safeName });
  return validation;
}