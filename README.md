# بلاعة — Balaa

**بلّغ. تابع. خلّي الطريق أأمن.**

Independent open-source civic-tech prototype for reporting and tracking road problems. Arabic RTL and English LTR, Android first, with an iOS-compatible Expo app and responsive Next.js district dashboard.

**This is an independent open-source civic-tech prototype. The current Digital Egypt login is a mock demonstration. No official government integration, partnership or endorsement is implied.** No national ID numbers are requested or stored. No messages are delivered to government addresses.

## Run the working local demo

Use Node.js 24 LTS and npm 11.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). No external credentials or Docker are needed for this demonstration. Local demo mode is the default. Its server-side data persists under `apps/dashboard/.balaa/`, ignored by Git.

1. Choose **بلّغ عن مشكلة**, complete the clearly marked mock verification.
2. Use **صورة تجريبية** and **موقع المعادي التجريبي**, or camera/GPS in the supported fixture area.
3. Choose category/severity, review and submit. Track the `BLAA-…` ID.
4. Open **لوحة الأحياء** → **موظف حي المعادي**. Acknowledge the report, start work, upload a resolution image and enter a resolution note.
5. Resolve it and open the public report to see before/after evidence.
6. Sign out, enter **مدير المنصة**, then inspect the test inbox, categories and account review. **مراجع المحتوى** demonstrates the moderation queue. A description containing `[flag]` is held for review.

These buttons create local demo sessions; they are not a production staff authentication mechanism. Run only on a trusted development network.

## Logo, languages and installing on a phone

The supplied logo is included. Switch **EN / العربية** in the web or mobile header; your preference is saved. Arabic interface wording has been reviewed and corrected. Citizen-written descriptions are retained as submitted.

[GitHub + Android/iPhone installation guide](docs/GITHUB-AND-PHONE.md) · [Brand and Arabic review](docs/BRAND-AND-LANGUAGES.md)

## Mobile

```sh
# apps/mobile/.env: EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:3000
npm run mobile
```

Use an Expo SDK 57-compatible development environment. Native camera, foreground GPS, secure token storage, bounded location corrections, duplicate confirmation, tracking and before/after views are implemented. Gallery and synthetic location controls are gated to development builds. See [mobile setup](apps/mobile/README.md).

## What is included

- Citizen journey and MapLibre public map, approximate public coordinates, account-free browsing.
- Persistent demo HTTP API with input validation, scoped staff authorization, token hashing, audit history, capture evidence checks, rate limits and unique confirmations.
- Responsive district console, moderation, configurable bilingual categories, temporary suspension review and inert test inbox.
- Supabase/PostGIS migrations, RLS, private media policies, transactional RPCs, authenticated Edge Functions, versioned GeoJSON import and local account seed tools.
- Provider abstractions for identity, moderation and notifications; no real Digital Egypt or government services.

## Demo versus hosted backend

The default demonstration uses a local JSON-backed API. Set `APP_MODE=supabase` with the documented credentials to route the same web/mobile API through Supabase Auth, Storage, PostGIS RPCs and Edge Functions. Caller JWTs retain RLS enforcement; the adapter never uses a service-role key. In this mode, staff log in with Supabase credentials and all media requires moderator approval before publication. The adapter is typechecked and transport-tested, but live Supabase integration has not been executed here because Docker/PostGIS is unavailable. Do not deploy mock identity or the local role chooser as production authentication.

Cairo reference names and four administrative areas are seeded, but only **two synthetic polygon fixtures** support demo routing. They are not official district boundaries. The Nasr City fixture is explicitly separate from the east/west administrative districts. Text-rule moderation does not certify image safety. See [security and release gates](docs/SECURITY.md).

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
# with the local server running:
npm run test:api
```

See [verification record](docs/VERIFICATION.md) for executed checks and limitations. [Setup](docs/SETUP.md) covers local Supabase, media review and native builds.

## Repository

`apps/mobile`, `apps/dashboard`, `packages/ui`, `packages/types`, `packages/config`, `packages/geo`, `supabase/migrations`, `supabase/seed`, `supabase/functions`, `data`, `docs`.

[Original PRD](docs/PRD.md) · [Architecture](docs/ARCHITECTURE.md) · [Data model](docs/DATA-MODEL.md) · [Implementation plan](docs/IMPLEMENTATION-PLAN.md) · [Contributing](docs/CONTRIBUTING.md) · [Roadmap](docs/ROADMAP.md)

MIT licensed. Synthetic boundary fixtures are CC0; see [data provenance](data/README.md).
