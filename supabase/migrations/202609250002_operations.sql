-- All writes cross transactional, authenticated functions. Client-supplied roles,
-- district IDs, counters, moderation decisions and provider IDs are never trusted.
create function private.has_role(roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.users u where u.id = auth.uid() and u.role = any(roles));
$$;
create function private.can_manage_district(district uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.users u where u.id = auth.uid() and
    (u.role = 'platform_admin' or (u.role in ('district_agent','district_manager') and
      exists(select 1 from public.district_memberships m where m.user_id=u.id and m.district_id=district))));
$$;
create function private.can_moderate() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(array['moderator','platform_admin']::public.app_role[]);
$$;
create function private.can_read_original(report uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  -- District staff get redacted derivatives only, not unreviewed originals.
  select exists(select 1 from public.reports r where r.id=report and
    (r.user_id=auth.uid() or private.can_moderate()));
$$;
create function private.require_verified() returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); account public.users;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into account from public.users where id=actor for update;
  if not found or not account.verified then raise exception 'Mock/authorized verification required' using errcode='42501'; end if;
  if account.suspended_until > now() then raise exception 'Reporting temporarily suspended; appeal available' using errcode='42501'; end if;
  return actor;
end $$;
create function private.consume_rate_limit(action_name text, maximum integer) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); total integer;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  insert into private.rate_limits(user_id,action,window_start)
    values(actor,action_name,date_trunc('hour',now()))
    on conflict(user_id,action,window_start) do update set count=private.rate_limits.count+1
    returning count into total;
  if total > maximum then raise exception 'Hourly action limit reached' using errcode='P0001'; end if;
end $$;
create function private.audit(action_name text, entity text, entity_key text, metadata jsonb default '{}') returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),action_name,entity,entity_key,metadata);
$$;
create function private.bootstrap_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users(id) values(new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.bootstrap_user();

create function private.reject_history_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'Append-only evidence cannot be modified or deleted' using errcode='42501'; end $$;
do $$ declare entity text; begin
  foreach entity in array array['audit_logs','report_status_history','report_confirmations','report_assignments','resolution_records','moderation_events','abuse_events','internal_notes','identity_verifications','email_deliveries'] loop
    execute format('create trigger immutable_evidence before update or delete on public.%I for each row execute function private.reject_history_mutation()',entity);
  end loop;
end $$;

create function private.record_report_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    insert into public.report_status_history(report_id,to_status,changed_by) values(new.id,new.status,auth.uid());
    perform private.audit('report.created','report',new.id::text,jsonb_build_object('district_id',new.district_id));
  elsif old.status is distinct from new.status then
    insert into public.report_status_history(report_id,from_status,to_status,changed_by) values(new.id,old.status,new.status,auth.uid());
    perform private.audit('report.status_changed','report',new.id::text,jsonb_build_object('from',old.status,'to',new.status));
    insert into public.notifications(report_id,kind,recipient_user_id,event_key,payload)
      values(new.id,'citizen_status',new.user_id,gen_random_uuid()::text,jsonb_build_object('public_id',new.public_id,'status',new.status));
  end if;
  return new;
end $$;
create trigger reports_status_history after insert or update on public.reports for each row execute function private.record_report_status();

create function public.complete_mock_verification() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not (select demo_identity_enabled from private.runtime_settings where singleton) then
    raise exception 'Demo identity disabled for this environment' using errcode='42501';
  end if;
  perform private.consume_rate_limit('mock_verification',10);
  insert into public.identity_verifications(user_id,identity_provider,verification_mode,provider_subject_id)
    values(actor,'digital_egypt_mock','demo','demo-user-' || actor::text)
    on conflict(identity_provider,provider_subject_id) do nothing;
  update public.users set verified=true where id=actor;
  perform private.audit('identity.demo_verified','user',actor::text);
  return jsonb_build_object('verified',true,'identity_provider','digital_egypt_mock','verification_mode','demo');
end $$;

create function public.resolve_district(lng double precision, lat double precision) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare point extensions.geometry; matches integer; result jsonb;
begin
  if lng is null or lat is null or not (lng between -180 and 180 and lat between -90 and 90) then
    raise exception 'Invalid coordinates' using errcode='22023';
  end if;
  point := extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326);
  select count(*), (jsonb_agg(jsonb_build_object('id',d.id,'slug',d.slug,'name_ar',d.name_ar,'name_en',d.name_en,
    'governorate_id',d.governorate_id,'administrative_area_id',d.administrative_area_id,
    'boundary_id',b.id,'is_synthetic',b.is_synthetic)))->0 into matches,result
    from public.district_boundaries b join public.districts d on d.id=b.district_id
    where b.active and d.enabled and extensions.st_covers(b.geom,point)
      and (not b.is_synthetic or (select synthetic_boundaries_enabled from private.runtime_settings where singleton));
  if matches = 0 then raise exception 'Location is outside supported district boundaries' using errcode='22023'; end if;
  if matches > 1 then raise exception 'Ambiguous district boundary; review required' using errcode='22023'; end if;
  return result;
