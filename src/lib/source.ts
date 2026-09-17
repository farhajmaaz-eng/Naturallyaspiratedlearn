import { MAX_PDF_PAGES, MAX_SOURCE_CHARS } from "./limits";

const TEXT_EXTENSIONS = /\.(txt|md|markdown)$/i;

export type ParsedSource = { title: string; text: string };

function deriveTitle(name: string | null, fallback: string): string {
  const base = (name ?? "").replace(TEXT_EXTENSIONS, "").replace(/\.pdf$/i, "").trim();
  return (base || fallback).slice(0, 200);
}

export async function extractSource(file: File): Promise<ParsedSource> {
  const name = file.name || null;
  const type = file.type || "";
  const isPdf = type === "application/pdf" || !!name?.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    if (file.size > 10 * 1024 * 1024) throw new SourceError("PDF exceeds the 10MB size limit.");
    const buffer = Buffer.from(await file.arrayBuffer());
    let parser: import("pdf-parse").PDFParse | null = null;
    try {
      await import("@napi-rs/canvas");
      const { PDFParse } = await import("pdf-parse");
      parser = new PDFParse({ data: new Uint8Array(buffer) });
      const info = await parser.getInfo();
      const total = info.total ?? 0;
      if (total > MAX_PDF_PAGES) throw new SourceError(`PDF has ${total} pages; the limit is ${MAX_PDF_PAGES}.`);
      const result = await parser.getText();
      const text = (result.text ?? "").trim();
      if (!text) throw new SourceError("The PDF appears to contain no extractable text (it may be image-only or corrupted).");
      return { title: deriveTitle(name, "Untitled PDF"), text };
    } catch (error) {
      if (error instanceof SourceError) throw error;
      throw new SourceError("The PDF could not be parsed. It may be corrupted or password protected.");
    } finally {
      try {
        await parser?.destroy();
      } catch {}
    }
  }
  if (type && !type.startsWith("text/") && type !== "application/json" && !TEXT_EXTENSIONS.test(name ?? "")) {
    throw new SourceError("Unsupported file type. Upload a PDF, TXT, or Markdown file.");
  }
  const text = await file.text();
  if (!text.trim()) throw new SourceError("The uploaded file is empty.");
  if (looksBinary(text)) throw new SourceError("The file appears to be binary and cannot be used as a text source.");
  return { title: deriveTitle(name, "Untitled note"), text };
}

export class SourceError extends Error {}

function looksBinary(text: string): boolean {
  const sample = text.slice(0, 2_000);
  let suspicious = 0;
  for (const char of sample) {
    const code = char.charCodeAt(0);
    if (code < 9 || (code > 13 && code < 32)) suspicious++;
  }
  return suspicious / Math.max(sample.length, 1) > 0.05;
}

export function clampSource(text: string): string {
  return text.length > MAX_SOURCE_CHARS ? `${text.slice(0, MAX_SOURCE_CHARS)}\n\n[Truncated to ${MAX_SOURCE_CHARS} characters.]` : text;
}

export function sourceToPrompt(source: string): string {
  return source
    .replace(/<\|/g, "<\u200b|")
    .replace(/^(\s*)(#+)/gm, "$1\u200b$2")
    .replace(/^(\s*)(system|assistant|user)\s*:/gim, "$1\u200b$2:");
}
