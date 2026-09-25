-- Deny by default. RLS controls base tables; safe definer projections explicitly
-- constrain rows AND columns so agents never gain citizen UUID/provider access.
create policy own_profile on public.users for select to authenticated using(id=auth.uid() or private.has_role(array['platform_admin']::public.app_role[]));
create policy own_verifications on public.identity_verifications for select to authenticated using(user_id=auth.uid());
create policy own_memberships on public.district_memberships for select to authenticated using(user_id=auth.uid() or private.has_role(array['platform_admin']::public.app_role[]));
create policy own_reports on public.reports for select to authenticated using(user_id=auth.uid());
create policy own_images on public.report_images for select to authenticated using(private.can_read_original(report_id));
create policy own_confirmations on public.report_confirmations for select to authenticated using(user_id=auth.uid());
create policy own_notifications on public.notifications for select to authenticated using(recipient_user_id=auth.uid() or private.has_role(array['platform_admin']::public.app_role[]));
create policy own_appeals on public.appeals for select to authenticated using(user_id=auth.uid() or private.can_moderate());
create policy own_abuse_events on public.abuse_events for select to authenticated using(user_id=auth.uid() or private.can_moderate());
create policy own_history on public.report_status_history for select to authenticated using(exists(select 1 from public.reports r where r.id=report_id and r.user_id=auth.uid()));
create policy district_notes on public.internal_notes for select to authenticated using(exists(select 1 from public.reports r where r.id=report_id and private.can_manage_district(r.district_id)));
-- Base report RLS would hide staff rows in the note policy, so expose notes only
-- through district_report_notes below. Do not grant table SELECT to staff.
create policy platform_contacts on public.authority_contacts for select to authenticated using(private.has_role(array['platform_admin']::public.app_role[]));
create policy platform_routing on public.routing_rules for select to authenticated using(private.has_role(array['platform_admin']::public.app_role[]));
create policy platform_audit on public.audit_logs for select to authenticated using(private.has_role(array['platform_admin']::public.app_role[]));
create policy platform_deliveries on public.email_deliveries for select to authenticated using(private.has_role(array['platform_admin']::public.app_role[]));
create policy moderator_events on public.moderation_events for select to authenticated using(private.can_moderate());
do $$ declare entity text; begin
  foreach entity in array array['countries','governorates','administrative_areas','districts','district_boundaries','categories','authorities'] loop
    execute format('create policy reference_read on public.%I for select to anon,authenticated using(true)',entity);
    execute format('grant select on public.%I to anon,authenticated',entity);
  end loop;
end $$;
grant select on public.users,public.identity_verifications,public.district_memberships,public.reports,public.report_images,
  public.report_confirmations,public.notifications,public.appeals,public.abuse_events,public.report_status_history,
  public.authority_contacts,public.routing_rules,public.audit_logs,public.email_deliveries,public.moderation_events to authenticated;

-- These are deliberately owner-evaluated security-barrier views (not invoker
-- views): callers have no base-table permission to other citizens' reports.
-- Never replace explicit projections with SELECT * or remove WHERE predicates.
create view public.public_reports with (security_barrier=true) as
select r.id,r.public_id,c.slug as category_slug,c.name_ar as category_ar,c.name_en as category_en,
  r.severity,round(r.latitude::numeric,3) as latitude,round(r.longitude::numeric,3) as longitude,
  d.id as district_id,d.slug as district_slug,d.name_ar as district_ar,d.name_en as district_en,
  r.status,r.confirmation_count,r.created_at,r.acknowledged_at,r.resolved_at,b.is_synthetic as demo_boundary
from public.reports r join public.categories c on c.id=r.category_id join public.districts d on d.id=r.district_id
  join public.district_boundaries b on b.id=r.boundary_id
where r.moderation_status='safe' and r.status not in ('under_review','rejected')
  and exists(select 1 from public.report_images i where i.report_id=r.id and i.kind='before' and i.moderation_status='safe' and i.public_path is not null and i.redaction_confirmed);
create view public.public_report_images with (security_barrier=true) as
select i.id,i.report_id,i.kind,i.public_path,i.created_at
from public.report_images i join public.public_reports r on r.id=i.report_id
where i.moderation_status='safe' and i.public_path is not null and i.redaction_confirmed
  and (i.kind='before' or (r.status='resolved' and exists(select 1 from public.resolution_records rr where rr.report_id=r.id and rr.resolution_image_id=i.id)));
