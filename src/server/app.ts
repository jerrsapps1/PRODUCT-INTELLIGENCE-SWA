import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { parse, serialize } from "cookie";
import { ZodError, type ZodSchema } from "zod";
import {
  contractorCreateSchema,
  competentPersonCreateSchema,
  contractorRequirementApplySchema,
  contractorRequirementUpdateSchema,
  engagementCreateSchema,
  loginSchema,
  projectSourceActivationSchema,
  projectSourceSchema,
  projectCreateSchema,
  planApprovalSchema,
  planFindingCreateSchema,
  planFindingUpdateSchema,
  planRecommendationUpdateSchema,
  planReviewRunSchema,
  observationCreateSchema,
  observationPhotoAttachSchema,
  observationPhotoUpdateSchema,
  observationPlanFindingLinkSchema,
  observationReferenceLinkSchema,
  observationSearchSchema,
  observationUpdateSchema,
  contractorCorrectiveActionSchema,
  contractorCorrectiveActionUpdateSchema,
  incidentAttachmentSchema,
  incidentCloseSchema,
  incidentCreateSchema,
  incidentFollowUpSchema,
  incidentLinkSchema,
  incidentProjectReviewSchema,
  incidentRecommendationSchema,
  incidentRecommendationUpdateSchema,
  incidentReopenSchema,
  incidentSearchSchema,
  incidentUpdateSchema,
  projectSafetyDecisionSchema,
  readinessEvidenceCreateSchema,
  readinessEvidenceReviewSchema,
  readinessRequirementCreateSchema,
  readinessRequirementUpdateSchema,
  resubmissionComparisonCreateSchema,
  safetyPlanCreateSchema,
  safetyPlanRevisionCreateSchema,
  safetyMetricCreateSchema,
  sourceMetadataSchema,
  sourceSearchSchema,
  sourceUpdateSchema,
  urlSourceCreateSchema,
  type UserSummary
} from "../shared/contracts";
import { extractSource, materializeChunks } from "./extraction";
import { createSessionToken, hashPassword, hashSessionToken, hoursFromNow, verifyPassword } from "./security";
import { isAllowedFile, maxUploadBytes, sourceCapabilities } from "./sourceCapabilities";
import { MemoryObjectStorage, type ObjectStorage } from "./storage";
import {
  DuplicateEngagementError,
  DuplicateEvidenceAssociationError,
  DuplicateIncidentAttachmentError,
  DuplicateIncidentLinkError,
  DuplicateObservationPhotoError,
  DuplicateObservationPlanFindingLinkError,
  DuplicateObservationReferenceError,
  DuplicatePlanRevisionSourceError,
  DuplicateProjectSourceError,
  DuplicateRequirementApplicationError,
  type AppStore,
  type StoredUser
} from "./store";
import { readMultipart } from "./upload";
import { retrieveUrlText } from "./urlSafety";

const sessionCookie = "pi_session";

export interface AppOptions {
  store: AppStore;
  storage?: ObjectStorage;
  bootstrapEmail: string;
  bootstrapPassword: string;
  bootstrapDisplayName: string;
  secureCookies?: boolean;
}

interface AuthedRequest {
  req: IncomingMessage;
  user: StoredUser;
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(statusCode, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

function sendNoContent(res: ServerResponse, headers: Record<string, string> = {}) {
  res.writeHead(204, headers);
  res.end();
}

async function readJson<T>(req: IncomingMessage, schema: ZodSchema<T>): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return schema.parse(raw ? JSON.parse(raw) : {});
}

function publicUser(user: StoredUser): UserSummary {
  return { id: user.id, email: user.email, displayName: user.displayName };
}

function cookieHeader(token: string, secureCookies: boolean, maxAgeSeconds = 60 * 60 * 24 * 7): string {
  return serialize(sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    path: "/",
    maxAge: maxAgeSeconds
  });
}

async function getAuthed(req: IncomingMessage, store: AppStore): Promise<StoredUser | null> {
  const token = parse(req.headers.cookie ?? "")[sessionCookie];
  if (!token) return null;
  return store.findUserBySessionTokenHash(hashSessionToken(token));
}

function routeParts(req: IncomingMessage): string[] {
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.pathname.split("/").filter(Boolean);
}

