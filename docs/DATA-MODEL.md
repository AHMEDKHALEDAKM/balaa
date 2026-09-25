# Data model

Canonical schema: `supabase/migrations/202609250001_schema.sql`. Operations and policies are separate ordered migrations.

| Entity                                                   | Purpose                                                                                                                                                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| users, identity_verifications                            | Auth-linked application role, verification mode, temporary suspension. Provider subjects are private; no national ID field.                                                                  |
| countries, governorates, administrative_areas, districts | Country-independent geography hierarchy with consistent parent foreign keys.                                                                                                                 |
| district_boundaries                                      | Versioned SRID 4326 MultiPolygons, provenance/license, synthetic flag and GiST index.                                                                                                        |
| authorities, authority_contacts, routing_rules           | District authority and independently configured primary/technology/operations/area/escalation endpoints. Automatic escalation is absent.                                                     |
| district_memberships                                     | Explicit agent/manager district grants.                                                                                                                                                      |
| categories                                               | Editable Arabic/English labels and active flags.                                                                                                                                             |
| reports                                                  | Public sequence ID, private citizen FK, capture/raw and adjusted coordinates, accuracy/time, routing, moderation and status. Geography point generated from coordinates and indexed by GiST. |
| report_images                                            | Private originals and separately reviewed public derivatives; before/after kind, approval and redaction confirmation.                                                                        |
| report_status_history, report_assignments                | Append-only transition and routing evidence.                                                                                                                                                 |
| report_confirmations                                     | Composite unique `(report_id,user_id)`. Transactionally increments aggregate once.                                                                                                           |
| internal_notes                                           | Staff notes excluded from public timelines.                                                                                                                                                  |
| resolution_records                                       | Immutable note, approved after-image, resolving agent/time.                                                                                                                                  |
| notifications, email_deliveries                          | Transactional outbox and test-only delivery evidence.                                                                                                                                        |
| moderation_events                                        | Actor, decision and reason for report/image review.                                                                                                                                          |
| abuse_events, appeals                                    | Reviewable strikes, temporary suspension and appeal records.                                                                                                                                 |
| audit_logs                                               | Append-only privileged-action record.                                                                                                                                                        |
| private.runtime_settings, private.rate_limits            | Non-public environment gates and transactional rate counters.                                                                                                                                |

`guest` is represented by Supabase's unauthenticated `anon` role, not an account row. All public-schema tables have RLS enabled and no client write grants. Security-definer RPCs use an empty search path and explicit authorization.

Public views allowlist columns: category, rounded location, district, timestamps, status, confirmation count and approved media. They exclude free-text descriptions in the hosted foundation to avoid accidental identity disclosure. District views return citizen verification status, not citizen UUID/provider identifiers. Owners read their own base records; moderators inspect originals for redaction. Public history excludes staff notes and actor identifiers.

Status transitions record history through a database trigger. Resolution requires approved after-image plus note. Rejected/resolved/duplicate are terminal in v0.1. The PostgreSQL test outbox does not mark an authority delivery; the standalone demo labels its `delivered` state explicitly as arrival at a test inbox.

The local demonstration uses the same domain concepts in an atomically written JSON file. It is single-process only, has a serialized mutation queue, and is not a substitute for the database/RLS backend. See `apps/dashboard/src/server/store.ts` and `service.ts`.
