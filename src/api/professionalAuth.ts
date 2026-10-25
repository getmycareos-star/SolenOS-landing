export type ProfessionalProfile = {
  id: string;
  email: string;
  full_name: string;
  professional_title: string;
  organization: string | null;
  credentials: string | null;
  specialties: string | null;
  biography: string | null;
  status: "pending_review" | "verified" | "rejected" | "suspended" | string;
  created_at: string | null;
};

const TOKEN_KEY = "solenos_professional_access_token";
const PROFILE_KEY = "solenos_professional_profile";

function apiErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return `Professional account request failed (HTTP ${status}).`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1/professional-auth${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiErrorMessage(payload, response.status));
  return payload as T;
}

type AuthResponse = {
  professional: ProfessionalProfile;
  access_token: string;
  token_type: "Bearer";
  expires_at: string;
  session_type: "professional";
  message?: string;
};

function persist(result: AuthResponse): ProfessionalProfile {
  window.localStorage.setItem(TOKEN_KEY, result.access_token);
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(result.professional));
  return result.professional;
}

export async function registerProfessional(input: {
  email: string;
  password: string;
  full_name: string;
  professional_title: string;
  organization?: string;
  credentials?: string;
  specialties?: string;
  biography?: string;
}): Promise<ProfessionalProfile> {
  return persist(await request<AuthResponse>("/register", {
    method: "POST",
    body: JSON.stringify(input),
  }));
}

export async function loginProfessional(email: string, password: string): Promise<ProfessionalProfile> {
  return persist(await request<AuthResponse>("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }));
}

export async function getProfessionalProfile(): Promise<ProfessionalProfile> {
  const token = window.localStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error("Log in with your professional account to continue.");
  const result = await request<{ authenticated: boolean; professional: ProfessionalProfile }>("/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(result.professional));
  return result.professional;
}

export async function logoutProfessional(): Promise<void> {
  const token = window.localStorage.getItem(TOKEN_KEY);
  if (token) {
    await request<{ revoked: boolean }>("/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(PROFILE_KEY);
}

export async function deleteProfessionalAccount(): Promise<void> {
  const token = window.localStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error("Log in with your professional account before deleting it.");
  await request<{ deleted: boolean }>("/account", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(PROFILE_KEY);
}
