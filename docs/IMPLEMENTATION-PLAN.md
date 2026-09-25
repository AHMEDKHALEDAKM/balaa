# Implementation plan

Scope follows PRD v0.1. No government API, real identity integration, real government email, payment, AI recognition or automated escalation.

1. Establish npm-workspace monorepo, strict TypeScript, environment contract, architecture and original PRD. Gate: parse configurations and check structure.
2. Build relational/PostGIS migrations and RLS, transactional report/confirmation/status functions, audit and private storage policies. Seed all category labels, administrative structure and explicit synthetic demonstration polygons/contacts. Gate: SQL/static security checks; execute database tests when Docker/Supabase are available.
3. Build shared schemas, identity/notification/moderation interfaces and test implementations, geometry and public privacy projection. Gate: unit tests, lint and typecheck.
4. Build Expo RTL navigation, onboarding, mock verification, camera, GPS, district lookup, category/severity/description/review, submission and tracking. Development fixture input is explicitly gated. Gate: typecheck and Metro bundle; physical-device testing documented separately.
5. Build Next.js browser companion, MapLibre map and public before/after tracking plus shared demo API. Persist locally, authorize every mutation, protect media and enforce duplicate/abuse/rate constraints. Gate: unit/API integration tests, typecheck and production build.
6. Build responsive district console, scoped detail actions, moderation and basic administration, internal notes, resolution upload and test outbox. Gate: authorization/privacy/status integration tests and UI smoke checks.
7. Finish Supabase integration boundary, setup/security/contribution/roadmap documents and verification report. Run all available checks, record unavailable runtime checks honestly, inspect the rendered UI, and deliver a runnable repository.

Implementation can proceed concurrently across database, mobile and web once shared contracts exist. Each subsystem must pass its available checks before final integration. Database execution and native-device checks must not be described as passed when their runtimes are absent.
