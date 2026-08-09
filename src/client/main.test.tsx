import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function EmptyWorkspaceState() {
  return (
    <div className="empty-state">
      <h2>No project open</h2>
      <p>Create or select a blank project from the left panel.</p>
    </div>
  );
}

describe("foundation UI states", () => {
  it("renders an intentional empty project state", () => {
    render(<EmptyWorkspaceState />);
    expect(screen.getByText("No project open")).toBeInTheDocument();
    expect(screen.getByText(/Create or select a blank project/)).toBeInTheDocument();
  });
});
