"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import { Markdown } from "./markdown";
import type { Folder, Note } from "@/lib/types";

type Session = { authenticated: boolean; configured: boolean; hasServerKey: boolean; defaultModel: string };
type Tab = "notes" | "flashcards" | "quiz" | "listen" | "chat";
type Toast = { kind: "error" | "success"; message: string } | null;
type ApiResponse = Session & { error?: string; note: Note; notes: Note[]; folders: Folder[]; folder: Folder };

const MODELS = [
  { value: "openai/gpt-4o-mini", label: "GPT-4o mini", note: "Fast and economical" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", note: "Long documents" },
  { value: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku", note: "Clear writing" },
  { value: "deepseek/deepseek-chat-v3-0324", label: "DeepSeek V3", note: "Strong value" },
];

export function StudyApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem("nal_openrouter_key") ?? "");
  const [model, setModel] = useState(() => typeof window === "undefined" ? MODELS[0].value : localStorage.getItem("nal_openrouter_model") ?? MODELS[0].value);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    try {
      const sessionResponse = await fetch("/api/session", { cache: "no-store" });
      const nextSession = await responseJson(sessionResponse);
      setSession(nextSession);
      if (nextSession.authenticated) {
        const response = await fetch("/api/notes", { cache: "no-store" });
        const data = await responseJson(response);
        if (!response.ok) throw new Error(data.error || "Could not load your library.");
        setNotes(data.notes ?? []);
        setFolders(data.folders ?? []);
      }
    } catch (error) {
      setToast({ kind: "error", message: messageOf(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => { void load(); });
    return () => cancelAnimationFrame(frame);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selected = notes.find((note) => note.id === selectedId) ?? null;
  const visibleNotes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? notes.filter((note) => note.title.toLowerCase().includes(needle)) : notes;
  }, [notes, query]);

  const headers = useCallback((json = false) => {
    const result: Record<string, string> = {};
    if (apiKey) result["x-openrouter-key"] = apiKey;
    if (model) result["x-openrouter-model"] = model;
    if (json) result["content-type"] = "application/json";
    return result;
  }, [apiKey, model]);

  function updateNote(note: Note) {
    setNotes((current) => current.map((item) => item.id === note.id ? note : item).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }

  function saveSettings(nextKey: string, nextModel: string) {
    const key = nextKey.trim();
    if (key) localStorage.setItem("nal_openrouter_key", key);
    else localStorage.removeItem("nal_openrouter_key");
    localStorage.setItem("nal_openrouter_model", nextModel);
    setApiKey(key);
    setModel(nextModel);
    setSettingsOpen(false);
    setToast({ kind: "success", message: "AI settings saved on this device." });
  }

  if (loading && !session) return <LoadingScreen />;
  if (session?.configured && !session.authenticated) return <LoginScreen onSuccess={load} />;

  return (
    <div className="app-shell">
      <Sidebar
        notes={visibleNotes}
        folders={folders}
        selectedId={selectedId}
        query={query}
        open={sidebarOpen}
        onQuery={setQuery}
        onSelect={(id) => { setSelectedId(id); setSidebarOpen(false); }}
        onHome={() => { setSelectedId(null); setSidebarOpen(false); }}
        onCreate={() => setCreateOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onFolder={async () => {
          const name = window.prompt("Folder name");
          if (!name?.trim()) return;
          try {
            const response = await fetch("/api/folders", { method: "POST", headers: headers(true), body: JSON.stringify({ name }) });
            const data = await responseJson(response);
            if (!response.ok) throw new Error(data.error);
            setFolders((current) => [...current, data.folder].sort((a, b) => a.name.localeCompare(b.name)));
          } catch (error) { setToast({ kind: "error", message: messageOf(error) }); }
        }}
      />
      <main className="main-stage">
        <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button>
        {selected ? (
          <NoteWorkspace
            key={selected.id}
            note={selected}
            folder={folders.find((folder) => folder.id === selected.folderId)}
            headers={headers}
            onUpdate={updateNote}
            onBack={() => setSelectedId(null)}
            onDelete={async () => {
              if (!window.confirm(`Delete “${selected.title}”?`)) return;
              const response = await fetch(`/api/notes/${selected.id}`, { method: "DELETE", headers: headers() });
              if (!response.ok) return setToast({ kind: "error", message: "Could not delete this material." });
              setNotes((current) => current.filter((note) => note.id !== selected.id));
              setSelectedId(null);
              setToast({ kind: "success", message: "Material moved out of your library." });
            }}
            onError={(message) => setToast({ kind: "error", message })}
            onSuccess={(message) => setToast({ kind: "success", message })}
            onNeedKey={() => setSettingsOpen(true)}
            hasKey={Boolean(apiKey || session?.hasServerKey)}
          />
        ) : (
          <Home notes={notes} onCreate={() => setCreateOpen(true)} onSelect={setSelectedId} />
        )}
      </main>
      {createOpen && (
        <CreateDialog
          folders={folders}
          hasKey={Boolean(apiKey || session?.hasServerKey)}
          headers={headers}
          onNeedKey={() => { setCreateOpen(false); setSettingsOpen(true); }}
          onClose={() => setCreateOpen(false)}
          onCreated={(note) => {
            setNotes((current) => [note, ...current]);
            setSelectedId(note.id);
            setCreateOpen(false);
            setToast({ kind: "success", message: "Your study set is ready." });
          }}
        />
      )}
      {settingsOpen && <SettingsDialog apiKey={apiKey} model={model} hasServerKey={Boolean(session?.hasServerKey)} onSave={saveSettings} onClose={() => setSettingsOpen(false)} />}
      {toast && <div className={`toast toast-${toast.kind}`} role="status"><span>{toast.kind === "success" ? "✓" : "!"}</span>{toast.message}</div>}
    </div>
  );
}

function Sidebar(props: {
  notes: Note[]; folders: Folder[]; selectedId: string | null; query: string; open: boolean;
  onQuery: (value: string) => void; onSelect: (id: string) => void; onHome: () => void;
  onCreate: () => void; onSettings: () => void; onFolder: () => void;
}) {
  return (
    <>
      {props.open && <button className="sidebar-scrim" aria-label="Close navigation" onClick={props.onHome} />}
      <aside className={`sidebar ${props.open ? "sidebar-open" : ""}`}>
        <div className="brand-lockup" onClick={props.onHome} role="button" tabIndex={0}>
          <BrandMark />
          <span>Naturally<br/><strong>aspiratedlearn</strong></span>
        </div>
        <button className="new-material" onClick={props.onCreate}><Icon name="plus" size={17} /> New material</button>
        <nav className="sidebar-nav" aria-label="Primary">
          <button className={!props.selectedId ? "active" : ""} onClick={props.onHome}><Icon name="home" /> Home</button>
          <button><Icon name="layers" /> Review queue <span className="count-pill">{props.notes.reduce((sum, note) => sum + note.flashcards.filter((card) => new Date(card.dueAt) <= new Date()).length, 0)}</span></button>
        </nav>
        <div className="sidebar-section">
          <div className="section-label"><span>Folders</span><button onClick={props.onFolder} aria-label="Add folder"><Icon name="plus" size={15}/></button></div>
          {props.folders.map((folder) => <button className="folder-row" key={folder.id}><Icon name="folder" size={16}/><span>{folder.name}</span></button>)}
          {!props.folders.length && <p className="sidebar-empty">Group materials by course or project.</p>}
        </div>
        <div className="sidebar-section sidebar-library">
          <div className="section-label"><span>Library</span><span>{props.notes.length}</span></div>
          <label className="sidebar-search"><Icon name="search" size={15}/><input value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder="Find material" /></label>
          <div className="note-list">
            {props.notes.map((note) => (
              <button key={note.id} className={props.selectedId === note.id ? "selected" : ""} onClick={() => props.onSelect(note.id)}>
                <span className="note-dot" />
                <span><strong>{note.title}</strong><small>{relativeDate(note.updatedAt)}</small></span>
              </button>
            ))}
          </div>
        </div>
        <div className="sidebar-footer">
          <button onClick={props.onSettings}><Icon name="gear" size={17}/> Settings</button>
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer"><span className="engine-dot" /> OpenRouter ready</a>
        </div>
      </aside>
    </>
  );
}

function Home({ notes, onCreate, onSelect }: { notes: Note[]; onCreate: () => void; onSelect: (id: string) => void }) {
  return (
    <div className="home-view">
      <header className="home-topbar"><p>{todayLabel()}</p><button className="avatar" aria-label="Your local workspace">NA</button></header>
      <section className="hero-block">
        <div className="eyebrow"><span /> YOUR PRIVATE STUDY WORKSHOP</div>
        <h1>Build knowledge under<br/>your own power.</h1>
        <p>Why have a turbochargee when you are naturally aspirated</p>
        <button className="primary-cta" onClick={onCreate}><Icon name="plus" size={18}/> Bring in material</button>
      </section>
      <section className="intake-strip" onClick={onCreate} role="button" tabIndex={0}>
        <div className="intake-icon"><Icon name="upload" size={25}/></div>
        <div><strong>Drop a PDF, text file, or your own notes</strong><span>We’ll turn the source into notes, recall cards, a quiz, and an audio review.</span></div>
        <button>Choose material <Icon name="chevron-right" size={16}/></button>
      </section>
      <section className="recent-section">
        <div className="section-heading"><div><span>Library</span><h2>{notes.length ? "Continue where you left off" : "Your materials will live here"}</h2></div></div>
        {notes.length ? (
          <div className="material-grid">
            {notes.slice(0, 6).map((note, index) => (
              <button className="material-card" key={note.id} onClick={() => onSelect(note.id)}>
                <div className={`material-cover cover-${index % 4}`}><span>{String(index + 1).padStart(2, "0")}</span><Icon name={index % 2 ? "brain" : "book"} size={30}/></div>
                <div className="material-copy"><small>{note.flashcards.length} cards · {note.quiz.length} questions</small><h3>{note.title}</h3><p>Updated {relativeDate(note.updatedAt)}</p></div>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-library"><div className="empty-lines"><span/><span/><span/></div><p>No filler content, no mystery data. Add your first source when you’re ready.</p></div>
        )}
      </section>
      <footer className="home-quote"><span>01</span><p>Study material should feel like something you own,<br/>not another feed you have to keep up with.</p></footer>
    </div>
  );
}

function NoteWorkspace(props: {
  note: Note; folder?: Folder; headers: (json?: boolean) => Record<string, string>;
  onUpdate: (note: Note) => void; onBack: () => void; onDelete: () => void;
  onError: (message: string) => void; onSuccess: (message: string) => void; onNeedKey: () => void; hasKey: boolean;
}) {
  const [tab, setTab] = useState<Tab>("notes");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(props.note.content);


  async function generate(kind: "flashcards" | "quiz" | "podcast") {
    if (!props.hasKey) return props.onNeedKey();
    setBusy(kind);
    try {
      const response = await fetch(`/api/notes/${props.note.id}/generate`, {
        method: "POST", headers: props.headers(true), body: JSON.stringify({ kind, model: undefined }),
      });
      const data = await responseJson(response);
      if (!response.ok) throw new Error(data.error || "Generation failed.");
      props.onUpdate(data.note);
      props.onSuccess(kind === "podcast" ? "Audio review script created." : `${capitalize(kind)} created.`);
    } catch (error) { props.onError(messageOf(error)); }
    finally { setBusy(null); }
  }

  async function saveNotes() {
    setBusy("save");
    try {
      const response = await fetch(`/api/notes/${props.note.id}`, { method: "PATCH", headers: props.headers(true), body: JSON.stringify({ content: draft }) });
      const data = await responseJson(response);
      if (!response.ok) throw new Error(data.error);
      props.onUpdate(data.note); setEditing(false); props.onSuccess("Notes saved.");
    } catch (error) { props.onError(messageOf(error)); }
    finally { setBusy(null); }
  }

  const tabs: { id: Tab; label: string; icon: Parameters<typeof Icon>[0]["name"] }[] = [
    { id: "notes", label: "Notes", icon: "file" }, { id: "flashcards", label: "Cards", icon: "layers" },
    { id: "quiz", label: "Quiz", icon: "brain" }, { id: "listen", label: "Listen", icon: "headphones" },
    { id: "chat", label: "Ask", icon: "message" },
  ];

  return (
    <div className="workspace-view">
      <header className="workspace-header">
        <button className="back-button" onClick={props.onBack}><Icon name="arrow-left" size={17}/> Library</button>
        <div className="workspace-title"><small>{props.folder?.name ?? "Unfiled material"}</small><h1>{props.note.title}</h1><span>Updated {relativeDate(props.note.updatedAt)}</span></div>
        <button className="icon-button danger-hover" onClick={props.onDelete} aria-label="Delete material"><Icon name="trash" size={18}/></button>
      </header>
      <nav className="study-tabs" aria-label="Study modes">
        {tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><Icon name={item.icon} size={17}/>{item.label}</button>)}
      </nav>
      <div className="workspace-body">
        {tab === "notes" && (
          <section className="notes-panel">
            <div className="panel-kicker"><span>GENERATED NOTES</span><button className="secondary-button" onClick={() => setEditing((value) => !value)}>{editing ? "Preview" : "Edit notes"}</button></div>
            {editing ? <><textarea className="notes-editor" value={draft} onChange={(event) => setDraft(event.target.value)} /><button className="primary-button" disabled={busy === "save"} onClick={saveNotes}>{busy === "save" ? "Saving…" : "Save changes"}</button></> : <Markdown>{props.note.content}</Markdown>}
          </section>
        )}
        {tab === "flashcards" && <Flashcards key={`-`} note={props.note} busy={busy === "flashcards"} onGenerate={() => generate("flashcards")} onPersist={async (flashcards) => {
          const response = await fetch(`/api/notes/${props.note.id}`, { method: "PATCH", headers: props.headers(true), body: JSON.stringify({ flashcards }) });
          const data = await responseJson(response); if (response.ok) props.onUpdate(data.note);
        }} />}
        {tab === "quiz" && <Quiz key={`-`} note={props.note} busy={busy === "quiz"} onGenerate={() => generate("quiz")} />}
        {tab === "listen" && <Listen note={props.note} busy={busy === "podcast"} onGenerate={() => generate("podcast")} />}
        {tab === "chat" && <Chat note={props.note} headers={props.headers} onUpdate={props.onUpdate} onError={props.onError} onNeedKey={props.onNeedKey} hasKey={props.hasKey} />}
      </div>
    </div>
  );
}

function Flashcards({ note, busy, onGenerate, onPersist }: { note: Note; busy: boolean; onGenerate: () => void; onPersist: (cards: Note["flashcards"]) => void }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  if (!note.flashcards.length) return <GeneratorEmpty icon="layers" title="Turn the source into recall cards" copy="Concise prompts, clean answers, and a review rhythm that remembers what needs work." label="Generate flashcards" busy={busy} onClick={onGenerate} />;
  const card = note.flashcards[Math.min(index, note.flashcards.length - 1)];
  function rate(days: number) {
    const next = note.flashcards.map((item, cardIndex) => cardIndex === index ? { ...item, interval: days, dueAt: new Date(Date.now() + days * 86_400_000).toISOString() } : item);
    void onPersist(next);
    setIndex((value) => (value + 1) % note.flashcards.length); setFlipped(false);
  }
  return <section className="study-tool"><div className="tool-heading"><div><span>ACTIVE RECALL</span><h2>{index + 1} <em>/ {note.flashcards.length}</em></h2></div><button className="secondary-button" onClick={onGenerate}>Regenerate</button></div><button className={`flashcard ${flipped ? "is-flipped" : ""}`} onClick={() => setFlipped((value) => !value)}><small>{flipped ? "ANSWER" : "PROMPT"}</small><p>{flipped ? card.back : card.front}</p><span>{flipped ? "How well did you know it?" : "Click to reveal"}</span></button><div className="card-controls"><button onClick={() => { setIndex((index - 1 + note.flashcards.length) % note.flashcards.length); setFlipped(false); }} aria-label="Previous card"><Icon name="chevron-left"/></button>{flipped ? <div className="rating-buttons"><button onClick={() => rate(0)}>Again</button><button onClick={() => rate(3)}>Learning</button><button onClick={() => rate(7)}>Got it</button></div> : <span>Reveal the answer to grade yourself</span>}<button onClick={() => { setIndex((index + 1) % note.flashcards.length); setFlipped(false); }} aria-label="Next card"><Icon name="chevron-right"/></button></div></section>;
}

function Quiz({ note, busy, onGenerate }: { note: Note; busy: boolean; onGenerate: () => void }) {
  const [index, setIndex] = useState(0); const [answers, setAnswers] = useState<Record<number, number>>({});
  if (!note.quiz.length) return <GeneratorEmpty icon="brain" title="Practice beyond recognition" copy="Generate a source-grounded quiz with plausible distractors and explanations for every answer." label="Build a quiz" busy={busy} onClick={onGenerate} />;
  const item = note.quiz[index]; const choice = answers[index]; const answered = choice !== undefined; const correct = Object.entries(answers).filter(([key, value]) => note.quiz[Number(key)]?.answer === value).length;
  return <section className="study-tool quiz-tool"><div className="tool-heading"><div><span>KNOWLEDGE CHECK</span><h2>Question {index + 1} <em>/ {note.quiz.length}</em></h2></div><div className="quiz-score">{correct} correct</div></div><div className="quiz-card"><h3>{item.question}</h3><div className="answer-list">{item.options.map((option, optionIndex) => { const state = answered ? optionIndex === item.answer ? "correct" : optionIndex === choice ? "wrong" : "" : ""; return <button className={state} key={option} disabled={answered} onClick={() => setAnswers((current) => ({ ...current, [index]: optionIndex }))}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}{state === "correct" && <Icon name="check"/>}</button>; })}</div>{answered && <div className="answer-explanation"><strong>{choice === item.answer ? "Exactly." : "Not quite."}</strong><p>{item.explanation}</p></div>}</div><div className="quiz-footer"><button className="secondary-button" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>Previous</button><span>{Object.keys(answers).length} of {note.quiz.length} answered</span><button className="primary-button" disabled={!answered} onClick={() => index < note.quiz.length - 1 ? setIndex((value) => value + 1) : setIndex(0)}>{index === note.quiz.length - 1 ? "Review again" : "Next question"}</button></div></section>;
}

function Listen({ note, busy, onGenerate }: { note: Note; busy: boolean; onGenerate: () => void }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  if (!note.podcast) return <GeneratorEmpty icon="headphones" title="Take the lesson with you" copy="Create a conversational review, then listen with the natural voices already available on your device." label="Create audio review" busy={busy} onClick={onGenerate} />;
  function toggle() {
    if (playing) { window.speechSynthesis.cancel(); setPlaying(false); return; }
    const utterance = new SpeechSynthesisUtterance(note.podcast.replace(/[#*_>`-]/g, " "));
    utterance.rate = 1; utterance.pitch = 1; utterance.onend = () => setPlaying(false); utterance.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(utterance); setPlaying(true);
  }
  return <section className="listen-panel"><div className="player-art"><div className="sound-rings"><span/><span/><span/></div><BrandMark/></div><div className="player-copy"><span>AUDIO REVIEW</span><h2>{note.title}</h2><p>Generated from your source · Browser narration</p><div className="player-controls"><button className="play-button" onClick={toggle}><Icon name={playing ? "pause" : "play"} size={24}/></button><div className="track"><span style={{ width: playing ? "38%" : "0%" }}/></div><small>{playing ? "Playing" : "Ready"}</small></div><button className="text-button" onClick={onGenerate}>Regenerate script</button></div><details className="transcript"><summary>Read transcript</summary><Markdown compact>{note.podcast}</Markdown></details></section>;
}

function Chat({ note, headers, onUpdate, onError, onNeedKey, hasKey }: { note: Note; headers: (json?: boolean) => Record<string, string>; onUpdate: (note: Note) => void; onError: (message: string) => void; onNeedKey: () => void; hasKey: boolean }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (list.current) list.current.scrollTop = list.current.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [note.messages.length, pending, busy]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!message.trim() || busy) return;
    if (!hasKey) return onNeedKey();
    const next = message.trim();
    setMessage("");
    setPending(next);
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/api/notes/${note.id}/chat`, {
        method: "POST",
        headers: headers(true),
        body: JSON.stringify({ message: next }),
      });
      const data = await responseJson(response);
      if (!response.ok) throw new Error(data.error || "Could not send your question.");
      if (!data.note || !Array.isArray(data.note.messages)) throw new Error("The server returned an incomplete reply.");
      onUpdate(data.note);
      setPending(null);
    } catch (caught) {
      const text = messageOf(caught);
      setError(text);
      setMessage(next);
      setPending(null);
      onError(text);
    } finally {
      setBusy(false);
    }
  }

  return <section className="chat-panel"><div className="chat-intro"><div><Icon name="message"/></div><h2>Ask this source</h2><p>Answers stay grounded in the material you brought in.</p></div><div className="message-list" ref={list} aria-live="polite">{!note.messages.length && !pending && <div className="suggestion-row">{["Explain the main idea simply", "What should I memorize?", "Give me an example"].map((text) => <button type="button" key={text} onClick={() => setMessage(text)}>{text}</button>)}</div>}{note.messages.map((item, index) => <div key={`${item.role}-${index}`} className={`message message-${item.role}`}>{item.role === "assistant" ? <Markdown compact>{item.content}</Markdown> : item.content}</div>)}{pending && <div className="message message-user message-pending">{pending}</div>}{busy && <div className="message message-assistant typing" aria-label="Writing an answer"><i/><i/><i/></div>}</div>{error && <p className="chat-error">{error}</p>}<form className="chat-composer" onSubmit={send}><textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Ask about a concept, formula, or passage…" rows={2}/><button type="submit" aria-label="Send message" disabled={!message.trim() || busy}><Icon name="send"/></button></form><small className="chat-hint">Enter to send · Shift + Enter for a new line</small></section>;
}

function GeneratorEmpty({ icon, title, copy, label, busy, onClick }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; copy: string; label: string; busy: boolean; onClick: () => void }) {
  return <section className="generator-empty"><div className="generator-icon"><Icon name={icon} size={28}/></div><span>STUDY MODE</span><h2>{title}</h2><p>{copy}</p><button className="primary-button" disabled={busy} onClick={onClick}>{busy ? <><span className="spinner"/>Building from your source…</> : <><Icon name="spark" size={17}/>{label}</>}</button></section>;
}

function CreateDialog({ folders, hasKey, headers, onNeedKey, onClose, onCreated }: { folders: Folder[]; hasKey: boolean; headers: (json?: boolean) => Record<string, string>; onNeedKey: () => void; onClose: () => void; onCreated: (note: Note) => void }) {
  const [mode, setMode] = useState<"file" | "text">("file"); const [file, setFile] = useState<File | null>(null); const [text, setText] = useState(""); const [title, setTitle] = useState(""); const [folderId, setFolderId] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const input = useRef<HTMLInputElement>(null);
  async function submit(event: FormEvent) { event.preventDefault(); if (!hasKey) return onNeedKey(); if (mode === "file" && !file) return setError("Choose a PDF, TXT, or Markdown file."); if (mode === "text" && !text.trim()) return setError("Paste some material first."); setBusy(true); setError(""); const body = new FormData(); if (file && mode === "file") body.set("file", file); else body.set("text", text); if (title.trim()) body.set("title", title.trim()); if (folderId) body.set("folderId", folderId); try { const response = await fetch("/api/notes", { method: "POST", headers: headers(), body }); const data = await responseJson(response); if (!response.ok) throw new Error(data.error || "Could not create the study set."); onCreated(data.note); } catch (error) { setError(messageOf(error)); } finally { setBusy(false); } }
  return <Dialog title="Bring in material" subtitle="The source becomes a reusable study workspace." onClose={onClose}><form className="create-form" onSubmit={submit}><div className="mode-switch"><button type="button" className={mode === "file" ? "active" : ""} onClick={() => setMode("file")}><Icon name="upload"/> Upload</button><button type="button" className={mode === "text" ? "active" : ""} onClick={() => setMode("text")}><Icon name="file"/> Paste text</button></div>{mode === "file" ? <button type="button" className={`drop-zone ${file ? "has-file" : ""}`} onClick={() => input.current?.click()}><input ref={input} type="file" accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown" onChange={(event) => setFile(event.target.files?.[0] ?? null)}/><div><Icon name={file ? "check" : "upload"} size={25}/></div><strong>{file ? file.name : "Choose a file"}</strong><span>{file ? readableBytes(file.size) : "PDF, TXT, or Markdown · up to 10MB"}</span></button> : <label className="field"><span>Source material</span><textarea value={text} onChange={(event) => setText(event.target.value)} rows={9} placeholder="Paste lecture notes, an article, a transcript, or anything you want to understand…"/></label>}<div className="form-row"><label className="field"><span>Title <em>optional</em></span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Derived from source"/></label><label className="field"><span>Folder <em>optional</em></span><select value={folderId} onChange={(event) => setFolderId(event.target.value)}><option value="">Unfiled</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label></div>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? <><span className="spinner"/>Reading the source…</> : <><Icon name="spark" size={17}/>Create study set</>}</button></div></form></Dialog>;
}

function SettingsDialog({ apiKey, model, hasServerKey, onSave, onClose }: { apiKey: string; model: string; hasServerKey: boolean; onSave: (key: string, model: string) => void; onClose: () => void }) {
  const [key, setKey] = useState(apiKey); const [nextModel, setNextModel] = useState(model); const [show, setShow] = useState(false);
  return <Dialog title="AI settings" subtitle="Your key stays in this browser and is sent only to your own server." onClose={onClose}><div className="settings-form"><label className="field"><span>OpenRouter API key</span><div className="key-input"><input type={show ? "text" : "password"} value={key} onChange={(event) => setKey(event.target.value)} placeholder={hasServerKey ? "Server key is configured" : "sk-or-v1-…"}/><button onClick={() => setShow((value) => !value)}>{show ? "Hide" : "Show"}</button></div><small>{hasServerKey ? "A server key is available. Add one here only to override it on this device." : <>Create a key at <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a>.</>}</small></label><label className="field"><span>Default model</span><div className="model-options">{MODELS.map((option) => <button key={option.value} className={nextModel === option.value ? "active" : ""} onClick={() => setNextModel(option.value)}><span><strong>{option.label}</strong><small>{option.note}</small></span>{nextModel === option.value && <Icon name="check"/>}</button>)}</div></label><div className="dialog-actions"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={() => onSave(key, nextModel)}>Save settings</button></div></div></Dialog>;
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); try { const response = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) }); const data = await responseJson(response); if (!response.ok) { setError(data.error || "Could not sign in."); return; } await onSuccess(); } catch (error) { setError(messageOf(error)); } finally { setBusy(false); } }
  return <div className="login-page"><div className="login-card"><BrandMark/><span>PRIVATE WORKSPACE</span><h1>Welcome back.</h1><p>Enter the password for this Naturallyaspiratedlearn instance.</p><form onSubmit={submit}><input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Workspace password"/>{error && <small>{error}</small>}<button className="primary-button" disabled={busy}>{busy ? "Opening…" : "Open workspace"}</button></form></div></div>;
}

function Dialog({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const close = (event: KeyboardEvent) => event.key === "Escape" && onClose(); window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose]);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="dialog" role="dialog" aria-modal="true" aria-label={title}><button className="dialog-close" onClick={onClose} aria-label="Close"><Icon name="x"/></button><div className="dialog-heading"><span>NATURALLY ASPIRATED</span><h2>{title}</h2><p>{subtitle}</p></div>{children}</div></div>;
}

function BrandMark() { return <div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M8 29V11l12 18V11l12 18V11"/><path d="M8 33h24"/></svg></div>; }
function LoadingScreen() { return <div className="loading-screen"><BrandMark/><span className="spinner dark"/></div>; }
async function responseJson(response: Response): Promise<ApiResponse> {
  const body = await response.text();
  if (!body.trim()) throw new Error(`The server returned an empty response (${response.status}). Please try again.`);
  try {
    return JSON.parse(body) as ApiResponse;
  } catch {
    throw new Error(`The server returned an invalid response (${response.status}). Please try again.`);
  }
}
function messageOf(error: unknown) { return error instanceof Error ? error.message : "Something went wrong. Please try again."; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function relativeDate(value: string) { const diff = Date.now() - new Date(value).getTime(); const minutes = Math.floor(diff / 60000); if (minutes < 1) return "just now"; if (minutes < 60) return `${minutes}m ago`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ago`; const days = Math.floor(hours / 24); return days === 1 ? "yesterday" : `${days}d ago`; }
function todayLabel() { return new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase(); }
function readableBytes(value: number) { return value < 1024 * 1024 ? `${Math.round(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`; }
