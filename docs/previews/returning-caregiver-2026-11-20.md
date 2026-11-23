# Returning-caregiver preview build

This branch is a preview-only build trigger from the exact current `main` commit.

The returning-caregiver route is implemented by `FirstVisitWorkspaceRouter`. It displays the returning workspace only after the authenticated backend confirms persisted care context for the server-issued anonymous care identity. A failed or incomplete backend read is displayed as unavailable, never as an empty or returning record.

No fabricated care data, test identity, or production record has been added for this preview. The preview must be opened with a care identity that already has persisted records; a new browser origin may create a different anonymous identity and therefore show first-visit or unavailable state.

Base commit: `31607c1a698d3a0091bd4908186e4292598df9f4`.
