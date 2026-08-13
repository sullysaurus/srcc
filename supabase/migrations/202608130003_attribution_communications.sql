alter type public.field_origin add value if not exists 'external_integration';

alter table public.oauth_states drop constraint oauth_states_provider_check;
alter table public.oauth_states add constraint oauth_states_provider_check check (provider in ('google_ads','search_console','gmail'));

create table public.attribution_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  visitor_key_hash text not null,
  request_fingerprint_hash text,
  landing_page text not null,
  first_referrer text,
  first_touch_at timestamptz not null,
  last_touch_at timestamptz not null,
  claimed_project_id uuid references public.projects(id) on delete set null,
  claimed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,visitor_key_hash)
);

create table public.attribution_touch_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.attribution_sessions(id) on delete cascade,
  gclid text, gbraid text, wbraid text,
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  landing_page text not null, referrer text, occurred_at timestamptz not null,
  touch_fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (session_id,touch_fingerprint)
);

alter table public.communications
  add column thread_id text,
  add column matched_by text check (matched_by in ('provider_id','email','phone','manual','unmatched')),
  add column metadata jsonb not null default '{}';

create index attribution_sessions_claim_idx on public.attribution_sessions (organization_id,claimed_project_id,created_at desc);
create index attribution_sessions_fingerprint_idx on public.attribution_sessions (organization_id,request_fingerprint_hash,created_at desc);
create index attribution_touch_click_idx on public.attribution_touch_events (organization_id,gclid,gbraid,wbraid);
create index communications_thread_idx on public.communications (organization_id,provider,thread_id,occurred_at desc);

alter table public.attribution_sessions enable row level security;
alter table public.attribution_touch_events enable row level security;

create policy "marketing reads attribution sessions" on public.attribution_sessions for select
using (public.has_org_role(organization_id,array['owner','admin','marketing']::public.organization_role[]));
create policy "marketing reads attribution touches" on public.attribution_touch_events for select
using (public.has_org_role(organization_id,array['owner','admin','marketing']::public.organization_role[]));

grant select on public.attribution_sessions,public.attribution_touch_events to authenticated;
grant all on public.attribution_sessions,public.attribution_touch_events to service_role;

create trigger set_attribution_sessions_updated_at before update on public.attribution_sessions
for each row execute procedure public.set_updated_at();
