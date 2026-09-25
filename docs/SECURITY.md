# Security and deployment boundaries

## Current deployment status

This is a runnable **local prototype**, not a production deployment. The role chooser and identity provider intentionally simulate identities. Do not expose the demo server to an untrusted network. `APP_MODE=supabase` uses real Supabase Auth sessions and database authorization. It never silently falls back to the local backend.

## Implemented controls

- Strict schemas, server-computed districts, capture age/accuracy checks, bounded coordinate correction, owned media, safe BLAA IDs and role/district checks on every staff write.
- Cryptographically random demo tokens stored as hashes; HTTP-only, SameSite cookies for web; secure token storage on native. HTTPS sessions use Secure cookies. Cookie mutations enforce same-host Origin; native uses bearer tokens.
- Original media ownership, MIME decoding and byte/pixel limits. Demo uploads are re-encoded to JPEG without EXIF. Public access is revoked when moderation is no longer safe.
- Explicit public DTO, rounded public locations, no citizen/provider IDs in district/public responses. Public timelines do not include internal notes or actor identity.
- Duplicate confirmation uniqueness, hourly submission/upload limits, temporary suspensions with administrative review, audit events and status history.
- PostgreSQL RLS, revoked direct writes, security-definer RPC authorization, scoped projections, immutable audit/history and private storage with short-lived signed URLs.
- Inert test notification provider. Even if given a real recipient, it only returns a reserved `.invalid` test destination. Production email selection fails closed. Database test deliveries enforce the same restriction.

## Known limits / release gates

1. Integration-test the supplied web/mobile Supabase transport against a live Supabase instance before hosted use. Run the migrations and pgTAP tests on actual local Supabase/PostGIS. The default local demo persists JSON and is unsuitable for multiple processes, serverless filesystems, production load or backups.
2. Replace synthetic polygons with reviewed, licensed district boundaries and validate official operational contacts. No real authority has agreed to receive reports here.
3. Implement an authorized identity provider only after formal authorization; verify callback signatures, state/nonce and session lifecycle. Do not repurpose the mock to claim verified government identity.
4. Replace demo text rules with a reviewed image/text moderation process. Demo `safe` means a rule simulation, not a safety guarantee. Hosted originals remain private until a moderator approves a redacted derivative; inspect faces, plates, documents and identifiable context. Removing EXIF alone is insufficient.
5. Establish retention/deletion/appeal policies, consent and operational review, abuse monitoring and shared rate limiting. GPS/device timestamps are untrusted evidence and do not prove physical presence or authenticity.
6. Complete native-device permission, camera, Arabic accessibility and network testing. A Metro export proves bundling, not device behavior or a signed application binary.
7. Add operational image cleanup, bounded pagination, observability and tests for concurrency under expected traffic. The current demo uses in-memory reads of a local JSON document.
8. Review tile-provider terms, privacy, offline behavior and hosting security headers/CSP. No tracking analytics are included.

No automatic permanent bans or government escalation. No service-role key belongs in mobile/frontend code, source control, screenshots or logs. Environment examples contain placeholders only.

Report security issues privately to the eventual repository maintainer before publishing sensitive exploit details. The repository has no official security contact yet.
