export type StickyColor = "amber" | "blue" | "teal" | "slate";

export interface ExtractedTask {
  task: string;
  dueHint: string;
  confirmed: boolean;
}

export interface StickyNoteItem {
  id: string;
  title: string;
  content: string;
  color: StickyColor;
  category: string;
  pinned: boolean;
  completed: boolean;
  archived: boolean;
  updatedAt: string;
  extractedTasks: ExtractedTask[];
}

export function extractTasksFromNote(content: string): ExtractedTask[] {
  const parts = content
    .split(/\n|;|and\s+(?=remind|send|follow|submit|check|ping|share)/i)
    .map((s) => s.trim())
    .filter(Boolean);

  return parts.map((part) => {
    const dueMatch = part.match(
      /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|eod|\d{1,2}\s*(?:am|pm))\b/i
    );
    return {
      task: part,
      dueHint: dueMatch ? dueMatch[0] : "Confirm date/time",
      confirmed: false,
    };
  });
}

export function buildStickyBrief(note: StickyNoteItem): string {
  const activeTasks = note.extractedTasks.length;
  return `${note.category} · ${activeTasks} extracted item(s) · Pinned: ${note.pinned ? "Yes" : "No"}`;
}