export async function createApp(options: AppOptions) {
  const { store } = options;
  const storage = options.storage ?? new MemoryObjectStorage();
  await store.migrate();
  await store.ensureBootstrapUser({
    email: options.bootstrapEmail,
    displayName: options.bootstrapDisplayName,
    passwordHash: hashPassword(options.bootstrapPassword)
  });

  async function requireAuth(req: IncomingMessage, res: ServerResponse): Promise<AuthedRequest | null> {
    const user = await getAuthed(req, store);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required" });
      return null;
    }
    return { req, user };
  }

  return createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const parts = routeParts(req);

      if (method === "GET" && parts.join("/") === "api/health") {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (method === "GET" && parts.join("/") === "api/source-capabilities") {
        sendJson(res, 200, { capabilities: sourceCapabilities, maxUploadBytes });
        return;
      }

      if (method === "POST" && parts.join("/") === "api/auth/login") {
        const input = await readJson(req, loginSchema);
        const user = await store.findUserByEmail(input.email);
        if (!user || !verifyPassword(input.password, user.passwordHash)) {
          sendJson(res, 401, { error: "Invalid email or password" });
          return;
        }
        const token = createSessionToken();
        await store.createSession(user.id, hashSessionToken(token), hoursFromNow(24 * 7));
        sendJson(res, 200, { user: publicUser(user) }, { "set-cookie": cookieHeader(token, Boolean(options.secureCookies)) });
        return;
      }

      if (method === "POST" && parts.join("/") === "api/auth/logout") {
        const token = parse(req.headers.cookie ?? "")[sessionCookie];
        if (token) await store.deleteSession(hashSessionToken(token));
        sendNoContent(res, { "set-cookie": cookieHeader("", Boolean(options.secureCookies), 0) });
        return;
      }

      if (method === "GET" && parts.join("/") === "api/auth/session") {
        const user = await getAuthed(req, store);
        if (!user) {
          sendJson(res, 200, { user: null });
          return;
        }
        sendJson(res, 200, { user: publicUser(user) });
        return;
      }

      const authed = await requireAuth(req, res);
      if (!authed) return;
      const userId = authed.user.id;
      const url = new URL(req.url ?? "/", "http://localhost");

      if (method === "GET" && parts.join("/") === "api/projects") {
        sendJson(res, 200, { projects: await store.listProjects(userId) });
        return;
      }

      if (method === "POST" && parts.join("/") === "api/projects") {
        const input = await readJson(req, projectCreateSchema);
        sendJson(res, 201, { project: await store.createProject(userId, input) });
        return;
      }

      if (method === "GET" && parts[0] === "api" && parts[1] === "projects" && parts.length === 3) {
        const project = await store.getProject(userId, parts[2]);
        if (!project) sendJson(res, 404, { error: "Project not found" });
        else sendJson(res, 200, { project });
        return;
      }

      if (method === "GET" && parts.join("/") === "api/contractors") {
        sendJson(res, 200, { contractors: await store.listContractors(userId) });
        return;
      }

      if (method === "POST" && parts.join("/") === "api/contractors") {
        const input = await readJson(req, contractorCreateSchema);
        sendJson(res, 201, { contractor: await store.createContractor(userId, input) });
        return;
      }

      if (parts[0] === "api" && parts[1] === "projects" && parts[3] === "contractors") {
        const projectId = parts[2];
        if (method === "GET" && parts.length === 4) {
          if (!(await store.getProject(userId, projectId))) {
            sendJson(res, 404, { error: "Project not found" });
            return;
          }
          sendJson(res, 200, { engagements: await store.listProjectEngagements(userId, projectId) });
          return;
        }
        if (method === "POST" && parts.length === 4) {
          const input = await readJson(req, engagementCreateSchema);
          sendJson(res, 201, { engagement: await store.createProjectEngagement(userId, projectId, input) });
          return;
        }
        if (method === "GET" && parts.length === 5) {
          const engagement = await store.getProjectEngagement(userId, projectId, parts[4]);
          if (!engagement) sendJson(res, 404, { error: "Contractor engagement not found" });
          else sendJson(res, 200, { engagement });
          return;
        }
      }

      if (parts[0] === "api" && parts[1] === "projects" && parts[3] === "readiness-requirements") {
        const projectId = parts[2];
        if (method === "GET" && parts.length === 4) {
          if (!(await store.getProject(userId, projectId))) {
            sendJson(res, 404, { error: "Project not found" });
            return;
          }
          sendJson(res, 200, { requirements: await store.listReadinessRequirements(userId, projectId) });
          return;
        }
        if (method === "POST" && parts.length === 4) {
          const input = await readJson(req, readinessRequirementCreateSchema);
          sendJson(res, 201, {
            requirement: await store.createReadinessRequirement(userId, projectId, {
              ...input,
              category: input.category ?? "Other",
              required: input.required ?? true,
              blocking: input.blocking ?? true
            })
          });
          return;
        }
        if (method === "PATCH" && parts.length === 5) {
          const requirement = await store.updateReadinessRequirement(
            userId,
            projectId,
            parts[4],
            await readJson(req, readinessRequirementUpdateSchema)
          );
          if (!requirement) sendJson(res, 404, { error: "Readiness requirement not found" });
          else sendJson(res, 200, { requirement });
          return;
        }
      }

      if (method === "GET" && parts[0] === "api" && parts[1] === "projects" && parts[3] === "readiness-summaries") {
        const projectId = parts[2];
        if (!(await store.getProject(userId, projectId))) {
          sendJson(res, 404, { error: "Project not found" });
          return;
        }
        sendJson(res, 200, { summaries: await store.listProjectReadinessSummaries(userId, projectId) });
        return;
      }

      if (parts[0] === "api" && parts[1] === "engagements" && parts[3] === "readiness") {
        const engagementId = parts[2];
        if (method === "GET" && parts.length === 4) {
          const detail = await store.getContractorReadiness(userId, engagementId, {
            status: url.searchParams.get("status") ?? undefined,
            category: url.searchParams.get("category") ?? undefined
          });
          if (!detail) sendJson(res, 404, { error: "Contractor engagement not found" });
          else sendJson(res, 200, { readiness: detail });
          return;
        }
        if (method === "POST" && parts[4] === "requirements" && parts.length === 5) {
          const input = await readJson(req, contractorRequirementApplySchema);
          sendJson(res, 201, { status: await store.applyRequirementToEngagement(userId, engagementId, input) });
          return;
        }
      }

      if (method === "PATCH" && parts[0] === "api" && parts[1] === "readiness" && parts[2] === "statuses" && parts.length === 4) {
        const status = await store.updateContractorRequirementStatus(userId, parts[3], await readJson(req, contractorRequirementUpdateSchema));
        if (!status) sendJson(res, 404, { error: "Requirement status not found" });
        else sendJson(res, 200, { status });
        return;
      }

      if (method === "POST" && parts.join("/") === "api/readiness/evidence") {
        const input = await readJson(req, readinessEvidenceCreateSchema);
        const evidence = await store.attachReadinessEvidence(userId, {
          ...input,
          evidenceRole: input.evidenceRole ?? "supporting_evidence",
          extractedMetadata: input.extractedMetadata ?? {}
        });
        sendJson(res, 201, { evidence });
        return;
      }

      if (method === "PATCH" && parts[0] === "api" && parts[1] === "readiness" && parts[2] === "evidence" && parts.length === 4) {
        const evidence = await store.reviewReadinessEvidence(userId, parts[3], await readJson(req, readinessEvidenceReviewSchema));
        if (!evidence) sendJson(res, 404, { error: "Readiness evidence not found" });
        else sendJson(res, 200, { evidence });
        return;
      }

      if (method === "POST" && parts.join("/") === "api/readiness/safety-metrics") {
        const input = await readJson(req, safetyMetricCreateSchema);
        sendJson(res, 201, { metric: await store.createSafetyMetric(userId, { ...input, reviewStatus: input.reviewStatus ?? "needs_review" }) });
        return;
      }

      if (method === "POST" && parts.join("/") === "api/readiness/competent-persons") {
        const input = await readJson(req, competentPersonCreateSchema);
        sendJson(res, 201, {
          competentPerson: await store.createCompetentPersonEvidence(userId, { ...input, reviewStatus: input.reviewStatus ?? "needs_review" })
        });
        return;
      }

      if (parts[0] === "api" && parts[1] === "engagements" && parts[3] === "safety-plans") {
        const engagementId = parts[2];
        if (method === "GET" && parts.length === 4) {
          sendJson(res, 200, { plans: await store.listSafetyPlans(userId, engagementId) });
          return;
        }
        if (method === "POST" && parts.length === 4) {
          const input = await readJson(req, safetyPlanCreateSchema);
          if (input.engagementId !== engagementId) {
            sendJson(res, 400, { error: "Engagement path and payload must match" });
            return;
          }
          sendJson(res, 201, {
            safetyPlan: await store.createSafetyPlan(userId, {
              ...input,
              revisionIdentifier: input.revisionIdentifier ?? "Rev 0"
            })
          });
          return;
        }
      }

      if (parts[0] === "api" && parts[1] === "safety-plans") {
        const planId = parts[2];
        if (method === "GET" && parts.length === 3) {
          const detail = await store.getSafetyPlanDetail(userId, planId);
          if (!detail) sendJson(res, 404, { error: "Safety plan not found" });
          else sendJson(res, 200, { safetyPlan: detail });
          return;
        }
        if (method === "POST" && parts[3] === "revisions" && parts.length === 4) {
          const detail = await store.createSafetyPlanRevision(userId, planId, await readJson(req, safetyPlanRevisionCreateSchema));
          if (!detail) sendJson(res, 404, { error: "Safety plan not found" });
          else sendJson(res, 201, { safetyPlan: detail });
          return;
        }
        if (method === "POST" && parts[3] === "review-runs" && parts.length === 4) {
          const detail = await store.runPlanReview(userId, planId, await readJson(req, planReviewRunSchema));
          sendJson(res, 201, { safetyPlan: detail });
          return;
        }
        if (method === "PATCH" && parts[3] === "approval" && parts.length === 4) {
          const detail = await store.updatePlanApproval(userId, planId, await readJson(req, planApprovalSchema));
          if (!detail) sendJson(res, 404, { error: "Safety plan not found" });
          else sendJson(res, 200, { safetyPlan: detail });
          return;
        }
        if (method === "POST" && parts[3] === "resubmission-comparisons" && parts.length === 4) {
          const input = await readJson(req, resubmissionComparisonCreateSchema);
          sendJson(res, 201, {
            comparisons: await store.createResubmissionComparison(userId, planId, {
              ...input,
              findingResolutions: input.findingResolutions ?? []
            })
          });
          return;
        }
      }

      if (method === "POST" && parts.join("/") === "api/plan-findings") {
        const input = await readJson(req, planFindingCreateSchema);
        sendJson(res, 201, { finding: await store.createPlanFinding(userId, { ...input, sortOrder: input.sortOrder ?? 0 }) });
        return;
      }

      if (parts[0] === "api" && parts[1] === "plan-findings" && parts.length === 3) {
        if (method === "PATCH") {
          const finding = await store.updatePlanFinding(userId, parts[2], await readJson(req, planFindingUpdateSchema));
          if (!finding) sendJson(res, 404, { error: "Plan finding not found" });
          else sendJson(res, 200, { finding });
          return;
        }
        if (method === "DELETE") {
          await store.deletePlanFinding(userId, parts[2]);
          sendNoContent(res);
          return;
        }
      }

      if (method === "PATCH" && parts[0] === "api" && parts[1] === "plan-reviews" && parts[3] === "recommendation" && parts.length === 4) {
        const review = await store.updatePlanRecommendation(userId, parts[2], await readJson(req, planRecommendationUpdateSchema));
        if (!review) sendJson(res, 404, { error: "Plan review not found" });
        else sendJson(res, 200, { review });
        return;
      }

      if (method === "GET" && parts.join("/") === "api/observations") {
        const filters = observationSearchSchema.parse(Object.fromEntries(url.searchParams.entries()));
        sendJson(res, 200, { observations: await store.listObservations(userId, filters) });
        return;
      }

      if (method === "POST" && parts.join("/") === "api/observations") {
        const input = await readJson(req, observationCreateSchema);
        const observation = await store.createObservation(userId, { ...input, followUpNeeded: input.followUpNeeded ?? false });
        sendJson(res, 201, { observation });
        return;
      }

      if (parts[0] === "api" && parts[1] === "observations" && parts.length >= 3) {
        const observationId = parts[2];
        if (method === "GET" && parts.length === 3) {
          const observation = await store.getObservation(userId, observationId);
          if (!observation) sendJson(res, 404, { error: "Observation not found" });
          else sendJson(res, 200, { observation });
          return;
        }
        if (method === "PATCH" && parts.length === 3) {
          const observation = await store.updateObservation(userId, observationId, await readJson(req, observationUpdateSchema));
          if (!observation) sendJson(res, 404, { error: "Observation not found" });
          else sendJson(res, 200, { observation });
          return;
        }
        if (method === "POST" && parts[3] === "photos" && parts.length === 4) {
          const photo = await store.attachObservationPhoto(userId, observationId, await readJson(req, observationPhotoAttachSchema));
          sendJson(res, 201, { photo });
          return;
        }
        if (method === "POST" && parts[3] === "enrichment-runs" && parts.length === 4) {
          const observation = await store.runObservationEnrichment(userId, observationId);
          if (!observation) sendJson(res, 404, { error: "Observation not found" });
          else sendJson(res, 201, { observation });
          return;
        }
        if (method === "POST" && parts[3] === "references" && parts.length === 4) {
          const input = await readJson(req, observationReferenceLinkSchema);
          const link = await store.linkObservationReference(userId, observationId, {
            ...input,
            suggested: input.suggested ?? false,
            accepted: input.accepted ?? true
          });
          sendJson(res, 201, { referenceLink: link });
          return;
        }
        if (method === "POST" && parts[3] === "plan-findings" && parts.length === 4) {
          const input = await readJson(req, observationPlanFindingLinkSchema);
          const link = await store.linkObservationPlanFinding(userId, observationId, {
            ...input,
            suggested: input.suggested ?? false,
            accepted: input.accepted ?? true
          });
          sendJson(res, 201, { planFindingLink: link });
          return;
        }
      }

      if (parts[0] === "api" && parts[1] === "observation-photos" && parts.length === 3) {
        if (method === "PATCH") {
          const photo = await store.updateObservationPhoto(userId, parts[2], await readJson(req, observationPhotoUpdateSchema));
          if (!photo) sendJson(res, 404, { error: "Observation photo not found" });
          else sendJson(res, 200, { photo });
          return;
        }
        if (method === "DELETE") {
          await store.removeObservationPhoto(userId, parts[2]);
          sendNoContent(res);
          return;
        }
      }

      if (method === "DELETE" && parts[0] === "api" && parts[1] === "observation-references" && parts.length === 3) {
        await store.unlinkObservationReference(userId, parts[2]);
        sendNoContent(res);
        return;
      }

      if (method === "DELETE" && parts[0] === "api" && parts[1] === "observation-plan-finding-links" && parts.length === 3) {
        await store.unlinkObservationPlanFinding(userId, parts[2]);
        sendNoContent(res);
        return;
      }

      if (method === "GET" && parts.join("/") === "api/incidents") {
        const filters = incidentSearchSchema.parse(Object.fromEntries(url.searchParams.entries()));
        sendJson(res, 200, { incidents: await store.listIncidents(userId, filters) });
        return;
      }

      if (method === "POST" && parts.join("/") === "api/incidents") {
        const input = await readJson(req, incidentCreateSchema);
        sendJson(res, 201, {
          incident: await store.createIncident(userId, {
            ...input,
            incidentCategory: input.incidentCategory ?? "other",
            contractorInvestigationStatus: input.contractorInvestigationStatus ?? "unknown"
          })
        });
        return;
      }

      if (parts[0] === "api" && parts[1] === "incidents" && parts.length >= 3) {
        const incidentId = parts[2];
        if (method === "GET" && parts.length === 3) {
          const incident = await store.getIncident(userId, incidentId);
          if (!incident) sendJson(res, 404, { error: "Incident not found" });
          else sendJson(res, 200, { incident });
          return;
        }
        if (method === "PATCH" && parts.length === 3) {
          const incident = await store.updateIncident(userId, incidentId, await readJson(req, incidentUpdateSchema));
          if (!incident) sendJson(res, 404, { error: "Incident not found" });
          else sendJson(res, 200, { incident });
          return;
        }
        if (method === "POST" && parts[3] === "attachments" && parts.length === 4) {
          const attachment = await store.attachIncidentSource(userId, incidentId, await readJson(req, incidentAttachmentSchema));
          sendJson(res, 201, { attachment });
          return;
        }
        if (method === "POST" && parts[3] === "contractor-corrective-actions" && parts.length === 4) {
          const input = await readJson(req, contractorCorrectiveActionSchema);
          const action = await store.createContractorCorrectiveAction(userId, incidentId, {
            ...input,
            contractorStatus: input.contractorStatus ?? "provided",
            evidenceReceived: input.evidenceReceived ?? false
          });
          sendJson(res, 201, { correctiveAction: action });
          return;
        }
        if (method === "PUT" && parts[3] === "project-review" && parts.length === 4) {
          const input = await readJson(req, incidentProjectReviewSchema);
          const review = await store.upsertIncidentProjectReview(userId, incidentId, {
            ...input,
            managementReviewNeeded: input.managementReviewNeeded ?? false
          });
          sendJson(res, 200, { review });
          return;
        }
        if (method === "POST" && parts[3] === "recommendations" && parts.length === 4) {
          const input = await readJson(req, incidentRecommendationSchema);
          const recommendation = await store.createIncidentRecommendation(userId, incidentId, {
            ...input,
            status: input.status ?? "open"
          });
          sendJson(res, 201, { recommendation });
          return;
        }
        if (method === "POST" && parts[3] === "project-decisions" && parts.length === 4) {
          const input = await readJson(req, projectSafetyDecisionSchema);
          const decision = await store.createProjectSafetyDecision(userId, incidentId, {
            ...input,
            status: input.status ?? "active"
          });
          sendJson(res, 201, { decision });
          return;
        }
        if (method === "POST" && parts[3] === "follow-ups" && parts.length === 4) {
          const followUp = await store.createIncidentFollowUp(userId, incidentId, await readJson(req, incidentFollowUpSchema));
          sendJson(res, 201, { followUp });
          return;
        }
        if (method === "POST" && parts[3] === "links" && parts.length === 4) {
          const input = await readJson(req, incidentLinkSchema);
          const link = await store.linkIncidentRecord(userId, incidentId, {
            ...input,
            suggested: input.suggested ?? false,
            accepted: input.accepted ?? true
          });
          sendJson(res, 201, { link });
          return;
        }
        if (method === "POST" && parts[3] === "ai-review-runs" && parts.length === 4) {
          const incident = await store.runIncidentAiReview(userId, incidentId);
          if (!incident) sendJson(res, 404, { error: "Incident not found" });
          else sendJson(res, 201, { incident });
          return;
        }
        if (method === "POST" && parts[3] === "close" && parts.length === 4) {
          const incident = await store.closeIncident(userId, incidentId, await readJson(req, incidentCloseSchema));
          if (!incident) sendJson(res, 404, { error: "Incident not found" });
          else sendJson(res, 200, { incident });
          return;
        }
        if (method === "POST" && parts[3] === "reopen" && parts.length === 4) {
          const incident = await store.reopenIncident(userId, incidentId, await readJson(req, incidentReopenSchema));
          if (!incident) sendJson(res, 404, { error: "Incident not found" });
          else sendJson(res, 200, { incident });
          return;
        }
      }

      if (parts[0] === "api" && parts[1] === "incident-attachments" && parts.length === 3 && method === "DELETE") {
        await store.removeIncidentAttachment(userId, parts[2]);
        sendNoContent(res);
        return;
      }

      if (parts[0] === "api" && parts[1] === "contractor-corrective-actions" && parts.length === 3 && method === "PATCH") {
        const action = await store.updateContractorCorrectiveAction(userId, parts[2], await readJson(req, contractorCorrectiveActionUpdateSchema));
        if (!action) sendJson(res, 404, { error: "Corrective action not found" });
        else sendJson(res, 200, { correctiveAction: action });
        return;
      }

      if (parts[0] === "api" && parts[1] === "incident-recommendations" && parts.length === 3 && method === "PATCH") {
        const recommendation = await store.updateIncidentRecommendation(userId, parts[2], await readJson(req, incidentRecommendationUpdateSchema));
        if (!recommendation) sendJson(res, 404, { error: "Recommendation not found" });
        else sendJson(res, 200, { recommendation });
        return;
      }

      if (parts[0] === "api" && parts[1] === "incident-links" && parts.length === 3 && method === "DELETE") {
        await store.unlinkIncidentRecord(userId, parts[2]);
        sendNoContent(res);
        return;
      }

      if (method === "GET" && parts.join("/") === "api/sources") {
        const filters = sourceSearchSchema.parse(Object.fromEntries(url.searchParams.entries()));
        sendJson(res, 200, { sources: await store.listSources(userId, filters) });
        return;
      }

      if (method === "POST" && parts.join("/") === "api/sources/upload") {
        const form = await readMultipart(req, maxUploadBytes + 1024 * 1024);
        const metadata = sourceMetadataSchema.parse(form.fields);
        if (form.files.length === 0) {
          sendJson(res, 400, { error: "At least one file is required" });
          return;
        }
        if (metadata.projectId && !(await store.getProject(userId, metadata.projectId))) {
          sendJson(res, 404, { error: "Project not found" });
          return;
        }
        const created = [];
        for (const file of form.files) {
          const allowed = isAllowedFile(file.filename, file.mimeType, file.buffer.byteLength);
          if (!allowed.ok) {
            sendJson(res, 400, { error: allowed.reason });
            return;
          }
          const sourceId = randomUUID();
          const stored = await storage.put(file.buffer, { ownerUserId: userId, sourceId, originalFilename: file.filename });
          let source = await store.createSource(userId, {
            id: sourceId,
            title: metadata.title || file.filename,
            originalFilename: file.filename,
            mimeType: file.mimeType,
            sourceType: allowed.sourceType,
            scope: metadata.scope,
            projectId: metadata.projectId || null,
            authorityClassification: metadata.authorityClassification,
            userConfirmedClassification: metadata.userConfirmedClassification,
            aiSuggestedClassification: null,
            storageKey: stored.key,
            originalUrl: null,
            sizeBytes: stored.sizeBytes,
            processingStatus: "processing",
            extractionStatus: "processing",
            extractionVersion: null,
            failureReason: null,
            metadata: { storageLabel: storage.publicLabel(stored.key) }
          });
          const extraction = await extractSource({ sourceId, sourceType: allowed.sourceType, mimeType: file.mimeType, buffer: file.buffer });
          await store.addSourceChunks(userId, sourceId, materializeChunks(sourceId, extraction));
          source = await store.updateSourceProcessing(userId, sourceId, {
            processingStatus: extraction.status,
            extractionStatus: extraction.status,
            extractionVersion: extraction.extractionVersion,
            failureReason: extraction.failureReason,
            metadata: { ...source.metadata, ...extraction.metadata }
          });
          created.push(source);
        }
        sendJson(res, 201, { sources: created });
        return;
      }

      if (method === "POST" && parts.join("/") === "api/sources/url") {
        const input = await readJson(req, urlSourceCreateSchema);
        if (input.projectId && !(await store.getProject(userId, input.projectId))) {
          sendJson(res, 404, { error: "Project not found" });
          return;
        }
        const retrieved = await retrieveUrlText(input.url);
        const sourceId = randomUUID();
        let source = await store.createSource(userId, {
          id: sourceId,
          title: input.title || retrieved.title || input.url,
          originalFilename: null,
          mimeType: "text/html",
          sourceType: "url",
          scope: input.scope,
          projectId: input.projectId || null,
          authorityClassification: input.authorityClassification,
          userConfirmedClassification: input.userConfirmedClassification ?? false,
          aiSuggestedClassification: null,
          storageKey: null,
          originalUrl: retrieved.finalUrl,
          sizeBytes: Buffer.byteLength(retrieved.text),
          processingStatus: "processing",
          extractionStatus: "processing",
          extractionVersion: null,
          failureReason: null,
          metadata: retrieved.metadata
        });
        const extraction = await extractSource({ sourceId, sourceType: "url", mimeType: "text/html", text: retrieved.text, url: retrieved.finalUrl });
        await store.addSourceChunks(userId, sourceId, materializeChunks(sourceId, extraction));
        source = await store.updateSourceProcessing(userId, sourceId, {
          processingStatus: extraction.status,
          extractionStatus: extraction.status,
          extractionVersion: extraction.extractionVersion,
          failureReason: extraction.failureReason,
          metadata: { ...source.metadata, ...extraction.metadata }
        });
        sendJson(res, 201, { source });
        return;
      }

      if (method === "GET" && parts[0] === "api" && parts[1] === "sources" && parts.length === 3) {
        const source = await store.getSource(userId, parts[2]);
        if (!source) sendJson(res, 404, { error: "Source not found" });
        else sendJson(res, 200, { source });
        return;
      }

      if (method === "PATCH" && parts[0] === "api" && parts[1] === "sources" && parts.length === 3) {
        const source = await store.updateSource(userId, parts[2], await readJson(req, sourceUpdateSchema));
        if (!source) sendJson(res, 404, { error: "Source not found" });
        else sendJson(res, 200, { source });
        return;
      }

      if (method === "GET" && parts[0] === "api" && parts[1] === "sources" && parts[3] === "original") {
        const source = await store.getSource(userId, parts[2]);
        if (!source || !source.storageKey) {
          sendJson(res, 404, { error: "Original file not found" });
          return;
        }
        const original = await storage.get(source.storageKey);
        res.writeHead(200, {
          "content-type": source.mimeType,
          "content-length": String(original.byteLength),
          "content-disposition": `attachment; filename="${(source.originalFilename ?? "source").replace(/"/g, "")}"`
        });
        res.end(original);
        return;
      }

      if (method === "GET" && parts.join("/") === "api/source-chunks") {
        const filters = sourceSearchSchema.parse(Object.fromEntries(url.searchParams.entries()));
        sendJson(res, 200, { chunks: await store.searchSourceChunks(userId, filters) });
        return;
      }

      if (parts[0] === "api" && parts[1] === "projects" && parts[3] === "sources") {
        const projectId = parts[2];
        if (method === "GET" && parts.length === 4) {
          if (!(await store.getProject(userId, projectId))) {
            sendJson(res, 404, { error: "Project not found" });
            return;
          }
          sendJson(res, 200, { projectSources: await store.listProjectSources(userId, projectId) });
          return;
        }
        if (method === "POST" && parts.length === 4) {
          const link = await store.associateSourceToProject(userId, projectId, await readJson(req, projectSourceSchema));
          sendJson(res, 201, { projectSource: link });
          return;
        }
        if (method === "PATCH" && parts.length === 5) {
          const link = await store.updateProjectSourceActivation(userId, projectId, parts[4], await readJson(req, projectSourceActivationSchema));
          if (!link) sendJson(res, 404, { error: "Project source not found" });
          else sendJson(res, 200, { projectSource: link });
          return;
        }
        if (method === "DELETE" && parts.length === 5) {
          await store.removeSourceFromProject(userId, projectId, parts[4]);
          sendNoContent(res);
          return;
        }
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      if (error instanceof ZodError) {
        sendJson(res, 400, { error: "Validation failed", details: error.flatten() });
        return;
      }
      if (error instanceof SyntaxError) {
        sendJson(res, 400, { error: "Invalid JSON" });
        return;
      }
      if (error instanceof DuplicateEngagementError) {
        sendJson(res, 409, { error: error.message });
        return;
      }
      if (error instanceof DuplicateProjectSourceError) {
        sendJson(res, 409, { error: error.message });
        return;
      }
      if (error instanceof DuplicateRequirementApplicationError) {
        sendJson(res, 409, { error: error.message });
        return;
      }
      if (error instanceof DuplicateEvidenceAssociationError) {
        sendJson(res, 409, { error: error.message });
        return;
      }
      if (error instanceof DuplicatePlanRevisionSourceError) {
        sendJson(res, 409, { error: error.message });
        return;
      }
      if (
        error instanceof DuplicateObservationPhotoError ||
        error instanceof DuplicateObservationReferenceError ||
        error instanceof DuplicateObservationPlanFindingLinkError ||
        error instanceof DuplicateIncidentAttachmentError ||
        error instanceof DuplicateIncidentLinkError
      ) {
        sendJson(res, 409, { error: error.message });
        return;
      }
      if (error instanceof Error && (
        error.message === "Project not found" ||
        error.message === "Contractor not found" ||
        error.message === "Source not found" ||
        error.message === "Contractor engagement not found" ||
        error.message === "Readiness requirement not found" ||
        error.message === "Requirement status not found" ||
        error.message === "Safety plan not found" ||
        error.message === "Safety plan revision not found" ||
        error.message === "Plan review not found" ||
        error.message === "Incident not found" ||
        error.message === "Observation not found" ||
        error.message === "Plan finding not found"
      )) {
        sendJson(res, 404, { error: error.message });
        return;
      }
      if (error instanceof Error && (
        error.message === "Review source is not available to this project" ||
        error.message === "Observation engagement must belong to the selected project" ||
        error.message === "Observation photos must use image sources" ||
        error.message === "Photo source must belong to the observation project" ||
        error.message === "Incident engagement must belong to the selected project" ||
        error.message === "Incident source must belong to the selected project" ||
        error.message === "Plan extraction failed" ||
        error.message === "At least one review source is required"
      )) {
        sendJson(res, 400, { error: error.message });
        return;
      }
      if (error instanceof Error && (error.message.toLowerCase().includes("private network") || error.message.includes("Localhost") || error.message.includes("Only HTTP"))) {
        sendJson(res, 400, { error: error.message });
        return;
      }
      console.error(error);
      sendJson(res, 500, { error: "Unexpected server error" });
    }
  });
}
