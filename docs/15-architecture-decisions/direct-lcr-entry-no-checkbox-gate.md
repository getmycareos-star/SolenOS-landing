# Direct Living Care Record Entry Without Checkbox Gates

**Status:** Accepted product requirement  
**Scope:** Frontend entry and workspace mounting  
**Applies to:** SolenOS landing, start, early-access, and workspace routes

## Decision

When a person taps an action to open or use the Living Care Record, route them directly to `/workspace?enter=1`. Do not show a required privacy acknowledgement checkbox, early-version checkbox, acknowledgement overlay, or onboarding confirmation before the workspace mounts.

## Rationale

Caregivers may arrive stressed, tired, or cognitively overloaded. Requiring them to complete a product questionnaire before they can reach the care record adds friction at the point where the product should reduce burden.

## Required behaviour

- The primary landing CTA, public navigation CTA, optional `/start` CTA, and `/early-access` CTA route directly to the LCR.
- Privacy and Terms remain available as readable links in public and in-product navigation.
- The workspace mounts without waiting for a checkbox, local acknowledgement flag, or consent-overlay state.
- Early-access and research-preview information is informational, not an entry gate.
- Do not conflate workspace access with permission to perform every operation.
- Keep server-issued session authentication, record ownership checks, audit requirements, and purpose-specific consent for sensitive actions.
- Do not weaken backend access control merely to remove a frontend gate.
- The optional data-improvement preference remains separate and revocable in Settings.

## Acceptance tests

- New and returning users can reach the LCR directly from every CTA that promises LCR access.
- No privacy or early-version checkbox appears before the workspace.
- Workspace loading, empty-state, and existing-record states remain available.
- A server denial for an unauthorised record or consent-required sensitive action remains a clear, operation-specific error rather than an entry wall.
- CI runs the direct-entry regression as part of `npm test`.

## Rollout

This is Stage 1 only. It removes the pre-workspace UI gates and locks the behaviour with regression tests. It does not claim the entire LCR architecture is implemented, nor does it change backend consent policy or production database schema.
