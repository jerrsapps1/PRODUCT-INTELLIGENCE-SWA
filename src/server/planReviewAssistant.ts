import { z } from "zod";
import type {
  AuthorityClassification,
  PlanFindingAuthority,
  PlanFindingType,
  SourceChunk,
  SourceDetail
} from "../shared/contracts";

export interface ReviewReferenceContext {
  source: SourceDetail;
  sourceChunkId?: string;
  authorityClassification: AuthorityClassification;
  citationLabel?: string;
}

export interface AssistantFindingDraft {
  title: string;
  findingType: PlanFindingType;
  authority: PlanFindingAuthority;
  planSourceChunkId: string | null;
  referenceSourceId: string | null;
  referenceSourceChunkId: string | null;
  referenceCitationLabel: string | null;
  aiExplanation: string;
  reviewerExplanation: string;
  contractorFacingRecommendation: string | null;
  recommendedRevisionText: string | null;
  reviewerDecision: string | null;
}

export interface AssistantReviewResult {
  provider: string;
  model: string;
  promptConfigVersion: string;
  processingStatus: "completed" | "partial";
  errorState: string | null;
  findings: AssistantFindingDraft[];
  contractorFacingSummary: string;
}

const promptConfigVersion = "phase4-review-v2";
const maxChunksPerSource = 6;
const maxCharsPerChunk = 900;

const aiFindingSchema = z.object({
  title: z.string().min(1).max(180),
  findingType: z.enum(["compliant", "revision_recommended", "deficiency", "conflict", "reviewer_decision"]),
  authority: z.enum(["regulatory_requirement", "project_requirement", "recommendation", "reviewer_decision"]),
  planChunkId: z.string().nullable().optional(),
  referenceSourceId: z.string().nullable().optional(),
  referenceChunkId: z.string().nullable().optional(),
  explanation: z.string().min(1).max(4000),
  reviewerExplanation: z.string().min(1).max(4000),
  contractorFacingRecommendation: z.string().nullable().optional(),
  recommendedRevisionText: z.string().nullable().optional(),
  reviewerDecision: z.string().nullable().optional()
});

const aiReviewSchema = z.object({
  findings: z.array(aiFindingSchema).min(1).max(20),
  contractorFacingSummary: z.string().min(1).max(12000)
});

export async function runPlanReviewAssistant(input: {
  planSource: SourceDetail;
  references: ReviewReferenceContext[];
}): Promise<AssistantReviewResult> {
  const deterministic = runDeterministicReview(input);
  const apiKey = process.env.OPENAI_API_KEY;
  const provider = process.env.PLAN_REVIEW_AI_PROVIDER ?? (apiKey ? "openai" : "local");
  if (provider !== "openai" || !apiKey) return deterministic;

  try {
    return await runOpenAiReview(input, deterministic, apiKey);
  } catch (error) {
    return {
      ...deterministic,
      processingStatus: "partial",
      errorState: error instanceof Error ? error.message : "AI provider failed; deterministic review used"
    };
  }
}

function runDeterministicReview(input: {
  planSource: SourceDetail;
  references: ReviewReferenceContext[];
}): AssistantReviewResult {
  const planChunks = boundedChunks(input.planSource);
  const planText = normalize(planChunks.map((chunk) => chunk.text).join(" "));
  const findings = input.references.flatMap((reference, index) => {
    const referenceChunks = selectedReferenceChunks(reference);
    return referenceChunks.map((chunk) => evaluateReferenceChunk(reference, chunk, planChunks, planText, index));
  });
  const finalFindings = findings.length ? findings : [reviewerDecisionFinding(input.planSource)];
  return {
    provider: "local-review-assistant",
    model: "deterministic-evidence-review-v2",
    promptConfigVersion,
    processingStatus: "completed",
    errorState: null,
    findings: finalFindings,
    contractorFacingSummary: buildSummary(input.planSource.title, finalFindings)
  };
}

