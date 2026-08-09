import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  AuthorityClassification,
  Contractor,
  ContractorReadinessDetail,
  ContractorReadinessSummary,
  ContractorRequirementStatus,
  FieldObservation,
  ObservationClassification,
  ObservationDetail,
  ObservationFollowUpStatus,
  AffectedWorkDisposition,
  IncidentCategory,
  IncidentDetail,
  IncidentOversightStatus,
  IncidentRecord,
  IncidentRecommendationType,
  Project,
  ProjectContractorEngagement,
  ProjectSourceLink,
  ReportFormat,
  ReportType,
  AssistantActionDescriptor,
  AssistantConversation,
  AssistantConversationDetail,
  AssistantDashboard,
  AssistantRetrievalScope,
  AssistantSkill,
  InstructionDocument,
  MemoryEntry,
  ProposedAction,
  ReadinessRequirement,
  ReadinessStatus,
  SafetyReport,
  SafetyReportDetail,
  SafetyPlan,
  SafetyPlanDetail,
  PlanFinding,
  PlanFindingAuthority,
  PlanFindingType,
  SafetyPlanType,
  SourceDetail,
  SourceRecord,
  SourceScope,
  UserSummary
} from "../shared/contracts";
import "./styles.css";

type View = "sources" | "workspace" | "workbench";

const readinessStatusOptions: Array<{ value: ReadinessStatus; label: string }> = [
  { value: "required", label: "Required" },
  { value: "requested", label: "Requested" },
  { value: "received", label: "Received" },
  { value: "needs_review", label: "Needs review" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "replacement_requested", label: "Replacement requested" },
  { value: "not_applicable", label: "Not applicable" }
];

const planTypeOptions: Array<{ value: SafetyPlanType; label: string }> = [
  { value: "site_specific_safety_plan", label: "Site-Specific Safety Plan" },
  { value: "fall_protection_plan", label: "Fall Protection Plan" },
  { value: "excavation_plan", label: "Excavation Plan" },
  { value: "demolition_plan", label: "Demolition Plan" },
  { value: "confined_space_plan", label: "Confined Space Plan" },
  { value: "respiratory_protection_plan", label: "Respiratory Protection Plan" },
  { value: "lift_plan", label: "Lift Plan" },
  { value: "other", label: "Other" }
];

const findingTypeOptions: Array<{ value: PlanFindingType; label: string }> = [
  { value: "compliant", label: "Compliant" },
  { value: "revision_recommended", label: "Revision recommended" },
  { value: "deficiency", label: "Deficiency" },
  { value: "conflict", label: "Conflict" },
  { value: "reviewer_decision", label: "Reviewer decision" }
];

const findingAuthorityOptions: Array<{ value: PlanFindingAuthority; label: string }> = [
  { value: "regulatory_requirement", label: "Regulatory requirement" },
  { value: "project_requirement", label: "Project requirement" },
  { value: "recommendation", label: "Recommendation" },
  { value: "reviewer_decision", label: "Reviewer decision" }
];

const observationClassificationOptions: Array<{ value: ObservationClassification; label: string }> = [
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral / informational" },
  { value: "concern", label: "Concern" },
  { value: "corrected_in_field", label: "Corrected in field" },
  { value: "follow_up_required", label: "Follow-up required" }
];

const followUpOptions: Array<{ value: ObservationFollowUpStatus; label: string }> = [
  { value: "none", label: "None" },
  { value: "needed", label: "Follow-up needed" },
  { value: "verified_closed", label: "Verified / closed" }
];

const incidentCategoryOptions: Array<{ value: IncidentCategory; label: string }> = [
  { value: "injury_illness", label: "Injury / Illness" },
  { value: "first_aid", label: "First Aid" },
  { value: "recordable_reported_by_contractor", label: "Recordable reported by contractor" },
  { value: "near_miss", label: "Near Miss" },
  { value: "property_damage", label: "Property Damage" },
  { value: "vehicle", label: "Vehicle" },
  { value: "environmental", label: "Environmental" },
  { value: "equipment_damage", label: "Equipment Damage" },
  { value: "other", label: "Other" }
];

const incidentStatusOptions: Array<{ value: IncidentOversightStatus; label: string }> = [
  { value: "received", label: "Received" },
  { value: "under_project_review", label: "Under project review" },
  { value: "awaiting_contractor_information", label: "Awaiting contractor information" },
  { value: "follow_up_required", label: "Follow-up required" },
  { value: "verification_pending", label: "Verification pending" },
  { value: "closed", label: "Closed" }
];

const affectedWorkOptions: Array<{ value: AffectedWorkDisposition; label: string }> = [
  { value: "no_restriction", label: "No restriction" },
  { value: "additional_monitoring", label: "Additional monitoring" },
  { value: "affected_activity_paused", label: "Affected activity paused" },
  { value: "documentation_required", label: "Documentation required" },
  { value: "plan_revision_required", label: "Plan revision required" },
  { value: "management_review", label: "Management review" },
  { value: "cleared_to_resume", label: "Cleared to resume" }
];

const recommendationTypeOptions: Array<{ value: IncidentRecommendationType; label: string }> = [
  { value: "accept_contractor_actions", label: "Accept contractor actions" },
  { value: "request_clarification", label: "Request clarification" },
  { value: "request_additional_corrective_action", label: "Request additional corrective action" },
  { value: "request_workforce_communication", label: "Request workforce communication" },
  { value: "require_plan_revision", label: "Require plan revision" },
  { value: "require_supporting_documentation", label: "Require supporting documentation" },
  { value: "perform_field_verification", label: "Perform field verification" },
  { value: "pause_affected_activity", label: "Pause affected activity" },
  { value: "escalate_to_management", label: "Escalate to management" },
  { value: "no_additional_project_action", label: "No additional project action" }
];

const authorityOptions: Array<{ value: AuthorityClassification; label: string }> = [
  { value: "regulatory_requirement", label: "Regulatory requirement" },
  { value: "project_requirement", label: "Project requirement" },
  { value: "owner_requirement", label: "Owner requirement" },
  { value: "gc_policy", label: "GC policy" },
  { value: "general_reference", label: "General reference" },
  { value: "contractor_submission", label: "Contractor submission" },
  { value: "working_document", label: "Working document" },
  { value: "generated_artifact", label: "Generated artifact" }
];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const response = await fetch(path, {
    credentials: "include",
    headers: { ...(isForm ? {} : { "content-type": "application/json" }), ...(init?.headers ?? {}) },
    ...init
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error ?? "Request failed");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function App() {
  const [user, setUser] = useState<UserSummary | null | undefined>(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ user: UserSummary | null }>("/api/auth/session")
      .then((body) => setUser(body.user))
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) return <main className="centered">Loading private workspace...</main>;
  if (!user) return <LoginScreen onLogin={setUser} error={error} setError={setError} />;
  return <WorkspaceHome user={user} onLogout={() => setUser(null)} />;
}

function LoginScreen({
  onLogin,
  error,
  setError
}: {
  onLogin: (user: UserSummary) => void;
  error: string;
  setError: (error: string) => void;
}) {
  const [email, setEmail] = useState("owner@example.com");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = await api<{ user: UserSummary }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      onLogin(body.user);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to log in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="login-title">
        <p className="eyebrow">Private Safety Workspace</p>
        <h1 id="login-title">Project Intelligence</h1>
        <form onSubmit={submit} className="stack">
          <label htmlFor="login-email">
            Email
            <input id="login-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label htmlFor="login-password">
            Password
            <input id="login-password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="primary" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
        </form>
      </section>
    </main>
  );
}

