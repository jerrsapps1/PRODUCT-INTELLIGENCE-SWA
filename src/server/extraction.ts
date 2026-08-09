import JSZip from "jszip";
import { randomUUID } from "node:crypto";
import type { SourceChunk, SourceType } from "../shared/contracts";
import { sourceCapabilities } from "./sourceCapabilities";

export interface ExtractionResult {
  status: "ready" | "partial" | "failed";
  failureReason: string | null;
  chunks: Array<Omit<SourceChunk, "id" | "sourceId" | "createdAt">>;
  metadata: Record<string, unknown>;
  extractionVersion: string;
}

export async function extractSource(input: {
  sourceId: string;
  sourceType: SourceType;
  mimeType: string;
  buffer?: Buffer;
  text?: string;
  url?: string;
}): Promise<ExtractionResult> {
  const capability = sourceCapabilities[input.sourceType];
  if (!capability.textExtractable) {
    return {
      status: "partial",
      failureReason: "This source type is preserved, but text extraction is not supported in Phase 2.",
      chunks: [],
      metadata: { mimeType: input.mimeType },
      extractionVersion: "phase2.1"
    };
  }

  try {
    if (input.sourceType === "url") {
      return chunksFromText(input.text ?? "", "URL content", { url: input.url });
    }
    if (!input.buffer) throw new Error("No source bytes were available for extraction");
    if (input.sourceType === "txt" || input.sourceType === "markdown" || input.sourceType === "csv") {
      return chunksFromText(input.buffer.toString("utf8"), "Text", { bytes: input.buffer.byteLength });
    }
    if (input.sourceType === "docx") return await extractDocx(input.buffer);
    if (input.sourceType === "pptx") return await extractPptx(input.buffer);
    if (input.sourceType === "xlsx") return await extractXlsx(input.buffer);
    if (input.sourceType === "pdf") return await extractPdf(input.buffer);
    return {
      status: "partial",
      failureReason: "No extraction adapter is available for this source type.",
      chunks: [],
      metadata: {},
      extractionVersion: "phase2.1"
    };
  } catch (error) {
    return {
      status: "failed",
      failureReason: error instanceof Error ? error.message : "Extraction failed",
      chunks: [],
      metadata: {},
      extractionVersion: "phase2.1"
    };
  }
}

function chunksFromText(text: string, locationPrefix: string, metadata: Record<string, unknown> = {}): ExtractionResult {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return {
      status: "partial",
      failureReason: "No extractable text was found.",
      chunks: [],
      metadata,
      extractionVersion: "phase2.1"
    };
  }
  return {
    status: "ready",
    failureReason: null,
    chunks: splitText(normalized).map((chunk, index) => ({
      chunkIndex: index,
      text: chunk,
      locationLabel: `${locationPrefix} chunk ${index + 1}`,
      citation: { locationType: locationPrefix.toLowerCase(), chunk: index + 1 }
    })),
    metadata: { ...metadata, characterCount: normalized.length },
    extractionVersion: "phase2.1"
  };
}

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  const pdfModule = await import("pdf-parse");
  const pdfParse = (pdfModule as unknown as { default?: (input: Buffer) => Promise<{ text?: string; numpages?: number; info?: unknown }>; PDFParse?: new (options: { data: Buffer }) => { getText(): Promise<{ text?: string; total?: number }>; destroy(): Promise<void> } }).default;
  if (pdfParse) {
    const parsed = await pdfParse(buffer);
    return chunksFromText(parsed.text ?? "", "PDF", { pages: parsed.numpages, info: parsed.info ?? {} });
  }
  const Parser = (pdfModule as unknown as { PDFParse?: new (options: { data: Buffer }) => { getText(): Promise<{ text?: string; total?: number }>; destroy(): Promise<void> } }).PDFParse;
  if (!Parser) throw new Error("PDF extraction adapter is unavailable");
  const parser = new Parser({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy();
  return chunksFromText(parsed.text ?? "", "PDF", { pages: parsed.total });
}

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")?.async("text");
  if (!xml) throw new Error("DOCX document.xml was not found");
  const text = xmlText(xml);
  return chunksFromText(text, "DOCX paragraph", { format: "docx" });
}

async function extractPptx(buffer: Buffer): Promise<ExtractionResult> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort();
  const chunks = [];
  for (let index = 0; index < slideFiles.length; index += 1) {
    const xml = await zip.file(slideFiles[index])?.async("text");
    const text = xml ? xmlText(xml).trim() : "";
    if (text) {
      chunks.push({
        chunkIndex: chunks.length,
        text,
        locationLabel: `PPTX slide ${index + 1}`,
        citation: { locationType: "slide", slide: index + 1 }
      });
    }
  }
  return chunks.length
    ? { status: "ready", failureReason: null, chunks, metadata: { slides: slideFiles.length }, extractionVersion: "phase2.1" }
    : { status: "partial", failureReason: "No extractable slide text was found.", chunks: [], metadata: { slides: slideFiles.length }, extractionVersion: "phase2.1" };
}

async function extractXlsx(buffer: Buffer): Promise<ExtractionResult> {
  const zip = await JSZip.loadAsync(buffer);
  const shared = await sharedStrings(zip);
  const sheetFiles = Object.keys(zip.files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort();
  const chunks = [];
  for (let index = 0; index < sheetFiles.length; index += 1) {
    const xml = await zip.file(sheetFiles[index])?.async("text");
    if (!xml) continue;
    const cells = [...xml.matchAll(/<c[^>]*?(?:r="([^"]+)")?[^>]*?(?:t="([^"]+)")?[^>]*>[\s\S]*?<v>([\s\S]*?)<\/v>[\s\S]*?<\/c>/g)]
      .map((match) => {
        const ref = match[1] ?? "";
        const type = match[2] ?? "";
        const value = decodeXml(match[3] ?? "");
        return type === "s" ? `${ref} ${shared[Number(value)] ?? ""}` : `${ref} ${value}`;
      })
      .filter((value) => value.trim());
    if (cells.length) {
      chunks.push({
        chunkIndex: chunks.length,
        text: cells.join("\n"),
        locationLabel: `XLSX sheet ${index + 1}`,
        citation: { locationType: "sheet", sheet: index + 1 }
      });
    }
  }
  return chunks.length
    ? { status: "ready", failureReason: null, chunks, metadata: { sheets: sheetFiles.length }, extractionVersion: "phase2.1" }
    : { status: "partial", failureReason: "No extractable spreadsheet cell text was found.", chunks: [], metadata: { sheets: sheetFiles.length }, extractionVersion: "phase2.1" };
}

async function sharedStrings(zip: JSZip): Promise<string[]> {
  const xml = await zip.file("xl/sharedStrings.xml")?.async("text");
  if (!xml) return [];
  return [...xml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((match) => xmlText(match[1]));
}

function splitText(text: string): string[] {
  const chunks: string[] = [];
  for (let start = 0; start < text.length; start += 1800) {
    chunks.push(text.slice(start, start + 1800));
  }
  return chunks;
}

function xmlText(xml: string): string {
  return decodeXml(xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

export function materializeChunks(sourceId: string, result: ExtractionResult): SourceChunk[] {
  const timestamp = new Date().toISOString();
  return result.chunks.map((chunk) => ({
    id: randomUUID(),
    sourceId,
    chunkIndex: chunk.chunkIndex,
    text: chunk.text,
    locationLabel: chunk.locationLabel,
    citation: chunk.citation,
    createdAt: timestamp
  }));
}
