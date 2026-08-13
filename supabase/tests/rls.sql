begin;
create extension if not exists pgtap;
select plan(20);
select has_table('public','organizations','organizations table exists');
select has_table('public','projects','projects table exists');
select ok((select relrowsecurity from pg_class where oid='public.projects'::regclass),'projects has RLS enabled');
select has_table('public','integration_health_issues','integration health table exists');
select ok((select relrowsecurity from pg_class where oid='public.oauth_states'::regclass),'OAuth state has RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.google_ads_conversion_actions'::regclass),'conversion actions have RLS enabled');
select has_table('public','attribution_sessions','attribution sessions table exists');
select ok((select relrowsecurity from pg_class where oid='public.attribution_sessions'::regclass),'attribution sessions have RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.attribution_touch_events'::regclass),'attribution touches have RLS enabled');
select has_table('public','conversion_upload_gates','conversion upload gates table exists');
select has_table('public','operational_alerts','operational alerts table exists');
select has_table('public','recommendations','recommendations table exists');
select ok((select relrowsecurity from pg_class where oid='public.conversion_upload_gates'::regclass),'conversion upload gates have RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.operational_alerts'::regclass),'operational alerts have RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.recommendations'::regclass),'recommendations have RLS enabled');
select is((select count(*) from public.conversion_upload_gates where organization_id=(select id from public.organizations where slug='southern-revelry')),5::bigint,'all conversion gates are seeded');

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','operator@example.com','',now(),'{}','{}',now(),now());
insert into public.organizations (id,name,slug) values
  ('20000000-0000-0000-0000-000000000001','RLS Test One','rls-test-one'),
  ('20000000-0000-0000-0000-000000000002','RLS Test Two','rls-test-two');
insert into public.organization_memberships (organization_id,user_id,role,status)
values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','operations','active');
insert into public.projects (organization_id,name) values
  ('20000000-0000-0000-0000-000000000001','Visible project'),
  ('20000000-0000-0000-0000-000000000002','Isolated project');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select count(*) from public.projects),1::bigint,'member sees only projects in their organization');
select is((select count(*) from public.projects where organization_id='20000000-0000-0000-0000-000000000002'),0::bigint,'cross-organization project is hidden');
select lives_ok($$insert into public.projects(organization_id,name) values ('20000000-0000-0000-0000-000000000001','Allowed write')$$,'operations can write within their organization');
select throws_ok($$insert into public.projects(organization_id,name) values ('20000000-0000-0000-0000-000000000002','Forbidden write')$$,'42501','new row violates row-level security policy for table "projects"','cross-organization write is rejected');
select * from finish();
rollback;