function WorkspaceHome({ user, onLogout }: { user: UserSummary; onLogout: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [engagements, setEngagements] = useState<ProjectContractorEngagement[]>([]);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [projectSources, setProjectSources] = useState<ProjectSourceLink[]>([]);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<SourceDetail | null>(null);
  const [activeEngagementId, setActiveEngagementId] = useState<string | null>(null);
  const [readinessRequirements, setReadinessRequirements] = useState<ReadinessRequirement[]>([]);
  const [readinessSummaries, setReadinessSummaries] = useState<ContractorReadinessSummary[]>([]);
  const [activeReadiness, setActiveReadiness] = useState<ContractorReadinessDetail | null>(null);
  const [safetyPlans, setSafetyPlans] = useState<SafetyPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<SafetyPlanDetail | null>(null);
  const [observations, setObservations] = useState<FieldObservation[]>([]);
  const [activeObservationId, setActiveObservationId] = useState<string | null>(null);
  const [activeObservation, setActiveObservation] = useState<ObservationDetail | null>(null);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  const [activeIncident, setActiveIncident] = useState<IncidentDetail | null>(null);
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<SafetyReportDetail | null>(null);
  const [assistantDashboard, setAssistantDashboard] = useState<AssistantDashboard | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<AssistantConversationDetail | null>(null);
  const [activeView, setActiveView] = useState<View>("workspace");
  const [status, setStatus] = useState("Loading records...");
  const [error, setError] = useState("");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const activeEngagement = useMemo(
    () => engagements.find((engagement) => engagement.id === activeEngagementId) ?? null,
    [engagements, activeEngagementId]
  );

  async function loadSources(path = "/api/sources") {
    const body = await api<{ sources: SourceRecord[] }>(path);
    setSources(body.sources);
    return body.sources;
  }

  async function reloadProjectSources(projectId = selectedProjectId) {
    if (!projectId) {
      setProjectSources([]);
      return;
    }
    const body = await api<{ projectSources: ProjectSourceLink[] }>(`/api/projects/${projectId}/sources`);
    setProjectSources(body.projectSources);
  }

  async function reloadReadinessRequirements(projectId = selectedProjectId) {
    if (!projectId) {
      setReadinessRequirements([]);
      setReadinessSummaries([]);
      return;
    }
    const [requirementsBody, summariesBody] = await Promise.all([
      api<{ requirements: ReadinessRequirement[] }>(`/api/projects/${projectId}/readiness-requirements`),
      api<{ summaries: ContractorReadinessSummary[] }>(`/api/projects/${projectId}/readiness-summaries`)
    ]);
    setReadinessRequirements(requirementsBody.requirements);
    setReadinessSummaries(summariesBody.summaries);
  }

  async function reloadActiveReadiness(engagementId = activeEngagementId) {
    if (!engagementId) {
      setActiveReadiness(null);
      return;
    }
    const body = await api<{ readiness: ContractorReadinessDetail }>(`/api/engagements/${engagementId}/readiness`);
    setActiveReadiness(body.readiness);
    await reloadReadinessRequirements();
  }

  async function reloadSafetyPlans(engagementId = activeEngagementId) {
    if (!engagementId) {
      setSafetyPlans([]);
      setActivePlanId(null);
      setActivePlan(null);
      return;
    }
    const body = await api<{ plans: SafetyPlan[] }>(`/api/engagements/${engagementId}/safety-plans`);
    setSafetyPlans(body.plans);
    setActivePlanId((current) => current ?? body.plans[0]?.id ?? null);
  }

  async function reloadObservations(projectId = selectedProjectId) {
    if (!projectId) {
      setObservations([]);
      setActiveObservationId(null);
      setActiveObservation(null);
      return;
    }
    const body = await api<{ observations: FieldObservation[] }>(`/api/observations?projectId=${projectId}`);
    setObservations(body.observations);
    setActiveObservationId((current) => current ?? body.observations[0]?.id ?? null);
  }

  async function reloadActiveObservation(observationId = activeObservationId) {
    if (!observationId) {
      setActiveObservation(null);
      return;
    }
    const body = await api<{ observation: ObservationDetail }>(`/api/observations/${observationId}`);
    setActiveObservation(body.observation);
  }

  async function reloadIncidents(projectId = selectedProjectId) {
    if (!projectId) {
      setIncidents([]);
      setActiveIncidentId(null);
      setActiveIncident(null);
      return;
    }
    const body = await api<{ incidents: IncidentRecord[] }>(`/api/incidents?projectId=${projectId}`);
    setIncidents(body.incidents);
    setActiveIncidentId((current) => current ?? body.incidents[0]?.id ?? null);
  }

  async function reloadActiveIncident(incidentId = activeIncidentId) {
    if (!incidentId) {
      setActiveIncident(null);
      return;
    }
    const body = await api<{ incident: IncidentDetail }>(`/api/incidents/${incidentId}`);
    setActiveIncident(body.incident);
  }

  async function reloadReports(projectId = selectedProjectId) {
    if (!projectId) {
      setReports([]);
      setActiveReportId(null);
      setActiveReport(null);
      return;
    }
    const body = await api<{ reports: SafetyReport[] }>(`/api/reports?projectId=${projectId}`);
    setReports(body.reports);
    setActiveReportId((current) => current ?? body.reports[0]?.id ?? null);
  }

  async function reloadActiveReport(reportId = activeReportId) {
    if (!reportId) {
      setActiveReport(null);
      return;
    }
    const body = await api<{ report: SafetyReportDetail }>(`/api/reports/${reportId}`);
    setActiveReport(body.report);
  }

  async function reloadAssistant(projectId = selectedProjectId) {
    if (!projectId) {
      setAssistantDashboard(null);
      setActiveConversationId(null);
      setActiveConversation(null);
      return;
    }
    const body = await api<{ dashboard: AssistantDashboard }>(`/api/assistant/dashboard?projectId=${projectId}`);
    setAssistantDashboard(body.dashboard);
    setActiveConversationId((current) => current ?? body.dashboard.conversations[0]?.id ?? null);
  }

  async function reloadActiveConversation(conversationId = activeConversationId) {
    if (!conversationId) {
      setActiveConversation(null);
      return;
    }
    const body = await api<{ conversation: AssistantConversationDetail }>(`/api/assistant/conversations/${conversationId}`);
    setActiveConversation(body.conversation);
  }

  async function reloadActivePlan(planId = activePlanId) {
    if (!planId) {
      setActivePlan(null);
      return;
    }
    const body = await api<{ safetyPlan: SafetyPlanDetail }>(`/api/safety-plans/${planId}`);
    setActivePlan(body.safetyPlan);
  }

  async function refreshSourceContext(sourceId = activeSourceId) {
    await loadSources();
    await reloadProjectSources();
    if (sourceId) {
      const body = await api<{ source: SourceDetail }>(`/api/sources/${sourceId}`);
      setActiveSource(body.source);
    }
  }

  async function refresh() {
    setError("");
    setStatus("Loading records...");
    const [projectBody, contractorBody] = await Promise.all([
      api<{ projects: Project[] }>("/api/projects"),
      api<{ contractors: Contractor[] }>("/api/contractors"),
      loadSources()
    ]);
    setProjects(projectBody.projects);
    setContractors(contractorBody.contractors);
    setSelectedProjectId((current) => current ?? projectBody.projects[0]?.id ?? null);
    setStatus("");
  }

  useEffect(() => {
    refresh().catch((refreshError) => {
      setStatus("");
      setError(refreshError instanceof Error ? refreshError.message : "Unable to load records");
    });
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setEngagements([]);
      setProjectSources([]);
      setReadinessRequirements([]);
      setReadinessSummaries([]);
      setSafetyPlans([]);
      setActivePlanId(null);
      setActivePlan(null);
      setObservations([]);
      setActiveObservationId(null);
      setActiveObservation(null);
      setIncidents([]);
      setActiveIncidentId(null);
      setActiveIncident(null);
      setReports([]);
      setActiveReportId(null);
      setActiveReport(null);
      setAssistantDashboard(null);
      setActiveConversationId(null);
      setActiveConversation(null);
      return;
    }
    api<{ engagements: ProjectContractorEngagement[] }>(`/api/projects/${selectedProjectId}/contractors`)
      .then((body) => {
        setEngagements(body.engagements);
        setActiveEngagementId((current) => current ?? body.engagements[0]?.id ?? null);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load engagements"));
    reloadProjectSources(selectedProjectId).catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : "Unable to load project sources")
    );
    reloadReadinessRequirements(selectedProjectId).catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : "Unable to load readiness")
    );
    reloadObservations(selectedProjectId).catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : "Unable to load observations")
    );
    reloadIncidents(selectedProjectId).catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : "Unable to load incidents")
    );
    reloadReports(selectedProjectId).catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : "Unable to load reports")
    );
    reloadAssistant(selectedProjectId).catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : "Unable to load assistant")
    );
  }, [selectedProjectId]);

  useEffect(() => {
    if (!activeSourceId) {
      setActiveSource(null);
      return;
    }
    api<{ source: SourceDetail }>(`/api/sources/${activeSourceId}`)
      .then((body) => setActiveSource(body.source))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load source"));
  }, [activeSourceId]);

  useEffect(() => {
    reloadActiveReadiness(activeEngagementId).catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : "Unable to load contractor readiness")
    );
    reloadSafetyPlans(activeEngagementId).catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : "Unable to load safety plans")
    );
  }, [activeEngagementId]);

  useEffect(() => {
    reloadActivePlan(activePlanId).catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : "Unable to load plan review")
    );
  }, [activePlanId]);

  useEffect(() => {
    reloadActiveObservation(activeObservationId).catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : "Unable to load observation")
    );
  }, [activeObservationId]);

  useEffect(() => {
    reloadActiveIncident(activeIncidentId).catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : "Unable to load incident")
    );
  }, [activeIncidentId]);

  useEffect(() => {
    reloadActiveReport(activeReportId).catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : "Unable to load report")
    );
  }, [activeReportId]);

  useEffect(() => {
    reloadActiveConversation(activeConversationId).catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : "Unable to load assistant conversation")
    );
  }, [activeConversationId]);

  async function logout() {
    await api<void>("/api/auth/logout", { method: "POST" });
    onLogout();
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Signed in as {user.displayName}</p>
          <h1>Project Intelligence</h1>
        </div>
        <button className="ghost" onClick={logout}>Log out</button>
      </header>

      {error ? <p className="banner" role="alert">{error}</p> : null}
      {status ? <p className="banner muted">{status}</p> : null}

      <nav className="mobile-tabs" aria-label="Workspace panels">
        <button className={activeView === "sources" ? "active" : ""} onClick={() => setActiveView("sources")}>Sources</button>
        <button className={activeView === "workspace" ? "active" : ""} onClick={() => setActiveView("workspace")}>Workspace</button>
        <button className={activeView === "workbench" ? "active" : ""} onClick={() => setActiveView("workbench")}>Workbench</button>
      </nav>

      <section className="workspace-grid">
        <aside className={`panel left ${activeView === "sources" ? "show" : ""}`}>
          <ProjectPanel
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelect={(id) => {
              setSelectedProjectId(id);
              setActiveView("workspace");
            }}
            onCreated={(project) => {
              setProjects((current) => [project, ...current]);
              setSelectedProjectId(project.id);
              setActiveView("workspace");
            }}
          />
          <SourceNav
            sources={sources}
            projectSources={projectSources}
            activeSourceId={activeSourceId}
            onOpen={(id) => {
              setActiveSourceId(id);
              setActiveView("workspace");
            }}
            onSearch={async (query) => {
              await loadSources(query ? `/api/sources?q=${encodeURIComponent(query)}` : "/api/sources");
            }}
          />
        </aside>

        <section className={`panel center ${activeView === "workspace" ? "show" : ""}`}>
          <WorkspacePanel
            project={selectedProject}
            engagements={engagements}
            activeEngagement={activeEngagement}
            activeSource={activeSource}
            readiness={activeReadiness}
            summaries={readinessSummaries}
            activePlan={activePlan}
            activeObservation={activeObservation}
            activeIncident={activeIncident}
            activeReport={activeReport}
            assistantDashboard={assistantDashboard}
            activeConversation={activeConversation}
            onConversationChanged={async (conversationId) => {
              await reloadAssistant(selectedProjectId);
              if (conversationId) {
                setActiveConversationId(conversationId);
                await reloadActiveConversation(conversationId);
              }
            }}
          />
        </section>

        <aside className={`panel right ${activeView === "workbench" ? "show" : ""}`}>
          <SourceWorkbench
            project={selectedProject}
            sources={sources}
            projectSources={projectSources}
            activeSource={activeSource}
            onChanged={async (sourceId) => {
              await refreshSourceContext(sourceId);
              if (sourceId) setActiveSourceId(sourceId);
            }}
          />
          <ContractorPanel
            project={selectedProject}
            contractors={contractors}
            engagements={engagements}
            onContractorCreated={(contractor) => setContractors((current) => [contractor, ...current])}
            onEngagementCreated={(engagement) => {
              setEngagements((current) => [engagement, ...current]);
              setActiveEngagementId(engagement.id);
            }}
            activeEngagementId={activeEngagementId}
            onOpenEngagement={(id) => {
              setActiveEngagementId(id);
              setActiveView("workspace");
            }}
          />
          <ReadinessWorkbench
            project={selectedProject}
            activeEngagement={activeEngagement}
            requirements={readinessRequirements}
            readiness={activeReadiness}
            sources={sources}
            onChanged={reloadActiveReadiness}
          />
          <PlanReviewWorkbench
            activeEngagement={activeEngagement}
            sources={sources}
            plans={safetyPlans}
            activePlan={activePlan}
            activePlanId={activePlanId}
            onSelectPlan={setActivePlanId}
            onChanged={async (planId) => {
              await reloadSafetyPlans(activeEngagementId);
              if (planId) {
                setActivePlanId(planId);
                await reloadActivePlan(planId);
              } else {
                await reloadActivePlan();
              }
            }}
          />
          <FieldOperationsWorkbench
            project={selectedProject}
            engagements={engagements}
            observations={observations}
            activeObservationId={activeObservationId}
            onOpenObservation={(id) => {
              setActiveObservationId(id);
              setActivePlanId(null);
              setActiveSourceId(null);
              setActiveView("workspace");
            }}
            onChanged={async (observationId) => {
              await reloadObservations(selectedProjectId);
              if (observationId) {
                setActiveObservationId(observationId);
                await reloadActiveObservation(observationId);
              }
            }}
          />
          <IncidentOversightWorkbench
            project={selectedProject}
            engagements={engagements}
            incidents={incidents}
            observations={observations}
            activeIncident={activeIncident}
            activeIncidentId={activeIncidentId}
            onOpenIncident={(id) => {
              setActiveIncidentId(id);
              setActiveObservationId(null);
              setActivePlanId(null);
              setActiveSourceId(null);
              setActiveView("workspace");
            }}
            onChanged={async (incidentId) => {
              await reloadIncidents(selectedProjectId);
              if (incidentId) {
                setActiveIncidentId(incidentId);
                await reloadActiveIncident(incidentId);
              }
            }}
          />
          <ReportingWorkbench
            project={selectedProject}
            reports={reports}
            activeReport={activeReport}
            activeReportId={activeReportId}
            onOpenReport={(id) => {
              setActiveReportId(id);
              setActiveIncidentId(null);
              setActiveObservationId(null);
              setActivePlanId(null);
              setActiveSourceId(null);
              setActiveView("workspace");
            }}
            onChanged={async (reportId) => {
              await reloadReports(selectedProjectId);
              if (reportId) {
                setActiveReportId(reportId);
                await reloadActiveReport(reportId);
              }
            }}
          />
          <AssistantWorkbench
            project={selectedProject}
            dashboard={assistantDashboard}
            activeConversation={activeConversation}
            activeConversationId={activeConversationId}
            onOpenConversation={(id) => {
              setActiveConversationId(id);
              setActiveView("workspace");
            }}
            onChanged={async (conversationId) => {
              await reloadAssistant(selectedProjectId);
              if (conversationId) {
                setActiveConversationId(conversationId);
                await reloadActiveConversation(conversationId);
              }
            }}
          />
        </aside>
      </section>
    </main>
  );
}