async function runOpenAiReview(
  input: { planSource: SourceDetail; references: ReviewReferenceContext[] },
  fallback: AssistantReviewResult,
  apiKey: string
): Promise<AssistantReviewResult> {
  const model = process.env.OPENAI_PLAN_REVIEW_MODEL ?? "gpt-5-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "developer",
          content: [
            "You draft safety-plan review findings for a human reviewer.",
            "Use only the submitted plan chunks and selected reference chunks.",
            "Do not invent requirements.",
            "Mandatory findings require support from selected references.",
            "Distinguish regulatory requirements, project requirements, recommendations, and reviewer decisions.",
            "Use reviewer_decision when evidence is ambiguous.",
            "Cite supporting source and chunk IDs.",
            "Never approve the plan, grant exceptions, make final legal determinations, or determine contractor eligibility.",
            "Return strict JSON only."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            submittedPlan: serializeSource(input.planSource),
            selectedReferences: input.references.map((reference) => ({
              authorityClassification: reference.authorityClassification,
              citationLabel: reference.citationLabel,
              source: serializeSource(reference.source, reference.sourceChunkId)
            }))
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "safety_plan_review",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["findings", "contractorFacingSummary"],
            properties: {
              contractorFacingSummary: { type: "string" },
              findings: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "findingType", "authority", "explanation", "reviewerExplanation"],
                  properties: {
                    title: { type: "string" },
                    findingType: { type: "string", enum: ["compliant", "revision_recommended", "deficiency", "conflict", "reviewer_decision"] },
                    authority: { type: "string", enum: ["regulatory_requirement", "project_requirement", "recommendation", "reviewer_decision"] },
                    planChunkId: { type: ["string", "null"] },
                    referenceSourceId: { type: ["string", "null"] },
                    referenceChunkId: { type: ["string", "null"] },
                    explanation: { type: "string" },
                    reviewerExplanation: { type: "string" },
                    contractorFacingRecommendation: { type: ["string", "null"] },
                    recommendedRevisionText: { type: ["string", "null"] },
                    reviewerDecision: { type: ["string", "null"] }
                  }
                }
              }
            }
          }
        }
      }
    })
  });
  if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
  const body = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const raw = body.output_text ?? body.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") ?? "";
  const parsed = aiReviewSchema.parse(JSON.parse(raw));
  return {
    provider: "openai",
    model,
    promptConfigVersion,
    processingStatus: "completed",
    errorState: null,
    findings: parsed.findings.map((finding, index) => ({
      title: finding.title,
      findingType: finding.findingType,
      authority: finding.authority,
      planSourceChunkId: finding.planChunkId ?? fallback.findings[index]?.planSourceChunkId ?? null,
      referenceSourceId: finding.referenceSourceId ?? fallback.findings[index]?.referenceSourceId ?? null,
      referenceSourceChunkId: finding.referenceChunkId ?? fallback.findings[index]?.referenceSourceChunkId ?? null,
      referenceCitationLabel: fallback.findings[index]?.referenceCitationLabel ?? null,
      aiExplanation: finding.explanation,
      reviewerExplanation: finding.reviewerExplanation,
      contractorFacingRecommendation: finding.contractorFacingRecommendation ?? null,
      recommendedRevisionText: finding.recommendedRevisionText ?? null,
      reviewerDecision: finding.reviewerDecision ?? null
    })),
    contractorFacingSummary: parsed.contractorFacingSummary
  };
}

