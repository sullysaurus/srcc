alter table public.projects
  add column if not exists source_spreadsheet_id text,
  add column if not exists source_tab text,
  add column if not exists source_row_number integer;

create unique index if not exists projects_sheet_source_key
  on public.projects (organization_id, source_spreadsheet_id, source_tab, source_row_number)
  where source_spreadsheet_id is not null and source_tab is not null and source_row_number is not null;

do $$
declare
  constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'source_records'
    and c.contype = 'u'
    and pg_get_constraintdef(c.oid) like '%source_spreadsheet_id%source_row_number%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.source_records drop constraint %I', constraint_name);
  end if;
end $$;

create index if not exists source_records_sheet_row_history_idx
  on public.source_records (organization_id, source_spreadsheet_id, source_tab, source_row_number, imported_at desc);
