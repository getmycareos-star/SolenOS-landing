# ADR-015 — Permanent product identity: SolenOS only

## Status

Accepted

## Context

The repository historically mixed **SolenOS** with legacy product-name placeholders and auto-generated renames. Product identity must be unambiguous for agents, docs, UI, prompts, and public contracts.

## Decision

1. **SolenOS** is the only valid company / product / platform name.
2. Category phrase **Care Reality Intelligence** and foundation **The Living Care Record** are not product renames.
3. Forbidden legacy product-name placeholders are listed and enforced in `.cursor/rules/solenos-product-identity.mdc` (`alwaysApply: true`) and must remain purged from source, docs, UI, prompts, package metadata, and architecture maps.
4. Code identifiers formerly using those placeholders are renamed to `SolenOS*` (or non-branded semantic names).

## Consequences

- Public response types and adapters use `SolenOSResponse` / related `SolenOS*` names.
- Agents and humans treat documentation as source of truth for brand; conflicts require ADR + code alignment in the same change.
- Ordinary English (caregiver, caregiving, care record, care graph, etc.) is unchanged.
