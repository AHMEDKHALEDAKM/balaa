-- Balaa v0.1. PostgreSQL 15+/Supabase. No national identity numbers are stored.
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.app_role as enum ('citizen','district_agent','district_manager','moderator','platform_admin');
create type public.report_status as enum ('submitted','delivered','acknowledged','in_progress','resolved','rejected','duplicate','under_review');
create type public.moderation_status as enum ('pending','safe','flagged','blocked');
create type public.report_severity as enum ('normal','dangerous','critical');

create table public.users (
  id uuid primary key references auth.users(id),
  role public.app_role not null default 'citizen',
  verified boolean not null default false,
  suspended_until timestamptz,
  abuse_strikes integer not null default 0 check (abuse_strikes >= 0),
  created_at timestamptz not null default now()
);
create table public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  identity_provider text not null check (identity_provider in ('digital_egypt_mock','digital_egypt')),
  verification_mode text not null check (verification_mode in ('demo','authorized')),
  provider_subject_id text not null,
  verified_at timestamptz not null default now(),
  unique (identity_provider, provider_subject_id),
  check ((identity_provider = 'digital_egypt_mock' and verification_mode = 'demo') or
         (identity_provider = 'digital_egypt' and verification_mode = 'authorized'))
);
create table public.countries (
  id uuid primary key default gen_random_uuid(), code text unique not null check (length(code) = 2),
  name_ar text not null, name_en text not null
);
create table public.governorates (
  id uuid primary key default gen_random_uuid(), country_id uuid not null references public.countries(id),
  slug text unique not null, name_ar text not null, name_en text not null
);
create table public.administrative_areas (
  id uuid primary key default gen_random_uuid(), governorate_id uuid not null references public.governorates(id),
  slug text not null, name_ar text not null, name_en text not null,
  unique(governorate_id, slug), unique(id, governorate_id)
);
create table public.districts (
  id uuid primary key default gen_random_uuid(), governorate_id uuid not null references public.governorates(id),
  administrative_area_id uuid not null, slug text unique not null,
  name_ar text not null, name_en text not null, enabled boolean not null default false,
  reference_verified boolean not null default false,
  foreign key(administrative_area_id, governorate_id) references public.administrative_areas(id, governorate_id),
  unique(id, administrative_area_id, governorate_id)
);
create table public.district_boundaries (
  id uuid primary key default gen_random_uuid(), district_id uuid not null references public.districts(id),
  version text not null, geom extensions.geometry(MultiPolygon, 4326) not null,
  source_url text, source_note text not null, license text not null,
  is_synthetic boolean not null default true, active boolean not null default false,
  imported_at timestamptz not null default now(),
  check (extensions.st_isvalid(geom) and not extensions.st_isempty(geom)),
  unique(district_id, version)
);
create unique index district_one_active_boundary on public.district_boundaries(district_id) where active;
create index district_boundary_gist on public.district_boundaries using gist(geom) where active;
create table public.authorities (
  id uuid primary key default gen_random_uuid(), district_id uuid not null references public.districts(id),
  name_ar text not null, name_en text not null, enabled boolean not null default true,
  is_demo boolean not null default true, unique(id, district_id)
);
create unique index district_primary_authority on public.authorities(district_id) where enabled;
create table public.authority_contacts (
  id uuid primary key default gen_random_uuid(), authority_id uuid not null references public.authorities(id),
  endpoint_type text not null check(endpoint_type in ('primary','technology_center','operations','area','escalation')),
  email text not null check(email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  enabled boolean not null default false, verified_at timestamptz, is_test boolean not null default true,
  unique(authority_id, endpoint_type, email),
  check (not is_test or email like '%.invalid')
);
create table public.routing_rules (
  id uuid primary key default gen_random_uuid(), district_id uuid not null references public.districts(id),
  endpoint_type text not null default 'primary' check(endpoint_type in ('primary','technology_center','operations')),
  enabled boolean not null default false,
  unique(district_id)
);
create table public.district_memberships (
  user_id uuid not null references public.users(id), district_id uuid not null references public.districts(id),
  granted_by uuid references public.users(id), created_at timestamptz not null default now(),
  primary key(user_id, district_id)
);
create table public.categories (
  id uuid primary key default gen_random_uuid(), slug text unique not null,
  name_ar text not null, name_en text not null, active boolean not null default true,
  display_order integer not null default 0
);
create sequence public.report_number_seq start 1;
create function private.next_report_number() returns text language plpgsql security definer set search_path = '' as $$
declare sequence_value text := nextval('public.report_number_seq')::text;
begin return 'BLAA-' || lpad(sequence_value,greatest(6,length(sequence_value)),'0'); end $$;
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default private.next_report_number(),
  user_id uuid not null references public.users(id), category_id uuid not null references public.categories(id),
  description text not null default '' check(char_length(description) <= 500),
  severity public.report_severity not null,
  latitude double precision not null check(latitude between -90 and 90),
  longitude double precision not null check(longitude between -180 and 180),
  captured_latitude double precision not null check(captured_latitude between -90 and 90),
  captured_longitude double precision not null check(captured_longitude between -180 and 180),
  gps_accuracy double precision not null check(gps_accuracy > 0 and gps_accuracy <= 200),
  captured_at timestamptz not null, device_timestamp timestamptz not null,
  location extensions.geography(Point,4326) generated always as
    (extensions.st_setsrid(extensions.st_makepoint(longitude,latitude),4326)::extensions.geography) stored,
  governorate_id uuid not null, administrative_area_id uuid not null, district_id uuid not null,
  boundary_id uuid not null references public.district_boundaries(id),
  status public.report_status not null default 'submitted',
  moderation_status public.moderation_status not null default 'pending',
  duplicate_of uuid references public.reports(id),
  confirmation_count integer not null default 0 check(confirmation_count >= 0),
  assigned_authority_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  acknowledged_at timestamptz, resolved_at timestamptz,
  foreign key(district_id,administrative_area_id,governorate_id) references public.districts(id,administrative_area_id,governorate_id),
  foreign key(assigned_authority_id,district_id) references public.authorities(id,district_id),
  check(duplicate_of is null or duplicate_of <> id),
  check((status = 'duplicate') = (duplicate_of is not null)),
  check((status = 'resolved') = (resolved_at is not null))
);
create index reports_location_gist on public.reports using gist(location);
create index reports_district_status on public.reports(district_id,status,created_at desc);
create index reports_owner_created on public.reports(user_id,created_at desc);
create index reports_public on public.reports(created_at desc) where moderation_status = 'safe';
create table public.report_images (
  id uuid primary key default gen_random_uuid(), report_id uuid not null references public.reports(id),
  uploaded_by uuid not null references public.users(id), kind text not null check(kind in ('before','after')),
  original_path text unique not null,
  public_path text unique,
  moderation_status public.moderation_status not null default 'pending',
  redaction_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  check (public_path is null or (moderation_status = 'safe' and redaction_confirmed))
);
create table public.report_status_history (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.reports(id),
  from_status public.report_status, to_status public.report_status not null,
  changed_by uuid references public.users(id),
  -- Only generic status labels are public. Internal notes never enter public timelines.
  created_at timestamptz not null default now()
);
create index report_history_chronological on public.report_status_history(report_id,created_at);
create table public.report_confirmations (
  report_id uuid not null references public.reports(id), user_id uuid not null references public.users(id),
  created_at timestamptz not null default now(), primary key(report_id,user_id)
);
create table public.report_assignments (
  id uuid primary key default gen_random_uuid(), report_id uuid not null references public.reports(id),
  authority_id uuid not null references public.authorities(id), assigned_by uuid references public.users(id),
  created_at timestamptz not null default now()
);
create table public.internal_notes (
  id uuid primary key default gen_random_uuid(), report_id uuid not null references public.reports(id),
  actor_id uuid not null references public.users(id), note text not null check(char_length(note) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table public.resolution_records (
  id uuid primary key default gen_random_uuid(), report_id uuid unique not null references public.reports(id),
  resolved_by uuid not null references public.users(id), resolution_note text not null check(char_length(trim(resolution_note)) between 1 and 2000),
  resolution_image_id uuid not null references public.report_images(id),
  resolved_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), report_id uuid not null references public.reports(id),
  kind text not null check(kind in ('district_new_report','citizen_status')),
  recipient_user_id uuid references public.users(id),
  status text not null default 'queued' check(status in ('queued','test_recorded','sent','failed','cancelled')),
  event_key text unique not null, payload jsonb not null default '{}',
  created_at timestamptz not null default now(), processed_at timestamptz
);
create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(), notification_id uuid not null references public.notifications(id),
  mode text not null default 'test' check(mode in ('test','production')),
  recipient text not null, subject text not null, body jsonb not null,
  provider_message_id text, created_at timestamptz not null default now(),
  -- Production sending is deliberately unavailable in v0.1.
  check(mode = 'test' and recipient like '%.invalid'), unique(notification_id)
);
create table public.moderation_events (
  id uuid primary key default gen_random_uuid(), report_id uuid not null references public.reports(id),
  image_id uuid references public.report_images(id), actor_id uuid references public.users(id),
  decision public.moderation_status not null,
  reason text not null check(char_length(reason) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table public.abuse_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id),
  actor_id uuid not null references public.users(id), reason text not null check(char_length(reason) between 1 and 2000),
  suspended_until timestamptz, created_at timestamptz not null default now()
);
create table public.appeals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id),
  reason text not null check(char_length(trim(reason)) between 1 and 2000),
  status text not null default 'pending' check(status in ('pending','upheld','dismissed')),
  reviewed_by uuid references public.users(id), review_note text,
  created_at timestamptz not null default now(), reviewed_at timestamptz
);
create table public.audit_logs (
  id bigint generated always as identity primary key, actor_id uuid references public.users(id),
  action text not null, entity_type text not null, entity_id text, details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table private.runtime_settings (
  singleton boolean primary key default true check(singleton),
  demo_identity_enabled boolean not null default false,
  synthetic_boundaries_enabled boolean not null default false,
  email_mode text not null default 'test' check(email_mode = 'test'),
  test_inbox text not null default 'balaa-test@example.invalid' check(test_inbox like '%.invalid')
);
insert into private.runtime_settings(singleton) values(true);
create table private.rate_limits (
  user_id uuid not null references public.users(id), action text not null,
  window_start timestamptz not null, count integer not null default 1,
  primary key(user_id,action,window_start)
);

-- Make future objects deny by default as well as objects in this migration.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

do $$ declare table_name text; begin
  for table_name in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;
alter table private.runtime_settings enable row level security;
alter table private.rate_limits enable row level security;