end $$;

create function public.find_duplicate_reports(category_slug text, lng double precision, lat double precision)
returns table(id uuid, public_id text, status public.report_status, distance_meters double precision, confirmation_count integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if lng is null or lat is null or not (lng between -180 and 180 and lat between -90 and 90) then raise exception 'Invalid coordinates' using errcode='22023'; end if;
  return query select r.id,r.public_id,r.status,
    round(extensions.st_distance(r.location,extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326)::extensions.geography))::double precision,
    r.confirmation_count from public.reports r join public.categories c on c.id=r.category_id
    where c.slug=category_slug and r.moderation_status='safe' and r.status in ('submitted','delivered','acknowledged','in_progress')
      and exists(select 1 from public.report_images i where i.report_id=r.id and i.kind='before' and i.public_path is not null and i.moderation_status='safe')
      and extensions.st_dwithin(r.location,extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326)::extensions.geography,30)
    order by 4 limit 10;
end $$;

create function public.submit_report(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; district jsonb; category uuid; authority uuid; created public.reports;
  lng double precision; lat double precision; raw_lng double precision; raw_lat double precision;
  accuracy double precision; capture_time timestamptz; path text;
begin
  actor := private.require_verified();
  perform private.consume_rate_limit('submit_report',10);
  if input is null or jsonb_typeof(input)<>'object' then raise exception 'Expected report object' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(input) k where k not in ('category_slug','description','severity','latitude','longitude','captured_latitude','captured_longitude','gps_accuracy','captured_at','device_timestamp','original_path')) then
    raise exception 'Unexpected report fields' using errcode='22023';
  end if;
  lng:=(input->>'longitude')::double precision; lat:=(input->>'latitude')::double precision;
  raw_lng:=(input->>'captured_longitude')::double precision; raw_lat:=(input->>'captured_latitude')::double precision;
  accuracy:=(input->>'gps_accuracy')::double precision; capture_time:=(input->>'captured_at')::timestamptz;
  if raw_lng is null or raw_lat is null or not(raw_lng between -180 and 180 and raw_lat between -90 and 90) then raise exception 'Invalid capture location' using errcode='22023'; end if;
  district := public.resolve_district(lng,lat);
  if accuracy is null or not (accuracy > 0 and accuracy <= 200) then raise exception 'GPS accuracy must be within 200 meters' using errcode='22023'; end if;
  if capture_time is null or capture_time < now()-interval '24 hours' or capture_time > now()+interval '5 minutes' then raise exception 'Capture timestamp outside allowed window' using errcode='22023'; end if;
  if (input->>'device_timestamp') is null then raise exception 'Device timestamp required' using errcode='22023'; end if;
  if extensions.st_distance(extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326)::extensions.geography,
    extensions.st_setsrid(extensions.st_makepoint(raw_lng,raw_lat),4326)::extensions.geography)>50 then raise exception 'Pin adjustment exceeds 50 meters' using errcode='22023'; end if;
  select id into category from public.categories where slug=input->>'category_slug' and active;
  if category is null then raise exception 'Unknown or inactive category' using errcode='22023'; end if;
  path:=input->>'original_path';
  if path is null or split_part(path,'/',1)<>actor::text or not exists(select 1 from storage.objects o
    where o.bucket_id='report-originals' and o.name=path and o.owner_id=actor::text) then
    raise exception 'An owned camera image upload is required' using errcode='22023';
  end if;
  select id into authority from public.authorities where district_id=(district->>'id')::uuid and enabled;
  if authority is null then raise exception 'No configured authority for district' using errcode='22023'; end if;
  insert into public.reports(user_id,category_id,description,severity,latitude,longitude,captured_latitude,captured_longitude,
    gps_accuracy,captured_at,device_timestamp,governorate_id,administrative_area_id,district_id,boundary_id,assigned_authority_id)
    values(actor,category,coalesce(input->>'description',''),(input->>'severity')::public.report_severity,lat,lng,raw_lat,raw_lng,
    accuracy,capture_time,(input->>'device_timestamp')::timestamptz,(district->>'governorate_id')::uuid,
    (district->>'administrative_area_id')::uuid,(district->>'id')::uuid,(district->>'boundary_id')::uuid,authority) returning * into created;
  insert into public.report_images(report_id,uploaded_by,kind,original_path) values(created.id,actor,'before',path);
  insert into public.report_assignments(report_id,authority_id,assigned_by) values(created.id,authority,actor);
  return jsonb_build_object('id',created.id,'public_id',created.public_id,'status',created.status,
    'moderation_status',created.moderation_status,'district',district,'delivery_mode','test');
