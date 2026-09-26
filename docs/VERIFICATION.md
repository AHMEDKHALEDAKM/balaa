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

## Logo and bilingual update — 26 September 2026

- Added the owner-supplied logo unchanged and a shared Arabic/English translation catalog for web and native interfaces.
- 43 tests in five suites pass, including translation interpolation, Arabic grammar corrections, localized dates/numbers, and preservation of user content with configurable bilingual category labels.
- Lint, strict TypeScript and optimized Next.js build pass.
- Android and iOS Metro/Hermes exports pass with the new logo and localization modules (621 / 623 modules). This remains a bundle check, not a signed APK/IPA or physical-device test.
- Browser checked: Arabic/English switching, saved selection on reload, English report steps through review, English district administration, Arabic corrected statuses/dates, and 390 x 844 layouts. Homepage and district dashboard document widths match the viewport in both languages; wide report tables scroll within their container.
- EAS preview/production profiles and HTTPS endpoint validation supplied. No GitHub push, hosted deployment, Expo cloud build, Apple signing or store submission was performed.
- iOS permission copy is configured in both Arabic and English; the OS chooses its display language. The uploaded Arabic wordmark, basemap labels and original report descriptions are intentionally not translated.

See [GitHub and phone installation](GITHUB-AND-PHONE.md) for the remaining account/build steps and [Arabic review](BRAND-AND-LANGUAGES.md) for editorial changes.

## Branding revert

Restored the original web grille mark and native letter mark. Removed the supplied PNG from the application and reverted its Expo icon override. Arabic/English functionality remains in place.

## Shared phone app, sign-in and tabs - 26 September 2026

Ran and passed:

- `npm run format:check` and `npm run check`: lint, TypeScript, **48 tests in 6 suites** (new `tests/apps-script.test.ts` runs the generated `apps-script/dist/Code.gs` against in-memory Drive, Sheets, lock and properties services), server build.
- `npm run test:api` against an isolated `next start` server with its own empty data folder.
- `npm run mobile:bundle`: Android and iOS Hermes exports.
- Browser walkthrough at 375 x 812 of the Pages build pointed at `scripts/apps-script-emulator.mjs` (the real script file, local stand-ins for Google): first-launch sign-in with the Digital Egypt demo button, name and email; empty platform; report `BLAA-000001` with photo; a second, separate browser profile seeing the report, photo and history without the citizen's email; staff sign-in refused without a code and with a wrong code; district agent acknowledge, start, resolve with photo and note; before/after and full history visible back on the first profile; Downtown Cairo GPS routed to "District pending"; admin outbox listing district, routing-team and masked citizen messages marked not sent; English layout.

Not verified: the script deployed on Google itself (Drive sharing, web app redirects and quotas), and physical phones.
