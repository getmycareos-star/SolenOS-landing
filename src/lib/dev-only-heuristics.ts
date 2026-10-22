/**
 * Heuristic classifiers are for local exploration only. They must be explicitly
 * opted into and are never enabled in production builds.
 */
declare const process:
  | { env?: Record<string, string | undefined> }
  | undefined;

export function isDevelopmentHeuristicModeEnabled(): boolean {
  if (typeof process === "undefined") return false;
  const env = process.env;
  return env?.NODE_ENV !== "production" && env?.SOLENOS_DEV_KEYWORD_HEURISTICS === "true";
}