end $$;

create function public.confirm_report(report_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; target public.reports; inserted integer;
begin
  actor:=private.require_verified(); perform private.consume_rate_limit('confirm_report',60);
  select * into target from public.reports r where r.id=confirm_report.report_id for update;
  if not found or target.moderation_status<>'safe' or target.status not in ('submitted','delivered','acknowledged','in_progress') then
    raise exception 'Report is not open for confirmation' using errcode='22023'; end if;
  if target.user_id=actor then raise exception 'You cannot confirm your own report' using errcode='22023'; end if;
  insert into public.report_confirmations(report_id,user_id) values(target.id,actor) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=1 then
    update public.reports set confirmation_count=confirmation_count+1, updated_at=now() where id=target.id returning * into target;
    perform private.audit('report.confirmed','report',target.id::text);
  end if;
  return jsonb_build_object('confirmation_count',target.confirmation_count,'already_confirmed',inserted=0);
end $$;

create function public.register_report_image(report_id uuid, object_path text, kind text default 'after') returns uuid
language plpgsql security definer set search_path = '' as $$
declare target public.reports; created uuid; actor uuid:=auth.uid();
begin
  select * into target from public.reports r where r.id=register_report_image.report_id for update;
  if not found or actor is null or not private.can_manage_district(target.district_id) then raise exception 'District access denied' using errcode='42501'; end if;
  if kind<>'after' or target.status not in ('acknowledged','in_progress') then raise exception 'Resolution image requires acknowledged/in-progress report' using errcode='22023'; end if;
  perform private.consume_rate_limit('resolution_upload',60);
  if split_part(object_path,'/',1)<>actor::text or not exists(select 1 from storage.objects o where o.bucket_id='report-originals' and o.name=object_path and o.owner_id=actor::text) then raise exception 'Owned image upload required' using errcode='22023'; end if;
  insert into public.report_images(report_id,uploaded_by,kind,original_path) values(target.id,actor,'after',object_path) returning id into created;
  perform private.audit('image.registered','report_image',created::text,jsonb_build_object('report_id',target.id));
  return created;
end $$;

create function private.queue_district_notification(report uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications(report_id,kind,event_key,payload)
    select r.id,'district_new_report','district_new:'||r.id::text,
      jsonb_build_object('public_id',r.public_id,'district_id',r.district_id,'category_id',r.category_id,'severity',r.severity,
        'latitude',round(r.latitude::numeric,3),'longitude',round(r.longitude::numeric,3),'captured_at',r.captured_at)
    from public.reports r where r.id=report and r.moderation_status='safe' and r.status in ('submitted','delivered','acknowledged','in_progress')
      and exists(select 1 from public.report_images i where i.report_id=r.id and i.kind='before' and i.moderation_status='safe' and i.public_path is not null)
    on conflict(event_key) do nothing;
end $$;

create function public.moderate_report(report_id uuid, decision public.moderation_status, note text) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.reports;
begin
  if not private.can_moderate() then raise exception 'Moderator access required' using errcode='42501'; end if;
  if decision is null or decision='pending' or char_length(trim(coalesce(note,''))) not between 1 and 2000 then raise exception 'Decision and moderation reason required' using errcode='22023'; end if;
  select * into target from public.reports r where r.id=moderate_report.report_id for update;
  if not found then raise exception 'Report not found' using errcode='22023'; end if;
  update public.reports set moderation_status=decision, updated_at=now() where id=target.id;
  insert into public.moderation_events(report_id,actor_id,decision,reason) values(target.id,auth.uid(),decision,note);
  perform private.audit('report.moderated','report',target.id::text,jsonb_build_object('decision',decision));
  if decision='safe' then perform private.queue_district_notification(target.id);
  else update public.notifications set status='cancelled',processed_at=now() where public.notifications.report_id=target.id and kind='district_new_report' and status='queued';
  end if;
end $$;

create function public.moderate_image(image_id uuid, decision public.moderation_status, note text,
  derivative_path text default null, redaction_confirmed boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.report_images;
begin
  if not private.can_moderate() then raise exception 'Moderator access required' using errcode='42501'; end if;
  if decision is null or decision='pending' or char_length(trim(coalesce(note,''))) not between 1 and 2000 then raise exception 'Decision and moderation reason required' using errcode='22023'; end if;
  select * into target from public.report_images i where i.id=image_id for update;
  if not found then raise exception 'Image not found' using errcode='22023'; end if;
  if decision='safe' and (not redaction_confirmed or derivative_path is null or not exists(select 1 from storage.objects o
    where o.bucket_id='report-derivatives' and o.name=derivative_path)) then
    raise exception 'Reviewed derivative with EXIF stripped and sensitive details redacted required' using errcode='22023';
  end if;
  update public.report_images set moderation_status=decision,
    public_path=case when decision='safe' then derivative_path else null end,
    redaction_confirmed=case when decision='safe' then moderate_image.redaction_confirmed else false end where id=target.id;
  insert into public.moderation_events(report_id,image_id,actor_id,decision,reason) values(target.report_id,target.id,auth.uid(),decision,note);
  perform private.audit('image.moderated','report_image',target.id::text,jsonb_build_object('decision',decision));
  perform private.queue_district_notification(target.report_id);
end $$;

create function public.transition_report(report_id uuid, new_status public.report_status, note text default '',
  resolution_image_id uuid default null, duplicate_of uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare target public.reports; permitted boolean; duplicate_target public.reports;
begin
  select * into target from public.reports r where r.id=transition_report.report_id for update;
  if not found or not private.can_manage_district(target.district_id) then raise exception 'District access denied' using errcode='42501'; end if;
  if target.moderation_status<>'safe' then raise exception 'Moderation clearance required' using errcode='22023'; end if;
  permitted := case target.status
    when 'submitted' then new_status in ('acknowledged','rejected','duplicate','under_review')
    when 'delivered' then new_status in ('acknowledged','rejected','duplicate','under_review')
    when 'acknowledged' then new_status in ('in_progress','rejected','duplicate','under_review')
    when 'in_progress' then new_status in ('resolved','rejected','duplicate','under_review')
    when 'under_review' then new_status in ('submitted','rejected')
    else false end;
  if not coalesce(permitted,false) then raise exception 'Invalid report status transition' using errcode='22023'; end if;
  if char_length(coalesce(note,''))>2000 or (new_status in ('resolved','rejected','duplicate','under_review') and trim(coalesce(note,''))='') then raise exception 'A reason is required (maximum 2000 characters)' using errcode='22023'; end if;
  if new_status='duplicate' then
    select * into duplicate_target from public.reports r where r.id=transition_report.duplicate_of;
    if not found or duplicate_target.id=target.id or duplicate_target.district_id<>target.district_id or
      duplicate_target.category_id<>target.category_id or duplicate_target.status in ('rejected','duplicate') or
      duplicate_target.moderation_status<>'safe' or not extensions.st_dwithin(duplicate_target.location,target.location,30) then
      raise exception 'Duplicate target must be a nearby same-category report in this district' using errcode='22023'; end if;
  elsif duplicate_of is not null then raise exception 'Duplicate target only valid for duplicate status' using errcode='22023'; end if;
  if new_status='resolved' then
    if not exists(select 1 from public.report_images i where i.id=resolution_image_id and i.report_id=target.id and
      i.kind='after' and i.moderation_status='safe' and i.public_path is not null and i.redaction_confirmed) then
      raise exception 'Approved resolution photo required' using errcode='22023'; end if;
    insert into public.resolution_records(report_id,resolved_by,resolution_note,resolution_image_id)
      values(target.id,auth.uid(),note,transition_report.resolution_image_id);
  elsif resolution_image_id is not null then raise exception 'Resolution evidence only valid when resolving' using errcode='22023'; end if;
  update public.reports set status=new_status, updated_at=now(),
    acknowledged_at=case when new_status='acknowledged' then coalesce(acknowledged_at,now()) else acknowledged_at end,
    resolved_at=case when new_status='resolved' then now() else null end,
    duplicate_of=case when new_status='duplicate' then transition_report.duplicate_of else null end
    where id=target.id;
  if trim(coalesce(note,''))<>'' then insert into public.internal_notes(report_id,actor_id,note) values(target.id,auth.uid(),note); end if;
  return jsonb_build_object('id',target.id,'public_id',target.public_id,'status',new_status);
end $$;

create function public.add_internal_note(report_id uuid, note text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare created uuid;
begin
  if not exists(select 1 from public.reports r where r.id=add_internal_note.report_id and private.can_manage_district(r.district_id)) then raise exception 'District access denied' using errcode='42501'; end if;
  if char_length(trim(coalesce(note,''))) not between 1 and 2000 then raise exception 'Note required (maximum 2000 characters)' using errcode='22023'; end if;
  insert into public.internal_notes(report_id,actor_id,note) values(add_internal_note.report_id,auth.uid(),note) returning id into created;
  perform private.audit('report.note_added','report',report_id::text);
  return created;
end $$;

create function public.process_test_notifications(batch_size integer default 25) returns integer
language plpgsql security definer set search_path = '' as $$
declare notice public.notifications; target public.reports; inbox text; processed integer:=0;
begin
  if not private.has_role(array['platform_admin']::public.app_role[]) then raise exception 'Platform admin required' using errcode='42501'; end if;
  if batch_size not between 1 and 100 then raise exception 'Batch must be 1-100' using errcode='22023'; end if;
  select test_inbox into inbox from private.runtime_settings where singleton and email_mode='test';
  if inbox is null then raise exception 'Test-only email configuration required' using errcode='42501'; end if;
  for notice in select * from public.notifications n where n.kind='district_new_report' and n.status='queued'
    order by n.created_at for update skip locked limit batch_size loop
    select * into target from public.reports r where r.id=notice.report_id;
    if target.moderation_status<>'safe' or not exists(select 1 from public.report_images i where i.report_id=target.id and i.kind='before' and i.public_path is not null and i.moderation_status='safe') then
      update public.notifications set status='cancelled',processed_at=now() where id=notice.id;
      continue;
    end if;
    if not exists(select 1 from public.routing_rules rr join public.authority_contacts c on c.authority_id=target.assigned_authority_id
      and c.endpoint_type=rr.endpoint_type where rr.district_id=target.district_id and rr.enabled and c.enabled) then continue; end if;
    insert into public.email_deliveries(notification_id,recipient,subject,body)
      values(notice.id,inbox,'[Balaa TEST] '||target.public_id,notice.payload) on conflict(notification_id) do nothing;
    update public.notifications set status='test_recorded',processed_at=now() where id=notice.id;
    -- A test outbox entry never marks a report "delivered to government".
    perform private.audit('notification.test_recorded','notification',notice.id::text);
    processed:=processed+1;
  end loop;
  return processed;
end $$;

create function public.upsert_category(category_slug text, arabic_label text, english_label text, enabled boolean default true, sort_order integer default 0) returns uuid
language plpgsql security definer set search_path = '' as $$
declare changed uuid;
begin
  if not private.has_role(array['platform_admin']::public.app_role[]) then raise exception 'Platform admin required' using errcode='42501'; end if;
  if category_slug !~ '^[a-z][a-z0-9-]{1,49}$' or length(trim(arabic_label)) not between 1 and 100 or length(trim(english_label)) not between 1 and 100 then raise exception 'Invalid category' using errcode='22023'; end if;
  insert into public.categories(slug,name_ar,name_en,active,display_order) values(category_slug,arabic_label,english_label,enabled,sort_order)
    on conflict(slug) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,active=excluded.active,display_order=excluded.display_order returning id into changed;
  perform private.audit('category.updated','category',changed::text);
  return changed;
end $$;

create function public.manage_district_member(member_id uuid, district_id uuid, grant_access boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare target_role public.app_role; own_role public.app_role;
begin
  select role into own_role from public.users where id=auth.uid();
  select role into target_role from public.users where id=member_id;
  if own_role is null or (own_role<>'platform_admin' and (own_role<>'district_manager' or not private.can_manage_district(district_id))) then raise exception 'District manager required' using errcode='42501'; end if;
  if target_role is null or target_role not in ('district_agent','district_manager') or (own_role<>'platform_admin' and target_role<>'district_agent') then raise exception 'Target must have an eligible staff role' using errcode='22023'; end if;
  if grant_access then insert into public.district_memberships(user_id,district_id,granted_by) values(member_id,district_id,auth.uid()) on conflict do nothing;
  else delete from public.district_memberships m where m.user_id=member_id and m.district_id=manage_district_member.district_id; end if;
  perform private.audit('district.membership_changed','user',member_id::text,jsonb_build_object('district_id',district_id,'granted',grant_access));
end $$;

create function public.set_user_role(member_id uuid, assigned_role public.app_role) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role(array['platform_admin']::public.app_role[]) then raise exception 'Platform admin required' using errcode='42501'; end if;
  if member_id=auth.uid() then raise exception 'Self role changes prohibited' using errcode='22023'; end if;
  update public.users set role=assigned_role where id=member_id;
  if not found then raise exception 'User not found' using errcode='22023'; end if;
  perform private.audit('user.role_changed','user',member_id::text,jsonb_build_object('role',assigned_role));
end $$;

create function public.review_abuse(member_id uuid, until_time timestamptz, reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_moderate() then raise exception 'Moderator required' using errcode='42501'; end if;
  if until_time is not null and (until_time<=now() or until_time>now()+interval '30 days') then raise exception 'Suspension must be temporary (maximum 30 days)' using errcode='22023'; end if;
  if char_length(trim(coalesce(reason,''))) not between 1 and 2000 then raise exception 'Reason required' using errcode='22023'; end if;
  update public.users set suspended_until=until_time,abuse_strikes=abuse_strikes+case when until_time is null then 0 else 1 end where id=member_id;
  if not found then raise exception 'User not found' using errcode='22023'; end if;
  insert into public.abuse_events(user_id,actor_id,reason,suspended_until) values(member_id,auth.uid(),reason,until_time);
  perform private.audit('user.abuse_reviewed','user',member_id::text,jsonb_build_object('suspended_until',until_time));
end $$;

create function public.submit_appeal(reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare created uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform private.consume_rate_limit('appeal',3);
  insert into public.appeals(user_id,reason) values(auth.uid(),reason) returning id into created;
  perform private.audit('appeal.created','appeal',created::text);
  return created;
end $$;

create function public.review_appeal(appeal_id uuid, outcome text, note text) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.appeals;
begin
  if not private.can_moderate() then raise exception 'Moderator required' using errcode='42501'; end if;
  if outcome not in ('upheld','dismissed') or char_length(trim(coalesce(note,''))) not between 1 and 2000 then raise exception 'Review outcome/reason required' using errcode='22023'; end if;
  select * into target from public.appeals where id=appeal_id for update;
  if not found or target.status<>'pending' then raise exception 'Pending appeal not found' using errcode='22023'; end if;
  update public.appeals set status=outcome,review_note=note,reviewed_by=auth.uid(),reviewed_at=now() where id=appeal_id;
  if outcome='upheld' then update public.users set suspended_until=null where id=target.user_id; end if;
  perform private.audit('appeal.reviewed','appeal',appeal_id::text,jsonb_build_object('outcome',outcome));
end $$;

-- Expose only deliberate RPCs. Helpers cannot be called via PostgREST's public schema.
revoke execute on all functions in schema private from public,anon,authenticated;
revoke execute on all functions in schema public from public,anon,authenticated;
grant usage on schema private to authenticated,anon;
grant execute on function private.has_role(public.app_role[]),private.can_manage_district(uuid),private.can_moderate(),private.can_read_original(uuid) to authenticated;
grant execute on function public.resolve_district(double precision,double precision),public.find_duplicate_reports(text,double precision,double precision) to anon,authenticated;
grant execute on function public.complete_mock_verification(),public.submit_report(jsonb),public.confirm_report(uuid),
  public.register_report_image(uuid,text,text),public.moderate_report(uuid,public.moderation_status,text),
  public.moderate_image(uuid,public.moderation_status,text,text,boolean),
  public.transition_report(uuid,public.report_status,text,uuid,uuid),public.add_internal_note(uuid,text),
  public.process_test_notifications(integer),public.upsert_category(text,text,text,boolean,integer),
  public.manage_district_member(uuid,uuid,boolean),public.set_user_role(uuid,public.app_role),
  public.review_abuse(uuid,timestamptz,text),public.submit_appeal(text),public.review_appeal(uuid,text,text) to authenticated;
