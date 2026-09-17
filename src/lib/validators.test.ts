import assert from "node:assert/strict";
import { test } from "node:test";

const validators: typeof import("./validators") = await import(new URL("./validators.ts", import.meta.url).href);

const card = { id: "c1", front: "Q", back: "A", dueAt: "2026-01-01T00:00:00.000Z", interval: 0 };

test("flashcard validation is strict and bounded", () => {
  assert.equal(validators.validFlashcards([card], 10)!.length, 1);
  assert.equal(validators.validFlashcards([{ ...card, interval: 1.5 }], 10), null);
  assert.equal(validators.validFlashcards([{ ...card, id: 1 }], 10), null);
  assert.equal(validators.validFlashcards(Array.from({ length: 11 }, (_, i) => ({ ...card, id: `c${i}` })), 10), null);
  assert.equal(validators.validFlashcards("nope", 10), null);
});

test("quiz validation is strict and bounded", () => {
  const question = { question: "Q?", options: ["a", "b"], answer: 0, explanation: "why" };
  assert.equal(validators.validQuiz([question], 5)!.length, 1);
  assert.equal(validators.validQuiz([{ ...question, answer: 4 }], 5), null);
  assert.equal(validators.validQuiz([{ ...question, options: ["only"] }], 5), null);
  assert.equal(validators.validQuiz([{ ...question, options: ["a", "b", 3] }], 5), null);
  assert.equal(validators.validQuiz(Array.from({ length: 6 }, () => question), 5), null);
});

test("message and body validation guards work", () => {
  assert.equal(validators.validMessages([{ role: "user", content: "hi" }], 10)!.length, 1);
  assert.equal(validators.validMessages([{ role: "system", content: "hi" }], 10), null);
  assert.equal(validators.validMessages(Array.from({ length: 11 }, () => ({ role: "user", content: "x" })), 10), null);
  assert.equal(validators.validTitle("  title  ", 20), "title");
  assert.equal(validators.validTitle("", 20), null);
  assert.equal(validators.validDifficulty("hard"), true);
  assert.equal(validators.validDifficulty("extreme"), false);
  assert.equal(validators.validCount("7", 20), 7);
  assert.equal(validators.validCount("99", 20), null);
});
