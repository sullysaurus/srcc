-- Mirror the complete HoneyBook pipeline observed in the Southern Revelry account.
update public.pipeline_stages
set sort_order = sort_order + 100
where organization_id in (
  select id from public.organizations where slug = 'southern-revelry'
);

with org as (
  select id from public.organizations where slug = 'southern-revelry'
)
insert into public.pipeline_stages (
  organization_id,
  key,
  name,
  sort_order,
  is_terminal
)
select id, 'meeting'::public.pipeline_stage_key, 'Meeting', 8, false
from org
on conflict (organization_id, key) do update
set name = excluded.name, sort_order = excluded.sort_order;

update public.pipeline_stages
set
  name = case key
    when 'proposal_sent' then 'Proposal sent'
    when 'completed' then 'Completed'
    when 'retainer_paid' then 'Retainer paid'
    when 'planning' then 'Planning'
    when 'inquiry' then 'Inquiry'
    when 'follow_up' then 'Follow-up'
    when 'proposal_signed' then 'Proposal signed'
    when 'meeting' then 'Meeting'
    when 'archived' then 'Archived'
    else name
  end,
  sort_order = case key
    when 'proposal_sent' then 1
    when 'completed' then 2
    when 'retainer_paid' then 3
    when 'planning' then 4
    when 'inquiry' then 5
    when 'follow_up' then 6
    when 'proposal_signed' then 7
    when 'meeting' then 8
    when 'archived' then 9
    when 'contacted' then 20
    when 'qualified' then 21
    when 'lost' then 22
    else sort_order
  end
where organization_id in (
  select id from public.organizations where slug = 'southern-revelry'
);

-- Sheet mappings are retained for audit but no longer appear as live work.
insert into public.audit_log (
  organization_id,
  action,
  entity_type,
  new_value,
  reason
)
select
  q.organization_id,
  'historical_sheet.mappings_archived',
  'mapping_queue',
  jsonb_build_object('archived_pending_count', count(*)),
  'Google Sheet retired as an operational source'
from public.mapping_queue q
join public.source_records s on s.id = q.source_record_id
where q.status = 'pending' and s.source_type = 'google_sheet'
group by q.organization_id;

update public.mapping_queue q
set status = 'excluded', resolved_at = now()
from public.source_records s
where s.id = q.source_record_id
  and q.status = 'pending'
  and s.source_type = 'google_sheet';
