# Balaa handover for Claude Code

Prepared 26 September 2026. This document describes the existing implementation and prior decisions; it is not authorization to publish, deploy, purchase services or contact third parties. Continue from the current repository rather than rebuilding it.

## Project and owner decisions

**Balaa / بلاعة** is an independent open-source civic-tech prototype for documenting road problems, routing them geographically and tracking repairs. Cairo is the initial dataset, not a hard-coded architectural limit. The requested tagline is **بلّغ. تابع. خلّي الطريق أأمن.**

Latest accepted user decisions:

- Support **Arabic and English** on web and mobile. Arabic is the default; retain the language switch, saved preference, RTL/LTR behavior and reviewed Arabic copy.
- **Restore the original logo.** The latest implementation uses the original teal grille mark on web and the original letter mark on native. The subsequently supplied navy/gold PNG was explicitly reverted and removed. Do not reintroduce it from Git history.
- The user intends to test on **both Android and iPhone** and wants to publish the source to GitHub. Instructions and build configuration are supplied; no repository destination or developer account has been connected.
- Do not imply official government affiliation, endorsement, identity verification or real authority delivery. Digital Egypt is a labeled mock. No national IDs are collected.

## Where to open the project

On the original computer, the actual repository root is:

```text
C:\Users\ahmed\Documents\Codex\2026-09-25\i-x20\outputs\balaa
```

Open Claude Code in **that directory**, not the parent dated task folder. All relative paths and commands below assume this root.

The sibling `balaa-mvp.zip` contains the current tracked source under a `balaa/` directory. It excludes `.git`, dependencies, local environment files, local reports and generated builds. On the same machine, use the existing directory to retain history. On a different machine, transfer a Git clone/bundle if you need history; extracting the ZIP supplies source only.

Implementation history before this documentation handover:

| Commit    | Meaning                                                      |
| --------- | ------------------------------------------------------------ |
| `53ab3f8` | Initial runnable prototype and Supabase foundation           |
| `9d3c2eb` | Arabic/English support, supplied logo and distribution guide |
| `ba07edb` | Restore original branding; retain all language features      |

The local branch was `master`, no Git remote was configured, and the working tree was clean before adding these handover files. Inspect current `git status` and history before editing. No PR or hosted deployment exists from this task.

## First run

Use Node.js 24 and npm 11. Install dependencies at the monorepo root:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. The default demo needs no cloud credentials or Docker. If port 3000 is already in use on the original machine, check for the existing development server before starting another.

The server listens on `0.0.0.0` for phone testing. It is intended for a trusted development network; its demo role chooser is not production authentication. For loopback-only use:

```sh
npm run dev --workspace @balaa/dashboard -- --hostname 127.0.0.1
```

Demo data is lazily created and persisted in `apps/dashboard/.balaa/`. Existing local data includes synthetic reports made during prior API/browser verification. The ZIP does not contain that state. Do not delete it as routine setup. `BALAA_DATA_DIR` can point a separate server at isolated test data. `npm run test:api` **creates test reports and updates their states** in the target demo server; it is not read-only.

## Architecture and important files

| Area                | Files / responsibilities                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Browser citizen app | `apps/dashboard/src/app/page.tsx`: home, report map, citizen tracking, onboarding and district navigation                |
| Web report UI       | `apps/dashboard/src/components/CreateReport.tsx`, `ReportDetail.tsx`, `ReportCard.tsx`                                   |
| Staff/admin         | `apps/dashboard/src/components/Dashboard.tsx`, `AbuseReview.tsx`                                                         |
| Public routes       | `apps/dashboard/src/app/map/page.tsx`, `apps/dashboard/src/app/reports/[id]/page.tsx`                                    |
| HTTP entry point    | `apps/dashboard/src/app/api/[...path]/route.ts`: shared browser/native API, environment selection and request checks     |
| Demo backend        | `apps/dashboard/src/server/service.ts`, `store.ts`: authorization, lifecycle, validation, DTOs, atomic local persistence |
| Supabase adapter    | `apps/dashboard/src/server/supabase.ts`: Auth, Storage, RLS projections and Edge/RPC calls using the caller's JWT        |
| Native citizen app  | `apps/mobile/App.tsx`, `src/components.tsx`, `src/api.ts`, `src/domain.ts`                                               |
| Domain contracts    | `packages/types/src/index.ts`: Zod schemas, states and types                                                             |
| Providers           | `packages/config/src/index.ts`: identity, moderation, notification contracts and demo implementations                    |
| Geography           | `packages/geo/src/index.ts`; `data/` source JSON/GeoJSON; Supabase mode uses PostGIS                                     |
| Localization        | `packages/ui/src/messages.ts`, `i18n.ts`, `locale.tsx`; web provider in `components/LanguageProvider.tsx`                |
| Branding            | Web `components/Brand.tsx`; native original letter mark in `App.tsx`                                                     |
| Database            | Four files under `supabase/migrations/`, generated `supabase/seed/seed.sql`, seed/import tools                           |
| Edge Functions      | `supabase/functions/{mock-identity,reports,test-notifications}` plus `_shared/http.ts`                                   |
| Distribution        | `apps/mobile/eas.json`, `app.config.ts`, `docs/GITHUB-AND-PHONE.md`                                                      |

