import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  AuthorityClassification,
  Contractor,
  Project,
  ProjectContractorEngagement,
  ProjectSourceLink,
  SourceDetail,
  SourceRecord,
  SourceScope,
  UserSummary
} from "../shared/contracts";
import "./styles.css";

type View = "sources" | "workspace" | "workbench";

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
  activeSource
}: {
  project: Project | null;
  engagements: ProjectContractorEngagement[];
  activeEngagement: ProjectContractorEngagement | null;
  activeSource: SourceDetail | null;
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
          {activeSource ? (
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
          {activeEngagement ? (
            <article className="detail">
              <h4>{activeEngagement.contractor?.legalName}</h4>
              <p>{activeEngagement.contractor?.trade ?? "Trade not specified"}</p>
              <p>{activeEngagement.scopeSummary ?? "No scope summary entered."}</p>
            </article>
          ) : null}
        </div>
      </section>
    </>
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

function authorityLabel(value: AuthorityClassification): string {
  return authorityOptions.find((option) => option.value === value)?.label ?? value;
}

createRoot(document.getElementById("root")!).render(<App />);
