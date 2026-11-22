# SolenOS caregiver language standard

## Purpose

Caregivers should understand what SolenOS is showing them without learning product, clinical, or engineering terminology. The interface should use short, familiar, direct language.

This standard applies to every caregiver-facing screen, message, button, empty state, notification, error, loading state, summary, and help page.

## Rules

1. Use everyday words and short sentences.
2. Say what happened, what was reported, what is not clear, and what needs attention.
3. Keep technical terms in code, APIs, logs, internal documentation, and engineering tools.
4. Do not expose internal system names, acronyms, model names, engine names, database terms, or implementation details.
5. Do not simplify away important distinctions. A caregiver must be able to tell a report from a confirmed fact, an earlier detail from a current one, and an unknown from a negative finding.
6. Never imply that an empty screen proves nothing happened or that a missing detail is unimportant.
7. Do not claim that an action was saved, shared, reviewed, or completed unless the system has confirmed it.
8. Use respectful, calm language. Do not blame caregivers or make them feel that they have failed to provide enough information.
9. Use “medicine” in general caregiver copy; preserve the exact medication names and clinical wording supplied by a source when displaying that source.
10. Keep professional-facing language clear and practical. Technical language belongs only where the professional needs it to do their work.

## Preferred wording

| Avoid in caregiver-facing copy | Use instead |
| --- | --- |
| Living Care Record / LCR | Care Record |
| AI Companion | Care Assistant |
| Care continuity | Keeping care information together |
| Reconciliation | Comparing or updating saved care information |
| Evidence / provenance | Notes and documents; where the information came from |
| Delta Engine | Changes over time |
| Retrieval | Finding saved care information |
| Open loops | Things that still need attention; Follow-ups |
| Longitudinal history | Care history over time |
| Epistemic status | What is known, not sure yet, or not recorded |
| Assessment coverage | What information was checked |
| Assessment (when used as a system label) | Check or review |
| Confidence (when used as a system label) | How sure we are; what is still unclear |
| Evidence (when referring to saved support) | Notes and documents |
| Source attribution | Who reported it; where it came from |
| Unresolved | Still needs attention |
| Incomplete record | Some information is not available |
| Not corroborated | No other report confirms this |
| Reconciliation review | Care information review |

## Required distinctions

Use clear wording to preserve these meanings:

- **Reported:** Someone said or recorded this. It is not automatically verified.
- **Recorded:** The information is saved. This does not prove it is medically correct.
- **Not sure yet:** The available information does not settle the question.
- **Not recorded:** The information is not present in the saved record. This does not mean it did not happen.
- **Needs checking:** The information is missing, unclear, or does not match another report.
- **Earlier report:** The information was recorded in the past and may not describe the current situation.


## Additional display safeguards

- Never show internal abbreviations such as LCR, subsystem names, model names, engine names, database names, or implementation terms to caregivers.
- Never show database IDs, caregiver IDs, source IDs, evidence IDs, hashes, raw enum values, JSON, or API error details as interface copy. Show a useful human label or a safe fallback instead.
- Do not turn an unknown system value into a label by replacing underscores with spaces. Use an approved label or a neutral fallback such as “Not available”.
- Do not show a generated explanation unless it passes the caregiver-language safety check. If it does not, show a short, honest fallback and keep the underlying information available to the appropriate reviewer.
- Apply stricter wording checks to SolenOS-generated explanations and suggestions. Do not apply those generated-text rules to rewrite original caregiver reports or source documents.
- Avoid words such as “verified”, “confirmed”, and “resolved” unless the interface says who performed the check and what was actually checked.
- Use “Care Assistant” in navigation and headings. Keep internal component and code names unchanged where changing them would create unnecessary engineering risk.
- A plain-English label must not change the meaning of the saved information or imply that a caregiver review is a clinical confirmation.

## Review checklist for every caregiver-facing change

- Can a caregiver understand the wording without knowing SolenOS terminology?
- Is the sentence short and direct?
- Does it say what the system actually knows?
- Does it preserve uncertainty and source attribution?
- Does it avoid suggesting a diagnosis, medical instruction, or unverified outcome?
- Does it explain what the caregiver can do next, if anything?
- Is the same term used consistently across navigation, screens, notifications, and help content?

If a technical term is necessary to preserve meaning, explain it in ordinary words at the point where it appears. Do not expose internal engine or subsystem names.
