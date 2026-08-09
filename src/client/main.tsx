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
  Project,
  ProjectContractorEngagement,
  ProjectSourceLink,
  ReadinessRequirement,
  ReadinessStatus,
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
  activeObservation
}: {
  project: Project | null;
  engagements: ProjectContractorEngagement[];
  activeEngagement: ProjectContractorEngagement | null;
  activeSource: SourceDetail | null;
  readiness: ContractorReadinessDetail | null;
  summaries: ContractorReadinessSummary[];
  activePlan: SafetyPlanDetail | null;
  activeObservation: ObservationDetail | null;
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
      <section className="foundation-grid">
        <div>
          {activeObservation ? (
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

createRoot(document.getElementById("root")!).render(<App />);
