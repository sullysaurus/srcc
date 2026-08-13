create extension if not exists pgcrypto with schema extensions;

create type public.organization_role as enum ('owner','admin','sales','operations','marketing','read_only');
create type public.membership_status as enum ('invited','active','suspended','revoked');
create type public.pipeline_stage_key as enum ('inquiry','contacted','qualified','proposal_sent','follow_up','proposal_signed','retainer_paid','planning','completed','lost','archived');
create type public.field_origin as enum ('honeybook','derived','manual','google_sheet','google_ads','search_console','email','web_form');
create type public.connection_status as enum ('not_configured','connected','degraded','failed','disabled');
create type public.sync_status as enum ('queued','running','succeeded','partial','failed','dead_letter');
create type public.mapping_status as enum ('pending','mapped','excluded','merged');

create table public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'America/Chicago', currency_code text not null default 'USD',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text, avatar_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade, role public.organization_role not null,
  status public.membership_status not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id,user_id)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  honeybook_client_id text, first_name text, last_name text, email_normalized text, phone_e164 text,
  raw_provider_fields jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id,honeybook_client_id)
);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  key public.pipeline_stage_key not null, name text not null, sort_order integer not null, is_terminal boolean not null default false,
  created_at timestamptz not null default now(), unique (organization_id,key), unique (organization_id,sort_order)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  primary_contact_id uuid references public.contacts(id) on delete set null, pipeline_stage_id uuid references public.pipeline_stages(id),
  honeybook_project_id text, honeybook_url text, name text not null, event_type text, event_at timestamptz, event_timezone text not null default 'America/Chicago',
  venue_name text, city text, region text, postal_code text, owner_user_id uuid references public.users(id) on delete set null,
  lead_source text, estimated_value_cents bigint not null default 0 check (estimated_value_cents >= 0),
  proposal_value_cents bigint not null default 0 check (proposal_value_cents >= 0), booked_value_cents bigint not null default 0 check (booked_value_cents >= 0),
  collected_cents bigint not null default 0 check (collected_cents >= 0), last_communication_at timestamptz, last_communication_channel text,
  next_follow_up_at timestamptz, lead_temperature text check (lead_temperature in ('hot','warm','cool')),
  source_origin public.field_origin not null default 'manual', raw_provider_fields jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,honeybook_project_id)
);

create table public.services (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (name in ('Photo Booth','360 Booth','GlamBOT','Dance Floor','Bar Services','Margarita Machine','Multiple Services','Unknown')),
  is_active boolean not null default true, created_at timestamptz not null default now(), unique (organization_id,name)
);

create table public.project_services (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade, service_id uuid not null references public.services(id),
  source_origin public.field_origin not null, original_value text, created_at timestamptz not null default now(), unique (project_id,service_id)
);

