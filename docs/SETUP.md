# Setup

## Requirements

Node.js 24 LTS, npm 11, Git. Android device/emulator and Expo SDK 57 for native testing. iOS native builds need macOS/Xcode or an explicitly configured build service. Supabase local development additionally needs Docker and the Supabase CLI. No global tools are installed by this repository.

## Default local demo

From the repository root, `npm ci`, then `npm run dev`. Open `http://localhost:3000`. The first API request creates a local persisted state with illustrative reports. Stop the server before resetting or backing up `apps/dashboard/.balaa`. There is no externally delivered email and no password in the local role chooser.

The development server listens on the LAN so a phone can access it. Keep it on a trusted network. For a loopback-only demo: `npm run dev --workspace @balaa/dashboard -- --hostname 127.0.0.1`.

To run an optimized local build: `npm run build`, then `npm run start --workspace @balaa/dashboard`. The production build command optimizes assets; it does not turn demo authentication into production authentication.

## Environment variables

Copy the relevant values from `.env.example` to `apps/dashboard/.env.local`. Next.js reads that file; it does not automatically read the monorepo root example. Copy `apps/mobile/.env.example` to `apps/mobile/.env` for Expo.

| Variable                                                          | Meaning                                                                                                                                |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_MODE`                                                        | `demo` by default. `supabase` selects the Supabase adapter; unknown values fail closed.                                                |
| `AUTH_PROVIDER`                                                   | `digital_egypt_mock`. Authorized provider names fail closed.                                                                           |
| `EMAIL_MODE`                                                      | `test`. Production transport is intentionally unavailable.                                                                             |
| `TEST_INBOX`                                                      | Reserved `.invalid` address; default `preview@balaa.invalid`.                                                                          |
| `BALAA_DATA_DIR`                                                  | Optional server-only local state directory for isolated tests.                                                                         |
| `EXPO_PUBLIC_API_URL`                                             | Phone-accessible Next.js base URL; use LAN IP or emulator host alias.                                                                  |
| `EXPO_PUBLIC_ENABLE_DEMO_INPUT`                                   | Additional development fixture switch. Native release builds hide fixtures regardless.                                                 |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`       | Fallback Supabase adapter settings. Prefer server-only `SUPABASE_URL` / `SUPABASE_ANON_KEY`. An anon key is not a service-role secret. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_SEED_PASSWORD` | Server/local seed only. Never put the latter two into a public/mobile variable.                                                        |
| `ENABLE_MOCK_IDENTITY`                                            | Edge Function opt-in, also gated by database runtime settings.                                                                         |
| `ALLOWED_ORIGINS`                                                 | Comma-separated Edge Function CORS allowlist.                                                                                          |

## Native application

1. Start the Next.js API.
2. Set `EXPO_PUBLIC_API_URL=http://<computer LAN IP>:3000`. Android emulator generally uses `http://10.0.2.2:3000`. `localhost` on a phone is the phone itself.
3. Run `npm run mobile`, then use a compatible Expo environment. `npm run android --workspace @balaa/mobile` builds with a configured Android SDK. iOS uses the corresponding `ios` command on macOS.
4. Permit camera and foreground location when exercising those features. Development-only synthetic Maadi coordinates allow a demonstration outside Cairo. Real GPS outside the fixtures is rejected, not assigned to a guessed district.

Bundle verification without native SDKs:

```sh
cd apps/mobile
npx expo export --platform android --platform ios --output-dir dist
```

The map is MapLibre in the companion `/map?embed=1` WebView. This keeps the citizen map consistent across Android/iOS and requires the companion server/network. OSM tiles are third-party network requests; choose a suitable tile provider and policy before deployment.

## Supabase mode

```sh
supabase start
supabase db reset
node supabase/seed/generate-seed.ts
supabase test db
```

`supabase db reset` is **for the local disposable database**. The checked-in seed is already generated. If you change source JSON, regenerate it before resetting. Never run reset against a populated/shared environment.

Obtain local keys with `supabase status`. Set `SUPABASE_URL`, server-only `SUPABASE_SERVICE_ROLE_KEY`, and a locally chosen `DEMO_SEED_PASSWORD` of at least 12 characters, then run:

```sh
node supabase/seed/demo-users.ts
```

The script refuses non-loopback hosts. It creates citizen, Maadi agent/manager, Nasr fixture agent, moderator and admin accounts using Supabase Auth Admin APIs, assigns roles and memberships, and never prints secrets. Their emails are in the script and use `.invalid`.

Copy `supabase/functions/.env.example` to a gitignored local env file and run:

```sh
supabase functions serve --env-file supabase/functions/.env.local
```

Use Supabase Auth-issued JWTs in the `Authorization` header. The functions validate the user through Auth and call RPCs with the same user JWT; no service-role credentials are used by these request handlers. See [Edge API](API.md). To connect both apps, set `APP_MODE=supabase`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `AUTH_PROVIDER=digital_egypt_mock`, and `ENABLE_MOCK_IDENTITY=true` in `apps/dashboard/.env.local`, then restart Next.js. The mobile API URL remains the Next.js URL. Citizen mock login creates an anonymous Supabase Auth session and calls the explicitly gated mock verification function. Staff enter their seeded email/password; role membership comes from the database, not a role button. Anonymous signup is enabled only in the checked-in local configuration.

### Hosted media workflow

Upload an original into private `report-originals/<user UUID>/<new unique filename>`, submit the report, review/redact media, upload a separate derivative into `report-derivatives`, and approve it with `moderate_image`. Approve report content with `moderate_report`. Only then can public views expose the report/image. Staff receives approved derivatives. Resolution images follow the same review path before `transition_report(..., 'resolved', ...)`.

The adapter moderation screen requires explicit confirmation that all displayed before/after photos contain no sensitive details. Approval creates metadata-stripped derivatives; it does not blur faces automatically. Block sensitive images and use a reviewed/redacted derivative through the Edge API. A staff resolution upload is registered for review first; approve it as moderator, then retry resolution with the same uploaded image. Platform admins can process the queued test notifications from the test inbox. The demo's rule-based publication shortcut is not used in Supabase mode. Public derivative URLs are signed for 60 seconds. Already issued URLs can remain usable until expiry after revocation.

### Geography import

```sh
node supabase/seed/import-boundaries.ts path/to/vetted.geojson path/to/review.sql
```

Features need `districtSlug`, `version`, `isSynthetic`, `sourceNote`, `license`, and Polygon/MultiPolygon geometry. New versions are inserted **inactive**. Review provenance, licensing, topology and overlaps before activating. Exactly one active boundary version per district is allowed. Ambiguous district matches fail closed.