function evaluateReferenceChunk(
  reference: ReviewReferenceContext,
  chunk: SourceChunk,
  planChunks: SourceChunk[],
  planText: string,
  index: number
): AssistantFindingDraft {
  const keywords = importantTerms(chunk.text);
  const matches = planChunks.map((planChunk) => ({
    chunk: planChunk,
    score: overlapScore(importantTerms(planChunk.text), keywords)
  })).sort((a, b) => b.score - a.score);
  const best = matches[0];
  const hasEvidence = Boolean(best && best.score >= Math.min(3, Math.max(1, Math.ceil(keywords.length * 0.35))));
  const bestPassage = best ? bestPlanPassage(best.chunk.text, keywords) : "";
  const ambiguous = hasEvidence && /\b(as needed|when feasible|if applicable|may|where practical|generally)\b/i.test(bestPassage);
  const conflict = hasEvidence && /\b(will not|not required|no requirement|not applicable|never)\b/i.test(bestPassage);
  const authority = authorityFor(reference.authorityClassification);
  const titleBase = titleFromRequirement(chunk.text, reference.source.title, index);
  if (authority === "recommendation") {
    return {
      title: `Recommended improvement: ${titleBase}`,
      findingType: hasEvidence ? "revision_recommended" : "reviewer_decision",
      authority,
      planSourceChunkId: best?.chunk.id ?? null,
      referenceSourceId: reference.source.id,
      referenceSourceChunkId: chunk.id,
      referenceCitationLabel: reference.citationLabel ?? chunk.locationLabel ?? reference.source.title,
      aiExplanation: hasEvidence
        ? "The plan touches this selected guidance item, but this source is classified as recommendation/guidance rather than a mandatory requirement."
        : "Selected guidance was not clearly addressed. Because the source is not mandatory, this is routed as reviewer judgment rather than a deficiency.",
      reviewerExplanation: "Reviewer should decide whether to include this as a contractor-facing recommendation.",
      contractorFacingRecommendation: `Consider strengthening the plan language for ${titleBase}.`,
      recommendedRevisionText: `Add clear, site-specific detail for ${titleBase} where appropriate.`,
      reviewerDecision: hasEvidence ? null : "Reviewer decision required"
    };
  }
  if (conflict) {
    return baseFinding("conflict", authority, `Potential conflict: ${titleBase}`, best?.chunk.id ?? null, reference, chunk);
  }
  if (ambiguous) {
    return {
      ...baseFinding("reviewer_decision", "reviewer_decision", `Reviewer decision required: ${titleBase}`, best?.chunk.id ?? null, reference, chunk),
      aiExplanation: "The plan uses conditional or ambiguous language against a selected requirement; reviewer judgment is required.",
      reviewerDecision: "Determine whether the submitted approach is acceptable for this project."
    };
  }
  if (hasEvidence) {
    return {
      ...baseFinding("compliant", authority, `Plan appears to address: ${titleBase}`, best?.chunk.id ?? null, reference, chunk),
      contractorFacingRecommendation: null,
      recommendedRevisionText: null
    };
  }
  return baseFinding("deficiency", authority, `Missing or incomplete: ${titleBase}`, null, reference, chunk);
}

function baseFinding(
  findingType: PlanFindingType,
  authority: PlanFindingAuthority,
  title: string,
  planSourceChunkId: string | null,
  reference: ReviewReferenceContext,
  referenceChunk: SourceChunk
): AssistantFindingDraft {
  const mandatory = authority === "regulatory_requirement" || authority === "project_requirement";
  return {
    title,
    findingType,
    authority,
    planSourceChunkId,
    referenceSourceId: reference.source.id,
    referenceSourceChunkId: referenceChunk.id,
    referenceCitationLabel: reference.citationLabel ?? referenceChunk.locationLabel ?? reference.source.title,
    aiExplanation: mandatory
      ? "This draft conclusion is supported by the selected reference citation and should be verified by the reviewer."
      : "This draft item is not represented as a mandatory requirement.",
    reviewerExplanation: findingType === "compliant"
      ? "The submitted plan appears to address the selected reference."
      : "The submitted plan should be revised or clarified against the selected reference.",
    contractorFacingRecommendation: findingType === "compliant" ? null : `Revise the plan to address ${title.replace(/^(Missing or incomplete|Potential conflict|Reviewer decision required): /, "")}.`,
    recommendedRevisionText: findingType === "compliant" ? null : "Add specific language describing the responsible party, required action, timing, and project-specific controls.",
    reviewerDecision: findingType === "reviewer_decision" ? "Reviewer decision required" : null
  };
}

