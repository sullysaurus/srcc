create type public.approval_gate_key as enum (
  'tracking_tested',
  'conversion_action_ownership_confirmed',
  'customer_data_terms_accepted',
  'deduplication_verified',
  'production_uploads_approved'
);

create type public.recommendation_status as enum ('open','acknowledged','completed','dismissed');

create table public.conversion_upload_gates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  gate public.approval_gate_key not null,
  satisfied boolean not null default false,
  evidence text,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  revoked_by uuid references public.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,gate),
  check (not satisfied or (approved_by is not null and approved_at is not null))
);

alter table public.google_ads_conversion_uploads
  add column conversion_action_id uuid references public.google_ads_conversion_actions(id) on delete restrict,
  add column conversion_occurred_at timestamptz,
  add column click_identifier_type text check (click_identifier_type in ('gclid','gbraid','wbraid','enhanced_lead')),
  add column click_identifier_ciphertext bytea,
  add column user_data_hashes jsonb not null default '{}',
  add column validation_result jsonb not null default '{}',
  add column dry_run_at timestamptz,
  add column upload_attempted_at timestamptz,
  add column uploaded_at timestamptz,
  add column provider_job_id text,
  add column last_error text;

alter table public.google_ads_conversion_uploads
  add constraint google_ads_conversion_uploads_uploaded_check check (
    status <> 'uploaded' or (uploaded_at is not null and provider_job_id is not null)
  );

alter table public.google_ads_conversion_uploads
  drop constraint if exists google_ads_conversion_uploads_status_check;
alter table public.google_ads_conversion_uploads
  add constraint google_ads_conversion_uploads_status_check check (status in (
    'disabled','candidate','invalid','ready_for_dry_run','dry_run_passed','awaiting_approval','approved','uploading','uploaded','failed','cancelled'
  ));

create table public.operational_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  alert_key text not null,
  severity text not null check (severity in ('info','warning','critical')),
  category text not null,
  title text not null,
  detail text,
  entity_type text,
  entity_id uuid,
  source text not null,
  source_date_range jsonb not null default '{}',
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  acknowledged_by uuid references public.users(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb not null default '{}',
  unique nulls not distinct (organization_id,alert_key,entity_id)
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recommendation_key text not null,
  category text not null,
  priority integer not null check (priority between 1 and 100),
  title text not null,
  rationale text not null,
  suggested_action text not null,
  source text not null,
  source_date_range jsonb not null default '{}',
  status public.recommendation_status not null default 'open',
  acknowledged_by uuid references public.users(id) on delete set null,
  acknowledged_at timestamptz,
  completed_by uuid references public.users(id) on delete set null,
  completed_at timestamptz,
  dismissed_by uuid references public.users(id) on delete set null,
  dismissed_at timestamptz,
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}',
  unique (organization_id,recommendation_key)
);

create index conversion_upload_queue_idx on public.google_ads_conversion_uploads (organization_id,status,created_at);
create index operational_alerts_open_idx on public.operational_alerts (organization_id,severity,last_detected_at desc) where resolved_at is null;
create index recommendations_open_idx on public.recommendations (organization_id,priority desc,generated_at desc) where status='open';

alter table public.conversion_upload_gates enable row level security;
alter table public.operational_alerts enable row level security;
alter table public.recommendations enable row level security;

create policy "admins read conversion gates" on public.conversion_upload_gates for select
using (public.has_org_role(organization_id,array['owner','admin']::public.organization_role[]));
create policy "members read operational alerts" on public.operational_alerts for select
using (public.is_org_member(organization_id));
create policy "members read recommendations" on public.recommendations for select
using (public.is_org_member(organization_id));
create policy "leaders manage recommendations" on public.recommendations for update
using (public.has_org_role(organization_id,array['owner','admin','sales','operations','marketing']::public.organization_role[]))
with check (public.has_org_role(organization_id,array['owner','admin','sales','operations','marketing']::public.organization_role[]));

grant select on public.conversion_upload_gates,public.operational_alerts,public.recommendations to authenticated;
grant update on public.recommendations to authenticated;
grant all on public.conversion_upload_gates,public.operational_alerts,public.recommendations to service_role;

create trigger set_conversion_upload_gates_updated_at before update on public.conversion_upload_gates
for each row execute procedure public.set_updated_at();

create or replace function public.seed_conversion_upload_gates() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.conversion_upload_gates(organization_id,gate)
  select new.id,unnest(enum_range(null::public.approval_gate_key)) on conflict do nothing;
  return new;
end $$;

create trigger organization_conversion_upload_gates after insert on public.organizations
for each row execute procedure public.seed_conversion_upload_gates();

with orgs as (select id from public.organizations), gates as (
  select unnest(enum_range(null::public.approval_gate_key)) as gate
)
insert into public.conversion_upload_gates(organization_id,gate)
select orgs.id,gates.gate from orgs cross join gates on conflict do nothing;
