-- ─── Run this entire file in your Supabase SQL editor ───────────────────────
-- Go to: supabase.com → your project → SQL Editor → New query → paste & run

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Profiles ─────────────────────────────────────────────────────────────────
create table public.profiles (
  id                   uuid primary key references auth.users on delete cascade,
  email                text,
  role                 text not null default 'pilot' check (role in ('pilot','cd')),
  full_name            text,
  competition_number   text,
  n_number             text,
  glider_manufacturer  text,
  glider_model         text,
  takeoff_weight_lbs   numeric,
  ref_weight_lbs       numeric,
  base_handicap        numeric,
  adjusted_handicap    numeric,
  wl_formula           text default 'none',
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Service role can do anything (for backend)
create policy "Service role full access to profiles"
  on public.profiles for all using (true) with check (true);

-- ─── Contests ─────────────────────────────────────────────────────────────────
create table public.contests (
  id           uuid primary key default uuid_generate_v4(),
  cd_id        uuid not null references public.profiles(id),
  name         text not null,
  location     text,
  start_date   date,
  end_date     date,
  frequency    text default '123.5',
  status       text default 'setup' check (status in ('setup','open','closed')),
  penalties    jsonb default '{
    "earlyStartMultiplier": 20,
    "invalidStartPenaltySecs": 600,
    "belowMinAltPerFoot": 10,
    "ceilingBustPenaltySecs": 0,
    "maxTimeFactor": 1.5
  }'::jsonb,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table public.contests enable row level security;

-- CD can manage their own contests
create policy "CD manages own contests"
  on public.contests for all using (auth.uid() = cd_id);

-- Pilots can read contests they're registered in
create policy "Pilots read registered contests"
  on public.contests for select using (
    exists (
      select 1 from public.contest_registrations
      where contest_id = id and pilot_id = auth.uid()
    )
  );

-- Leaderboard public read (all contests)
create policy "Public leaderboard read"
  on public.contests for select using (true);

-- ─── Contest Registrations ────────────────────────────────────────────────────
create table public.contest_registrations (
  id                  uuid primary key default uuid_generate_v4(),
  contest_id          uuid not null references public.contests(id) on delete cascade,
  pilot_id            uuid not null references public.profiles(id) on delete cascade,
  status              text default 'pending' check (status in ('pending','approved','withdrawn')),
  handicap_override   numeric,
  effective_handicap  numeric,
  created_at          timestamptz default now(),
  unique (contest_id, pilot_id)
);

alter table public.contest_registrations enable row level security;

create policy "Anyone can read registrations"
  on public.contest_registrations for select using (true);

create policy "Pilots manage own registration"
  on public.contest_registrations for insert with check (auth.uid() = pilot_id);

create policy "CD manages registrations in their contest"
  on public.contest_registrations for update using (
    exists (select 1 from public.contests where id = contest_id and cd_id = auth.uid())
  );

-- ─── Tasks ────────────────────────────────────────────────────────────────────
create table public.tasks (
  id                  uuid primary key default uuid_generate_v4(),
  contest_id          uuid not null references public.contests(id) on delete cascade,
  date                date not null,
  gate_open           time not null default '12:00',
  status              text default 'open' check (status in ('open','finalized')),
  reference_handicap  numeric default 0.5,
  task_points         jsonb default '[]'::jsonb,
  settings            jsonb default '{}'::jsonb,
  winner_time         numeric,
  max_time            numeric,
  max_time_factor     numeric default 1.5,
  below_threshold     boolean default false,
  finalized_at        timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table public.tasks enable row level security;

create policy "Anyone can read tasks"
  on public.tasks for select using (true);

create policy "CD manages tasks in their contest"
  on public.tasks for all using (
    exists (select 1 from public.contests where id = contest_id and cd_id = auth.uid())
  );

-- ─── Results ──────────────────────────────────────────────────────────────────
create table public.results (
  id                  uuid primary key default uuid_generate_v4(),
  task_id             uuid not null references public.tasks(id) on delete cascade,
  contest_id          uuid not null references public.contests(id) on delete cascade,
  pilot_id            uuid not null references public.profiles(id) on delete cascade,
  status              text,
  final_status        text,
  elapsed_secs        numeric,
  penalty_secs        numeric default 0,
  start_secs          numeric,
  finish_secs         numeric,
  early_penalty_secs  numeric default 0,
  final_time          numeric,
  winner_time         numeric,
  max_time            numeric,
  igc_filename        text,
  igc_storage_path    text,
  detail              text,
  scored_at           timestamptz,
  created_at          timestamptz default now(),
  unique (task_id, pilot_id)
);

alter table public.results enable row level security;

create policy "Anyone can read results"
  on public.results for select using (true);

create policy "Pilots upload own results"
  on public.results for insert with check (auth.uid() = pilot_id);

create policy "Pilots update own results"
  on public.results for update using (auth.uid() = pilot_id);

create policy "CD manages results in their contest"
  on public.results for all using (
    exists (select 1 from public.contests where id = contest_id and cd_id = auth.uid())
  );

-- ─── Storage bucket for IGC files ─────────────────────────────────────────────
-- Run these in Supabase Dashboard → Storage → New bucket
-- Bucket name: igc-files, Public: false

-- Or via SQL:
insert into storage.buckets (id, name, public)
values ('igc-files', 'igc-files', false)
on conflict do nothing;

create policy "Pilots upload own IGC"
  on storage.objects for insert
  with check (bucket_id = 'igc-files' and auth.uid()::text = (storage.foldername(name))[3]);

create policy "CD reads IGC in their contests"
  on storage.objects for select
  using (bucket_id = 'igc-files');

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Enable realtime on results table for live leaderboard
alter publication supabase_realtime add table public.results;
alter publication supabase_realtime add table public.tasks;
