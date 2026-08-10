import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SourceNav, constrainWorkspacePanelWidths } from "./main";
import type { Project, ProjectSourceLink, SourceRecord } from "../shared/contracts";

function EmptyWorkspaceState() {
  return (
    <div className="empty-state">
      <h2>No project open</h2>
      <p>Create or select a blank project from the left panel.</p>
    </div>
  );
}

describe("foundation UI states", () => {
  it("keeps resizable desktop panels within workspace constraints", () => {
    expect(constrainWorkspacePanelWidths({ sources: 900, workbench: 900 }, 1366)).toEqual({ sources: 520, workbench: 362 });
    expect(constrainWorkspacePanelWidths({ sources: 100, workbench: 100 }, 1366)).toEqual({ sources: 270, workbench: 300 });
  });

  it("renders an intentional empty project state", () => {
    render(<EmptyWorkspaceState />);
    expect(screen.getByText("No project open")).toBeInTheDocument();
    expect(screen.getByText(/Create or select a blank project/)).toBeInTheDocument();
  });

  it("supports NotebookLM-style source selection without activating authority", () => {
    const sources = [source("source-1", "Safety Manual", "manual.pdf", "gc_policy"), source("source-2", "OSHA 1926", null, "regulatory_requirement")];
    const projectSources: ProjectSourceLink[] = [{
      id: "link-1",
      projectId: "project-1",
      sourceId: "source-1",
      activationStatus: "associated",
      createdAt: "2026-08-09T00:00:00.000Z",
      updatedAt: "2026-08-09T00:00:00.000Z"
    }];
    const onOpen = vi.fn();
    const onToggleSelected = vi.fn();
    const onSelectAll = vi.fn();
    const onClearSelection = vi.fn();

    render(
      <SourceNav
        sources={sources}
        projectSources={projectSources}
        activeSourceId="source-1"
        selectedSourceIds={["source-1"]}
        currentProject={project()}
        onOpen={onOpen}
        onToggleSelected={onToggleSelected}
        onSelectAll={onSelectAll}
        onClearSelection={onClearSelection}
        onRemoveFromContext={vi.fn()}
        onSearch={vi.fn()}
        onSourceAdded={vi.fn()}
      />
    );

    expect(screen.getByText("+ Add sources")).toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getAllByText("context")[0]).toBeInTheDocument();
    expect(screen.getAllByText("authority")[0]).not.toHaveClass("authority");

    fireEvent.click(screen.getByLabelText("Select OSHA 1926 for current context"));
    expect(onToggleSelected).toHaveBeenCalledWith("source-2", true);

    fireEvent.click(screen.getByText("Select all"));
    expect(onSelectAll).toHaveBeenCalledWith(["source-1", "source-2"]);

    fireEvent.click(screen.getByText("Clear selection"));
    expect(onClearSelection).toHaveBeenCalled();

    fireEvent.click(screen.getByText("Safety Manual"));
    expect(onOpen).toHaveBeenCalledWith("source-1");
  });

  it("opens and closes the Add Sources dialog", () => {
    render(
      <SourceNav
        sources={[]}
        projectSources={[]}
        activeSourceId={null}
        selectedSourceIds={[]}
        currentProject={project()}
        onOpen={vi.fn()}
        onToggleSelected={vi.fn()}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
        onRemoveFromContext={vi.fn()}
        onSearch={vi.fn()}
        onSourceAdded={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("+ Add sources"));
    expect(screen.getByRole("dialog", { name: "Add sources" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload new" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add URL" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose from Global Library" })).toBeInTheDocument();
    expect(screen.getByText("PDF / DOCX / XLSX / PPTX / TXT / Markdown / CSV / Images")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close"));
    expect(screen.queryByRole("dialog", { name: "Add sources" })).not.toBeInTheDocument();
  });

  it("shows the Global Library reuse workflow in Add Sources", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ sources: [] }), { status: 200, headers: { "content-type": "application/json" } })));
    render(
      <SourceNav
        sources={[]}
        projectSources={[]}
        activeSourceId={null}
        selectedSourceIds={[]}
        currentProject={project()}
        onOpen={vi.fn()}
        onToggleSelected={vi.fn()}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
        onRemoveFromContext={vi.fn()}
        onSearch={vi.fn()}
        onSourceAdded={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("+ Add sources"));
    fireEvent.click(screen.getByText("Choose from Global Library"));
    expect(await screen.findByRole("button", { name: "Search library" })).toBeInTheDocument();
    expect(screen.getByText("Associate selected sources")).toBeDisabled();
    vi.unstubAllGlobals();
  });
});

function source(id: string, title: string, originalFilename: string | null, authorityClassification: SourceRecord["authorityClassification"]): SourceRecord {
  return {
    id,
    ownerUserId: "user-1",
    title,
    originalFilename,
    mimeType: "application/pdf",
    sourceType: originalFilename ? "pdf" : "url",
    scope: originalFilename ? "project" : "global",
    projectId: originalFilename ? "project-1" : null,
    authorityClassification,
    userConfirmedClassification: true,
    aiSuggestedClassification: null,
    storageKey: originalFilename ? "storage-key" : null,
    originalUrl: originalFilename ? null : "https://example.com",
    sizeBytes: 128,
    processingStatus: "ready",
    extractionStatus: "ready",
    extractionVersion: "test",
    failureReason: null,
    metadata: {},
    tags: [],
    summary: null,
    summaryStatus: "not_generated",
    summaryGeneratedAt: null,
    summaryProvider: null,
    summaryModel: null,
    archivedAt: null,
    uploadedAt: "2026-08-09T00:00:00.000Z",
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z"
  };
}

function project(): Project {
  return {
    id: "project-1",
    ownerUserId: "user-1",
    name: "Test Project",
    projectIdentifier: null,
    location: "Dallas, TX",
    federalClassification: "Non-Federal",
    description: null,
    startDate: null,
    endDate: null,
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z"
  };
}
