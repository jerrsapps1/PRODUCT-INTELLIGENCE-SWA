import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Contractor, Project, ProjectContractorEngagement, UserSummary } from "../shared/contracts";
import "./styles.css";

type View = "sources" | "workspace" | "workbench";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
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

  if (!user) {
    return <LoginScreen onLogin={setUser} error={error} setError={setError} />;
  }

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

  async function refresh() {
    setError("");
    setStatus("Loading records...");
    const [projectBody, contractorBody] = await Promise.all([
      api<{ projects: Project[] }>("/api/projects"),
      api<{ contractors: Contractor[] }>("/api/contractors")
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
      return;
    }
    api<{ engagements: ProjectContractorEngagement[] }>(`/api/projects/${selectedProjectId}/contractors`)
      .then((body) => {
        setEngagements(body.engagements);
        setActiveEngagementId((current) => current ?? body.engagements[0]?.id ?? null);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load engagements"));
  }, [selectedProjectId]);

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
            onSelect={setSelectedProjectId}
            onCreated={(project) => {
              setProjects((current) => [project, ...current]);
              setSelectedProjectId(project.id);
              setActiveView("workspace");
            }}
          />
        </aside>

        <section className={`panel center ${activeView === "workspace" ? "show" : ""}`}>
          <WorkspacePanel project={selectedProject} engagements={engagements} activeEngagement={activeEngagement} />
        </section>

        <aside className={`panel right ${activeView === "workbench" ? "show" : ""}`}>
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
            <span>{project.location} · {project.federalClassification}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function WorkspacePanel({
  project,
  engagements,
  activeEngagement
}: {
  project: Project | null;
  engagements: ProjectContractorEngagement[];
  activeEngagement: ProjectContractorEngagement | null;
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
          <h3>Workspace</h3>
          <p className="empty">Assistant, source intelligence, and plan review will appear in later phases after human-selected authority and evidence exist.</p>
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
    <>
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
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
