-- Community blog ("Park a thought"): public, anonymous-friendly, every piece
-- reviewed by a moderator before it appears on the site.
create table if not exists blog_posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid references users(id) on delete set null,
  pen_name     text not null default 'Anonymous',
  title        text not null,
  body         text not null,
  topic        text not null default 'thoughts',
  contact_email text,                     -- optional, never published
  status       text not null default 'pending' check (status in ('pending','published','rejected')),
  review_note  text not null default '',
  reviewed_by  uuid references users(id) on delete set null,
  reviewed_at  timestamptz,
  hearts       int not null default 0,
  created_at   timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists blog_status_idx on blog_posts(status, published_at desc);
alter table blog_posts enable row level security;
