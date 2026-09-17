import { db } from "./db";
import { type Folder, type Flashcard, type Message, type Note, type QuizQuestion } from "./types";

export const MAX_SOURCE_CHARS = 100_000;
export const MAX_TITLE_CHARS = 200;
export const MAX_CONTENT_CHARS = 200_000;
export const MAX_FOLDER_NAME_CHARS = 80;
export const MAX_MESSAGE_CHARS = 8_000;
export const MAX_MESSAGES = 60;
export const MAX_FLASHCARDS = 100;
export const MAX_QUESTIONS = 60;
export const MAX_CARD_CHARS = 2_000;
export const MAX_OPTION_CHARS = 500;
export const MAX_PODCAST_CHARS = 100_000;

export type NoteRecord = {
  id: string;
  title: string;
  folderId: string | null;
  source: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  podcast: string;
  messages: Message[];
};

const rows = {
  insertNote: () =>
    db().prepare(
      "INSERT INTO notes (id, title, folder_id, source, content, created_at, updated_at, flashcards, quiz, podcast, messages) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ),
  selectNotes: () => db().prepare("SELECT * FROM notes ORDER BY updated_at DESC"),
  selectNote: () => db().prepare("SELECT * FROM notes WHERE id = ?"),
  updateNoteContent: () =>
    db().prepare("UPDATE notes SET title = ?, content = ?, folder_id = ?, flashcards = ?, quiz = ?, podcast = ?, messages = ?, updated_at = ? WHERE id = ?"),
  touchMessages: () => db().prepare("UPDATE notes SET messages = ? WHERE id = ?"),
  deleteNote: () => db().prepare("DELETE FROM notes WHERE id = ?"),
  insertFolder: () => db().prepare("INSERT INTO folders (id, name) VALUES (?, ?)"),
  selectFolders: () => db().prepare("SELECT * FROM folders ORDER BY name"),
  selectFolder: () => db().prepare("SELECT id FROM folders WHERE id = ?"),
  deleteFolder: () => db().prepare("DELETE FROM folders WHERE id = ?"),
  unfileNotes: () => db().prepare("UPDATE notes SET folder_id = NULL WHERE folder_id = ?"),
} as const;

export function saveNote(note: NoteRecord): void {
  rows.insertNote().run(note.id, note.title, note.folderId, note.source, note.content, note.createdAt, note.updatedAt, JSON.stringify(note.flashcards), JSON.stringify(note.quiz), note.podcast, JSON.stringify(note.messages));
}

export function getNoteRow(id: string): Record<string, unknown> | undefined {
  return rows.selectNote().get(id) as Record<string, unknown> | undefined;
}

export function allNotes(): Note[] {
  return (rows.selectNotes().all() as Record<string, unknown>[]).map(noteFromRow);
}

export function allFolders(): Folder[] {
  return rows.selectFolders().all() as Folder[];
}

export function noteFromRow(row: Record<string, unknown>): Note {
  return {
    id: String(row.id),
    title: String(row.title),
    folderId: (row.folder_id as string | null) ?? null,
    source: String(row.source),
    content: String(row.content),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    flashcards: safeArray(row.flashcards) as Flashcard[],
    quiz: safeArray(row.quiz) as QuizQuestion[],
    podcast: String(row.podcast ?? ""),
    messages: safeArray(row.messages) as Message[],
  };
}

function safeArray(value: unknown): unknown[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function touchNote(id: string, patch: { title?: string; content?: string; folderId?: string | null; flashcards?: Flashcard[]; quiz?: QuizQuestion[]; podcast?: string; messages?: Message[] }): Note | null {
  const row = getNoteRow(id);
  if (!row) return null;
  const note = noteFromRow(row);
  const updated = {
    id: note.id,
    title: patch.title ?? note.title,
    folderId: "folderId" in patch ? patch.folderId ?? null : note.folderId,
    source: note.source,
    content: patch.content ?? note.content,
    createdAt: note.createdAt,
    updatedAt: new Date().toISOString(),
    flashcards: patch.flashcards ?? note.flashcards,
    quiz: patch.quiz ?? note.quiz,
    podcast: patch.podcast ?? note.podcast,
    messages: patch.messages ?? note.messages,
  };
  rows.updateNoteContent().run(updated.title, updated.content, updated.folderId, JSON.stringify(updated.flashcards), JSON.stringify(updated.quiz), updated.podcast, JSON.stringify(updated.messages), updated.updatedAt, id);
  return updated;
}

export function deleteNoteRow(id: string): boolean {
  return rows.deleteNote().run(id).changes > 0;
}

export function createFolder(id: string, name: string): Folder {
  rows.insertFolder().run(id, name);
  return { id, name };
}

export function deleteFolderRow(id: string): boolean {
  const removed = rows.deleteFolder().run(id).changes > 0;
  if (removed) rows.unfileNotes().run(id);
  return removed;
}

export function folderExists(id: string): boolean {
  return !!rows.selectFolder().get(id);
}
