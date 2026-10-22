import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

jest.mock("./api/client", () => ({
  ensureAnonymousSession: jest.fn().mockResolvedValue(undefined),
}));

afterEach(cleanup);

describe("application role routes", () => {
  it("does not mount the professional dashboard from a directly entered URL", async () => {
    render(
      <MemoryRouter initialEntries={["/professional"]}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Professional access is not available yet" })).toBeTruthy();
    });
    expect(screen.queryByText(/Professional Dashboard/i)).toBeNull();
  });

  it("does not mount the team dashboard from a directly entered URL", async () => {
    render(
      <MemoryRouter initialEntries={["/team"]}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "SolenOS team access is not available yet" })).toBeTruthy();
    });
    expect(screen.queryByText(/Mission Control/i)).toBeNull();
  });
});
