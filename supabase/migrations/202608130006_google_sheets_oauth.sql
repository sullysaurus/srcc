alter table public.oauth_states
  drop constraint if exists oauth_states_provider_check;

alter table public.oauth_states
  add constraint oauth_states_provider_check
  check (provider in ('google_ads', 'search_console', 'gmail', 'google_sheets'));
