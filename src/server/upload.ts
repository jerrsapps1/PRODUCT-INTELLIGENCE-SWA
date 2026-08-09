import type { IncomingMessage } from "node:http";

export interface UploadedFile {
  fieldName: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

export interface MultipartForm {
  fields: Record<string, string>;
  files: UploadedFile[];
}

export async function readMultipart(req: IncomingMessage, maxBytes: number): Promise<MultipartForm> {
  const contentType = req.headers["content-type"] ?? "";
  const boundary = /boundary=([^;]+)/i.exec(contentType)?.[1];
  if (!boundary) throw new Error("Missing multipart boundary");
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > maxBytes) throw new Error("Upload exceeds maximum request size");
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks);
  const marker = Buffer.from(`--${boundary}`);
  const parts: Buffer[] = [];
  let start = body.indexOf(marker);
  while (start !== -1) {
    const next = body.indexOf(marker, start + marker.length);
    if (next === -1) break;
    const part = body.subarray(start + marker.length, next);
    if (!part.includes(Buffer.from("Content-Disposition"))) {
      start = next;
      continue;
    }
    parts.push(trimCrlf(part));
    start = next;
  }

  const fields: Record<string, string> = {};
  const files: UploadedFile[] = [];
  for (const part of parts) {
    const splitAt = part.indexOf(Buffer.from("\r\n\r\n"));
    if (splitAt === -1) continue;
    const headers = part.subarray(0, splitAt).toString("utf8");
    const content = trimCrlf(part.subarray(splitAt + 4));
    const disposition = /content-disposition:\s*form-data;([^\r\n]+)/i.exec(headers)?.[1] ?? "";
    const name = /name="([^"]+)"/i.exec(disposition)?.[1];
    const filename = /filename="([^"]*)"/i.exec(disposition)?.[1];
    if (!name) continue;
    if (filename !== undefined) {
      const mimeType = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim() ?? "application/octet-stream";
      files.push({ fieldName: name, filename: sanitizeFilename(filename), mimeType, buffer: content });
    } else {
      fields[name] = content.toString("utf8");
    }
  }
  return { fields, files };
}

export function sanitizeFilename(filename: string): string {
  const cleaned = filename.replace(/\\/g, "/").split("/").pop()?.replace(/[^\w.\- ]+/g, "_").trim();
  return cleaned || "uploaded-source";
}

function trimCrlf(buffer: Buffer): Buffer {
  let start = 0;
  let end = buffer.length;
  while (start < end && (buffer[start] === 13 || buffer[start] === 10)) start += 1;
  while (end > start && (buffer[end - 1] === 13 || buffer[end - 1] === 10)) end -= 1;
  return buffer.subarray(start, end);
}
