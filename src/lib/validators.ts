const MAX_CARD_CHARS = 2_000;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_OPTION_CHARS = 500;

export function validTitle(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

export function validFlashcards(value: unknown, max: number) {
  if (!Array.isArray(value) || value.length > max) return null;
  const cards = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const { id, front, back, dueAt, interval } = entry as { id: unknown; front: unknown; back: unknown; dueAt: unknown; interval: unknown };
    if (typeof id !== "string" || !id || id.length > 64) return null;
    if (typeof front !== "string" || !front.trim() || front.length > MAX_CARD_CHARS) return null;
    if (typeof back !== "string" || !back.trim() || back.length > MAX_CARD_CHARS) return null;
    if (typeof dueAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(dueAt)) return null;
    if (typeof interval !== "number" || !Number.isInteger(interval) || interval < 0) return null;
    cards.push({ id, front, back, dueAt, interval });
  }
  return cards;
}

export function validQuiz(value: unknown, max: number) {
  if (!Array.isArray(value) || value.length > max) return null;
  const questions = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const item = entry as Record<string, unknown>;
    if (typeof item.question !== "string" || !item.question.trim() || item.question.length > MAX_CARD_CHARS) return null;
    if (!Array.isArray(item.options) || item.options.length < 2 || item.options.length > 6) return null;
    for (const option of item.options) {
      if (typeof option !== "string" || option.length > MAX_OPTION_CHARS) return null;
    }
    if (typeof item.answer !== "number" || !Number.isInteger(item.answer) || item.answer < 0 || item.answer >= item.options.length) return null;
    if (typeof item.explanation !== "string" || item.explanation.length > MAX_CARD_CHARS) return null;
    questions.push({ question: item.question, options: item.options, answer: item.answer, explanation: item.explanation });
  }
  return questions;
}

export function validMessages(value: unknown, max: number) {
  if (!Array.isArray(value) || value.length > max) return null;
  const messages = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const message = entry as Record<string, unknown>;
    if (message.role !== "user" && message.role !== "assistant") return null;
    if (typeof message.content !== "string" || message.content.length > MAX_MESSAGE_CHARS) return null;
    messages.push({ role: message.role, content: message.content });
  }
  return messages;
}

export function validDifficulty(value: unknown): boolean {
  return value === undefined || value === "easy" || value === "medium" || value === "hard";
}

export function validCount(value: unknown, max: number): number | null {
  if (value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) return null;
  return parsed;
}
