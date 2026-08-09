import type {
  ObservationClassification,
  ObservationFollowUpStatus,
  SourceChunk,
  SourceRecord
} from "../shared/contracts";

export interface ObservationEnrichmentContext {
  originalText: string;
  activity: string | null;
  category: string | null;
  existingReferences: SourceChunk[];
}

export interface ObservationEnrichmentResult {
  provider: string;
  model: string;
  classification: ObservationClassification;
  category: string;
  activity: string | null;
  summary: string;
  followUpStatus: ObservationFollowUpStatus;
  referenceSuggestions: Array<{
    sourceId: string;
    sourceChunkId: string;
    citationLabel: string;
  }>;
}

const categories = [
  { name: "Fall protection", terms: ["fall", "harness", "lanyard", "anchor", "guardrail", "tie-off", "lift rail"] },
  { name: "PPE", terms: ["hard hat", "glasses", "gloves", "vest", "ppe", "respirator"] },
  { name: "Housekeeping", terms: ["debris", "trash", "cleanup", "housekeeping", "walkway", "trip"] },
  { name: "Aerial lifts", terms: ["lift", "boom", "scissor", "basket", "rail"] },
  { name: "Excavation", terms: ["trench", "excavation", "soil", "shoring", "benching"] },
  { name: "Hot work", terms: ["welding", "torch", "spark", "fire watch", "hot work"] }
];

export async function runObservationAssistant(context: ObservationEnrichmentContext): Promise<ObservationEnrichmentResult> {
  const text = context.originalText.toLowerCase();
  const classification = classify(text);
  const category = context.category || inferCategory(text);
  const activity = context.activity || inferActivity(text);
  const summary = summarize(context.originalText);
  const followUpStatus = classification === "follow_up_required" ? "needed" : "none";
  const referenceSuggestions = context.existingReferences.slice(0, 3).map((chunk) => ({
    sourceId: chunk.sourceId,
    sourceChunkId: chunk.id,
    citationLabel: chunk.locationLabel ?? `Chunk ${chunk.chunkIndex + 1}`
  }));
  return {
    provider: "local-observation-assistant",
    model: "deterministic-field-observation-v1",
    classification,
    category,
    activity,
    summary,
    followUpStatus,
    referenceSuggestions
  };
}

export function buildObservationReferenceQuery(observation: {
  originalText: string;
  category: string | null;
  activity: string | null;
}): string {
  const seed = [observation.category, observation.activity, observation.originalText].filter(Boolean).join(" ");
  const words = seed
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((word) => word.length > 4 && !["should", "would", "about", "there", "their", "after"].includes(word));
  return [...new Set(words)].slice(0, 4).join(" ") || "safety";
}

function classify(text: string): ObservationClassification {
  if (/(follow[- ]?up|verify|recheck|needs review|not complete)/.test(text)) return "follow_up_required";
  if (/(corrected|fixed|resolved|addressed).{0,40}(field|immediate|spot|site)?/.test(text)) return "corrected_in_field";
  if (/(missing|without|unsafe|concern|issue|hazard|not tied|no guard|blocked|trip)/.test(text)) return "concern";
  if (/(good|clean|safe|excellent|proper|well|positive|recognized)/.test(text)) return "positive";
  return "neutral";
}

function inferCategory(text: string): string {
  return categories.find((category) => category.terms.some((term) => text.includes(term)))?.name ?? "General safety observation";
}

function inferActivity(text: string): string | null {
  if (/(welding|torch|hot work)/.test(text)) return "Hot work";
  if (/(lift|boom|scissor)/.test(text)) return "Aerial lift work";
  if (/(trench|excavat)/.test(text)) return "Excavation";
  if (/(demo|demolition)/.test(text)) return "Demolition";
  return null;
}

function summarize(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= 220 ? clean : `${clean.slice(0, 217)}...`;
}
