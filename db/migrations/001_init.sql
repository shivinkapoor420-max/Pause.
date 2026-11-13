-- Pause 2.0 — initial schema.
-- Works on any Postgres 14+ (local, Supabase, Neon, RDS).
-- All access goes through the Pause server, which enforces authorisation.
-- Row Level Security is enabled on every table with NO policies for the
-- anon/authenticated roles, so Supabase's public REST/Realtime APIs can never
-- read this data directly (defence in depth). The server connects as the
-- table owner and is the only client.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- users
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique,                       -- null for child profiles
  email_verified_at timestamptz,
  username      text not null unique,
  password_hash text,                              -- null for 4–7 profiles (no own login)
  display_name  text not null,
  birth_date    date not null,
  age_group     text not null check (age_group in ('early','kids','teen','adult')),
  role          text not null default 'user' check (role in ('user','moderator','admin')),
  guardian_id   uuid references users(id) on delete cascade,
  parent_pin_hash text,                            -- parent accounts: exit code for child mode
  bio           text not null default '',
  avatar_id     uuid,
  cover_id      uuid,
  avatar_style  text not null default 'leaf',
  interests     text[] not null default '{}',
  profile_visibility text not null default 'public' check (profile_visibility in ('public','followers','private')),
  phone         text not null default '',
  -- Anonymity-first community identity: a generated pseudonym is the ONLY
  -- identifier other members see, unless the person opts to show their name.
  community_alias text unique,
  identity_mode text not null default 'alias' check (identity_mode in ('alias','name')),
  settings      jsonb not null default '{}',       -- accessibility + UI settings
  prefs         jsonb not null default '{}',       -- notifications, privacy, leaderboard opt-in, read receipts
  app_data      jsonb not null default '{}',       -- small private extras (routine, notes…)
  consented_at  timestamptz,
  memory_consent boolean not null default false,   -- AI companion may use recaps
  status        text not null default 'active' check (status in ('active','suspended','deleted')),
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists users_guardian_idx on users(guardian_id);
create index if not exists users_age_group_idx on users(age_group);
create index if not exists users_username_trgm on users (lower(username));

create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,
  user_id     uuid not null references users(id) on delete cascade,
  child_mode  boolean not null default false,     -- a 4–7 session started from a parent account
  parent_id   uuid references users(id) on delete cascade,
  user_agent  text not null default '',
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists sessions_user_idx on sessions(user_id);

create table if not exists auth_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  kind        text not null check (kind in ('verify_email','reset_password')),
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists consents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  granted_by  uuid references users(id) on delete set null,  -- guardian for minors
  kind        text not null,       -- terms, privacy, guardian, voice, ai_memory, location
  granted     boolean not null,
  version     text not null default '2026-11',
  created_at  timestamptz not null default now()
);
create index if not exists consents_user_idx on consents(user_id, kind);

-- ---------------------------------------------------------------- wellness
create table if not exists mood_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  day        date not null,
  sky        text not null check (sky in ('sunny','partly','cloudy','rainy','stormy')),
  tags       text[] not null default '{}',
  note       text not null default '',
  assisted_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

create table if not exists journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  kind       text not null check (kind in ('text','voice','drawing','gratitude')),
  prompt     text not null default '',
  body       text not null default '',
  sky        text,
  created_at timestamptz not null default now()
);
create index if not exists journal_user_idx on journal_entries(user_id, created_at desc);

create table if not exists checkins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  band       text not null,
  answers    jsonb not null,
  flagged    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists checkins_user_idx on checkins(user_id, created_at desc);

create table if not exists companion_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  band         text not null,
  mode         text not null,
  turns        jsonb not null default '[]',
  observations jsonb not null default '[]',
  created_at   timestamptz not null default now()
);
create index if not exists companion_user_idx on companion_sessions(user_id, created_at desc);

