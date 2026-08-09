import type { SourceType } from "../shared/contracts";

export const maxUploadBytes = 25 * 1024 * 1024;

export interface SourceCapability {
  extensions: string[];
  mimeTypes: string[];
  acceptedForStorage: boolean;
  textExtractable: boolean;
  metadataExtractable: boolean;
  previewable: boolean;
}

export const sourceCapabilities: Record<SourceType, SourceCapability> = {
  pdf: {
    extensions: [".pdf"],
    mimeTypes: ["application/pdf"],
    acceptedForStorage: true,
    textExtractable: true,
    metadataExtractable: true,
    previewable: true
  },
  docx: {
    extensions: [".docx"],
    mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    acceptedForStorage: true,
    textExtractable: true,
    metadataExtractable: true,
    previewable: false
  },
  xlsx: {
    extensions: [".xlsx"],
    mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    acceptedForStorage: true,
    textExtractable: true,
    metadataExtractable: true,
    previewable: false
  },
  pptx: {
    extensions: [".pptx"],
    mimeTypes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    acceptedForStorage: true,
    textExtractable: true,
    metadataExtractable: true,
    previewable: false
  },
  txt: {
    extensions: [".txt"],
    mimeTypes: ["text/plain"],
    acceptedForStorage: true,
    textExtractable: true,
    metadataExtractable: true,
    previewable: true
  },
  markdown: {
    extensions: [".md", ".markdown"],
    mimeTypes: ["text/markdown", "text/plain"],
    acceptedForStorage: true,
    textExtractable: true,
    metadataExtractable: true,
    previewable: true
  },
  csv: {
    extensions: [".csv"],
    mimeTypes: ["text/csv", "application/csv", "text/plain"],
    acceptedForStorage: true,
    textExtractable: true,
    metadataExtractable: true,
    previewable: true
  },
  image: {
    extensions: [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    mimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
    acceptedForStorage: true,
    textExtractable: false,
    metadataExtractable: true,
    previewable: true
  },
  url: {
    extensions: [],
    mimeTypes: ["text/html"],
    acceptedForStorage: false,
    textExtractable: true,
    metadataExtractable: true,
    previewable: true
  },
  other: {
    extensions: [],
    mimeTypes: [],
    acceptedForStorage: false,
    textExtractable: false,
    metadataExtractable: false,
    previewable: false
  }
};

export function detectSourceType(filename: string, mimeType: string): SourceType {
  const lower = filename.toLowerCase();
  for (const [type, capability] of Object.entries(sourceCapabilities) as Array<[SourceType, SourceCapability]>) {
    if (capability.extensions.some((extension) => lower.endsWith(extension))) return type;
    if (capability.mimeTypes.includes(mimeType)) return type;
  }
  return "other";
}

export function isAllowedFile(filename: string, mimeType: string, sizeBytes: number): { ok: true; sourceType: SourceType } | { ok: false; reason: string } {
  if (sizeBytes <= 0) return { ok: false, reason: "File is empty" };
  if (sizeBytes > maxUploadBytes) return { ok: false, reason: `File exceeds ${Math.floor(maxUploadBytes / 1024 / 1024)} MB limit` };
  const sourceType = detectSourceType(filename, mimeType);
  const capability = sourceCapabilities[sourceType];
  if (!capability.acceptedForStorage) return { ok: false, reason: "Unsupported file type" };
  const lower = filename.toLowerCase();
  if (capability.extensions.length > 0 && !capability.extensions.some((extension) => lower.endsWith(extension))) {
    return { ok: false, reason: "File extension does not match supported type" };
  }
  return { ok: true, sourceType };
}
