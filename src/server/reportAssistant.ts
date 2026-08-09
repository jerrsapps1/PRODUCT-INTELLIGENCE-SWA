import type {
  FieldObservation,
  IncidentRecord,
  Project,
  ProjectContractorEngagement,
  ProjectSafetyDecision,
  ReportEvidenceManifest,
  ReportFormat,
  ReportManualInputs,
  ReportScopeInput,
  ReportType,
  ContractorRequirementStatus,
  SafetyPlan
} from "../shared/contracts";

export interface ReportEvidenceContext {
  project: Project;
  reportType: ReportType;
  format: ReportFormat;
  periodStart: string;
  periodEnd: string;
  scope: ReportScopeInput;
  manualInputs: ReportManualInputs;
  engagements: ProjectContractorEngagement[];
  observations: FieldObservation[];
  carriedObservations: FieldObservation[];
  incidents: IncidentRecord[];
  carriedIncidents: IncidentRecord[];
  safetyPlans: SafetyPlan[];
  readinessStatuses: ContractorRequirementStatus[];
  projectDecisions: ProjectSafetyDecision[];
  manifest: ReportEvidenceManifest;
}

export interface ReportDraftResult {
  provider: string;
  model: string;
  contentMarkdown: string;
  contentJson: Record<string, unknown>;
  errorState: string | null;
}

export async function draftSafetyReport(context: ReportEvidenceContext): Promise<ReportDraftResult> {
  if (process.env.REPORT_AI_PROVIDER === "fail-test") {
    throw new Error("Configured report AI test failure");
  }
  const lines = context.format === "structured" ? structuredReport(context) : narrativeReport(context);
  return {
    provider: "local-report-assistant",
    model: "deterministic-evidence-report-v1",
    contentMarkdown: lines.join("\n"),
    contentJson: {
      format: context.format,
      evidenceManifest: context.manifest,
      sectionCount: lines.filter((line) => line.startsWith("## ")).length
    },
    errorState: null
  };
}

export function draftFallbackSafetyReport(context: ReportEvidenceContext, error: unknown): ReportDraftResult {
  const lines = context.format === "structured" ? structuredReport(context) : narrativeReport(context);
  lines.push("", "## Generation Note", "", "Draft generated with the deterministic fallback after the configured assistant was unavailable.");
  return {
    provider: "local-report-fallback",
    model: "deterministic-evidence-report-v1",
    contentMarkdown: lines.join("\n"),
    contentJson: {
      format: context.format,
      evidenceManifest: context.manifest,
      sectionCount: lines.filter((line) => line.startsWith("## ")).length,
      fallbackReason: error instanceof Error ? error.message : "Report assistant unavailable"
    },
    errorState: error instanceof Error ? error.message : "Report assistant unavailable"
  };
}

function narrativeReport(context: ReportEvidenceContext): string[] {
  const lines = header(context);
  lines.push("## Project Safety Summary", "");
  lines.push(context.manualInputs.projectActivity || `${context.project.name} safety activity was reviewed for the reporting period using recorded project evidence.`);
  addManual(lines, "Management / Site Note", context.manualInputs.meetingNote);
  addManual(lines, "Weather", context.manualInputs.weather);
  addContractors(lines, context);
  addReadiness(lines, context);
  addObservations(lines, context);
  addIncidents(lines, context);
  addPlans(lines, context);
  addDecisions(lines, context);
  addFocus(lines, context);
  return lines;
}

function structuredReport(context: ReportEvidenceContext): string[] {
  const lines = header(context);
  lines.push("## Project Summary", "");
  lines.push(`- Project: ${context.project.name}`);
  lines.push(`- Period: ${context.periodStart} to ${context.periodEnd}`);
  if (context.manualInputs.projectActivity) lines.push(`- Activity: ${context.manualInputs.projectActivity}`);
  addManual(lines, "Milestone", context.manualInputs.milestone);
  addManual(lines, "Visitor / Audit Note", context.manualInputs.visitorAuditNote);
  addManual(lines, "Other Context", context.manualInputs.otherContext);
  addContractors(lines, context);
  addReadiness(lines, context);
  addObservations(lines, context);
  addIncidents(lines, context);
  addPlans(lines, context);
  addDecisions(lines, context);
  addFocus(lines, context);
  return lines;
}

function header(context: ReportEvidenceContext): string[] {
  const type = context.reportType[0].toUpperCase() + context.reportType.slice(1);
  return [`# ${type} Safety Report`, "", `**Project:** ${context.project.name}`, `**Period:** ${context.periodStart} to ${context.periodEnd}`, ""];
}

function addManual(lines: string[], label: string, value?: string) {
  if (!value) return;
  lines.push("", `## ${label}`, "", value);
}

