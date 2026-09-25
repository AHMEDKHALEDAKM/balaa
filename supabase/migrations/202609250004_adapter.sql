-- Integration projections and media-upload budget. No new direct write grants.
drop policy own_images on public.report_images;
create policy own_images on public.report_images for select to authenticated
using(uploaded_by=auth.uid() or private.can_read_original(report_id));

drop view public.moderation_queue;
create view public.moderation_queue with(security_barrier=true) as
select r.id,r.public_id,r.description,r.category_id,r.district_id,r.status,r.moderation_status,
 r.severity,r.latitude,r.longitude,r.confirmation_count,r.created_at,r.resolved_at,u.verified as citizen_verified
from public.reports r join public.users u on u.id=r.user_id
where private.can_moderate() and (r.moderation_status<>'safe' or exists(
 select 1 from public.report_images i where i.report_id=r.id and i.moderation_status<>'safe'));
create view public.moderator_report_timeline with(security_barrier=true) as
select h.id,h.report_id,h.from_status,h.to_status,h.created_at
from public.report_status_history h where private.can_moderate();
grant select on public.moderation_queue,public.moderator_report_timeline to authenticated;

create function public.authorize_media_upload() returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_verified();
 perform private.consume_rate_limit('media_upload',30);
end $$;
revoke all on function public.authorize_media_upload() from public,anon;
grant execute on function public.authorize_media_upload() to authenticated;
