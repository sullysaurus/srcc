alter type public.pipeline_stage_key
  add value if not exists 'proposal_viewed' after 'proposal_sent';
