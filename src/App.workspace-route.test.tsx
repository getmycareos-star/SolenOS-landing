import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

jest.mock("./api/client", () => ({
  ensureAnonymousSession: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("./pages/Dashboard", () => ({
  __esModule: true,
  default: () => <main>Caregiver workspace mounted</main>,
}));

afterEach(cleanup);

describe("Vite workspace route", () => {
  it("renders the caregiver workspace at /workspace", async () => {
    render(
      <MemoryRouter initialEntries={["/workspace"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Caregiver workspace mounted")).toBeTruthy();
    });
  });
});