function ProjectPanel({
  projects,
  selectedProjectId,
  onSelect,
  onCreated
}: {
  projects: Project[];
  selectedProjectId: string | null;
  onSelect: (id: string) => void;
  onCreated: (project: Project) => void;
}) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [classification, setClassification] = useState<"Federal" | "Non-Federal">("Non-Federal");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const body = await api<{ project: Project }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name, location, federalClassification: classification })
      });
      setName("");
      setLocation("");
      onCreated(body.project);
    } catch (projectError) {
      setError(projectError instanceof Error ? projectError.message : "Unable to create project");
    }
  }

  return (
    <>
      <h2>Projects</h2>
      <form onSubmit={submit} className="stack compact">
        <label htmlFor="project-name">Project name<input id="project-name" value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label htmlFor="project-location">Location<input id="project-location" value={location} onChange={(event) => setLocation(event.target.value)} required /></label>
        <label htmlFor="project-classification">
          Classification
          <select id="project-classification" value={classification} onChange={(event) => setClassification(event.target.value as "Federal" | "Non-Federal")}>
            <option>Non-Federal</option>
            <option>Federal</option>
          </select>
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="primary">Create blank project</button>
      </form>
      <div className="list">
        {projects.length === 0 ? <p className="empty">No projects yet. Create a blank project to begin.</p> : null}
        {projects.map((project) => (
          <button key={project.id} className={project.id === selectedProjectId ? "row active" : "row"} onClick={() => onSelect(project.id)}>
            <strong>{project.name}</strong>
            <span>{project.location} - {project.federalClassification}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function SourceNav({
  sources,
  projectSources,
  activeSourceId,
  onOpen,
  onSearch
}: {
  sources: SourceRecord[];
  projectSources: ProjectSourceLink[];
  activeSourceId: string | null;
  onOpen: (id: string) => void;
  onSearch: (query: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const activeIds = new Set(projectSources.filter((link) => link.activationStatus === "active").map((link) => link.sourceId));
  return (
    <section className="source-nav" aria-labelledby="sources-title">
      <h2 id="sources-title">Sources</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(query).catch(() => undefined);
        }}
        className="stack compact"
      >
        <label htmlFor="source-search">Search library<input id="source-search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <button className="secondary">Search sources</button>
      </form>
      <div className="list">
        {sources.length === 0 ? <p className="empty">No sources yet. Upload files or add a URL from the workbench.</p> : null}
        {sources.map((source) => (
          <button key={source.id} className={source.id === activeSourceId ? "row active" : "row"} onClick={() => onOpen(source.id)}>
            <strong>{source.title}</strong>
            <span>{source.scope} - {source.sourceType} - {source.processingStatus}{activeIds.has(source.id) ? " - active" : ""}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function WorkspacePanel({
  project,
  engagements,
  activeEngagement,
  activeSource,
  readiness,
  summaries,
  activePlan,
  activeObservation,
  activeIncident,
  activeReport,
  assistantDashboard,
  activeConversation,
  onConversationChanged
}: {
  project: Project | null;
  engagements: ProjectContractorEngagement[];
  activeEngagement: ProjectContractorEngagement | null;
  activeSource: SourceDetail | null;
  readiness: ContractorReadinessDetail | null;
  summaries: ContractorReadinessSummary[];
  activePlan: SafetyPlanDetail | null;
  activeObservation: ObservationDetail | null;
  activeIncident: IncidentDetail | null;
  activeReport: SafetyReportDetail | null;
  assistantDashboard: AssistantDashboard | null;
  activeConversation: AssistantConversationDetail | null;
  onConversationChanged: (conversationId?: string) => Promise<void>;
}) {
  if (!project) {
    return <div className="empty-state"><h2>No project open</h2><p>Create or select a blank project from the left panel.</p></div>;
  }

  return (
    <>
      <div className="project-heading">
        <div>
          <p className="eyebrow">{project.federalClassification}</p>
          <h2>{project.name}</h2>
        </div>
        <span>{project.location}</span>
      </div>
      <AssistantConsole project={project} dashboard={assistantDashboard} activeConversation={activeConversation} onChanged={onConversationChanged} />
      <section className="foundation-grid">
        <div>
          {activeReport ? (
            <SafetyReportView detail={activeReport} />
          ) : activeIncident ? (
            <IncidentOversightView detail={activeIncident} />
          ) : activeObservation ? (
            <FieldObservationView detail={activeObservation} />
          ) : activePlan ? (
            <PlanReviewView detail={activePlan} />
          ) : activeSource ? (
            <SourceDetailView source={activeSource} />
          ) : (
            <>
              <h3>Source workspace</h3>
              <p className="empty">Open a source to inspect metadata, extraction status, citation chunks, and original-file access.</p>
            </>
          )}
        </div>
        <div>
          <h3>Project contractors</h3>
          {engagements.length === 0 ? <p className="empty">No contractor engagements on this project yet.</p> : null}
          <ReadinessSummaryList summaries={summaries} engagements={engagements} />
          {activeEngagement ? (
            <article className="detail">
              <h4>{activeEngagement.contractor?.legalName}</h4>
              <p>{activeEngagement.contractor?.trade ?? "Trade not specified"}</p>
              <p>{activeEngagement.scopeSummary ?? "No scope summary entered."}</p>
            </article>
          ) : null}
          <ReadinessDetailView readiness={readiness} />
        </div>
      </section>
    </>
  );
}

function AssistantConsole({
  project,
  dashboard,
  activeConversation,
  onChanged
}: {
  project: Project;
  dashboard: AssistantDashboard | null;
  activeConversation: AssistantConversationDetail | null;
  onChanged: (conversationId?: string) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const context = activeConversation?.context;

  async function ensureConversation(): Promise<string> {
    if (activeConversation) return activeConversation.id;
    const created = await api<{ conversation: AssistantConversationDetail }>("/api/assistant/conversations", {
      method: "POST",
      body: JSON.stringify({ projectId: project.id, title: "Project assistant", retrievalScope: "current_project" })
    });
    await onChanged(created.conversation.id);
    return created.conversation.id;
  }

  async function send(message = prompt) {
    if (!message.trim()) return;
    setBusy(true);
    setError("");
    try {
      const conversationId = await ensureConversation();
      await api<{ conversation: AssistantConversationDetail }>(`/api/assistant/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: message })
      });
      setPrompt("");
      await onChanged(conversationId);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Assistant request failed");
    } finally {
      setBusy(false);
    }
  }

  const starters = ["What needs my attention?", "Summarize open follow-up.", "Prepare me for the project meeting.", "Draft this week's safety summary."];

  return (
    <section className="assistant-console" aria-labelledby="assistant-title">
      <div className="project-heading compact-heading">
        <div>
          <p className="eyebrow">Assistant</p>
          <h3 id="assistant-title">{activeConversation?.title ?? "Project assistant"}</h3>
        </div>
        <span>{context?.retrievalScope.replace(/_/g, " ") ?? "current project"}</span>
      </div>
      <div className="context-strip">
        <span>Project: {project.name}</span>
        <span>Contractor: {context?.contractorId ?? "None"}</span>
        <span>Skill: {dashboard?.skills.find((skill) => skill.id === context?.activeSkillId)?.name ?? "None"}</span>
      </div>
      <div className="starter-grid">
        {starters.map((starter) => <button key={starter} type="button" className="ghost" onClick={() => send(starter)}>{starter}</button>)}
      </div>
      <div className="assistant-messages">
        {activeConversation?.messages.length ? activeConversation.messages.map((message) => (
          <article key={message.id} className={`message ${message.role}`}>
            <p className="eyebrow">{message.role}</p>
            <pre>{message.content}</pre>
          </article>
        )) : <p className="empty">Start a project conversation. Responses show context used, evidence classes, active skill, and suggested bounded actions.</p>}
      </div>
      <form onSubmit={(event) => { event.preventDefault(); send(); }} className="assistant-composer">
        <label htmlFor="assistant-prompt">Assistant message<textarea id="assistant-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) send(); }} /></label>
        <button className="primary" disabled={busy || !prompt.trim()}>{busy ? "Working..." : "Send"}</button>
      </form>
      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}

function SafetyReportView({ detail }: { detail: SafetyReportDetail }) {
  const manifest = detail.currentRevision?.evidenceManifest;
  return (
    <section className="plan-review" aria-labelledby="report-title">
      <div className="project-heading compact-heading">
        <div>
          <p className="eyebrow">Safety reporting</p>
          <h3 id="report-title">{detail.title}</h3>
        </div>
        <span>{detail.status}</span>
      </div>
      <div className="review-columns">
        <article className="review-pane">
          <p className="eyebrow">Report record</p>
          <h4>{reportTypeLabel(detail.reportType)} - {reportFormatLabel(detail.format)}</h4>
          <p>{detail.periodStart} to {detail.periodEnd}</p>
          <p><strong>Generation:</strong> {detail.generationStatus}{detail.errorState ? ` - fallback: ${detail.errorState}` : ""}</p>
          <p><strong>Author:</strong> {detail.createdByUserId}</p>
          <p><strong>Reviewer:</strong> {detail.finalizedByUserId ?? "Not finalized"}</p>
        </article>
        <article className="review-pane">
          <p className="eyebrow">Evidence manifest</p>
          <h4>{manifest?.generatedAt ? new Date(manifest.generatedAt).toLocaleString() : "No draft generated"}</h4>
          {manifest ? (
            <>
              <p>{manifest.newDuringPeriod.observationIds.length} observations, {manifest.newDuringPeriod.incidentIds.length} incidents, {manifest.newDuringPeriod.readinessStatusIds.length} readiness updates in period.</p>
              <p>{manifest.carriedOpen.observationIds.length} open observations and {manifest.carriedOpen.incidentIds.length} open incidents carried forward.</p>
              <p>{manifest.sourceIds.length} preserved source reference{manifest.sourceIds.length === 1 ? "" : "s"}.</p>
            </>
          ) : <p className="empty">Generate a draft to capture evidence IDs.</p>}
        </article>
        <article className="review-pane">
          <p className="eyebrow">Revision history</p>
          <h4>{detail.revisions.length} revision{detail.revisions.length === 1 ? "" : "s"}</h4>
          {detail.revisions.slice(0, 5).map((revision) => (
            <p key={revision.id}>v{revision.revisionNumber} - {revision.status} - {new Date(revision.createdAt).toLocaleString()}</p>
          ))}
          <p>{detail.auditEvents.length} audit event{detail.auditEvents.length === 1 ? "" : "s"}</p>
        </article>
      </div>
      <pre className="recommendation-preview report-preview">{detail.currentRevision?.contentMarkdown ?? "No generated content yet."}</pre>
    </section>
  );
}

function FieldObservationView({ detail }: { detail: ObservationDetail }) {
  return (
    <section className="plan-review" aria-labelledby="observation-title">
      <div className="project-heading compact-heading">
        <div>
          <p className="eyebrow">Field observation</p>
          <h3 id="observation-title">{detail.category ?? "General observation"}</h3>
        </div>
        <span>{observationLabel(detail.derivedClassification) ?? "Unclassified"}</span>
      </div>
      <div className="review-columns">
        <article className="review-pane">
          <p className="eyebrow">Original note</p>
          <h4>{detail.engagement?.contractor?.legalName ?? "Project-level observation"}</h4>
          <p>{detail.originalText}</p>
          <p className="empty">{new Date(detail.observedAt).toLocaleString()} {detail.location ? `- ${detail.location}` : ""}</p>
        </article>
        <article className="review-pane">
          <p className="eyebrow">Reviewer fields</p>
          <h4>{detail.activity ?? "Activity not specified"}</h4>
          <p>{detail.derivedSummary ?? "No reviewer summary yet."}</p>
          <p><strong>Follow-up:</strong> {followUpLabel(detail.followUpStatus)}</p>
          {detail.followUpNote ? <p>{detail.followUpNote}</p> : null}
          {detail.recurrenceSummary ? <p className="suggested-text">{detail.recurrenceSummary}</p> : null}
        </article>
        <article className="review-pane">
          <p className="eyebrow">Suggestions / links</p>
          <h4>{detail.aiSuggestionStatus.replace(/_/g, " ")}</h4>
          <p>{detail.suggestedSummary ?? "No AI suggestions have been applied."}</p>
          <p>{detail.referenceLinks.length} reference suggestion{detail.referenceLinks.length === 1 ? "" : "s"} - {detail.planFindingLinks.length} plan finding link{detail.planFindingLinks.length === 1 ? "" : "s"}</p>
        </article>
      </div>
      <div className="readiness-strip">
        <span>{detail.photos.length} photo{detail.photos.length === 1 ? "" : "s"}</span>
        <span>{detail.auditEvents.length} audit event{detail.auditEvents.length === 1 ? "" : "s"}</span>
        <span>Original preserved</span>
      </div>
      {detail.photos.length > 0 ? (
        <div className="photo-strip">
          {detail.photos.map((photo) => (
            <a key={photo.id} href={`/api/sources/${photo.sourceId}/original`} target="_blank" rel="noreferrer">
              <img src={`/api/sources/${photo.sourceId}/original`} alt={photo.caption ?? photo.source?.title ?? "Observation photo"} />
              <span>{photo.caption ?? photo.source?.title ?? "Photo"}</span>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function IncidentOversightView({ detail }: { detail: IncidentDetail }) {
  return (
    <section className="plan-review" aria-labelledby="incident-title">
      <div className="project-heading compact-heading">
        <div>
          <p className="eyebrow">Incident oversight</p>
          <h3 id="incident-title">{incidentCategoryLabel(detail.incidentCategory)}</h3>
        </div>
        <span>{incidentStatusLabel(detail.oversightStatus)}</span>
      </div>
      <div className="review-columns">
        <article className="review-pane">
          <p className="eyebrow">Contractor-provided information</p>
          <h4>{detail.engagement?.contractor?.legalName ?? "Project / GC incident"}</h4>
          <p>{detail.factualDescription}</p>
          <p><strong>Contractor classification:</strong> {detail.contractorReportedClassification ?? "Not provided"}</p>
          <p><strong>Investigation:</strong> {detail.contractorInvestigationStatus.replace(/_/g, " ")}</p>
          <p>{detail.attachments.length} source attachment{detail.attachments.length === 1 ? "" : "s"}</p>
        </article>
        <article className="review-pane">
          <p className="eyebrow">GC / project review</p>
          <h4>{detail.activity ?? "Activity not specified"}</h4>
          <p>{detail.projectReview?.reviewerAnalysis ?? "No project review entered."}</p>
          <p><strong>Exposure:</strong> {detail.projectReview?.remainingExposure ?? "Not reviewed"}</p>
          <p><strong>Affected work:</strong> {affectedWorkLabel(detail.affectedWorkDisposition)}</p>
        </article>
        <article className="review-pane">
          <p className="eyebrow">Decisions / follow-up</p>
          <h4>{detail.projectDecisions.length} decision{detail.projectDecisions.length === 1 ? "" : "s"}</h4>
          <p>{detail.recommendations.length} recommendation{detail.recommendations.length === 1 ? "" : "s"} - {detail.followUps.length} follow-up record{detail.followUps.length === 1 ? "" : "s"}</p>
          <p>{detail.aiSummary ?? "AI suggestions have not been run."}</p>
          {detail.closureNote ? <p className="suggested-text">{detail.closureNote}</p> : null}
        </article>
      </div>
      <div className="readiness-strip">
        <span>{new Date(detail.incidentDateTime).toLocaleString()}</span>
        <span>{detail.location ?? "Location not specified"}</span>
        <span>{detail.auditEvents.length} audit event{detail.auditEvents.length === 1 ? "" : "s"}</span>
      </div>
    </section>
  );
}

function PlanReviewView({ detail }: { detail: SafetyPlanDetail }) {
  const currentRevision = detail.revisions.find((revision) => revision.id === detail.plan.currentRevisionId) ?? detail.revisions[detail.revisions.length - 1];
  const planText = currentRevision?.source?.title ?? detail.plan.title;
  const selectedFinding = detail.findings[0] ?? null;
  const reference = selectedFinding?.referenceSourceId
    ? detail.references.find((item) => item.sourceId === selectedFinding.referenceSourceId)
    : detail.references[0];
  return (
    <section className="plan-review" aria-labelledby="plan-review-title">
      <div className="project-heading compact-heading">
        <div>
          <p className="eyebrow">{planTypeLabel(detail.plan.planType)}</p>
          <h3 id="plan-review-title">{detail.plan.title}</h3>
        </div>
        <span>{detail.plan.reviewStatus === "approved" ? "Approved" : "Pending"}</span>
      </div>
      <div className="review-columns">
        <article className="review-pane">
          <p className="eyebrow">Original plan</p>
          <h4>{currentRevision?.revisionIdentifier ?? "No revision"}</h4>
          <p>{planText}</p>
          <p className="empty">Original source remains unchanged; review artifacts are separate.</p>
        </article>
        <article className="review-pane">
          <p className="eyebrow">Finding</p>
          {selectedFinding ? (
            <>
              <h4>{selectedFinding.title}</h4>
              <p><strong>{findingTypeLabel(selectedFinding.findingType)}</strong> - {findingAuthorityLabel(selectedFinding.authority)}</p>
              <p>{selectedFinding.reviewerExplanation ?? selectedFinding.aiExplanation}</p>
              {selectedFinding.recommendedRevisionText ? <p className="suggested-text">{selectedFinding.recommendedRevisionText}</p> : null}
            </>
          ) : <p className="empty">Run a review or add a finding to begin.</p>}
        </article>
        <article className="review-pane">
          <p className="eyebrow">Reference / recommendation</p>
          <h4>{reference?.source?.title ?? "No selected reference"}</h4>
          <p>{reference?.citationLabel ?? "Select review sources before running review."}</p>
          <pre className="recommendation-preview">{detail.review?.contractorFacingSummary || "No recommendation artifact drafted."}</pre>
        </article>
      </div>
      <div className="readiness-strip">
        <span>{detail.references.length} selected review source{detail.references.length === 1 ? "" : "s"}</span>
        <span>{detail.findings.length} finding{detail.findings.length === 1 ? "" : "s"}</span>
        <span>{detail.revisions.length} revision{detail.revisions.length === 1 ? "" : "s"}</span>
      </div>
    </section>
  );
}

function ReadinessSummaryList({
  summaries,
  engagements
}: {
  summaries: ContractorReadinessSummary[];
  engagements: ProjectContractorEngagement[];
}) {
  if (summaries.length === 0) return null;
  return (
    <div className="readiness-strip">
      {summaries.map((summary) => {
        const engagement = engagements.find((item) => item.id === summary.engagementId);
        return (
          <div key={summary.engagementId} className={`status-pill ${summary.overallStatus}`}>
            <strong>{engagement?.contractor?.legalName ?? "Contractor"}</strong>
            <span>{readinessLabel(summary.overallStatus)} - {summary.accepted}/{summary.totalRequired} accepted</span>
          </div>
        );
      })}
    </div>
  );
}

function ReadinessDetailView({ readiness }: { readiness: ContractorReadinessDetail | null }) {
  if (!readiness) return <p className="empty">Open a contractor engagement to review readiness requirements and evidence.</p>;
  return (
    <section className="readiness-detail" aria-labelledby="readiness-heading">
      <div className="project-heading compact-heading">
        <div>
          <p className="eyebrow">Contractor readiness</p>
          <h3 id="readiness-heading">{readinessLabel(readiness.summary.overallStatus)}</h3>
        </div>
        <span>{readiness.summary.accepted}/{readiness.summary.totalRequired} accepted</span>
      </div>
      <dl className="metadata-grid">
        <div><dt>Missing</dt><dd>{readiness.summary.missing}</dd></div>
        <div><dt>Needs review</dt><dd>{readiness.summary.needsReview}</dd></div>
        <div><dt>Attention</dt><dd>{readiness.summary.rejectedOrExpired}</dd></div>
        <div><dt>Not applicable</dt><dd>{readiness.summary.notApplicable}</dd></div>
      </dl>
      {readiness.summary.timingWarnings.length ? (
        <p className="form-error">{readiness.summary.timingWarnings.join(" ")}</p>
      ) : null}
      <div className="list">
        {readiness.requirements.length === 0 ? <p className="empty">No requirements have been applied to this engagement.</p> : null}
        {readiness.requirements.map((item) => (
          <article key={item.id} className="detail compact-detail">
            <strong>{item.requirement?.title ?? "Requirement"}</strong>
            <span>{statusLabel(item.status)} - {item.requirement?.category ?? "Other"}</span>
            {item.reviewerNotes ? <p>{item.reviewerNotes}</p> : null}
          </article>
        ))}
      </div>
      {readiness.metrics.length || readiness.competentPersons.length ? (
        <div className="readiness-strip">
          <span>{readiness.metrics.length} safety metric records</span>
          <span>{readiness.competentPersons.length} competent person records</span>
        </div>
      ) : null}
    </section>
  );
}

function SourceDetailView({ source }: { source: SourceDetail }) {
  return (
    <article className="source-detail">
      <p className="eyebrow">{source.scope} source</p>
      <h3>{source.title}</h3>
      <dl className="metadata-grid">
        <div><dt>Type</dt><dd>{source.sourceType}</dd></div>
        <div><dt>Authority</dt><dd>{authorityLabel(source.authorityClassification)}</dd></div>
        <div><dt>Processing</dt><dd>{source.processingStatus}</dd></div>
        <div><dt>Extraction</dt><dd>{source.extractionStatus}</dd></div>
      </dl>
      {source.failureReason ? <p className="form-error">{source.failureReason}</p> : null}
      <p className="empty">
        Original: {source.originalFilename ?? source.originalUrl ?? "No original file"} {source.storageKey ? <a href={`/api/sources/${source.id}/original`}>Download</a> : null}
      </p>
      <h4>Citation chunks</h4>
      {source.chunks.length === 0 ? <p className="empty">No extracted text chunks are available for this source.</p> : null}
      <div className="chunk-list">
        {source.chunks.map((chunk) => (
          <section className="chunk" key={chunk.id}>
            <strong>{chunk.locationLabel ?? `Chunk ${chunk.chunkIndex + 1}`}</strong>
            <p>{chunk.text}</p>
          </section>
        ))}
      </div>
    </article>
  );
}

function SourceWorkbench({
  project,
  sources,
  projectSources,
  activeSource,
  onChanged
}: {
  project: Project | null;
  sources: SourceRecord[];
  projectSources: ProjectSourceLink[];
  activeSource: SourceDetail | null;
  onChanged: (sourceId?: string) => Promise<void>;
}) {
  const [scope, setScope] = useState<SourceScope>("global");
  const [title, setTitle] = useState("");
  const [authority, setAuthority] = useState<AuthorityClassification>("general_reference");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [sourceToAssociate, setSourceToAssociate] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const projectSourceIds = new Set(projectSources.map((link) => link.sourceId));

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setError("");
    setStatus("Uploading and processing...");
    try {
      const form = new FormData();
      form.set("title", title || file.name);
      form.set("scope", scope);
      if (scope === "project" && project) form.set("projectId", project.id);
      form.set("authorityClassification", authority);
      form.set("userConfirmedClassification", "true");
      form.append("file", file, file.name);
      const body = await api<{ sources: SourceRecord[] }>("/api/sources/upload", { method: "POST", body: form });
      setTitle("");
      setFile(null);
      setStatus("Source processed.");
      await onChanged(body.sources[0]?.id);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setStatus("");
    }
  }

  async function addUrl(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("Retrieving URL...");
    try {
      const body = await api<{ source: SourceRecord }>("/api/sources/url", {
        method: "POST",
        body: JSON.stringify({
          title: title || url,
          scope,
          projectId: scope === "project" && project ? project.id : "",
          authorityClassification: authority,
          userConfirmedClassification: true,
          url
        })
      });
      setTitle("");
      setUrl("");
      await onChanged(body.source.id);
    } catch (urlError) {
      setError(urlError instanceof Error ? urlError.message : "URL intake failed");
    } finally {
      setStatus("");
    }
  }

  async function associate() {
    if (!project || !sourceToAssociate) return;
    await api<{ projectSource: ProjectSourceLink }>(`/api/projects/${project.id}/sources`, {
      method: "POST",
      body: JSON.stringify({ sourceId: sourceToAssociate, activationStatus: "associated" })
    });
    await onChanged(sourceToAssociate);
  }

  async function setActivation(statusValue: "associated" | "active") {
    if (!project || !activeSource) return;
    await api<{ projectSource: ProjectSourceLink }>(`/api/projects/${project.id}/sources/${activeSource.id}`, {
      method: "PATCH",
      body: JSON.stringify({ activationStatus: statusValue })
    });
    await onChanged(activeSource.id);
  }

  async function updateClassification() {
    if (!activeSource) return;
    await api<{ source: SourceRecord }>(`/api/sources/${activeSource.id}`, {
      method: "PATCH",
      body: JSON.stringify({ authorityClassification: authority, userConfirmedClassification: true })
    });
    await onChanged(activeSource.id);
  }

  return (
    <section className="workbench-section">
      <h2>Source intake</h2>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {status ? <p className="banner muted">{status}</p> : null}
      <form onSubmit={upload} className="stack compact upload-zone">
        <label htmlFor="source-title">Source title<input id="source-title" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label htmlFor="source-scope">
          Scope
          <select id="source-scope" value={scope} onChange={(event) => setScope(event.target.value as SourceScope)}>
            <option value="global">Global library</option>
            <option value="project" disabled={!project}>Current project</option>
          </select>
        </label>
        <label htmlFor="source-authority">
          Classification
          <select id="source-authority" value={authority} onChange={(event) => setAuthority(event.target.value as AuthorityClassification)}>
            {authorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label htmlFor="source-file">Upload file<input id="source-file" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        <button className="primary" disabled={!file}>Upload source</button>
      </form>
      <form onSubmit={addUrl} className="stack compact">
        <label htmlFor="source-url">URL source<input id="source-url" value={url} onChange={(event) => setUrl(event.target.value)} type="url" /></label>
        <button className="secondary" disabled={!url}>Add URL</button>
      </form>
      <div className="stack compact">
        <label htmlFor="associate-source">
          Associate global source
          <select id="associate-source" value={sourceToAssociate} onChange={(event) => setSourceToAssociate(event.target.value)} disabled={!project}>
            <option value="">Choose available source</option>
            {sources.filter((source) => source.scope === "global" && !projectSourceIds.has(source.id)).map((source) => (
              <option key={source.id} value={source.id}>{source.title}</option>
            ))}
          </select>
        </label>
        <button className="secondary" disabled={!project || !sourceToAssociate} onClick={associate} type="button">Associate to project</button>
      </div>
      <div className="stack compact">
        <h3>Project activation</h3>
        <button className="secondary" disabled={!activeSource} onClick={updateClassification} type="button">Confirm classification</button>
        <button className="secondary" disabled={!project || !activeSource || !projectSourceIds.has(activeSource.id)} onClick={() => setActivation("associated")}>Mark associated</button>
        <button className="primary" disabled={!project || !activeSource || !projectSourceIds.has(activeSource.id)} onClick={() => setActivation("active")}>Mark active</button>
      </div>
    </section>
  );
}

function ContractorPanel({
  project,
  contractors,
  engagements,
  onContractorCreated,
  onEngagementCreated,
  activeEngagementId,
  onOpenEngagement
}: {
  project: Project | null;
  contractors: Contractor[];
  engagements: ProjectContractorEngagement[];
  onContractorCreated: (contractor: Contractor) => void;
  onEngagementCreated: (engagement: ProjectContractorEngagement) => void;
  activeEngagementId: string | null;
  onOpenEngagement: (id: string) => void;
}) {
  const [legalName, setLegalName] = useState("");
  const [trade, setTrade] = useState("");
  const [selectedContractorId, setSelectedContractorId] = useState("");
  const [scopeSummary, setScopeSummary] = useState("");
  const [error, setError] = useState("");

  async function createContractor(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const body = await api<{ contractor: Contractor }>("/api/contractors", {
        method: "POST",
        body: JSON.stringify({ legalName, trade })
      });
      setLegalName("");
      setTrade("");
      setSelectedContractorId(body.contractor.id);
      onContractorCreated(body.contractor);
    } catch (contractorError) {
      setError(contractorError instanceof Error ? contractorError.message : "Unable to create contractor");
    }
  }

  async function addToProject(event: FormEvent) {
    event.preventDefault();
    if (!project) return;
    setError("");
    try {
      const body = await api<{ engagement: ProjectContractorEngagement }>(`/api/projects/${project.id}/contractors`, {
        method: "POST",
        body: JSON.stringify({ contractorId: selectedContractorId, scopeSummary })
      });
      setScopeSummary("");
      onEngagementCreated(body.engagement);
    } catch (engagementError) {
      setError(engagementError instanceof Error ? engagementError.message : "Unable to add contractor");
    }
  }

  return (
    <section className="workbench-section">
      <h2>Contractors</h2>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <form onSubmit={createContractor} className="stack compact">
        <label htmlFor="contractor-legal-name">Legal company name<input id="contractor-legal-name" value={legalName} onChange={(event) => setLegalName(event.target.value)} required /></label>
        <label htmlFor="contractor-trade">Trade or role<input id="contractor-trade" value={trade} onChange={(event) => setTrade(event.target.value)} /></label>
        <button className="secondary">Create contractor master</button>
      </form>
      <form onSubmit={addToProject} className="stack compact">
        <label htmlFor="engagement-contractor">
          Add existing contractor
          <select id="engagement-contractor" value={selectedContractorId} onChange={(event) => setSelectedContractorId(event.target.value)} disabled={!project}>
            <option value="">Choose contractor</option>
            {contractors.map((contractor) => <option key={contractor.id} value={contractor.id}>{contractor.legalName}</option>)}
          </select>
        </label>
        <label htmlFor="engagement-scope">Project scope<input id="engagement-scope" value={scopeSummary} onChange={(event) => setScopeSummary(event.target.value)} disabled={!project} /></label>
        <button className="primary" disabled={!project || !selectedContractorId}>Add to project</button>
      </form>
      <div className="list">
        {engagements.length === 0 ? <p className="empty">Project engagements will be listed here.</p> : null}
        {engagements.map((engagement) => (
          <button
            key={engagement.id}
            className={engagement.id === activeEngagementId ? "row active" : "row"}
            onClick={() => onOpenEngagement(engagement.id)}
          >
            <strong>{engagement.contractor?.legalName}</strong>
            <span>{engagement.scopeSummary ?? "Open contractor workspace"}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ReadinessWorkbench({
  project,
  activeEngagement,
  requirements,
  readiness,
  sources,
  onChanged
}: {
  project: Project | null;
  activeEngagement: ProjectContractorEngagement | null;
  requirements: ReadinessRequirement[];
  readiness: ContractorReadinessDetail | null;
  sources: SourceRecord[];
  onChanged: (engagementId?: string | null) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Safety Metrics");
  const [requirementSourceId, setRequirementSourceId] = useState("");
  const [requirementId, setRequirementId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [evidenceSourceId, setEvidenceSourceId] = useState("");
  const [reviewStatus, setReviewStatus] = useState<ReadinessStatus>("accepted");
  const [plannedMobilizationDate, setPlannedMobilizationDate] = useState("");
  const [metricType, setMetricType] = useState<"emr" | "trir" | "dart" | "other">("emr");
  const [metricValue, setMetricValue] = useState("");
  const [metricYear, setMetricYear] = useState(String(new Date().getFullYear()));
  const [personName, setPersonName] = useState("");
  const [designation, setDesignation] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const availableSources = sources.filter((source) => source.processingStatus === "ready");
  const requirementStatuses = readiness?.requirements ?? [];

  async function run(action: () => Promise<void>, message: string) {
    setError("");
    setStatus(message);
    try {
      await action();
      if (activeEngagement) await onChanged(activeEngagement.id);
    } catch (readinessError) {
      setError(readinessError instanceof Error ? readinessError.message : "Readiness update failed");
    } finally {
      setStatus("");
    }
  }

  async function createRequirement(event: FormEvent) {
    event.preventDefault();
    if (!project) return;
    await run(async () => {
      const body = await api<{ requirement: ReadinessRequirement }>(`/api/projects/${project.id}/readiness-requirements`, {
        method: "POST",
        body: JSON.stringify({
          title,
          category,
          sourceId: requirementSourceId,
          required: true,
          blocking: true
        })
      });
      setTitle("");
      setRequirementId(body.requirement.id);
    }, "Creating requirement...");
  }

  async function applyRequirement() {
    if (!activeEngagement || !requirementId) return;
    await run(async () => {
      const body = await api<{ status: ContractorRequirementStatus }>(`/api/engagements/${activeEngagement.id}/readiness/requirements`, {
        method: "POST",
        body: JSON.stringify({ requirementId })
      });
      setStatusId(body.status.id);
    }, "Applying requirement...");
  }

  async function attachEvidence() {
    if (!statusId || !evidenceSourceId) return;
    await run(async () => {
      await api<{ evidence: unknown }>("/api/readiness/evidence", {
        method: "POST",
        body: JSON.stringify({ requirementStatusId: statusId, sourceId: evidenceSourceId })
      });
    }, "Attaching evidence...");
  }

  async function updateStatus(nextStatus: ReadinessStatus) {
    if (!statusId) return;
    await run(async () => {
      await api<{ status: ContractorRequirementStatus }>(`/api/readiness/statuses/${statusId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus, plannedMobilizationDate })
      });
    }, "Updating readiness status...");
  }

  async function reviewEvidence() {
    const evidence = readiness?.evidence.find((item) => item.requirementStatusId === statusId);
    if (!evidence) return;
    await run(async () => {
      await api<{ evidence: unknown }>(`/api/readiness/evidence/${evidence.id}`, {
        method: "PATCH",
        body: JSON.stringify({ reviewStatus })
      });
    }, "Reviewing evidence...");
  }

  async function addMetric(event: FormEvent) {
    event.preventDefault();
    if (!activeEngagement || !evidenceSourceId) return;
    await run(async () => {
      await api<{ metric: unknown }>("/api/readiness/safety-metrics", {
        method: "POST",
        body: JSON.stringify({
          engagementId: activeEngagement.id,
          metricType,
          periodYear: metricYear,
          value: metricValue,
          sourceId: evidenceSourceId
        })
      });
      setMetricValue("");
    }, "Recording metric...");
  }

  async function addCompetentPerson(event: FormEvent) {
    event.preventDefault();
    if (!activeEngagement || !evidenceSourceId) return;
    await run(async () => {
      await api<{ competentPerson: unknown }>("/api/readiness/competent-persons", {
        method: "POST",
        body: JSON.stringify({
          engagementId: activeEngagement.id,
          personName,
          designation,
          authorizationSourceId: evidenceSourceId,
          reviewStatus: "needs_review"
        })
      });
      setPersonName("");
      setDesignation("");
    }, "Recording competent person...");
  }

  return (
    <section className="workbench-section">
      <h2>Readiness</h2>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {status ? <p className="banner muted">{status}</p> : null}
      <form onSubmit={createRequirement} className="stack compact">
        <label htmlFor="readiness-title">Requirement<input id="readiness-title" value={title} onChange={(event) => setTitle(event.target.value)} required disabled={!project} /></label>
        <label htmlFor="readiness-category">Category<input id="readiness-category" value={category} onChange={(event) => setCategory(event.target.value)} disabled={!project} /></label>
        <label htmlFor="readiness-source">
          Requirement source
          <select id="readiness-source" value={requirementSourceId} onChange={(event) => setRequirementSourceId(event.target.value)} disabled={!project}>
            <option value="">No citation source</option>
            {availableSources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
          </select>
        </label>
        <button className="secondary" disabled={!project || !title}>Create requirement</button>
      </form>
      <div className="stack compact">
        <label htmlFor="apply-requirement">
          Apply to engagement
          <select id="apply-requirement" value={requirementId} onChange={(event) => setRequirementId(event.target.value)} disabled={!activeEngagement}>
            <option value="">Choose requirement</option>
            {requirements.map((requirement) => <option key={requirement.id} value={requirement.id}>{requirement.title}</option>)}
          </select>
        </label>
        <button className="primary" disabled={!activeEngagement || !requirementId} type="button" onClick={applyRequirement}>Apply requirement</button>
      </div>
      <div className="stack compact">
        <label htmlFor="status-record">
          Requirement status
          <select id="status-record" value={statusId} onChange={(event) => setStatusId(event.target.value)} disabled={!activeEngagement}>
            <option value="">Choose applied requirement</option>
            {requirementStatuses.map((item) => <option key={item.id} value={item.id}>{item.requirement?.title ?? item.id} - {statusLabel(item.status)}</option>)}
          </select>
        </label>
        <label htmlFor="mobilization-date">Planned mobilization<input id="mobilization-date" type="date" value={plannedMobilizationDate} onChange={(event) => setPlannedMobilizationDate(event.target.value)} /></label>
        <label htmlFor="evidence-source">
          Evidence source
          <select id="evidence-source" value={evidenceSourceId} onChange={(event) => setEvidenceSourceId(event.target.value)} disabled={!activeEngagement}>
            <option value="">Choose received source</option>
            {availableSources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
          </select>
        </label>
        <button className="secondary" disabled={!statusId} type="button" onClick={() => updateStatus("requested")}>Mark requested</button>
        <button className="secondary" disabled={!statusId || !evidenceSourceId} type="button" onClick={attachEvidence}>Attach evidence</button>
        <label htmlFor="review-status">
          Review outcome
          <select id="review-status" value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as ReadinessStatus)}>
            {readinessStatusOptions.filter((option) => ["needs_review", "accepted", "rejected", "expired", "replacement_requested"].includes(option.value)).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <button className="primary" disabled={!statusId || !readiness?.evidence.some((item) => item.requirementStatusId === statusId)} type="button" onClick={reviewEvidence}>Review evidence</button>
        <button className="secondary" disabled={!statusId} type="button" onClick={() => updateStatus("not_applicable")}>Not applicable</button>
      </div>
      <form onSubmit={addMetric} className="stack compact">
        <h3>Safety metrics</h3>
        <label htmlFor="metric-type">
          Metric
          <select id="metric-type" value={metricType} onChange={(event) => setMetricType(event.target.value as typeof metricType)}>
            <option value="emr">EMR</option>
            <option value="trir">TRIR</option>
            <option value="dart">DART</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label htmlFor="metric-year">Year<input id="metric-year" value={metricYear} onChange={(event) => setMetricYear(event.target.value)} inputMode="numeric" /></label>
        <label htmlFor="metric-value">Value<input id="metric-value" value={metricValue} onChange={(event) => setMetricValue(event.target.value)} inputMode="decimal" /></label>
        <button className="secondary" disabled={!activeEngagement || !evidenceSourceId || !metricValue}>Record metric</button>
      </form>
      <form onSubmit={addCompetentPerson} className="stack compact">
        <h3>Competent person</h3>
        <label htmlFor="person-name">Name<input id="person-name" value={personName} onChange={(event) => setPersonName(event.target.value)} /></label>
        <label htmlFor="designation">Designation<input id="designation" value={designation} onChange={(event) => setDesignation(event.target.value)} /></label>
        <button className="secondary" disabled={!activeEngagement || !evidenceSourceId || !personName || !designation}>Record evidence</button>
      </form>
    </section>
  );
}

function PlanReviewWorkbench({
  activeEngagement,
  sources,
  plans,
  activePlan,
  activePlanId,
  onSelectPlan,
  onChanged
}: {
  activeEngagement: ProjectContractorEngagement | null;
  sources: SourceRecord[];
  plans: SafetyPlan[];
  activePlan: SafetyPlanDetail | null;
  activePlanId: string | null;
  onSelectPlan: (planId: string | null) => void;
  onChanged: (planId?: string | null) => Promise<void>;
}) {
  const [title, setTitle] = useState("Site-Specific Safety Plan");
  const [planType, setPlanType] = useState<SafetyPlanType>("site_specific_safety_plan");
  const [planSourceId, setPlanSourceId] = useState("");
  const [revisionIdentifier, setRevisionIdentifier] = useState("Rev 0");
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([]);
  const [findingTitle, setFindingTitle] = useState("");
  const [findingType, setFindingType] = useState<PlanFindingType>("reviewer_decision");
  const [findingAuthority, setFindingAuthority] = useState<PlanFindingAuthority>("reviewer_decision");
  const [findingText, setFindingText] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [revisionSourceId, setRevisionSourceId] = useState("");
  const [newRevisionLabel, setNewRevisionLabel] = useState("Rev 1");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const readySources = sources.filter((source) => source.processingStatus === "ready");
  const currentReview = activePlan?.review ?? null;

  useEffect(() => {
    setRecommendation(currentReview?.contractorFacingSummary ?? "");
    setInternalNotes(currentReview?.internalReviewerNotes ?? "");
  }, [currentReview?.id]);

  async function run(action: () => Promise<string | null | void>, message: string) {
    setError("");
    setStatus(message);
    try {
      const planId = await action();
      await onChanged(planId ?? activePlanId);
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "Plan review update failed");
    } finally {
      setStatus("");
    }
  }

  async function createPlan(event: FormEvent) {
    event.preventDefault();
    if (!activeEngagement || !planSourceId) return;
    await run(async () => {
      const body = await api<{ safetyPlan: SafetyPlanDetail }>(`/api/engagements/${activeEngagement.id}/safety-plans`, {
        method: "POST",
        body: JSON.stringify({
          engagementId: activeEngagement.id,
          title,
          planType,
          sourceId: planSourceId,
          revisionIdentifier
        })
      });
      setRevisionIdentifier("Rev 0");
      return body.safetyPlan.plan.id;
    }, "Creating plan record...");
  }

  async function runReview() {
    if (!activePlanId || selectedReferenceIds.length === 0) return;
    await run(async () => {
      await api<{ safetyPlan: SafetyPlanDetail }>(`/api/safety-plans/${activePlanId}/review-runs`, {
        method: "POST",
        body: JSON.stringify({
          selectedReferences: selectedReferenceIds.map((sourceId) => {
            const source = sources.find((item) => item.id === sourceId);
            return {
              sourceId,
              authorityClassification: source?.authorityClassification ?? "general_reference",
              citationLabel: source?.title ?? "Selected source"
            };
          })
        })
      });
    }, "Running selected-source review...");
  }

  async function updateFinding(finding: PlanFinding, patch: Partial<PlanFinding>) {
    await run(async () => {
      await api<{ finding: PlanFinding }>(`/api/plan-findings/${finding.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
    }, "Saving finding...");
  }

  async function addFinding(event: FormEvent) {
    event.preventDefault();
    if (!currentReview) return;
    await run(async () => {
      await api<{ finding: PlanFinding }>("/api/plan-findings", {
        method: "POST",
        body: JSON.stringify({
          reviewId: currentReview.id,
          title: findingTitle,
          findingType,
          authority: findingAuthority,
          reviewerExplanation: findingText,
          contractorFacingRecommendation: findingText,
          sortOrder: activePlan?.findings.length ?? 0
        })
      });
      setFindingTitle("");
      setFindingText("");
    }, "Adding reviewer finding...");
  }

  async function saveRecommendation() {
    if (!currentReview) return;
    await run(async () => {
      await api<{ review: unknown }>(`/api/plan-reviews/${currentReview.id}/recommendation`, {
        method: "PATCH",
        body: JSON.stringify({ contractorFacingSummary: recommendation, internalReviewerNotes: internalNotes })
      });
    }, "Saving recommendation...");
  }

  async function markApproved() {
    if (!activePlanId) return;
    await run(async () => {
      await api<{ safetyPlan: SafetyPlanDetail }>(`/api/safety-plans/${activePlanId}/approval`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved", reviewerNotes: "Approved by reviewer." })
      });
    }, "Approving plan...");
  }

  async function addRevision() {
    if (!activePlanId || !revisionSourceId) return;
    await run(async () => {
      await api<{ safetyPlan: SafetyPlanDetail }>(`/api/safety-plans/${activePlanId}/revisions`, {
        method: "POST",
        body: JSON.stringify({
          sourceId: revisionSourceId,
          revisionIdentifier: newRevisionLabel,
          priorRevisionId: activePlan?.plan.currentRevisionId ?? ""
        })
      });
    }, "Adding new revision...");
  }

  return (
    <section className="workbench-section">
      <h2>Plan review</h2>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {status ? <p className="banner muted">{status}</p> : null}
      <form onSubmit={createPlan} className="stack compact">
        <label htmlFor="plan-title">Plan title<input id="plan-title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={!activeEngagement} /></label>
        <label htmlFor="plan-type">
          Plan type
          <select id="plan-type" value={planType} onChange={(event) => setPlanType(event.target.value as SafetyPlanType)} disabled={!activeEngagement}>
            {planTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label htmlFor="plan-source">
          Submitted plan source
          <select id="plan-source" value={planSourceId} onChange={(event) => setPlanSourceId(event.target.value)} disabled={!activeEngagement}>
            <option value="">Choose source</option>
            {sources.map((source) => <option key={source.id} value={source.id}>{source.title} - {source.extractionStatus}</option>)}
          </select>
        </label>
        <label htmlFor="plan-revision">Revision<input id="plan-revision" value={revisionIdentifier} onChange={(event) => setRevisionIdentifier(event.target.value)} /></label>
        <button className="secondary" disabled={!activeEngagement || !planSourceId || !title}>Create plan record</button>
      </form>
      <div className="stack compact">
        <label htmlFor="active-plan">
          Open plan
          <select id="active-plan" value={activePlanId ?? ""} onChange={(event) => onSelectPlan(event.target.value || null)} disabled={!activeEngagement}>
            <option value="">Choose plan</option>
            {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title} - {plan.reviewStatus}</option>)}
          </select>
        </label>
        <label htmlFor="review-sources">
          Review sources
          <select id="review-sources" multiple value={selectedReferenceIds} onChange={(event) => setSelectedReferenceIds(Array.from(event.target.selectedOptions).map((option) => option.value))} disabled={!activePlan}>
            {readySources.map((source) => <option key={source.id} value={source.id}>{source.title} - {authorityLabel(source.authorityClassification)}</option>)}
          </select>
        </label>
        <button className="primary" type="button" disabled={!activePlan || selectedReferenceIds.length === 0} onClick={runReview}>Run review</button>
      </div>
      {activePlan?.findings.map((finding) => (
        <article className="detail compact-detail" key={finding.id}>
          <strong>{finding.title}</strong>
          <span>{findingTypeLabel(finding.findingType)} - {findingAuthorityLabel(finding.authority)}</span>
          <textarea value={finding.reviewerExplanation ?? ""} onChange={(event) => updateFinding(finding, { reviewerExplanation: event.target.value }).catch(() => undefined)} />
          <button className="secondary" type="button" onClick={() => updateFinding(finding, { resolved: !finding.resolved })}>{finding.resolved ? "Mark unresolved" : "Mark resolved"}</button>
          <button className="ghost" type="button" onClick={() => updateFinding(finding, { notApplicable: !finding.notApplicable })}>{finding.notApplicable ? "Applicable" : "Not applicable"}</button>
        </article>
      ))}
      <form onSubmit={addFinding} className="stack compact">
        <h3>Reviewer finding</h3>
        <label htmlFor="finding-title">Title<input id="finding-title" value={findingTitle} onChange={(event) => setFindingTitle(event.target.value)} /></label>
        <label htmlFor="finding-type">Finding type<select id="finding-type" value={findingType} onChange={(event) => setFindingType(event.target.value as PlanFindingType)}>{findingTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label htmlFor="finding-authority">Authority<select id="finding-authority" value={findingAuthority} onChange={(event) => setFindingAuthority(event.target.value as PlanFindingAuthority)}>{findingAuthorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label htmlFor="finding-text">Explanation<textarea id="finding-text" value={findingText} onChange={(event) => setFindingText(event.target.value)} /></label>
        <button className="secondary" disabled={!currentReview || !findingTitle}>Add finding</button>
      </form>
      <div className="stack compact">
        <h3>Recommendation artifact</h3>
        <label htmlFor="recommendation-text">Contractor-facing<textarea id="recommendation-text" value={recommendation} onChange={(event) => setRecommendation(event.target.value)} /></label>
        <label htmlFor="internal-notes">Internal notes<textarea id="internal-notes" value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} /></label>
        <button className="secondary" type="button" disabled={!currentReview} onClick={saveRecommendation}>Save artifact</button>
        <button className="primary" type="button" disabled={!activePlan || activePlan.plan.reviewStatus === "approved"} onClick={markApproved}>Approve plan</button>
      </div>
      <div className="stack compact">
        <h3>New revision</h3>
        <label htmlFor="revision-source">Revision source<select id="revision-source" value={revisionSourceId} onChange={(event) => setRevisionSourceId(event.target.value)} disabled={!activePlan}>{sources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}</select></label>
        <label htmlFor="revision-label">Revision label<input id="revision-label" value={newRevisionLabel} onChange={(event) => setNewRevisionLabel(event.target.value)} /></label>
        <button className="secondary" type="button" disabled={!activePlan || !revisionSourceId} onClick={addRevision}>Add revision</button>
      </div>
    </section>
  );
}

function FieldOperationsWorkbench({
  project,
  engagements,
  observations,
  activeObservationId,
  onOpenObservation,
  onChanged
}: {
  project: Project | null;
  engagements: ProjectContractorEngagement[];
  observations: FieldObservation[];
  activeObservationId: string | null;
  onOpenObservation: (id: string) => void;
  onChanged: (observationId?: string) => Promise<void>;
}) {
  const [engagementId, setEngagementId] = useState("");
  const [text, setText] = useState("");
  const [location, setLocation] = useState("");
  const [activity, setActivity] = useState("");
  const [category, setCategory] = useState("");
  const [classification, setClassification] = useState<ObservationClassification | "">("");
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [photos, setPhotos] = useState<FileList | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>, message: string) {
    setError("");
    setStatus(message);
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Field operation failed");
    } finally {
      setStatus("");
    }
  }

  async function createObservation(event: FormEvent) {
    event.preventDefault();
    if (!project) return;
    await run(async () => {
      const created = await api<{ observation: ObservationDetail }>("/api/observations", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          engagementId,
          originalText: text,
          location,
          activity,
          category,
          classification: classification || undefined,
          followUpNeeded
        })
      });
      if (photos) {
        for (const file of Array.from(photos)) {
          const form = new FormData();
          form.append("title", `${created.observation.category ?? "Observation photo"} - ${file.name}`);
          form.append("scope", "project");
          form.append("projectId", project.id);
          form.append("authorityClassification", "working_document");
          form.append("userConfirmedClassification", "true");
          form.append("file", file);
          const upload = await api<{ sources: SourceRecord[] }>("/api/sources/upload", { method: "POST", body: form });
          await api<{ photo: unknown }>(`/api/observations/${created.observation.id}/photos`, {
            method: "POST",
            body: JSON.stringify({ sourceId: upload.sources[0].id, caption: file.name })
          });
        }
      }
      setText("");
      setLocation("");
      setActivity("");
      setCategory("");
      setClassification("");
      setFollowUpNeeded(false);
      setPhotos(null);
      await onChanged(created.observation.id);
    }, "Saving observation...");
  }

  async function runSuggestions() {
    if (!activeObservationId) return;
    await run(async () => {
      await api<{ observation: ObservationDetail }>(`/api/observations/${activeObservationId}/enrichment-runs`, { method: "POST" });
      await onChanged(activeObservationId);
    }, "Processing suggestions...");
  }

  async function updateActive(input: Record<string, unknown>) {
    if (!activeObservationId) return;
    await run(async () => {
      await api<{ observation: ObservationDetail }>(`/api/observations/${activeObservationId}`, {
        method: "PATCH",
        body: JSON.stringify(input)
      });
      await onChanged(activeObservationId);
    }, "Updating observation...");
  }

  async function removeFirstPhoto() {
    if (!activeObservationId) return;
    const detail = await api<{ observation: ObservationDetail }>(`/api/observations/${activeObservationId}`);
    const first = detail.observation.photos[0];
    if (!first) return;
    await run(async () => {
      await api<void>(`/api/observation-photos/${first.id}`, { method: "DELETE" });
      await onChanged(activeObservationId);
    }, "Removing photo link...");
  }

  return (
    <section className="workbench-section">
      <h2>Field operations</h2>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {status ? <p className="banner muted">{status}</p> : null}
      <form onSubmit={createObservation} className="stack compact">
        <label htmlFor="observation-contractor">Contractor
          <select id="observation-contractor" value={engagementId} onChange={(event) => setEngagementId(event.target.value)} disabled={!project}>
            <option value="">Project-level / general</option>
            {engagements.map((engagement) => <option key={engagement.id} value={engagement.id}>{engagement.contractor?.legalName ?? engagement.contractorId}</option>)}
          </select>
        </label>
        <label htmlFor="observation-text">Observation<textarea id="observation-text" value={text} onChange={(event) => setText(event.target.value)} disabled={!project} /></label>
        <label htmlFor="observation-location">Location<input id="observation-location" value={location} onChange={(event) => setLocation(event.target.value)} /></label>
        <label htmlFor="observation-activity">Activity<input id="observation-activity" value={activity} onChange={(event) => setActivity(event.target.value)} /></label>
        <label htmlFor="observation-category">Category<input id="observation-category" value={category} onChange={(event) => setCategory(event.target.value)} /></label>
        <label htmlFor="observation-classification">Classification
          <select id="observation-classification" value={classification} onChange={(event) => setClassification(event.target.value as ObservationClassification | "")}>
            <option value="">Unclassified</option>
            {observationClassificationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="check-row" htmlFor="observation-follow-up"><input id="observation-follow-up" type="checkbox" checked={followUpNeeded} onChange={(event) => setFollowUpNeeded(event.target.checked)} />Follow-up needed</label>
        <label htmlFor="observation-photos">Photos<input id="observation-photos" type="file" accept="image/*" multiple onChange={(event) => setPhotos(event.target.files)} /></label>
        <button className="primary" disabled={!project || !text.trim()}>Save observation</button>
      </form>
      <div className="stack compact">
        <h3>Recent observations</h3>
        {observations.map((observation) => (
          <button key={observation.id} className={observation.id === activeObservationId ? "row active" : "row"} type="button" onClick={() => onOpenObservation(observation.id)}>
            <strong>{observation.engagement?.contractor?.legalName ?? "Project-level"}</strong>
            <span>{observation.category ?? "General"} - {observationLabel(observation.derivedClassification) ?? "Unclassified"} - {followUpLabel(observation.followUpStatus)}</span>
          </button>
        ))}
      </div>
      <div className="stack compact">
        <h3>Active observation</h3>
        <button className="secondary" type="button" disabled={!activeObservationId} onClick={runSuggestions}>Run suggestions</button>
        <label htmlFor="active-observation-classification">Classification
          <select id="active-observation-classification" disabled={!activeObservationId} onChange={(event) => updateActive({ derivedClassification: event.target.value }).catch(() => undefined)}>
            <option value="">Set classification</option>
            {observationClassificationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label htmlFor="active-observation-followup">Follow-up
          <select id="active-observation-followup" disabled={!activeObservationId} onChange={(event) => updateActive({ followUpStatus: event.target.value }).catch(() => undefined)}>
            <option value="">Set follow-up</option>
            {followUpOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button className="ghost" type="button" disabled={!activeObservationId} onClick={() => updateActive({ aiSuggestionsRejected: true })}>Reject suggestions</button>
        <button className="ghost" type="button" disabled={!activeObservationId} onClick={removeFirstPhoto}>Unlink first photo</button>
      </div>
    </section>
  );
}

function IncidentOversightWorkbench({
  project,
  engagements,
  incidents,
  observations,
  activeIncident,
  activeIncidentId,
  onOpenIncident,
  onChanged
}: {
  project: Project | null;
  engagements: ProjectContractorEngagement[];
  incidents: IncidentRecord[];
  observations: FieldObservation[];
  activeIncident: IncidentDetail | null;
  activeIncidentId: string | null;
  onOpenIncident: (id: string) => void;
  onChanged: (incidentId?: string) => Promise<void>;
}) {
  const [engagementId, setEngagementId] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<IncidentCategory>("near_miss");
  const [incidentDateTime, setIncidentDateTime] = useState(new Date().toISOString().slice(0, 16));
  const [location, setLocation] = useState("");
  const [activity, setActivity] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [actionText, setActionText] = useState("");
  const [recommendationType, setRecommendationType] = useState<IncidentRecommendationType>("request_clarification");
  const [recommendationText, setRecommendationText] = useState("");
  const [decisionText, setDecisionText] = useState("");
  const [followUpText, setFollowUpText] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>, message: string) {
    setError("");
    setStatus(message);
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Incident operation failed");
    } finally {
      setStatus("");
    }
  }

  async function createIncident(event: FormEvent) {
    event.preventDefault();
    if (!project) return;
    await run(async () => {
      const created = await api<{ incident: IncidentDetail }>("/api/incidents", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          engagementId,
          incidentDateTime: new Date(incidentDateTime).toISOString(),
          location,
          activity,
          factualDescription: description,
          incidentCategory: category,
          contractorInvestigationStatus: "unknown"
        })
      });
      setDescription("");
      await onChanged(created.incident.id);
    }, "Creating incident...");
  }

  async function updateActive(input: Record<string, unknown>, message = "Updating incident...") {
    if (!activeIncidentId) return;
    await run(async () => {
      await api<{ incident: IncidentDetail }>(`/api/incidents/${activeIncidentId}`, {
        method: "PATCH",
        body: JSON.stringify(input)
      });
      await onChanged(activeIncidentId);
    }, message);
  }

  async function saveReview() {
    if (!activeIncidentId) return;
    await run(async () => {
      await api<{ review: unknown }>(`/api/incidents/${activeIncidentId}/project-review`, {
        method: "PUT",
        body: JSON.stringify({ reviewerAnalysis: reviewText, remainingExposure: "Reviewer evaluation required.", managementReviewNeeded: false })
      });
      await onChanged(activeIncidentId);
    }, "Saving project review...");
  }

  async function addAction() {
    if (!activeIncidentId || !actionText.trim()) return;
    await run(async () => {
      await api<{ correctiveAction: unknown }>(`/api/incidents/${activeIncidentId}/contractor-corrective-actions`, {
        method: "POST",
        body: JSON.stringify({ description: actionText, contractorStatus: "provided" })
      });
      setActionText("");
      await onChanged(activeIncidentId);
    }, "Recording contractor action...");
  }

  async function addRecommendation() {
    if (!activeIncidentId || !recommendationText.trim()) return;
    await run(async () => {
      await api<{ recommendation: unknown }>(`/api/incidents/${activeIncidentId}/recommendations`, {
        method: "POST",
        body: JSON.stringify({ recommendationType, recommendationText })
      });
      setRecommendationText("");
      await onChanged(activeIncidentId);
    }, "Adding recommendation...");
  }

  async function addDecision() {
    if (!activeIncidentId || !decisionText.trim()) return;
    await run(async () => {
      await api<{ decision: unknown }>(`/api/incidents/${activeIncidentId}/project-decisions`, {
        method: "POST",
        body: JSON.stringify({ decisionText, appliesToScope: activeIncident?.affectedWorkScope ?? "", status: "active" })
      });
      setDecisionText("");
      await onChanged(activeIncidentId);
    }, "Creating project decision...");
  }

  async function addFollowUp() {
    if (!activeIncidentId || !followUpText.trim()) return;
    await run(async () => {
      await api<{ followUp: unknown }>(`/api/incidents/${activeIncidentId}/follow-ups`, {
        method: "POST",
        body: JSON.stringify({ status: "verified", verificationNote: followUpText })
      });
      setFollowUpText("");
      await onChanged(activeIncidentId);
    }, "Recording follow-up...");
  }

  return (
    <section className="workbench-section">
      <h2>Incident oversight</h2>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {status ? <p className="banner muted">{status}</p> : null}
      <form onSubmit={createIncident} className="stack compact">
        <label htmlFor="incident-contractor">Contractor
          <select id="incident-contractor" value={engagementId} onChange={(event) => setEngagementId(event.target.value)} disabled={!project}>
            <option value="">Project / GC incident</option>
            {engagements.map((engagement) => <option key={engagement.id} value={engagement.id}>{engagement.contractor?.legalName ?? engagement.contractorId}</option>)}
          </select>
        </label>
        <label htmlFor="incident-date">Incident date/time<input id="incident-date" type="datetime-local" value={incidentDateTime} onChange={(event) => setIncidentDateTime(event.target.value)} /></label>
        <label htmlFor="incident-category">Category<select id="incident-category" value={category} onChange={(event) => setCategory(event.target.value as IncidentCategory)}>{incidentCategoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label htmlFor="incident-location">Location<input id="incident-location" value={location} onChange={(event) => setLocation(event.target.value)} /></label>
        <label htmlFor="incident-activity">Activity<input id="incident-activity" value={activity} onChange={(event) => setActivity(event.target.value)} /></label>
        <label htmlFor="incident-description">Factual description<textarea id="incident-description" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <button className="primary" disabled={!project || !description.trim()}>Create incident</button>
      </form>
      <div className="stack compact">
        <h3>Incident register</h3>
        {incidents.map((incident) => (
          <button key={incident.id} className={incident.id === activeIncidentId ? "row active" : "row"} type="button" onClick={() => onOpenIncident(incident.id)}>
            <strong>{incident.engagement?.contractor?.legalName ?? "Project / GC incident"}</strong>
            <span>{incidentCategoryLabel(incident.incidentCategory)} - {incidentStatusLabel(incident.oversightStatus)} - {affectedWorkLabel(incident.affectedWorkDisposition)}</span>
          </button>
        ))}
      </div>
      <div className="stack compact">
        <h3>Project oversight</h3>
        <label htmlFor="incident-disposition">Affected work<select id="incident-disposition" disabled={!activeIncidentId} onChange={(event) => updateActive({ affectedWorkDisposition: event.target.value }, "Updating affected work...").catch(() => undefined)}><option value="">Set disposition</option>{affectedWorkOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label htmlFor="incident-review">GC review<textarea id="incident-review" value={reviewText} onChange={(event) => setReviewText(event.target.value)} /></label>
        <button className="secondary" type="button" disabled={!activeIncidentId} onClick={saveReview}>Save review</button>
        <label htmlFor="contractor-action">Contractor corrective action<textarea id="contractor-action" value={actionText} onChange={(event) => setActionText(event.target.value)} /></label>
        <button className="secondary" type="button" disabled={!activeIncidentId || !actionText.trim()} onClick={addAction}>Record contractor action</button>
        <label htmlFor="incident-recommendation-type">Recommendation type<select id="incident-recommendation-type" value={recommendationType} onChange={(event) => setRecommendationType(event.target.value as IncidentRecommendationType)}>{recommendationTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label htmlFor="incident-recommendation">Recommendation<textarea id="incident-recommendation" value={recommendationText} onChange={(event) => setRecommendationText(event.target.value)} /></label>
        <button className="secondary" type="button" disabled={!activeIncidentId || !recommendationText.trim()} onClick={addRecommendation}>Add recommendation</button>
        <label htmlFor="incident-decision">Project decision<textarea id="incident-decision" value={decisionText} onChange={(event) => setDecisionText(event.target.value)} /></label>
        <button className="secondary" type="button" disabled={!activeIncidentId || !decisionText.trim()} onClick={addDecision}>Create decision</button>
        <label htmlFor="incident-follow-up">Follow-up verification<textarea id="incident-follow-up" value={followUpText} onChange={(event) => setFollowUpText(event.target.value)} /></label>
        <button className="secondary" type="button" disabled={!activeIncidentId || !followUpText.trim()} onClick={addFollowUp}>Record follow-up</button>
        <button className="secondary" type="button" disabled={!activeIncidentId} onClick={() => activeIncidentId && api<{ incident: IncidentDetail }>(`/api/incidents/${activeIncidentId}/ai-review-runs`, { method: "POST" }).then(() => onChanged(activeIncidentId)).catch((aiError) => setError(aiError instanceof Error ? aiError.message : "AI review failed"))}>Run AI suggestions</button>
        <button className="primary" type="button" disabled={!activeIncidentId || activeIncident?.oversightStatus === "closed"} onClick={() => activeIncidentId && api<{ incident: IncidentDetail }>(`/api/incidents/${activeIncidentId}/close`, { method: "POST", body: JSON.stringify({ closureNote: "Project-level follow-up complete." }) }).then(() => onChanged(activeIncidentId)).catch((closeError) => setError(closeError instanceof Error ? closeError.message : "Close failed"))}>Close incident</button>
        <button className="ghost" type="button" disabled={!activeIncidentId || activeIncident?.oversightStatus !== "closed"} onClick={() => activeIncidentId && api<{ incident: IncidentDetail }>(`/api/incidents/${activeIncidentId}/reopen`, { method: "POST", body: JSON.stringify({ reason: "New evidence or follow-up requires review." }) }).then(() => onChanged(activeIncidentId)).catch((reopenError) => setError(reopenError instanceof Error ? reopenError.message : "Reopen failed"))}>Reopen</button>
      </div>
    </section>
  );
}

function ReportingWorkbench({
  project,
  reports,
  activeReport,
  activeReportId,
  onOpenReport,
  onChanged
}: {
  project: Project | null;
  reports: SafetyReport[];
  activeReport: SafetyReportDetail | null;
  activeReportId: string | null;
  onOpenReport: (id: string) => void;
  onChanged: (reportId?: string) => Promise<void>;
}) {
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [format, setFormat] = useState<ReportFormat>("narrative");
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [projectActivity, setProjectActivity] = useState("");
  const [plannedWork, setPlannedWork] = useState("");
  const [safetyEmphasis, setSafetyEmphasis] = useState("");
  const [meetingNote, setMeetingNote] = useState("");
  const [includeReadiness, setIncludeReadiness] = useState(true);
  const [includePlanReview, setIncludePlanReview] = useState(true);
  const [includeObservations, setIncludeObservations] = useState(true);
  const [includeIncidents, setIncludeIncidents] = useState(true);
  const [content, setContent] = useState("");
  const [archiveType, setArchiveType] = useState<"" | ReportType>("");
  const [archiveStatus, setArchiveStatus] = useState<"" | "draft" | "finalized">("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setContent(activeReport?.currentRevision?.contentMarkdown ?? "");
  }, [activeReport?.currentRevision?.id]);

  const filteredReports = reports
    .filter((report) => !archiveType || report.reportType === archiveType)
    .filter((report) => !archiveStatus || report.status === archiveStatus);

  async function run(action: () => Promise<void>, message: string) {
    setError("");
    setStatus(message);
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Report operation failed");
    } finally {
      setStatus("");
    }
  }

  async function createReport(event: FormEvent) {
    event.preventDefault();
    if (!project) return;
    await run(async () => {
      const created = await api<{ report: SafetyReportDetail }>("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          reportType,
          format,
          periodStart,
          periodEnd,
          title,
          scope: {
            includeContractors: true,
            includeReadiness,
            includePlanReview,
            includeObservations,
            includeIncidents,
            includeOpenFollowUp: true,
            includeProjectDecisions: true,
            includeUpcomingFocus: true
          },
          manualInputs: { projectActivity, plannedWork, safetyEmphasis, meetingNote }
        })
      });
      setTitle("");
      await onChanged(created.report.id);
    }, "Creating report...");
  }

  async function generateReport(preserveExisting = true) {
    if (!activeReportId) return;
    await run(async () => {
      const generated = await api<{ report: SafetyReportDetail }>(`/api/reports/${activeReportId}/generate`, {
        method: "POST",
        body: JSON.stringify({ preserveExisting })
      });
      setContent(generated.report.currentRevision?.contentMarkdown ?? "");
      await onChanged(activeReportId);
    }, "Generating report draft...");
  }

  async function saveContent() {
    if (!activeReport?.currentRevision) return;
    await run(async () => {
      await api<{ revision: unknown }>(`/api/report-revisions/${activeReport.currentRevision!.id}`, {
        method: "PATCH",
        body: JSON.stringify({ contentMarkdown: content })
      });
      await onChanged(activeReport.id);
    }, "Saving report revision...");
  }

  async function finalizeReport() {
    if (!activeReportId) return;
    await run(async () => {
      await api<{ report: SafetyReportDetail }>(`/api/reports/${activeReportId}/finalize`, {
        method: "POST",
        body: JSON.stringify({ reviewerNote: "Finalized by project user." })
      });
      await onChanged(activeReportId);
    }, "Finalizing report...");
  }

  async function createRevision() {
    if (!activeReportId) return;
    await run(async () => {
      await api<{ report: SafetyReportDetail }>(`/api/reports/${activeReportId}/revisions`, { method: "POST" });
      await onChanged(activeReportId);
    }, "Creating revision...");
  }

  return (
    <section className="workbench-section">
      <h2>Safety reports</h2>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {status ? <p className="banner muted">{status}</p> : null}
      <form onSubmit={createReport} className="stack compact">
        <label htmlFor="report-type">Type
          <select id="report-type" value={reportType} onChange={(event) => setReportType(event.target.value as ReportType)} disabled={!project}>
            {(["daily", "weekly", "monthly", "custom"] as ReportType[]).map((value) => <option key={value} value={value}>{reportTypeLabel(value)}</option>)}
          </select>
        </label>
        <label htmlFor="report-format">Format
          <select id="report-format" value={format} onChange={(event) => setFormat(event.target.value as ReportFormat)}>
            <option value="narrative">Narrative</option>
            <option value="structured">Structured</option>
          </select>
        </label>
        <div className="two-col">
          <label htmlFor="report-start">Start<input id="report-start" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
          <label htmlFor="report-end">End<input id="report-end" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
        </div>
        <label htmlFor="report-title-input">Title<input id="report-title-input" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label htmlFor="report-activity">Project activity<textarea id="report-activity" value={projectActivity} onChange={(event) => setProjectActivity(event.target.value)} /></label>
        <label htmlFor="report-meeting">Meeting note<textarea id="report-meeting" value={meetingNote} onChange={(event) => setMeetingNote(event.target.value)} /></label>
        <label htmlFor="report-planned">Planned work<textarea id="report-planned" value={plannedWork} onChange={(event) => setPlannedWork(event.target.value)} /></label>
        <label htmlFor="report-emphasis">Safety emphasis<textarea id="report-emphasis" value={safetyEmphasis} onChange={(event) => setSafetyEmphasis(event.target.value)} /></label>
        <div className="scope-grid">
          <label><input type="checkbox" checked={includeReadiness} onChange={(event) => setIncludeReadiness(event.target.checked)} /> Readiness</label>
          <label><input type="checkbox" checked={includePlanReview} onChange={(event) => setIncludePlanReview(event.target.checked)} /> Plans</label>
          <label><input type="checkbox" checked={includeObservations} onChange={(event) => setIncludeObservations(event.target.checked)} /> Observations</label>
          <label><input type="checkbox" checked={includeIncidents} onChange={(event) => setIncludeIncidents(event.target.checked)} /> Incidents</label>
        </div>
        <button className="primary" disabled={!project}>Create report</button>
      </form>
      <div className="stack compact">
        <h3>Archive</h3>
        <div className="two-col">
          <label htmlFor="archive-type">Type<select id="archive-type" value={archiveType} onChange={(event) => setArchiveType(event.target.value as "" | ReportType)}><option value="">All</option>{(["daily", "weekly", "monthly", "custom"] as ReportType[]).map((value) => <option key={value} value={value}>{reportTypeLabel(value)}</option>)}</select></label>
          <label htmlFor="archive-status">Status<select id="archive-status" value={archiveStatus} onChange={(event) => setArchiveStatus(event.target.value as "" | "draft" | "finalized")}><option value="">All</option><option value="draft">Draft</option><option value="finalized">Finalized</option></select></label>
        </div>
        {filteredReports.map((report) => (
          <button key={report.id} className={report.id === activeReportId ? "row active" : "row"} type="button" onClick={() => onOpenReport(report.id)}>
            <strong>{report.title}</strong>
            <span>{reportTypeLabel(report.reportType)} - {report.periodStart} to {report.periodEnd} - {report.status}</span>
          </button>
        ))}
      </div>
      <div className="stack compact">
        <h3>Active report</h3>
        <button className="secondary" type="button" disabled={!activeReportId} onClick={() => generateReport(true)}>Generate draft</button>
        <button className="ghost" type="button" disabled={!activeReportId} onClick={() => generateReport(false)}>Regenerate current draft</button>
        <label htmlFor="report-content">Editable content<textarea id="report-content" className="tall-textarea" value={content} onChange={(event) => setContent(event.target.value)} disabled={!activeReport?.currentRevision} /></label>
        <button className="secondary" type="button" disabled={!activeReport?.currentRevision} onClick={saveContent}>Save edit</button>
        <button className="secondary" type="button" disabled={!activeReportId} onClick={createRevision}>New revision</button>
        <button className="primary" type="button" disabled={!activeReport?.currentRevision || activeReport.status === "finalized"} onClick={finalizeReport}>Finalize</button>
        <a className={`button-link ${activeReport?.currentRevision ? "" : "disabled"}`} href={activeReport?.currentRevision ? `/api/reports/${activeReport.id}/export` : undefined} target="_blank" rel="noreferrer">Export HTML</a>
      </div>
    </section>
  );
}

function AssistantWorkbench({
  project,
  dashboard,
  activeConversation,
  activeConversationId,
  onOpenConversation,
  onChanged
}: {
  project: Project | null;
  dashboard: AssistantDashboard | null;
  activeConversation: AssistantConversationDetail | null;
  activeConversationId: string | null;
  onOpenConversation: (id: string) => void;
  onChanged: (conversationId?: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("Project assistant");
  const [scope, setScope] = useState<AssistantRetrievalScope>("current_project");
  const [memoryContent, setMemoryContent] = useState("");
  const [instructionMarkdown, setInstructionMarkdown] = useState("Use concise, evidence-grounded responses. Do not bypass confirmation.");
  const [skillName, setSkillName] = useState("Project Meeting Brief");
  const [skillDescription, setSkillDescription] = useState("Prepare a project meeting brief from bounded project context.");
  const [skillTrigger, setSkillTrigger] = useState("Use when preparing for project coordination meetings.");
  const [skillMarkdown, setSkillMarkdown] = useState("# Project Meeting Brief\n\nRead open readiness, observations, incidents, decisions, and reports. Draft a meeting brief without committing operational changes.");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>, message: string) {
    setStatus(message);
    setError("");
    try {
      await action();
    } catch (workbenchError) {
      setError(workbenchError instanceof Error ? workbenchError.message : "Assistant operation failed");
    } finally {
      setStatus("");
    }
  }

  async function createConversation() {
    if (!project) return;
    await run(async () => {
      const created = await api<{ conversation: AssistantConversationDetail }>("/api/assistant/conversations", { method: "POST", body: JSON.stringify({ projectId: project.id, title, retrievalScope: scope }) });
      await onChanged(created.conversation.id);
    }, "Creating conversation...");
  }

  async function updateScope(nextScope: AssistantRetrievalScope) {
    if (!activeConversationId) return;
    setScope(nextScope);
    await run(async () => {
      await api<{ conversation: AssistantConversationDetail }>(`/api/assistant/conversations/${activeConversationId}`, { method: "PATCH", body: JSON.stringify({ retrievalScope: nextScope }) });
      await onChanged(activeConversationId);
    }, "Updating scope...");
  }

  async function saveMemory(scopeValue: "global" | "project") {
    if (!project || !memoryContent.trim()) return;
    await run(async () => {
      await api<{ memoryEntry: MemoryEntry }>("/api/memory", { method: "POST", body: JSON.stringify({ scope: scopeValue, projectId: scopeValue === "project" ? project.id : "", content: memoryContent, provenanceType: "manual_editor" }) });
      setMemoryContent("");
      await onChanged(activeConversationId ?? undefined);
    }, "Saving memory...");
  }

  async function saveInstruction(scopeValue: "global" | "project") {
    if (!project) return;
    await run(async () => {
      await api<{ instruction: InstructionDocument }>("/api/instructions", { method: "POST", body: JSON.stringify({ scope: scopeValue, projectId: scopeValue === "project" ? project.id : "", area: "general", title: scopeValue === "project" ? "Project Instructions" : "Global Instructions", markdown: instructionMarkdown }) });
      await onChanged(activeConversationId ?? undefined);
    }, "Saving instructions...");
  }

  async function saveSkill(scopeValue: "global" | "project") {
    if (!project) return;
    await run(async () => {
      await api<{ skill: AssistantSkill }>("/api/skills", { method: "POST", body: JSON.stringify({ scope: scopeValue, projectId: scopeValue === "project" ? project.id : "", name: skillName, description: skillDescription, triggerDescription: skillTrigger, guidedPurpose: skillDescription, guidedInputs: "Project context and explicit user question.", guidedOutputs: "Draft artifact or bounded proposed action.", guidedRules: "Use registered actions only.", guidedAuthorityLimits: "No authoritative writes without confirmation.", markdown: skillMarkdown, active: true }) });
      await onChanged(activeConversationId ?? undefined);
    }, "Saving skill...");
  }

  async function activateSkill(skillId: string) {
    if (!activeConversationId) return;
    await run(async () => {
      await api<{ conversation: AssistantConversationDetail }>(`/api/assistant/conversations/${activeConversationId}/active-skill`, { method: "POST", body: JSON.stringify({ activeSkillId: skillId }) });
      await onChanged(activeConversationId);
    }, "Activating skill...");
  }

  async function invoke(actionName: string) {
    if (!project) return;
    await run(async () => {
      await api<unknown>("/api/assistant/actions/invoke", { method: "POST", body: JSON.stringify({ conversationId: activeConversationId ?? undefined, actionName, input: { projectId: project.id, content: memoryContent || "Remember this confirmed project preference." } }) });
      await onChanged(activeConversationId ?? undefined);
    }, "Running assistant action...");
  }

  async function proposal(id: string, decision: "confirm" | "reject") {
    await run(async () => {
      await api<{ proposal: ProposedAction }>(`/api/proposed-actions/${id}/${decision}`, { method: "POST", body: JSON.stringify(decision === "confirm" ? { confirmationNote: "Confirmed by authenticated user." } : { rejectionReason: "Rejected by user." }) });
      await onChanged(activeConversationId ?? undefined);
    }, `${decision === "confirm" ? "Confirming" : "Rejecting"} proposal...`);
  }

  return (
    <section className="workbench-section">
      <h2>Assistant workbench</h2>
      {error ? <p className="form-error">{error}</p> : null}
      {status ? <p className="banner muted">{status}</p> : null}
      <div className="stack compact">
        <h3>Conversations</h3>
        <label htmlFor="assistant-title-input">Title<input id="assistant-title-input" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label htmlFor="assistant-scope">Scope<select id="assistant-scope" value={activeConversation?.context.retrievalScope ?? scope} onChange={(event) => updateScope(event.target.value as AssistantRetrievalScope)} disabled={!activeConversationId}>{["current_project", "current_contractor", "selected_projects", "global_library", "entire_workspace"].map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label>
        <button className="primary" type="button" disabled={!project} onClick={createConversation}>New conversation</button>
        {dashboard?.conversations.map((conversation: AssistantConversation) => <button key={conversation.id} className={conversation.id === activeConversationId ? "row active" : "row"} type="button" onClick={() => onOpenConversation(conversation.id)}><strong>{conversation.title}</strong><span>{conversation.context.retrievalScope.replace(/_/g, " ")}</span></button>)}
      </div>
      <div className="stack compact">
        <h3>Memory</h3>
        <label htmlFor="memory-content">Markdown memory<textarea id="memory-content" value={memoryContent} onChange={(event) => setMemoryContent(event.target.value)} /></label>
        <button className="secondary" type="button" onClick={() => saveMemory("project")}>Save Project Memory</button>
        <button className="ghost" type="button" onClick={() => saveMemory("global")}>Save Global Memory</button>
        {dashboard?.memoryEntries.slice(0, 4).map((entry) => <p key={entry.id} className="empty">{entry.scope}: {entry.content}</p>)}
      </div>
      <div className="stack compact">
        <h3>Instructions</h3>
        <label htmlFor="instruction-markdown">Advanced Markdown<textarea id="instruction-markdown" value={instructionMarkdown} onChange={(event) => setInstructionMarkdown(event.target.value)} /></label>
        <button className="secondary" type="button" onClick={() => saveInstruction("project")}>Save Project Instructions</button>
        <button className="ghost" type="button" onClick={() => saveInstruction("global")}>Save Global Instructions</button>
      </div>
      <div className="stack compact">
        <h3>Skills</h3>
        <label htmlFor="skill-name">Name<input id="skill-name" value={skillName} onChange={(event) => setSkillName(event.target.value)} /></label>
        <label htmlFor="skill-description">What it does<textarea id="skill-description" value={skillDescription} onChange={(event) => setSkillDescription(event.target.value)} /></label>
        <label htmlFor="skill-trigger">When to use<textarea id="skill-trigger" value={skillTrigger} onChange={(event) => setSkillTrigger(event.target.value)} /></label>
        <label htmlFor="skill-markdown">SKILL.md<textarea id="skill-markdown" value={skillMarkdown} onChange={(event) => setSkillMarkdown(event.target.value)} /></label>
        <button className="secondary" type="button" onClick={() => saveSkill("project")}>Save Project Skill</button>
        <button className="ghost" type="button" onClick={() => saveSkill("global")}>Save Global Skill</button>
        {dashboard?.skills.map((skill) => <button key={skill.id} className="row" type="button" onClick={() => activateSkill(skill.id)}><strong>{skill.name}</strong><span>{skill.scope} v{skill.version}</span></button>)}
      </div>
      <div className="stack compact">
        <h3>Actions</h3>
        {dashboard?.actions.map((action: AssistantActionDescriptor) => <button key={action.name} className={action.confirmationRequired ? "ghost" : "secondary"} type="button" onClick={() => invoke(action.name)}>{action.name}</button>)}
      </div>
      <div className="stack compact">
        <h3>Proposed actions</h3>
        {dashboard?.proposedActions.map((item) => <article key={item.id} className="detail"><p className="eyebrow">{item.status}</p><h4>{item.actionName}</h4><pre>{JSON.stringify(item.proposedChange, null, 2)}</pre><button className="primary" type="button" disabled={!["proposed", "edited"].includes(item.status)} onClick={() => proposal(item.id, "confirm")}>Confirm</button><button className="ghost" type="button" disabled={!["proposed", "edited"].includes(item.status)} onClick={() => proposal(item.id, "reject")}>Reject</button></article>)}
      </div>
    </section>
  );
}

function authorityLabel(value: AuthorityClassification): string {
  return authorityOptions.find((option) => option.value === value)?.label ?? value;
}

function statusLabel(value: ReadinessStatus): string {
  return readinessStatusOptions.find((option) => option.value === value)?.label ?? value;
}

function readinessLabel(value: ContractorReadinessSummary["overallStatus"]): string {
  if (value === "not_started") return "Not started";
  if (value === "in_progress") return "In progress";
  if (value === "attention_required") return "Attention required";
  return "Ready";
}

function planTypeLabel(value: SafetyPlanType): string {
  return planTypeOptions.find((option) => option.value === value)?.label ?? value;
}

function findingTypeLabel(value: PlanFindingType): string {
  return findingTypeOptions.find((option) => option.value === value)?.label ?? value;
}

function findingAuthorityLabel(value: PlanFindingAuthority): string {
  return findingAuthorityOptions.find((option) => option.value === value)?.label ?? value;
}

function observationLabel(value: ObservationClassification | null): string | null {
  if (!value) return null;
  return observationClassificationOptions.find((option) => option.value === value)?.label ?? value;
}

function followUpLabel(value: ObservationFollowUpStatus): string {
  return followUpOptions.find((option) => option.value === value)?.label ?? value;
}

function incidentCategoryLabel(value: IncidentCategory): string {
  return incidentCategoryOptions.find((option) => option.value === value)?.label ?? value;
}

function incidentStatusLabel(value: IncidentOversightStatus): string {
  return incidentStatusOptions.find((option) => option.value === value)?.label ?? value;
}

function affectedWorkLabel(value: AffectedWorkDisposition): string {
  return affectedWorkOptions.find((option) => option.value === value)?.label ?? value;
}

function reportTypeLabel(value: ReportType): string {
  if (value === "daily") return "Daily";
  if (value === "weekly") return "Weekly";
  if (value === "monthly") return "Monthly";
  return "Custom";
}

function reportFormatLabel(value: ReportFormat): string {
  return value === "structured" ? "Structured" : "Narrative";
}

createRoot(document.getElementById("root")!).render(<App />);
