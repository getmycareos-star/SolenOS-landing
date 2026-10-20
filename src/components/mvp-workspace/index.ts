/**
 * Prefer importing panels directly from their files.
 * This barrel only re-exports the workspace shell so page/client graphs
 * do not eagerly pull every panel (and any accidental server deps).
 */
export { CognitiveWorkspace } from "./CognitiveWorkspace";