Stack at handover: Next.js 16.3.6, React 19.2.3, Expo ~57.0.25, React Native 0.86.3, TypeScript 5.9, Zod, MapLibre 6.11+, sharp 0.35+, Vitest 5. The lockfile is authoritative. Do not downgrade to a familiar framework version without a concrete compatibility reason.

There is a nested `apps/dashboard/AGENTS.md` generated by Next.js and a `CLAUDE.md` importing it. Read the relevant installed Next.js documentation before editing framework code. In this workspace it is hoisted at `node_modules/next/dist/docs/`; search the installed package if a path differs.

## Implemented product flow

The local demo supports:

1. Browse the public map without an account.
2. Start a report and complete clearly labeled mock identity verification.
3. Capture/upload a photo and obtain coordinates. Native uses the camera and foreground GPS; explicit development fixtures support testing elsewhere.
4. Identify a district, choose category/severity, review privacy and submit.
5. Detect open same-category reports within about 30 metres; offer a unique confirmation instead of requiring a duplicate.
6. Allocate a `BLAA-…` public ID, create status history and place a notification in an inert test inbox.
7. Track public reports with approximate coordinates and no reporter identity.
8. Use district-scoped staff actions: acknowledge, start work, resolve with image/note, reject, mark duplicate and add internal notes.
9. Show before/after images for resolved reports.
10. Review flagged content, configure bilingual categories and review temporary account suspensions.

Public DTOs exclude citizen/provider identity. Staff access is server-authorized and district-scoped. Reports/media held by moderation are not automatically public. Local uploads are decoded/re-encoded without EXIF. This does not redact faces or plates.

Geographic data includes Cairo reference district names and four administrative areas but **only two synthetic routing polygons**. The Nasr City fixture is deliberately distinct from the official east/west district names. Real GPS outside fixtures is rejected, not silently reassigned.

## Two backend modes — do not conflate them

**Demo (default):** `APP_MODE=demo`, `AUTH_PROVIDER=digital_egypt_mock`, `EMAIL_MODE=test`. JSON storage, hashed demo sessions, simulated roles, rule-based moderation and reserved `.invalid` inbox destinations. Suitable for demonstration, not a hosted production service.

**Supabase:** `APP_MODE=supabase`. The API adapter exists and uses Supabase Auth, private Storage, authenticated Edge Functions and transactional PostGIS/RLS RPCs. It does not silently fall back to demo mode. Request handling uses the caller JWT and anon key, never a service-role key. Staff use real Supabase Auth email/password sessions; citizen identity remains an explicitly gated demonstration.

Supabase mode has **not been run against a live database** in the original environment. SQL parser tests do not establish that migrations, PL/pgSQL semantics, RLS, Storage or Edge Functions work end to end. Read [SETUP.md](SETUP.md) and execute integration gates before deployment.

Hosted media requires human review. Approval creates a metadata-stripped derivative; it does not automatically blur sensitive material. Resolution media is registered pending review, approved by a moderator, then the staff member retries resolution with the same image. Test notifications still do not leave the system.

## Environment and mobile details

- Next.js environment file: `apps/dashboard/.env.local`, using the root `.env.example` as a reference. Root `.env.example` is not automatically loaded by Next.
- Native environment file: `apps/mobile/.env`, based on its adjacent example.
- Physical phones: set `EXPO_PUBLIC_API_URL` to the computer's reachable LAN URL during local development. `localhost` points to the phone itself. Start the Next server separately from Metro.
- Run `npm run mobile` from the root. A matching SDK 57 Expo environment is required; do not assume any installed Expo Go release is compatible.
- Native MapLibre is a WebView of the companion `/map?embed=1&lang=…` page. It requires that server and a network connection.
- Gallery and synthetic GPS tools are development-only; release builds require camera/GPS and will reject unsupported locations.
- EAS `preview` produces an Android APK/internal iOS build. `production` is for store distribution. The app config rejects missing, localhost, reserved `.invalid` and non-HTTPS backend URLs during EAS builds.
- No Expo project ID, Apple signing, provisioning profile, store record or cloud build has been created here. `org.balaa.prototype` is a prototype identifier, not evidence of ownership.
- No custom native launcher icon is configured after the requested logo revert; the original native in-app letter mark is restored. Designing/exporting a store-ready launcher asset is a future distribution task.

Never copy service-role credentials into `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*`. Server-only seeding may use a service-role key, but the seed-user script intentionally refuses non-loopback Supabase hosts.

## Localization behavior to preserve

Arabic is the default. The switch stores its preference in browser localStorage / native SecureStore. Web also accepts `?lang=ar` or `?lang=en`. Dates and numbers use `ar-EG` / `en-GB`; native text and layout order adapt without removing the RTL design.

