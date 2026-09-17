export type Folder = { id: string; name: string };

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  dueAt: string;
  interval: number;
};

export type QuizQuestion = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
};

export type Message = { role: "user" | "assistant"; content: string };

export type Note = {
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
