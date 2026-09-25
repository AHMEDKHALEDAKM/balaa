# Verification record

Verified on 25 September 2026 using Windows, Node.js 24.19.0 and npm 11.17.0.

## Passed

- `npm run check`: ESLint, strict TypeScript for shared packages/web/mobile, 38 tests across four suites, and optimized Next.js production build.
- Tests cover domain validation/geometry, privacy and authorization, report lifecycle and moderation, duplicate confirmations, SQL syntax and seed consistency, and Supabase adapter transport behavior.
- `npm run test:api`: real HTTP mock identity, image upload, geographic routing, public ID, test notification, tracking, district authorization, acknowledgment, work, resolution and public before/after. Also checks hidden moderated media and idempotent confirmations.
- `EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 npm run mobile:bundle`: Android (617 modules) and iOS (619 modules) Hermes exports.
- `npm ci --dry-run --offline --ignore-scripts`: lockfile installation plan accepted. This is not a fresh installation test.
- SQL parsed using the PostgreSQL 15 parser: four migrations and generated seed. This does not execute SQL or prove RLS semantics.
- Browser: citizen creation with explicit synthetic photo/location, district acknowledgment and work, resolution with demonstration image/note, public history and before/after images. Desktop and 390 x 844 responsive inspection; no horizontal overflow on the phone homepage. Map loads without console errors after configuring its module worker.

## Not verified / release gates

- Live Supabase Auth, PostGIS, Storage, Edge Functions and pgTAP: Docker/Supabase/Deno runtimes unavailable. Supabase functions are supplied but excluded from the Node ESLint/typecheck configuration; run Deno checks and the supplied SQL tests before hosted deployment.
- Physical Android/iOS camera, GPS, permissions, screen reader behavior, signed native binaries and app-store builds.
- Automated native file chooser interaction timed out. JPEG upload passed through the HTTP test and browser demonstration fixture; manual file selection remains a device/browser QA step.
- No production deployment, official identity, real authority notifications or verified district boundaries. Two synthetic polygons and reserved `.invalid` recipients are deliberate fixtures.
- No automatic face/plate blurring. Hosted publication requires human approval of safe media; metadata removal alone does not establish privacy.
- Dependency audit at verification time: no high/critical findings; 10 moderate findings in the Expo build-tool dependency chain associated with nested `uuid` 7.0.3. Requested overrides have not displaced that nested installation. Review the current audit before release; no blanket clean-audit claim is made.

See [SETUP.md](SETUP.md) for runtime instructions and [SECURITY.md](SECURITY.md) for deployment gates. Local demo data and generated bundles are excluded from the source archive.