function selectedReferenceChunks(reference: ReviewReferenceContext): SourceChunk[] {
  if (reference.sourceChunkId) {
    const exact = reference.source.chunks.find((chunk) => chunk.id === reference.sourceChunkId);
    if (exact) return [exact];
  }
  return boundedChunks(reference.source);
}

function boundedChunks(source: SourceDetail): SourceChunk[] {
  return source.chunks.slice(0, maxChunksPerSource).map((chunk) => ({
    ...chunk,
    text: chunk.text.slice(0, maxCharsPerChunk)
  }));
}

function serializeSource(source: SourceDetail, selectedChunkId?: string) {
  return {
    id: source.id,
    title: source.title,
    authorityClassification: source.authorityClassification,
    chunks: selectedReferenceChunks({ source, sourceChunkId: selectedChunkId, authorityClassification: source.authorityClassification })
      .map((chunk) => ({ id: chunk.id, locationLabel: chunk.locationLabel, text: chunk.text }))
  };
}

function importantTerms(text: string): string[] {
  const stop = new Set(["shall", "must", "will", "with", "from", "that", "this", "have", "been", "their", "before", "after", "where", "when", "plan", "requirement", "required"]);
  return [...new Set(normalize(text).split(" ").filter((word) => word.length > 3 && !stop.has(word)))].slice(0, 14);
}

function overlapScore(planTerms: string[], referenceTerms: string[]): number {
  const plan = new Set(planTerms);
  return referenceTerms.filter((term) => plan.has(term)).length;
}

function bestPlanPassage(text: string, referenceTerms: string[]): string {
  return text
    .split(/[.\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({ part, score: overlapScore(importantTerms(part), referenceTerms) }))
    .sort((a, b) => b.score - a.score)[0]?.part ?? text;
}

function authorityFor(classification: AuthorityClassification): PlanFindingAuthority {
  if (classification === "regulatory_requirement") return "regulatory_requirement";
  if (["project_requirement", "owner_requirement", "gc_policy"].includes(classification)) return "project_requirement";
  if (classification === "general_reference") return "recommendation";
  return "reviewer_decision";
}

function titleFromRequirement(text: string, fallback: string, index: number): string {
  const first = text.split(/[.\n]/).map((part) => part.trim()).find(Boolean);
  return (first ?? `${fallback} item ${index + 1}`).slice(0, 120);
}

function reviewerDecisionFinding(planSource: SourceDetail): AssistantFindingDraft {
  return {
    title: "Reviewer decision required",
    findingType: "reviewer_decision",
    authority: "reviewer_decision",
    planSourceChunkId: planSource.chunks[0]?.id ?? null,
    referenceSourceId: null,
    referenceSourceChunkId: null,
    referenceCitationLabel: null,
    aiExplanation: "No selected reference text was available for a grounded comparison.",
    reviewerExplanation: "Select extracted reference sources or complete a manual review.",
    contractorFacingRecommendation: null,
    recommendedRevisionText: null,
    reviewerDecision: "Reviewer decision required"
  };
}

function buildSummary(planTitle: string, findings: AssistantFindingDraft[]): string {
  const required = findings.filter((finding) => ["deficiency", "conflict"].includes(finding.findingType));
  const recommended = findings.filter((finding) => finding.authority === "recommendation" || finding.findingType === "revision_recommended");
  const decisions = findings.filter((finding) => finding.findingType === "reviewer_decision");
  return [
    `Plan reviewed: ${planTitle}`,
    "",
    "Required revisions:",
    ...(required.length ? required.map((finding) => `- ${finding.contractorFacingRecommendation ?? finding.title}`) : ["- None drafted."]),
    "",
    "Recommended revisions:",
    ...(recommended.length ? recommended.map((finding) => `- ${finding.contractorFacingRecommendation ?? finding.title}`) : ["- None drafted."]),
    "",
    "Clarifications requested:",
    ...(decisions.length ? decisions.map((finding) => `- ${finding.title}`) : ["- None drafted."]),
    "",
    "Reviewer comments:",
    "- Draft generated for human review; approval remains reviewer-controlled."
  ].join("\n");
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
