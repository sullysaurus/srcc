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
select id, 'proposal_viewed'::public.pipeline_stage_key, 'Proposal viewed', 2, false
from org
on conflict (organization_id, key) do update
set name = excluded.name, sort_order = excluded.sort_order, is_terminal = false;

update public.pipeline_stages
set sort_order = case key
  when 'proposal_sent' then 1
  when 'proposal_viewed' then 2
  when 'completed' then 3
  when 'retainer_paid' then 4
  when 'planning' then 5
  when 'inquiry' then 6
  when 'follow_up' then 7
  when 'proposal_signed' then 8
  when 'meeting' then 9
  when 'archived' then 10
  when 'contacted' then 20
  when 'qualified' then 21
  when 'lost' then 22
  else sort_order
end
where organization_id in (
  select id from public.organizations where slug = 'southern-revelry'
);

insert into public.audit_log (
  organization_id,
  action,
  entity_type,
  new_value,
  reason
)
select
  id,
  'pipeline.proposal_viewed_stage_added',
  'pipeline_stage',
  jsonb_build_object('key', 'proposal_viewed', 'name', 'Proposal viewed'),
  'Receive confirmed HoneyBook file views through a native automation stage transition'
from public.organizations
where slug = 'southern-revelry';
