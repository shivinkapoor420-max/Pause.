-- Therapist partner network: real, admin-verified clinicians who can receive
-- self-report briefs that members write and review themselves.
create table if not exists therapist_profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references users(id) on delete cascade,
  name            text not null,
  credentials     text not null,
  license_number  text not null,
  license_region  text not null,
  practice        text not null default '',
  email           text not null,
  phone           text not null default '',
  bio             text not null default '',
  city            text not null default '',
  country         text not null default '',
  issues          text[] not null default '{}',
  age_groups      text[] not null default '{}',   -- early, kids, teen, adult
  languages       text[] not null default '{}',
  online          boolean not null default true,
  in_person       boolean not null default false,
  status          text not null default 'pending' check (status in ('pending','verified','rejected','paused')),
  accepts_briefs  boolean not null default true,
  review_note     text not null default '',
  verified_by     uuid references users(id) on delete set null,
  verified_at     timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists therapist_briefs (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references users(id) on delete cascade,
  therapist_id  uuid not null references therapist_profiles(id) on delete cascade,
  kind          text not null default 'brief' check (kind in ('brief','update')),
  body          text not null,
  read_at       timestamptz,
  confirmed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists briefs_sender_idx on therapist_briefs(sender_id, created_at desc);
create index if not exists briefs_therapist_idx on therapist_briefs(therapist_id, created_at desc);

-- Browser push subscriptions (Web Push / VAPID).
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_user_idx on push_subscriptions(user_id);

-- Small server-side settings (e.g. auto-generated VAPID keys).
create table if not exists app_settings (
  key   text primary key,
  value jsonb not null
);

-- One reminder per person per day, at most.
create table if not exists reminder_log (
  user_id uuid not null references users(id) on delete cascade,
  day     date not null,
  kind    text not null,
  primary key (user_id, day, kind)
);

alter table therapist_profiles enable row level security;
alter table therapist_briefs enable row level security;
alter table push_subscriptions enable row level security;
alter table app_settings enable row level security;
alter table reminder_log enable row level security;