function addContractors(lines: string[], context: ReportEvidenceContext) {
  if (!context.scope.includeContractors) return;
  const contractorIds = new Set([...context.observations, ...context.incidents].map((item) => item.contractorId).filter(Boolean));
  const relevant = context.engagements.filter((engagement) => contractorIds.has(engagement.contractorId));
  if (relevant.length === 0) return;
  lines.push("", "## Contractor Activity", "");
  for (const engagement of relevant) {
    const observations = context.observations.filter((item) => item.engagementId === engagement.id);
    const incidents = context.incidents.filter((item) => item.engagementId === engagement.id);
    lines.push(`### ${engagement.contractor?.legalName ?? engagement.contractorId}`);
    if (observations.length) lines.push(`${observations.length} observation${observations.length === 1 ? "" : "s"} recorded for this contractor during the period.`);
    if (incidents.length) lines.push(`${incidents.length} incident oversight record${incidents.length === 1 ? "" : "s"} occurred during the period.`);
    if (observations.length === 0 && incidents.length === 0) lines.push("No meaningful project evidence was recorded for this contractor during the period.");
    lines.push("");
  }
}

function addObservations(lines: string[], context: ReportEvidenceContext) {
  if (!context.scope.includeObservations) return;
  const positive = context.observations.filter((item) => item.derivedClassification === "positive");
  const corrected = context.observations.filter((item) => item.derivedClassification === "corrected_in_field");
  const followUp = [...context.observations, ...context.carriedObservations].filter((item) => item.followUpStatus === "needed");
  if (positive.length === 0 && corrected.length === 0 && followUp.length === 0) return;
  lines.push("", "## Safety Observations", "");
  if (positive.length) lines.push(`${positive.length} positive observation${positive.length === 1 ? "" : "s"} supported satisfactory practices during the period.`);
  if (corrected.length) lines.push(`${corrected.length} item${corrected.length === 1 ? " was" : "s were"} corrected in the field.`);
  if (followUp.length) lines.push(`${followUp.length} observation follow-up item${followUp.length === 1 ? "" : "s"} remained open or required attention.`);
}

function addReadiness(lines: string[], context: ReportEvidenceContext) {
  if (!context.scope.includeReadiness || context.readinessStatuses.length === 0) return;
  const open = context.readinessStatuses.filter((status) => !["accepted", "not_applicable"].includes(status.status));
  const accepted = context.readinessStatuses.length - open.length;
  lines.push("", "## Contractor Readiness", "");
  lines.push(`${accepted} readiness item${accepted === 1 ? "" : "s"} accepted or marked not applicable; ${open.length} item${open.length === 1 ? "" : "s"} remained open for the evidence window.`);
  open.slice(0, 6).forEach((status) => lines.push(`- ${status.requirement?.title ?? "Readiness requirement"}: ${status.status.replace(/_/g, " ")}.`));
}

function addIncidents(lines: string[], context: ReportEvidenceContext) {
  if (!context.scope.includeIncidents) return;
  const items = [...context.incidents, ...context.carriedIncidents.filter((item) => item.oversightStatus !== "closed")];
  if (items.length === 0) return;
  lines.push("", "## Incidents / Significant Events", "");
  for (const incident of items) {
    lines.push(`- ${incident.factualDescription} Project oversight status: ${incident.oversightStatus.replace(/_/g, " ")}.`);
  }
}

function addPlans(lines: string[], context: ReportEvidenceContext) {
  if (!context.scope.includePlanReview || context.safetyPlans.length === 0) return;
  lines.push("", "## Plan / Readiness Status", "");
  for (const plan of context.safetyPlans.slice(0, 5)) {
    lines.push(`- ${plan.title}: ${plan.reviewStatus}.`);
  }
}

function addDecisions(lines: string[], context: ReportEvidenceContext) {
  if (!context.scope.includeProjectDecisions || context.projectDecisions.length === 0) return;
  lines.push("", "## Project Decisions", "");
  context.projectDecisions.slice(0, 6).forEach((decision) => {
    lines.push(`- ${decision.decisionText}${decision.appliesToScope ? ` Scope: ${decision.appliesToScope}.` : ""}`);
  });
}

function addFocus(lines: string[], context: ReportEvidenceContext) {
  if (!context.scope.includeUpcomingFocus) return;
  const focus = [
    context.manualInputs.safetyEmphasis,
    context.manualInputs.plannedWork ? `Planned work: ${context.manualInputs.plannedWork}` : "",
    context.carriedObservations.some((item) => item.followUpStatus === "needed") ? "Verify carried open observation follow-up." : "",
    context.carriedIncidents.some((item) => item.oversightStatus !== "closed") ? "Continue incident oversight follow-up where open." : ""
  ].filter(Boolean);
  if (focus.length === 0) return;
  lines.push("", "## Follow-Up / Upcoming Focus", "");
  focus.forEach((item) => lines.push(`- ${item}`));
}
