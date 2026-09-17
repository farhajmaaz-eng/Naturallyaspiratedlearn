<p align="center">
  <img src="src/app/icon.svg" width="84" height="84" alt="Naturallyaspiratedlearn monogram" />
</p>

<h1 align="center">Naturallyaspiratedlearn</h1>

<p align="center"><strong>Why have a turbocharger when you are naturally aspirated</strong></p>

<p align="center">A private, open-source study workspace that turns your own material into notes, flashcards, quizzes, source-grounded chat, and a narrated audio review.</p>

## What it does

Bring in a PDF, a text or Markdown file, or pasted source material. Naturallyaspiratedlearn uses an OpenRouter model to create structured notes, then keeps every study mode attached to the same source.

- Editable Markdown notes with tables, code, math, and syntax highlighting
- Active-recall flashcards with simple spaced review scheduling
- Multiple-choice quizzes with answer explanations
- Source-grounded chat with bounded conversation history
- Two-host audio-review scripts read with the browser's native speech engine
- Folders, search, recent materials, and a responsive mobile layout
- Optional workspace password and per-browser OpenRouter keys
- Local SQLite persistence with no account service or analytics dependency

The product workflow is inspired by study tools such as Turbo AI, but the implementation, branding, visual system, copy, and source code are original. This project is not affiliated with or endorsed by TurboLearn LLC.

## Quick start

Requirements: Node.js 22 or newer and an [OpenRouter API key](https://openrouter.ai/keys).

```bash
git clone https://github.com/farhajmaaz-eng/Naturallyaspiratedlearn.git
cd Naturallyaspiratedlearn
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. You can put `OPENROUTER_API_KEY` in `.env.local`, or leave it blank and add a key through **Settings**. A browser-supplied key stays in that browser's local storage and is forwarded by your server only for OpenRouter requests; it is never written to SQLite.

For a shared deployment, set a strong `APP_PASSWORD`. When it is blank, the workspace opens without a sign-in screen.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | No | Shared server-side key; browser keys can be used instead |
| `OPENROUTER_MODEL` | No | Server default, `openai/gpt-4o-mini` when omitted |
| `APP_PASSWORD` | No | Enables the single-workspace sign-in screen |
| `DATABASE_PATH` | No | SQLite file path, defaults to `data/study.db` |
| `NEXT_PUBLIC_SITE_URL` | No | Public URL sent in OpenRouter attribution headers |

The model selector includes a few practical presets. Any valid OpenRouter model identifier can also be sent through the API.

## Docker

Create `.env.local` from the example, then run:

```bash
docker compose up --build
```

The compose file stores SQLite data in a named volume. The application listens on port 3000.

## How it is built

The app uses Next.js 16, React 19, TypeScript, SQLite through `better-sqlite3`, and the OpenRouter chat-completions API. PDFs are parsed locally before their text is sent to the chosen model. Notes and study artifacts stay in the configured SQLite database.

The server applies upload and body-size limits, validates structured AI output, limits concurrent AI calls, rejects cross-origin mutations, uses `HttpOnly` signed session cookies when password protection is enabled, and treats uploaded material as untrusted prompt data.

Audio review intentionally uses the browser's speech synthesis rather than a second paid provider. Available voices and playback quality depend on the device.

## Development

```bash
npm run lint
npm test
npm run build
```

The unit suite covers session signing, input validation, rate limiting, and OpenRouter key/model resolution. A live OpenRouter call is not run in CI because it would require a funded secret.

## Current input support

PDF, plain text, Markdown, and pasted text are supported today. Audio/video transcription and YouTube ingestion need a dedicated transcription or transcript service and are good candidates for community contributions.

## Data and deployment notes

This is a single-workspace application. It does not isolate data between multiple users. Password protection controls access to the whole workspace.

SQLite works well on a local machine, VPS, home server, Railway volume, Fly volume, or another host with persistent disk. A default serverless filesystem is ephemeral; use persistent storage or replace the database adapter before deploying there.

## Contributing

Issues and pull requests are welcome. Keep product copy specific, preserve keyboard and mobile behavior, and add tests when changing security boundaries, parsers, persistence, or AI-response validation.

## License

[MIT](LICENSE)
