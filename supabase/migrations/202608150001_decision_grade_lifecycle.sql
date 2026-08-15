-- Separate provider lifecycle timestamps from database ingestion time so
-- date-bound KPIs do not count a historical CSV import as a new lead/booking.
alter table public.projects
  add column if not exists inquiry_at timestamptz,
  add column if not exists booked_at timestamptz,
  add column if not exists owner_name text;

create index if not exists projects_inquiry_idx
  on public.projects (organization_id, inquiry_at desc);

create index if not exists projects_booked_idx
  on public.projects (organization_id, booked_at desc)
  where booked_at is not null;

alter table public.tasks
  add column if not exists provider text,
  add column if not exists provider_id text;

alter table public.tasks
  add constraint tasks_provider_unique
  unique (organization_id, provider, provider_id);
