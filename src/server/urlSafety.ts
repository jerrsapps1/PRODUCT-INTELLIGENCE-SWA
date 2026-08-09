import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const privateCidrs = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^0\./
];

export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }
  if (url.username || url.password) throw new Error("URLs with embedded credentials are not allowed");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) throw new Error("Localhost URLs are not allowed");
  if (isIP(host) && isPrivateAddress(host)) throw new Error("Private network URLs are not allowed");
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (addresses.some((address) => isPrivateAddress(address.address))) {
    throw new Error("URL resolves to a private network address");
  }
  return url;
}

export async function retrieveUrlText(rawUrl: string): Promise<{ finalUrl: string; title: string | null; text: string; metadata: Record<string, unknown> }> {
  const url = await assertSafeUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "ProjectIntelligenceSourceIntake/0.2" }
    });
    if (!response.ok) throw new Error(`URL returned HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("markdown")) {
      throw new Error("URL content type is not supported for text retrieval");
    }
    const text = await response.text();
    const title = titleFromHtml(text);
    return {
      finalUrl: response.url,
      title,
      text: htmlToText(text),
      metadata: { contentType, retrievedAt: new Date().toISOString(), finalUrl: response.url }
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isPrivateAddress(address: string): boolean {
  if (address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;
  return privateCidrs.some((pattern) => pattern.test(address));
}

function titleFromHtml(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? htmlEntities(match[1].replace(/\s+/g, " ").trim()) : null;
}

function htmlToText(html: string): string {
  return htmlEntities(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
}

function htmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}
