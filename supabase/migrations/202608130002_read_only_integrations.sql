create table public.oauth_states (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('google_ads','search_console')),
  nonce_hash text not null unique,
  code_verifier_ciphertext bytea not null,
  redirect_path text not null default '/integrations',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.webhook_events
  add column encrypted_payload bytea,
  add column retention_expires_at timestamptz,
  add column retry_count integer not null default 0 check (retry_count between 0 and 20);

alter table public.google_ads_campaigns
  add column budget_cents bigint check (budget_cents is null or budget_cents >= 0);

create table public.google_ads_conversion_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.google_ads_accounts(id) on delete cascade,
  provider_id text not null,
  name text not null,
  category text,
  business_outcome text check (business_outcome in ('inquiry','qualified_lead','proposal','booked_event','revenue_collected','unmapped')),
  status text,
  primary_for_goal boolean,
  enhanced_conversions_enabled boolean,
  last_conversion_at timestamptz,
  raw_provider_fields jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id,provider_id)
);

create table public.integration_health_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.sync_connections(id) on delete cascade,
  provider text not null,
  issue_key text not null,
  severity text not null check (severity in ('info','warning','critical')),
  title text not null,
  detail text,
  entity_type text,
  entity_provider_id text,
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}',
  unique (organization_id,provider,issue_key,entity_provider_id)
);

create index oauth_states_expiry_idx on public.oauth_states (expires_at) where consumed_at is null;
create index conversion_actions_health_idx on public.google_ads_conversion_actions (organization_id,status,last_conversion_at);
create index integration_health_open_idx on public.integration_health_issues (organization_id,severity,last_detected_at desc) where resolved_at is null;

alter table public.oauth_states enable row level security;
alter table public.google_ads_conversion_actions enable row level security;
alter table public.integration_health_issues enable row level security;

create policy "admins read oauth states" on public.oauth_states for select
using (public.has_org_role(organization_id,array['owner','admin']::public.organization_role[]));
create policy "marketing reads conversion actions" on public.google_ads_conversion_actions for select
using (public.has_org_role(organization_id,array['owner','admin','marketing','read_only']::public.organization_role[]));
create policy "members read integration health" on public.integration_health_issues for select
using (public.is_org_member(organization_id));

grant select on public.oauth_states,public.google_ads_conversion_actions,public.integration_health_issues to authenticated;
grant all on public.oauth_states,public.google_ads_conversion_actions,public.integration_health_issues to service_role;
