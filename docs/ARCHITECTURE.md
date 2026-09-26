# Balaa architecture

Independent open-source civic-tech prototype. No government endorsement, identity integration, or operational delivery is claimed.

## Runtime boundaries

- `apps/mobile`: Expo React Native citizen application, Arabic RTL / English LTR, camera and foreground GPS; native iOS-compatible components. MapLibre renders the public map through the web companion in a WebView.
- `apps/dashboard`: Next.js App Router. Responsive district console, public map/tracking and browser citizen demonstration. HTTP API is shared with mobile.
- `packages/types`: Zod input schemas, bilingual category/status models, API contracts.
- `packages/config`: identity, moderation and notification provider contracts plus safe demo implementations.
- `packages/geo`: portable point-in-polygon fixture lookup and meter-distance helpers; the Supabase path uses PostGIS as its source of truth.
- `packages/ui`: shared design tokens, Arabic/English interface copy, formatting helpers and a React locale context shared by web and native.
- `supabase`: canonical PostgreSQL/PostGIS schema, RLS, RPC transitions, private media storage and Edge Function integration boundary.

## Two explicit operating environments

1. **Local demonstration**: `APP_MODE=demo`, `AUTH_PROVIDER=digital_egypt_mock`, `EMAIL_MODE=test`. A server-side persisted JSON store makes the complete journey runnable without Docker or accounts. HTTP-only demo session cookies and server-issued bearer tokens represent locally simulated identities. Fixed staff demo accounts have explicit district grants. The demo API is disabled unless APP_MODE is demo. Synthetic district polygons cannot be used to claim official routing. All emails stay in the test outbox. Rule-based moderation is demonstrative, not image safety certification.
2. **Supabase mode**: the Next.js API adapter forwards caller JWTs to Supabase Auth, Storage, authenticated Edge Functions, RLS views and transactional RPCs. Supabase Auth issues sessions. Production identity and email provider implementations are deliberately unavailable until authorized. Never fall back silently from hosted mode to demo mode.

The runnable default demonstrates the product. Supabase mode is implemented but not yet exercised against a live database in this environment. Hosted deployment requires configuring credentials, vetted geographic data, an authorized identity provider, reviewed media moderation/redaction and contact verification. Those are documented release gates, not simulated government services.

## Trust boundaries

The client supplies capture coordinates, accuracy and timestamp, never an authoritative district or citizen identity. The server validates coordinates, computes the district and duplicate candidates, evaluates moderation, assigns the authority and allocates the BLAA ID. GPS is device evidence, not proof against device tampering. Image EXIF is not used for routing.

Private original images remain behind authorization. Only approved public media and rounded coordinates enter an explicitly allowlisted public DTO. Agents receive an identity-verified boolean and no citizen/provider identifier. Every transition and privileged mutation records an audit event. Resolutions require a note and image. Confirmation is unique per citizen and report. Repeated requests do not increase the count twice.

## Routing and state

Country → governorate → administrative area → district → authority/contact endpoints. Boundaries are versioned multipolygons, loaded from GeoJSON. Overlaps fail closed for review. Unsupported coordinates cannot silently resolve to Cairo. Open same-category reports within 30m are offered as candidates; citizens may continue independently.

Submitted → delivered → acknowledged → in_progress → resolved. Under-review, rejected and duplicate are explicit alternative states; transitions are centrally validated. Test inbox delivery never means an actual authority received a report. Moderation states pending/flagged/blocked prevent public visibility and notifications. Resolution media also passes review before public release.

## Technical references

- [Expo SDK](https://docs.expo.dev/versions/latest/)
- [Next.js](https://nextjs.org/docs)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase PostGIS](https://supabase.com/docs/guides/database/extensions/postgis)
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
