import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "@jest/globals";
import { MemoryRouter } from "react-router-dom";
import RestrictedRolePage from "./RestrictedRolePage";

afterEach(cleanup);

describe("unverified role access", () => {
  it("denies privileged dashboard access until server-side identity is verified", () => {
    render(
      <MemoryRouter>
        <RestrictedRolePage role="Professional" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Professional access is not available yet" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("server-issued identity");
    expect(screen.getByRole("link", { name: "Return to caregiver workspace" })).toBeTruthy();
  });
});