`messages.ts` contains interface translations keyed by source copy and Arabic editorial corrections. `useLocale()` provides `t`, `bilingual`, `date`, `dateLabel` and `number`. Use bilingual database fields for configurable categories, not a hard-coded English guess. User descriptions and staff notes are original content, not automatically translated. Raster basemap labels can remain Arabic in English mode. iOS permission text has both locale configurations, selected by the OS.

Arabic corrections include **جارٍ العمل**, **وصل إلى صندوق الاختبار**, the imperative **اختر**, and explicitly **تجريبي** identity wording. Preserve the requested Egyptian conversational tone in citizen invitations. See [BRAND-AND-LANGUAGES.md](BRAND-AND-LANGUAGES.md).

## Verification: what actually ran

The bilingual implementation passed:

- `npm run check`: ESLint, strict TypeScript, **43 tests in five suites**, optimized Next.js build.
- `npm run test:api`: mock identity, image upload, routing, test inbox, public privacy, district scope, duplicate confirmation, moderation and before/after lifecycle over HTTP.
- `npm run mobile:bundle`: Android/iOS Metro/Hermes exports. Export is not a signed APK/IPA or proof of native-device behavior.
- Browser checks of English report steps through review, district administration, Arabic switch/status wording and 390 x 844 layouts. Homepage and dashboard have no document-level horizontal overflow; wide tables scroll inside their container.
- Translation placeholder tests and preservation of authored content. SQL syntax/seed checks and mocked Supabase transport tests.
- EAS endpoint guard exercised with rejected missing/local/insecure/reserved URLs and an accepted configured HTTPS URL.

After the latest logo-only revert, **lint and TypeScript were rerun and passed**. Full builds and native exports above predate that revert. No tests were rerun just to create this handover. `docs/VERIFICATION.md` contains the chronological record.

Useful commands:

```sh
npm run check
npm run format:check
# Requires a running, disposable/local demo server; creates test records:
npm run test:api
npm run mobile:bundle
```

On PowerShell, bundling was also run with `EXPO_NO_TELEMETRY=1` and `EXPO_OFFLINE=1` in the process environment. A direct Node 24 TypeScript invocation is used for seed/smoke scripts because the tsx launcher failed in the original sandbox with an OS-account lookup error.

## Known gaps and next priorities

These are recommendations for the next session, not claims that the work has been completed:

1. **Establish a fresh baseline on the new machine.** Install locked dependencies, inspect Git changes, run checks, and smoke-test both languages with the original branding.
2. **Exercise real Supabase locally.** Install/configure Docker, Supabase CLI and Deno if available. Run migrations, seeds, pgTAP and Deno checks. Test owner/non-owner, cross-district, moderator/admin access, public privacy, image publication/revocation and resolution approval. Root Node checks intentionally exclude Edge Functions.
3. **Address session lifecycle before real users.** Supabase automatic token refresh is not implemented. Anonymous mock citizens are not durable/recoverable government identities.
4. **Test physical Android and iPhone.** Validate permissions, camera/GPS, denied permissions, Arabic/English alignment, keyboard/screen readers, background resume and poor networks. Browser file-chooser automation timed out previously; normal upload APIs and the explicit browser fixture passed.
5. **Prepare the chosen GitHub destination and installation path with the owner.** Follow [GITHUB-AND-PHONE.md](GITHUB-AND-PHONE.md). No remote destination is configured. GitHub hosts source; GitHub Pages cannot run this Next.js API. An installed app still needs a reachable backend.
6. **Complete pilot data/operations gates.** Vetted boundaries and contacts, approved identity integration, operational moderation/redaction, retention/appeals and reviewed notification delivery remain outstanding. Do not substitute invented government integrations.
7. **Hardening:** shared rate limiting, pagination, media cleanup, concurrency/load validation, monitoring and hosted session handling. Local JSON persistence is not multi-instance/serverless storage.
8. **Dependency audit:** an earlier online audit found 10 moderate findings in Expo build tooling around nested uuid 7.0.3, with no high/critical findings after MapLibre/sharp updates. Requested overrides had not displaced that installed nested dependency. An offline install later printed zero findings; that is not equivalent to a fresh online audit. Recheck the current lockfile and registry before a release.

Avoid broad redesigns, framework migrations or new features such as payments, chat, SMS or automatic escalation unless the owner requests them. Some components are large; refactor incrementally only when it helps the next authorized task, preserving behavior.

## Reading order

1. This handover and [README](../README.md).
2. [Original PRD](PRD.md) and [build brief](BUILD-BRIEF.md) for requirements; the owner's later logo/language decisions above supersede earlier presentation choices.
3. [Architecture](ARCHITECTURE.md), [data model](DATA-MODEL.md), [API](API.md).
4. [Setup](SETUP.md), [security](SECURITY.md), [verification](VERIFICATION.md).
5. [GitHub/phone guide](GITHUB-AND-PHONE.md), [roadmap](ROADMAP.md), [contribution guide](CONTRIBUTING.md).
