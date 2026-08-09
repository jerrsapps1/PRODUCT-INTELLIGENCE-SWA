import type { FieldObservation, IncidentRecommendationType, PlanFinding, SourceDetail } from "../shared/contracts";

export interface IncidentAssistantContext {
  factualDescription: string;
  activity: string | null;
  contractorClassification: string | null;
  documents: SourceDetail[];
  findings: PlanFinding[];
  observations: FieldObservation[];
}

export interface IncidentAssistantResult {
  provider: string;
  model: string;
  processingStatus: "ready" | "failed";
  summary: string;
  suggestedConcerns: string;
  suggestedQuestions: string;
  suggestedRecommendationTypes: IncidentRecommendationType[];
  errorState: string | null;
}

export async function runIncidentAssistant(context: IncidentAssistantContext): Promise<IncidentAssistantResult> {
  if (process.env.INCIDENT_AI_PROVIDER === "fail-test") {
    return {
      provider: "local-incident-assistant",
      model: "deterministic-incident-oversight-v1",
      processingStatus: "failed",
      summary: "",
      suggestedConcerns: "",
      suggestedQuestions: "",
      suggestedRecommendationTypes: [],
      errorState: "Configured incident AI test failure"
    };
  }
  const text = [context.factualDescription, ...context.documents.flatMap((source) => source.chunks.map((chunk) => chunk.text))]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const summary = text.length <= 280 ? text : `${text.slice(0, 277)}...`;
  const lower = text.toLowerCase();
  const concerns = [
    lower.includes("fall") || lower.includes("lift") ? "Review elevated-work controls and whether similar exposure exists elsewhere." : "",
    lower.includes("training") ? "Confirm whether workforce communication or refresher documentation is needed." : "",
    context.findings.length ? `${context.findings.length} linked plan finding(s) may warrant reviewer consideration without assuming causation.` : "",
    context.observations.length ? `${context.observations.length} linked observation(s) may indicate factual recurrence without proving cause.` : ""
  ].filter(Boolean).join(" ");
  const questions = [
    "Are contractor corrective actions sufficient from the project perspective?",
    "Is additional documentation needed before affected work continues?",
    "Should a project-level decision or temporary condition be recorded?"
  ].join("\n");
  const suggestedRecommendationTypes: IncidentRecommendationType[] = [];
  if (lower.includes("plan") || lower.includes("procedure")) suggestedRecommendationTypes.push("require_plan_revision");
  if (lower.includes("document") || lower.includes("training")) suggestedRecommendationTypes.push("require_supporting_documentation");
  if (lower.includes("verify") || lower.includes("field")) suggestedRecommendationTypes.push("perform_field_verification");
  if (suggestedRecommendationTypes.length === 0) suggestedRecommendationTypes.push("request_clarification");
  return {
    provider: "local-incident-assistant",
    model: "deterministic-incident-oversight-v1",
    processingStatus: "ready",
    summary,
    suggestedConcerns: concerns || "No project-level concern is stated as fact; reviewer evaluation is required.",
    suggestedQuestions: questions,
    suggestedRecommendationTypes,
    errorState: null
  };
}
