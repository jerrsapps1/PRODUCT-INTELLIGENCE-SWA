import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { randomUUID } from "node:crypto";

export interface StoredObject {
  key: string;
  sizeBytes: number;
}

export interface ObjectStorage {
  put(buffer: Buffer, options: { ownerUserId: string; sourceId: string; originalFilename: string }): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  publicLabel(key: string): string;
}

export class LocalObjectStorage implements ObjectStorage {
  constructor(private readonly rootDir: string) {}

  async put(buffer: Buffer, options: { ownerUserId: string; sourceId: string; originalFilename: string }): Promise<StoredObject> {
    const extension = extensionOf(options.originalFilename);
    const key = `${options.ownerUserId}/${options.sourceId}/${randomUUID()}${extension}`;
    const fullPath = this.resolveKey(key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
    return { key, sizeBytes: buffer.byteLength };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  publicLabel(key: string): string {
    return `local-object://${key}`;
  }

  private resolveKey(key: string): string {
    if (key.includes("..") || key.includes("\\") || key.startsWith("/")) {
      throw new Error("Invalid storage key");
    }
    const resolved = normalize(join(this.rootDir, key));
    const root = normalize(this.rootDir);
    if (!resolved.startsWith(root)) throw new Error("Invalid storage key");
    return resolved;
  }
}

export class MemoryObjectStorage implements ObjectStorage {
  private objects = new Map<string, Buffer>();

  async put(buffer: Buffer, options: { ownerUserId: string; sourceId: string; originalFilename: string }): Promise<StoredObject> {
    const key = `${options.ownerUserId}/${options.sourceId}/${randomUUID()}${extensionOf(options.originalFilename)}`;
    this.objects.set(key, Buffer.from(buffer));
    return { key, sizeBytes: buffer.byteLength };
  }

  async get(key: string): Promise<Buffer> {
    const object = this.objects.get(key);
    if (!object) throw new Error("Stored object not found");
    return Buffer.from(object);
  }

  publicLabel(key: string): string {
    return `memory-object://${key}`;
  }
}

function extensionOf(filename: string): string {
  const match = filename.toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
}
