# Moat & Defensibility

## Five intelligence assets

| Asset | What compounds | Implementation bridge | Honest durability |
|-------|----------------|----------------------|-------------------|
| **Family Memory** | People, relationships, observed patterns | care-profile, memory-influence, observation-intelligence, FI facade | **IN-MEMORY** (+ noop PG) |
| **Care Graph** | Ownership / dependence / support edges | responsibility-graph, care-profile, FI care-graph | **IN-MEMORY** |
| **Decision History** | WHY decisions were chosen; accept/outcome hooks | decision-history, explanation layer, FI facade | Process + explanation path |
| **Delegation Network** | Who can absorb load; success/overload concentration | delegation-layer + FI network store | Suggest-only; IN-MEMORY compound |
| **Crisis Prediction** | Predictive failure signals with explanations | crisis-prevention-layer + FI crisis-prediction | Heuristic DERIVED each request; FI compounds IN-MEMORY |

## Why this is a moat (technical)

1. **Care Graph compounding** — task apps store todos; SolenOS stores accountability topology used by load, delegation, and crisis. Switching costs rise as ownership history deepens (**when durable persistence ships**).
2. **Crisis prediction over time** — RiskOverTime curves + load make foresight structural, not chat recall. Competitors copying UI tips do not copy verified DERIVED contracts.
3. **Delegation dependency** — Network learning who successfully absorbs work is relational data competitors cannot scrape from a blank install.
4. **Family Memory** — Observation patterns + care profile weights personalize without becoming a medical record product.
5. **Decision History lock-in** — WHY audit is the continuity OS backbone; replacing SolenOS loses institutional family memory of decisions.

## Trust mechanisms (productized)

Remember · Explain · Reduce Guilt · Prevent Mistakes — bridged in `family-intelligence/trust-mechanisms.ts` / confidence-state.

## What is NOT moat yet

- In-memory stores reset on deploy — **moat requires durable STATE**
- Unsalted auth stub — not a security moat
- No live clinical network effects
- LLM provider is commodity; **Priority/Load/Crisis contracts are not**

## Defensibility roadmap (engineering)

1. Persist STATE/BELIEF/EXPLANATION + FI assets durably
2. Keep DERIVED pure / verified
3. Production identity continuity
4. Consented multi-caregiver graph
5. Only then partner integrations that feed care events
