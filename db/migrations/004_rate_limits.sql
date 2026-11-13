-- Shared rate-limit counters (fixed windows) so limits hold across many server instances.
create unlogged table if not exists rate_limits (
  key          text not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (key, window_start)
);
alter table rate_limits enable row level security;