create table public.communications (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null, provider text, external_message_id text, direction text check (direction in ('inbound','outbound')),
  channel text not null, subject text, internal_summary text, occurred_at timestamptz not null, match_confidence text,
  source_origin public.field_origin not null, created_at timestamptz not null default now(), unique (organization_id,provider,external_message_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade, assigned_to uuid references public.users(id) on delete set null,
  title text not null, due_at timestamptz, completed_at timestamptz, priority text not null default 'normal', source_origin public.field_origin not null default 'manual',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade, provider text not null, provider_id text, status text not null,
  amount_cents bigint not null default 0 check (amount_cents >= 0), sent_at timestamptz, signed_at timestamptz,
  raw_provider_fields jsonb not null default '{}', created_at timestamptz not null default now(), unique (organization_id,provider,provider_id)
);

create table public.proposal_views (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade, provider_event_id text, viewed_at timestamptz not null,
  source_origin public.field_origin not null, created_at timestamptz not null default now(), unique (organization_id,provider_event_id)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade, provider text not null, provider_id text,
  amount_cents bigint not null check (amount_cents >= 0), paid_cents bigint not null default 0 check (paid_cents >= 0), due_at timestamptz, status text not null,
  raw_provider_fields jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,provider,provider_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade, invoice_id uuid references public.invoices(id) on delete set null,
  provider text not null, provider_id text, amount_cents bigint not null check (amount_cents >= 0), paid_at timestamptz not null,
  raw_provider_fields jsonb not null default '{}', created_at timestamptz not null default now(), unique (organization_id,provider,provider_id)
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade, event_type text not null, title text not null, detail text,
  source_origin public.field_origin not null, provider_event_id text, occurred_at timestamptz not null, metadata jsonb not null default '{}',
  created_at timestamptz not null default now(), unique (organization_id,source_origin,provider_event_id)
);

create table public.lead_attribution (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade, touch_type text not null,
  gclid text, gbraid text, wbraid text, utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  landing_page text, referrer text, occurred_at timestamptz not null, first_touch_at timestamptz, last_touch_at timestamptz,
  self_reported_source text, created_at timestamptz not null default now(), unique (project_id,touch_type,occurred_at)
);

create table public.google_ads_accounts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id text not null, manager_customer_id text, display_name text, currency_code text, timezone text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,customer_id)
);
create table public.google_ads_campaigns (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.google_ads_accounts(id) on delete cascade, provider_id text not null, name text not null, service_category text, status text,
  raw_provider_fields jsonb not null default '{}', unique (account_id,provider_id)
);
create table public.google_ads_ad_groups (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.google_ads_campaigns(id) on delete cascade, provider_id text not null, name text not null, status text,
  raw_provider_fields jsonb not null default '{}', unique (campaign_id,provider_id)
);
create table public.google_ads_keywords (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  ad_group_id uuid not null references public.google_ads_ad_groups(id) on delete cascade, provider_id text not null, keyword_text text not null, match_type text,
  raw_provider_fields jsonb not null default '{}', unique (ad_group_id,provider_id)
);
create table public.google_ads_search_terms (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.google_ads_campaigns(id) on delete cascade, ad_group_id uuid references public.google_ads_ad_groups(id) on delete cascade,
  date date not null, search_term text not null, raw_provider_fields jsonb not null default '{}', unique (campaign_id,ad_group_id,date,search_term)
);
create table public.google_ads_daily_metrics (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.google_ads_accounts(id) on delete cascade, date date not null, entity_type text not null, entity_provider_id text not null,
  device text not null default 'all', geographic_area text not null default 'all', conversion_action text not null default 'all',
  impressions bigint not null default 0, clicks bigint not null default 0, cost_cents bigint not null default 0, conversions numeric(14,4) not null default 0,
  conversion_value_cents bigint not null default 0, impression_share numeric(8,6), raw_provider_fields jsonb not null default '{}',
  unique (account_id,date,entity_type,entity_provider_id,device,geographic_area,conversion_action)
);
create table public.google_ads_conversion_uploads (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade, conversion_action text not null, value_cents bigint not null default 0,
  deduplication_key text not null, status text not null default 'disabled', approved_by uuid references public.users(id), approved_at timestamptz,
  provider_response jsonb, created_at timestamptz not null default now(), unique (organization_id,deduplication_key)
);

create table public.search_console_properties (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  property_uri text not null, display_name text, permission_level text, last_success_at timestamptz,
  created_at timestamptz not null default now(), unique (organization_id,property_uri)
);
create table public.search_console_daily_metrics (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.search_console_properties(id) on delete cascade, date date not null, query text not null default '', page text not null default '',
  country text not null default '', device text not null default '', search_appearance text not null default '', clicks bigint not null default 0,
  impressions bigint not null default 0, ctr numeric(8,6) not null default 0, average_position numeric(10,4) not null default 0,
  unique (property_id,date,query,page,country,device,search_appearance)
);
create table public.search_console_sitemaps (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.search_console_properties(id) on delete cascade, path text not null, status text,
  submitted_at timestamptz, last_downloaded_at timestamptz, warnings integer, errors integer, raw_provider_fields jsonb not null default '{}', unique (property_id,path)
);

