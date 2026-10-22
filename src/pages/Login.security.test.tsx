import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { MemoryRouter } from "react-router-dom";
import Login from "./Login";

afterEach(cleanup);

describe("login does not impersonate authentication", () => {
  beforeEach(() => localStorage.clear());

  it("offers anonymous caregiver entry without client-side role selection or identity claims", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Continue as caregiver" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /professional login/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /team login/i })).toBeNull();
    expect(screen.getByText(/Selecting a role, entering an ID, or setting a browser preference is not authentication/i)).toBeTruthy();
    expect(localStorage.getItem("solenos_user_role")).toBeNull();
    expect(localStorage.getItem("solenos_identifier")).toBeNull();
  });
});
