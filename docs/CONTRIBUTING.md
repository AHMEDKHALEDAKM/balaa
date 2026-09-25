# Contributing

Read the PRD, architecture and security boundaries before changing behavior. Keep changes within the report → route → track → resolve journey. Arabic RTL is primary; keep labels separate from logic and preserve English metadata.

Use Node.js 24 and `npm ci`. Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and the relevant native/database checks. Add tests for authorization, privacy, state changes and failure behavior rather than mirroring presentation markup. Never describe unavailable tests as passed.

Create a focused branch and commits describing the behavior. Explain the concrete issue, fix, validation and limitations in a PR. Include migration/seed changes when persistence behavior changes. Do not commit `.env`, `.balaa`, generated native bundles, credentials or real citizen photos.

Keep government integration claims accurate. Mock identity, synthetic boundaries and the test inbox must remain visibly labeled. Do not introduce real government contacts or outbound email without a reviewed deployment process. Preserve RLS and server-side authorization even when a UI hides an action.

SQL migrations are ordered and append-only after release. The initial three migrations may be amended only before the first shared deployment; once deployed, add a new migration. Reference data changes need provenance, licensing and separate boundary/contact review.