create table if not exists activity_events (
  id         bigserial primary key,
  user_id    uuid not null references users(id) on delete cascade,
  kind       text not null,      -- tool, grounding, breathing, game, story…
  ref        text not null default '',
  amount     int not null default 1,
  meta       jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists activity_user_idx on activity_events(user_id, created_at desc);

create table if not exists ai_usage (
  user_id uuid not null references users(id) on delete cascade,
  day     date not null,
  count   int not null default 0,
  primary key (user_id, day)
);

-- ---------------------------------------------------------------- games + gamification
create table if not exists game_results (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  game       text not null,
  difficulty text not null default 'easy',
  score      int not null default 0,
  duration_s int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists game_results_user_idx on game_results(user_id, game, created_at desc);
create index if not exists game_results_board_idx on game_results(game, created_at desc);

create table if not exists user_achievements (
  user_id    uuid not null references users(id) on delete cascade,
  key        text not null,
  earned_at  timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists xp_ledger (
  id         bigserial primary key,
  user_id    uuid not null references users(id) on delete cascade,
  amount     int not null,
  reason     text not null,
  day        date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists xp_user_idx on xp_ledger(user_id, created_at desc);

create table if not exists games_catalog (
  id          text primary key,
  enabled     boolean not null default true,
  premium     boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- subscriptions
create table if not exists subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id) on delete cascade,
  provider           text not null,        -- stripe | razorpay | sandbox
  provider_sub_id    text,
  provider_customer_id text,
  plan               text not null check (plan in ('monthly','annual')),
  status             text not null check (status in ('incomplete','active','trialing','past_due','canceled','expired')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (provider, provider_sub_id)
);
create index if not exists subscriptions_user_idx on subscriptions(user_id);

create table if not exists billing_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id) on delete set null,
  provider     text not null,
  kind         text not null,       -- payment_succeeded, payment_failed, refund…
  amount_cents int not null default 0,
  currency     text not null default 'usd',
  description  text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists billing_user_idx on billing_events(user_id, created_at desc);

create table if not exists webhook_events (
  provider   text not null,
  event_id   text not null,
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);

-- ---------------------------------------------------------------- media
create table if not exists uploads (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references users(id) on delete cascade,
  mime       text not null,
  size       int not null,
  scope      text not null check (scope in ('public','message')),
  conversation_id uuid,
  data       bytea not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- community (18+ only)
create table if not exists communities (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text not null default '',
  guidelines  text not null default '',
  cover_hue   int not null default 140,
  cover_id    uuid,
  premium     boolean not null default false,
  created_by  uuid references users(id) on delete set null,
  status      text not null default 'active' check (status in ('active','archived')),
  created_at  timestamptz not null default now()
);

create table if not exists community_members (
  community_id uuid not null references communities(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  role         text not null default 'member' check (role in ('member','moderator','owner')),
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index if not exists community_members_user_idx on community_members(user_id);

create table if not exists posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references users(id) on delete cascade,
  community_id uuid references communities(id) on delete cascade,
  body         text not null,
  image_id     uuid references uploads(id) on delete set null,
  anonymous    boolean not null default false,
  kind         text not null default 'post' check (kind in ('post','milestone','prompt')),
  status       text not null default 'visible' check (status in ('visible','pending','removed')),
  edited_at    timestamptz,
  created_at   timestamptz not null default now(),
  search       tsvector generated always as (to_tsvector('english', body)) stored
);
create index if not exists posts_created_idx on posts(created_at desc);
create index if not exists posts_author_idx on posts(author_id, created_at desc);
create index if not exists posts_community_idx on posts(community_id, created_at desc);
create index if not exists posts_search_idx on posts using gin(search);

create table if not exists comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  author_id  uuid not null references users(id) on delete cascade,
  parent_id  uuid references comments(id) on delete cascade,
  body       text not null,
  status     text not null default 'visible' check (status in ('visible','pending','removed')),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on comments(post_id, created_at);

create table if not exists reactions (
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  kind       text not null check (kind in ('heart','hug','strength','relate','celebrate')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists saved_posts (
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists follows (
  follower_id uuid not null references users(id) on delete cascade,
  followee_id uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on follows(followee_id);

create table if not exists blocks (
  blocker_id uuid not null references users(id) on delete cascade,
  blocked_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table if not exists mutes (
  muter_id   uuid not null references users(id) on delete cascade,
  muted_id   uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id)
);

-- ---------------------------------------------------------------- messaging (18+ only)
create table if not exists conversations (
  id           uuid primary key default gen_random_uuid(),
  is_group     boolean not null default false,
  title        text not null default '',
  community_id uuid references communities(id) on delete cascade,
  created_by   uuid references users(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create table if not exists conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  status       text not null default 'accepted' check (status in ('accepted','pending','left')),
  muted        boolean not null default false,
  last_read_at timestamptz not null default 'epoch',
  joined_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists conv_members_user_idx on conversation_members(user_id);

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references users(id) on delete cascade,
  body            text not null default '',
  kind            text not null default 'text' check (kind in ('text','image','voice')),
  media_id        uuid references uploads(id) on delete set null,
  reply_to        uuid references messages(id) on delete set null,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conv_idx on messages(conversation_id, created_at desc);

create table if not exists message_reactions (
  message_id uuid not null references messages(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  emoji      text not null,
  primary key (message_id, user_id)
);

-- ---------------------------------------------------------------- notifications, safety, admin
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text not null default '',
  link       text not null default '',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications(user_id, created_at desc);

create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references users(id) on delete set null,   -- null = automated filter
  target_kind text not null check (target_kind in ('post','comment','user','message','community')),
  target_id   uuid not null,
  reason      text not null,
  details     text not null default '',
  status      text not null default 'open' check (status in ('open','actioned','dismissed')),
  resolved_by uuid references users(id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists reports_status_idx on reports(status, created_at desc);

create table if not exists moderation_actions (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references users(id) on delete set null,
  target_kind text not null,
  target_id   uuid not null,
  action      text not null,
  note        text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists audit_logs (
  id         bigserial primary key,
  actor_id   uuid references users(id) on delete set null,
  action     text not null,
  target     text not null default '',
  meta       jsonb not null default '{}',
  ip         text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists contact_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) on delete set null,
  name       text not null,
  email      text not null,
  topic      text not null,
  message    text not null,
  status     text not null default 'new' check (status in ('new','read','replied','archived')),
  created_at timestamptz not null default now()
);

create table if not exists location_shares (
  child_id    uuid primary key references users(id) on delete cascade,
  enabled     boolean not null default false,
  lat         double precision,
  lng         double precision,
  accuracy_m  int,
  shared_at   timestamptz           -- only the latest point is ever kept; no history
);

-- ---------------------------------------------------------------- RLS lockdown
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
