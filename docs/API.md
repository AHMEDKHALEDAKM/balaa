# API contracts

The Next.js `/api/*` interface serves both web and mobile. `APP_MODE` selects the local persisted demo or the Supabase adapter. Web uses an HTTP-only session cookie; mobile uses `Authorization: Bearer <token>`. JSON errors use `{error: string}` with an appropriate HTTP status. No service-role key is used in request handlers.

| Method/path                                          | Request / result                                                                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| GET `/api/config`                                    | Active backend mode, no credentials.                                                                                                |
| POST `/api/auth/mock`                                | Explicit prototype verification; returns `{user, token}`. In Supabase mode requires both environment opt-in and database mock gate. |
| POST `/api/auth/staff`                               | Local demo `{role}`; Supabase `{email,password}` with authoritative profile role lookup.                                            |
| GET `/api/auth/session`                              | `{user}`; expired Supabase sessions require sign-in again.                                                                          |
| POST `/api/auth/logout`                              | Revoke session and clear cookie.                                                                                                    |
| GET `/api/categories`                                | `{categories}` with bilingual names, slug ID and active flag.                                                                       |
| POST `/api/geo`                                      | `{latitude,longitude}` → `{district,dataset}`.                                                                                      |
| POST `/api/media`                                    | `{dataUrl,kind:'before'                                                                                                             | 'resolution'}`→`{imageUrl}`; owned normalized JPEG, 5 MB input limit. |
| POST `/api/reports/duplicates`                       | `{latitude,longitude,categoryId}` → nearby open same-category public reports.                                                       |
| POST `/api/reports`                                  | Capture metadata, original/adjusted coordinates, category, severity, description and owned image URL → `{report}`.                  |
| GET `/api/public/reports`, `/api/public/reports/:id` | Public allowlisted reports; id may be UUID or `BLAA-…`.                                                                             |
| GET `/api/me/reports`                                | Citizen's own reports, including held content.                                                                                      |
| POST `/api/reports/:id/confirm`                      | Idempotent citizen confirmation.                                                                                                    |
| GET `/api/dashboard/reports`                         | Server-scoped district reports.                                                                                                     |
| POST `/api/dashboard/reports/:id/status`             | `{status,note,imageUrl?,duplicateOf?}`. Resolution requires reviewed media in Supabase mode.                                        |
| POST `/api/dashboard/reports/:id/notes`              | Private `{note}`.                                                                                                                   |
| GET `/api/moderation`                                | Review queue, including pending resolution photos in Supabase mode.                                                                 |
| POST `/api/moderation/:id`                           | `{decision,note,redactionConfirmed?}`; Supabase safe approval requires explicit media review confirmation.                          |
| GET `/api/admin/outbox`                              | Inert test deliveries.                                                                                                              |
| POST `/api/admin/outbox/process`                     | Supabase admin processes queued test notifications.                                                                                 |
| POST `/api/admin/categories`                         | Create/update labels and active flag.                                                                                               |
| GET/POST `/api/admin/abuse`                          | Review metrics / temporary suspension `{userId,hours,note}`.                                                                        |

Media URLs are application routes; their permissions are checked on access. Supabase public routes issue 60-second signed derivative redirects. Unpublished originals require an owner/moderator or their uploader as appropriate.

## Edge Functions

The Supabase adapter uses `POST /functions/v1/reports` with an `action` and validated fields. Responses are `{data: ...}`; actions are `submit`, `confirm`, `transition`, `resolve_district`, `duplicates`, `register_image`, `moderate_report`, `moderate_image`, `note`, `image_url`. See `supabase/functions/reports/index.ts` for exact schemas. Every call validates the JWT through Supabase Auth and carries the same JWT to RPC/Storage.

`mock-identity` invokes the database's gated `complete_mock_verification`. `test-notifications` invokes the admin-only transactional outbox processor and never sends network email. Reference reads and administration use RLS-protected REST views/RPCs directly.

Supabase sessions expire; automatic refresh across native/web is not implemented in this prototype. Re-authenticate staff as needed. Anonymous mock citizens are demonstration identities, not durable recoverable government identities. Replace this lifecycle with the authorized provider before a real-user pilot.
