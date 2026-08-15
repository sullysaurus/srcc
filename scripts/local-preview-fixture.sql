-- Local-only browser QA fixture. Never apply this file to a hosted database.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token,recovery_token,email_change_token_new,email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '10000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'preview@example.com',
  extensions.crypt('PreviewPass!2026', extensions.gen_salt('bf')), now(),
  '','','','',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Preview Owner"}', now(), now()
) on conflict (id) do nothing;

insert into auth.identities (
  provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at
) values (
  '10000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000010',
  '{"sub":"10000000-0000-0000-0000-000000000010","email":"preview@example.com","email_verified":true}',
  'email',now(),now(),now()
) on conflict (provider_id,provider) do nothing;

insert into public.organization_memberships (organization_id,user_id,role,status)
select id,'10000000-0000-0000-0000-000000000010','owner','active'
from public.organizations where slug='southern-revelry'
on conflict (organization_id,user_id) do update set status='active',role='owner';

insert into public.contacts (
  id,organization_id,honeybook_client_id,first_name,last_name,email_normalized
)
select '30000000-0000-0000-0000-000000000001',id,'hb-amanda','Amanda','Atcheson','amanda@example.com'
from public.organizations where slug='southern-revelry';

insert into public.contacts (
  id,organization_id,honeybook_client_id,first_name,last_name,email_normalized
)
select '30000000-0000-0000-0000-000000000002',id,'hb-jordan','Jordan','Lee','jordan@example.com'
from public.organizations where slug='southern-revelry';

insert into public.projects (
  id,organization_id,primary_contact_id,pipeline_stage_id,honeybook_project_id,
  honeybook_url,name,event_type,event_at,inquiry_at,venue_name,city,region,
  owner_name,lead_source,estimated_value_cents,source_origin
)
select
  '40000000-0000-0000-0000-000000000001',o.id,
  '30000000-0000-0000-0000-000000000001',s.id,'hb-project-amanda',
  'https://www.honeybook.com/app/projects/hb-project-amanda',
  'Amanda Atcheson''s Project - Classy Booth','Wedding','2026-10-03T18:00:00Z',
  '2026-08-15T14:00:00Z','The Grand Lady','Austin','TX','Colton Cerday',
  'Google',199800,'honeybook'
from public.organizations o
join public.pipeline_stages s on s.organization_id=o.id and s.key='inquiry'
where o.slug='southern-revelry';

insert into public.projects (
  id,organization_id,primary_contact_id,pipeline_stage_id,honeybook_project_id,
  honeybook_url,name,event_type,event_at,inquiry_at,booked_at,venue_name,city,
  region,owner_name,lead_source,estimated_value_cents,proposal_value_cents,
  booked_value_cents,collected_cents,last_communication_at,
  last_communication_channel,source_origin
)
select
  '40000000-0000-0000-0000-000000000002',o.id,
  '30000000-0000-0000-0000-000000000002',s.id,'hb-project-jordan',
  'https://www.honeybook.com/app/projects/hb-project-jordan',
  'Jordan Lee''s Project','Corporate Event','2026-11-14T18:00:00Z',
  '2026-08-04T15:00:00Z','2026-08-10T17:00:00Z','Hotel Van Zandt',
  'Austin','TX','Colton Cerday','Instagram',299700,299700,299700,99900,
  '2026-08-14T19:00:00Z','email','honeybook'
from public.organizations o
join public.pipeline_stages s on s.organization_id=o.id and s.key='planning'
where o.slug='southern-revelry';

insert into public.tasks (
  organization_id,project_id,title,due_at,priority,source_origin,provider,provider_id
)
select organization_id,id,'Respond to new inquiry','2026-08-15T18:00:00Z','high','derived','honeybook_automation','new-inquiry:hb-project-amanda'
from public.projects where id='40000000-0000-0000-0000-000000000001';

update public.projects set next_follow_up_at='2026-08-15T18:00:00Z'
where id='40000000-0000-0000-0000-000000000001';

insert into public.proposals (
  id,organization_id,project_id,provider,provider_id,status,amount_cents,sent_at
)
select '50000000-0000-0000-0000-000000000001',organization_id,id,
  'honeybook_automation','project:hb-project-jordan','Viewed',299700,
  '2026-08-07T16:00:00Z'
from public.projects where id='40000000-0000-0000-0000-000000000002';

insert into public.proposal_views (
  organization_id,proposal_id,provider_event_id,viewed_at,source_origin
)
select organization_id,id,'preview-proposal-view','2026-08-08T16:00:00Z','honeybook'
from public.proposals where id='50000000-0000-0000-0000-000000000001';

insert into public.communications (
  organization_id,project_id,provider,external_message_id,thread_id,direction,
  channel,subject,internal_summary,occurred_at,match_confidence,matched_by,
  source_origin,metadata
)
select organization_id,id,'gmail','preview-sms','preview-thread','inbound','sms',
  'New SMS from Amanda Atcheson in Amanda Atcheson''s Project - Classy Booth',
  'HoneyBook SMS notification synchronized; message body not stored.',
  '2026-08-15T17:30:00Z','exact','provider_id','email',
  '{"honeybook_notification":"sms"}'
from public.projects where id='40000000-0000-0000-0000-000000000001';

update public.projects
set last_communication_at='2026-08-15T17:30:00Z',
    last_communication_channel='sms'
where id='40000000-0000-0000-0000-000000000001';

insert into public.sync_connections (
  organization_id,provider,status,display_name,configuration,last_success_at
)
select id,'honeybook_zapier','connected','HoneyBook via Zapier','{"enabled":true}',now()
from public.organizations where slug='southern-revelry';

insert into public.sync_connections (
  organization_id,provider,status,display_name,configuration,last_success_at
)
select id,'gmail','connected','Company email','{"mailbox":"preview@example.com"}',now()
from public.organizations where slug='southern-revelry';
