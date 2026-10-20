# SolenOS MVP Retention Behavior (Internal)

**Status:** Internal product behavior specification — not a user-facing page  
**Authority:** Care Reality Engine + Living Care Record  
**Do not** display this document as instructions to caregivers.

## Test for every engineering decision

> Does this improve the Care Reality Engine?

If no → defer.

## Priority order (MVP)

1. Data is saved correctly  
2. Timeline works  
3. Information connects over time  
4. AI separates facts from assumptions  
5. Users can correct misunderstandings  
6. Feedback is collected  

Advanced intelligence comes later.

## Where principles live

| Principle | Location |
|-----------|----------|
| Care Record as source of truth | Care Reality / situation entry / LCR persistence |
| Accumulating understanding on home | Workspace / state of care / return continuity |
| Timeline history never silently overwritten | Timeline + Care Record |
| Input → extract → compare → change → unknowns → update LCR → response | Situation entry pipeline |
| Understanding response structure | Response Contract / composer / LivingCareRecordPanel |
| Feedback after responses + global improve | `UnderstandingFeedbackPrompt` · `HelpImproveSolenos` · research-feedback |
| Uploads as evidence into Care Reality | Input entry contract (Scan/Snap/Upload/Share) |
| Questions only if they reduce uncertainty | Response Contract |
| Avoid chatbot / therapist / companion | Entry behavior · emotional language · non-conversational |
| Greetings → state / Care Record, not chat | `entry-behavior-protocol` · `GREETING_ORIENTATION` |

## Avoid chatbot behavior

SolenOS is a care understanding system — not a conversational assistant.

Greetings: acknowledge briefly via session reentry / Care Record orientation.  
Never: "I'm always here for you", therapy empathy, or answering "How are you?" as a human.

Guide back to: add information · understand changes · review Care Record.

## Success

Caregivers feel information accumulates, connects, and remains trustworthy — not that they chatted with a polished AI.