create table public.sync_connections (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null, status public.connection_status not null default 'not_configured', display_name text not null,
  configuration jsonb not null default '{}', encrypted_refresh_token bytea, token_key_version integer,
  last_attempt_at timestamptz, last_success_at timestamptz, disconnected_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,provider)
);
create table public.sync_runs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.sync_connections(id) on delete set null, provider text not null, operation text not null,
  status public.sync_status not null default 'queued', started_at timestamptz, completed_at timestamptz,
  processed_count integer not null default 0, created_count integer not null default 0, updated_count integer not null default 0,
  skipped_count integer not null default 0, failed_count integer not null default 0, attempt integer not null default 0,
  continuation_cursor text, error_code text, error_summary text, structured_log jsonb not null default '[]', created_at timestamptz not null default now()
);
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null, provider_event_id text not null, idempotency_key text not null, signature_verified boolean not null default false,
  received_at timestamptz not null default now(), processed_at timestamptz, expires_at timestamptz, status public.sync_status not null default 'queued',
  safe_payload jsonb not null default '{}', payload_digest text not null, error_summary text,
  unique (organization_id,provider,provider_event_id), unique (organization_id,idempotency_key)
);
create table public.source_records (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null, source_spreadsheet_id text, source_tab text, source_row_number integer, provider_record_id text,
  raw_values jsonb not null, normalized_values jsonb not null default '{}', mapping_decisions jsonb not null default '{}',
  imported_at timestamptz not null default now(), validation_errors jsonb not null default '[]', import_fingerprint text not null,
  unique (organization_id,source_type,import_fingerprint), unique nulls not distinct (organization_id,source_spreadsheet_id,source_tab,source_row_number)
);
create table public.mapping_rules (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null, field_name text not null, source_value text not null, canonical_value text, status public.mapping_status not null,
  decided_by uuid references public.users(id), decided_at timestamptz, created_at timestamptz not null default now(),
  unique (organization_id,source_type,field_name,source_value)
);
create table public.mapping_queue (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  source_record_id uuid not null references public.source_records(id) on delete cascade, field_name text not null, source_value text not null,
  suggested_value text, candidate_entity_ids uuid[] not null default '{}', status public.mapping_status not null default 'pending',
  mapping_rule_id uuid references public.mapping_rules(id) on delete set null, affected_count integer not null default 1,
  resolved_by uuid references public.users(id), resolved_at timestamptz, created_at timestamptz not null default now(),
  unique (source_record_id,field_name)
);
create table public.audit_log (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null, action text not null, entity_type text not null, entity_id uuid,
  prior_value jsonb, new_value jsonb, reason text, request_id text, occurred_at timestamptz not null default now()
);

create index projects_attention_idx on public.projects (organization_id,next_follow_up_at,last_communication_at);
create index projects_event_idx on public.projects (organization_id,event_at);
create index communications_project_idx on public.communications (organization_id,project_id,occurred_at desc);
create index source_records_import_idx on public.source_records (organization_id,source_type,imported_at desc);
create index mapping_queue_pending_idx on public.mapping_queue (organization_id,status,created_at) where status='pending';
create index sync_runs_health_idx on public.sync_runs (organization_id,provider,created_at desc);
create index audit_log_entity_idx on public.audit_log (organization_id,entity_type,entity_id,occurred_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.users(id,display_name,avatar_url) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.email),new.raw_user_meta_data->>'avatar_url') on conflict(id) do nothing; return new; end $$;
create or replace function public.is_org_member(org_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.organization_memberships m where m.organization_id=org_id and m.user_id=auth.uid() and m.status='active') $$;
create or replace function public.has_org_role(org_id uuid, roles public.organization_role[]) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.organization_memberships m where m.organization_id=org_id and m.user_id=auth.uid() and m.status='active' and m.role=any(roles)) $$;
revoke all on function public.is_org_member(uuid) from public; grant execute on function public.is_org_member(uuid) to authenticated;
revoke all on function public.has_org_role(uuid,public.organization_role[]) from public; grant execute on function public.has_org_role(uuid,public.organization_role[]) to authenticated;
create trigger auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

