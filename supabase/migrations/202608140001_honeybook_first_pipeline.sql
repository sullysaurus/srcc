-- HoneyBook is the operational source of truth. These are the exact stage labels
-- visible in Southern Revelry's current HoneyBook pipeline; legacy canonical
-- stages remain available only for retained historical records.
update public.pipeline_stages
set sort_order = sort_order + 100
where organization_id in (
  select id from public.organizations where slug = 'southern-revelry'
);

update public.pipeline_stages
set
  name = case key
    when 'inquiry' then 'Inquiry'
    when 'proposal_sent' then 'Proposal sent'
    when 'retainer_paid' then 'Retainer paid'
    when 'planning' then 'Planning'
    when 'completed' then 'Completed'
    else name
  end,
  sort_order = case key
    when 'inquiry' then 1
    when 'proposal_sent' then 2
    when 'retainer_paid' then 3
    when 'planning' then 4
    when 'completed' then 5
    when 'contacted' then 20
    when 'qualified' then 21
    when 'follow_up' then 22
    when 'proposal_signed' then 23
    when 'lost' then 24
    when 'archived' then 25
    else sort_order
  end
where organization_id in (
  select id from public.organizations where slug = 'southern-revelry'
);

create index if not exists source_records_provider_record_idx
  on public.source_records (organization_id, source_type, provider_record_id)
  where provider_record_id is not null;
