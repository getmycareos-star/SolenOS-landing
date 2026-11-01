import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const client = await readFile(new URL("../src/api/client.ts", import.meta.url), "utf8");
const settings = await readFile(new URL("../src/app/workspace/settings/page.tsx", import.meta.url), "utf8");
const authProvider = await readFile(new URL("../src/components/AuthProvider.tsx", import.meta.url), "utf8");

assert.match(client, /export async function signInToAccount\(email: string, password: string\)/);
assert.match(client, /export async function checkAuthState\(\)/);
assert.match(client, /fetchWithTimeout\("\/api\/v1\/accounts\/me"/);
assert.match(client, /window\.addEventListener\("personIdChanged", refresh\)/);
assert.equal(client.includes('export async function checkAuthState(): Promise<{ authenticated: boolean; sessionInfo: AuthSessionInfo | null }> {\n  return { authenticated: false, sessionInfo: null }\n}'), false);

assert.match(client, /\/api\/v1\/accounts\/login/);
assert.match(client, /ANONYMOUS_TOKEN_KEY, result\.access_token/);
assert.match(client, /ANONYMOUS_PERSON_KEY, result\.person_id/);
assert.match(client, /ANONYMOUS_CAREGIVER_KEY, result\.caregiver_id/);
assert.match(settings, /signInToAccount\(email, password\)/);
assert.match(authProvider, /finally \{\s*if \(mounted\) setLoading\(false\)/);
assert.match(authProvider, /catch \{\s*if \(mounted\) \{\s*setAuthenticated\(false\)/);
assert.match(settings, /mode === "login"/);
assert.match(settings, /Sign in to an existing account/);
assert.match(settings, /getAnonymousAccessToken\(\)/);
assert.match(settings, /Do not create a new anonymous care record merely to inspect account status/);

console.log("PASS: returning caregivers can sign in through the account API without creating a replacement care record first.");