do $$ declare t text; begin foreach t in array array['organizations','users','organization_memberships','contacts','pipeline_stages','projects','services','project_services','communications','tasks','proposals','proposal_views','invoices','payments','activity_events','lead_attribution','google_ads_accounts','google_ads_campaigns','google_ads_ad_groups','google_ads_keywords','google_ads_search_terms','google_ads_daily_metrics','google_ads_conversion_uploads','search_console_properties','search_console_daily_metrics','search_console_sitemaps','sync_connections','sync_runs','webhook_events','source_records','mapping_rules','mapping_queue','audit_log'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;

create policy "users read self" on public.users for select using (id=auth.uid());
create policy "users update self" on public.users for update using (id=auth.uid()) with check (id=auth.uid());
create policy "members read organizations" on public.organizations for select using (public.is_org_member(id));
create policy "owners admins update organizations" on public.organizations for update using (public.has_org_role(id,array['owner','admin']::public.organization_role[])) with check (public.has_org_role(id,array['owner','admin']::public.organization_role[]));
create policy "members read memberships" on public.organization_memberships for select using (public.is_org_member(organization_id));
create policy "owners admins manage memberships" on public.organization_memberships for all using (public.has_org_role(organization_id,array['owner','admin']::public.organization_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.organization_role[]));

do $$ declare t text; begin foreach t in array array['contacts','pipeline_stages','projects','services','project_services','communications','tasks','proposals','proposal_views','activity_events','lead_attribution','source_records','mapping_rules','mapping_queue'] loop
  execute format('create policy "members read %1$s" on public.%1$I for select using (public.is_org_member(organization_id))',t);
  execute format('create policy "operators write %1$s" on public.%1$I for all using (public.has_org_role(organization_id,array[''owner'',''admin'',''sales'',''operations'']::public.organization_role[])) with check (public.has_org_role(organization_id,array[''owner'',''admin'',''sales'',''operations'']::public.organization_role[]))',t);
end loop; end $$;

do $$ declare t text; begin foreach t in array array['invoices','payments'] loop
  execute format('create policy "financial roles read %1$s" on public.%1$I for select using (public.has_org_role(organization_id,array[''owner'',''admin'',''sales'']::public.organization_role[]))',t);
  execute format('create policy "admins write %1$s" on public.%1$I for all using (public.has_org_role(organization_id,array[''owner'',''admin'']::public.organization_role[])) with check (public.has_org_role(organization_id,array[''owner'',''admin'']::public.organization_role[]))',t);
end loop; end $$;

do $$ declare t text; begin foreach t in array array['google_ads_accounts','google_ads_campaigns','google_ads_ad_groups','google_ads_keywords','google_ads_search_terms','google_ads_daily_metrics','search_console_properties','search_console_daily_metrics','search_console_sitemaps'] loop
  execute format('create policy "marketing reads %1$s" on public.%1$I for select using (public.has_org_role(organization_id,array[''owner'',''admin'',''marketing'',''read_only'']::public.organization_role[]))',t);
end loop; end $$;

do $$ declare t text; begin foreach t in array array['sync_connections','sync_runs','webhook_events','google_ads_conversion_uploads','audit_log'] loop
  execute format('create policy "admins read %1$s" on public.%1$I for select using (public.has_org_role(organization_id,array[''owner'',''admin'']::public.organization_role[]))',t);
end loop; end $$;

insert into public.organizations(name,slug,timezone) values ('Southern Revelry','southern-revelry','America/Chicago') on conflict(slug) do nothing;
with org as (select id from public.organizations where slug='southern-revelry')
insert into public.pipeline_stages(organization_id,key,name,sort_order,is_terminal)
select org.id,s.key::public.pipeline_stage_key,s.name,s.sort_order,s.terminal from org cross join (values
('inquiry','Inquiry',1,false),('contacted','Contacted',2,false),('qualified','Qualified',3,false),('proposal_sent','Proposal Sent',4,false),
('follow_up','Follow-up',5,false),('proposal_signed','Proposal Signed',6,false),('retainer_paid','Retainer Paid',7,false),('planning','Planning',8,false),
('completed','Completed',9,true),('lost','Lost',10,true),('archived','Archived',11,true)) s(key,name,sort_order,terminal) on conflict do nothing;
with org as (select id from public.organizations where slug='southern-revelry')
insert into public.services(organization_id,name) select org.id,s.name from org cross join (values ('Photo Booth'),('360 Booth'),('GlamBOT'),('Dance Floor'),('Bar Services'),('Margarita Machine'),('Multiple Services'),('Unknown')) s(name) on conflict do nothing;

grant usage on schema public to authenticated, service_role;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant select,insert,update,delete on tables to authenticated;
alter default privileges in schema public grant usage,select on sequences to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
