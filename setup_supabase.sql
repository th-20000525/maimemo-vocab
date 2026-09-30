-- 在 Supabase → SQL Editor → New query 中粘贴并点击 Run

create table if not exists vocab_progress (
  sync_code text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table vocab_progress enable row level security;

drop policy if exists "vocab_progress_all" on vocab_progress;
create policy "vocab_progress_all"
  on vocab_progress
  for all
  using (true)
  with check (true);