create view public.public_report_timeline with (security_barrier=true) as
select h.id,h.report_id,h.from_status,h.to_status,h.created_at
from public.report_status_history h join public.public_reports r on r.id=h.report_id;
create view public.district_reports with (security_barrier=true) as
select r.id,r.public_id,r.category_id,c.slug as category_slug,c.name_ar as category_ar,c.name_en as category_en,
  r.description,r.severity,r.latitude,r.longitude,r.gps_accuracy,r.captured_at,
  r.district_id,d.slug as district_slug,d.name_ar as district_ar,r.status,r.moderation_status,
  r.confirmation_count,r.assigned_authority_id,r.created_at,r.acknowledged_at,r.resolved_at,
  u.verified as citizen_verified,b.is_synthetic as demo_boundary
from public.reports r join public.users u on u.id=r.user_id join public.categories c on c.id=r.category_id
  join public.districts d on d.id=r.district_id join public.district_boundaries b on b.id=r.boundary_id
where private.can_manage_district(r.district_id) and r.moderation_status='safe';
create view public.district_report_notes with (security_barrier=true) as
select n.id,n.report_id,n.note,n.created_at
from public.internal_notes n join public.reports r on r.id=n.report_id where private.can_manage_district(r.district_id);
create view public.district_report_timeline with (security_barrier=true) as
select h.id,h.report_id,h.from_status,h.to_status,h.created_at
from public.report_status_history h join public.reports r on r.id=h.report_id where private.can_manage_district(r.district_id);
create view public.district_report_images with (security_barrier=true) as
select i.id,i.report_id,i.kind,i.public_path,i.moderation_status,i.created_at
from public.report_images i join public.reports r on r.id=i.report_id where private.can_manage_district(r.district_id)
  and i.moderation_status='safe' and i.public_path is not null and i.redaction_confirmed;
create view public.moderation_queue with (security_barrier=true) as
select r.id,r.public_id,r.description,r.category_id,r.district_id,r.status,r.moderation_status,r.created_at
from public.reports r where private.can_moderate();
create view public.abuse_review_summary with (security_barrier=true) as
select u.id as user_id,u.suspended_until,u.abuse_strikes,
  count(r.id) as reports_submitted,count(r.id) filter(where r.status='rejected') as reports_rejected,
  count(r.id) filter(where r.status='duplicate') as duplicate_reports,
  count(r.id) filter(where r.moderation_status in ('flagged','blocked')) as flagged_submissions
from public.users u left join public.reports r on r.user_id=u.id where private.can_moderate() group by u.id;
grant select on public.public_reports,public.public_report_images,public.public_report_timeline to anon,authenticated;
grant select on public.district_reports,public.district_report_notes,public.district_report_timeline,
  public.district_report_images,public.moderation_queue,public.abuse_review_summary to authenticated;

-- Both buckets are private. Even derivatives are served through short-lived
-- signed URLs so later moderation revocation stops new access immediately.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('report-originals','report-originals',false,8388608,array['image/jpeg','image/png','image/webp']),
      ('report-derivatives','report-derivatives',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy original_upload on storage.objects for insert to authenticated with check(
  bucket_id='report-originals' and (storage.foldername(name))[1]=auth.uid()::text
  and exists(select 1 from public.users u where u.id=auth.uid() and u.verified and (u.suspended_until is null or u.suspended_until<=now()))
);
create policy original_read on storage.objects for select to authenticated using(
  bucket_id='report-originals' and (owner_id=auth.uid()::text or exists(select 1 from public.report_images i where i.original_path=name and private.can_read_original(i.report_id)))
);
-- No UPDATE/DELETE policies: storage objects cannot be silently replaced after
-- approval. New versions use new paths and pass moderation again.
create policy derivative_upload on storage.objects for insert to authenticated with check(bucket_id='report-derivatives' and private.can_moderate());
create policy derivative_read_public on storage.objects for select to anon,authenticated using(
  bucket_id='report-derivatives' and exists(select 1 from public.public_report_images i where i.public_path=name)
);
create policy derivative_read_staff on storage.objects for select to authenticated using(
  bucket_id='report-derivatives' and (private.can_moderate() or exists(select 1 from public.district_report_images i where i.public_path=name))
);

comment on view public.public_reports is 'Safe, owner-evaluated allowlist; no citizen identity, free text, original media or exact coordinates. Security-barrier WHERE is an authorization boundary.';
comment on view public.district_reports is 'Explicit district role and membership filter; verified boolean only; no citizen/provider ID.';
