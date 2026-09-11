-- The strategy learning layer.
--
-- A hand history is a fact: it happened once, and stays in `played_hand`.
-- Whether that hand belongs to a strategy is an interpretation that can change
-- when the player changes stakes, format or filters. Keeping assignments in a
-- separate table makes the interpretation versioned and reversible without
-- rewriting the canonical poker record.
--
-- Strategy definitions themselves live in code. They contain licensed source
-- mappings, teaching text and executable rules, none of which should be
-- editable through a database row. These tables hold the per-user state only.

create table public.strategy_hand_assignment (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  hand_id         uuid not null references public.played_hand(id) on delete cascade,
  strategy_id     text not null,
  filter_version  text not null,
  source          text not null check (source in ('automatic', 'manual')),
  assigned_at     timestamptz not null default now(),

  unique (user_id, hand_id, strategy_id)
);

create index strategy_assignment_strategy_idx
  on public.strategy_hand_assignment (user_id, strategy_id, assigned_at desc);
create index strategy_assignment_hand_idx
  on public.strategy_hand_assignment (hand_id);

alter table public.strategy_hand_assignment enable row level security;
create policy strategy_assignment_owner on public.strategy_hand_assignment
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A strategy source is defined in code; this binds its stable source ID to the
-- user's private uploaded book. The book itself remains in the existing reader
-- tables and storage bucket, never copied into strategy rows.
create table public.strategy_source_binding (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  strategy_id     text not null,
  source_id       text not null,
  book_id         uuid not null references public.book(id) on delete cascade,
  bound_at        timestamptz not null default now(),

  unique (user_id, strategy_id, source_id)
);

create index strategy_source_binding_user_idx
  on public.strategy_source_binding (user_id, strategy_id);

alter table public.strategy_source_binding enable row level security;
create policy strategy_source_binding_owner on public.strategy_source_binding
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A setup requirement is supplied by the strategy manifest. This is only the
-- user's completion state: a requirement may be checked off and later undone
-- without losing the evidence that it once existed.
create table public.strategy_setup_check (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  strategy_id     text not null,
  requirement_id  text not null,
  complete        boolean not null default false,
  completed_at    timestamptz,
  updated_at      timestamptz not null default now(),

  unique (user_id, strategy_id, requirement_id)
);

create index strategy_setup_user_idx
  on public.strategy_setup_check (user_id, strategy_id);

alter table public.strategy_setup_check enable row level security;
create policy strategy_setup_owner on public.strategy_setup_check
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Locked and available are derived from the manifest's prerequisite graph.
-- Only activity and actual mastery are persisted, so editing a map cannot
-- leave stale unlock flags behind.
create table public.strategy_lesson_progress (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  strategy_id     text not null,
  lesson_id       text not null,
  started_at      timestamptz,
  mastered_at     timestamptz,
  updated_at      timestamptz not null default now(),

  unique (user_id, strategy_id, lesson_id)
);

create index strategy_lesson_user_idx
  on public.strategy_lesson_progress (user_id, strategy_id, updated_at desc);

alter table public.strategy_lesson_progress enable row level security;
create policy strategy_lesson_owner on public.strategy_lesson_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Append-only evidence behind a mastery decision. A score is intentionally
-- generic: a range drill records accuracy, a recall exercise records its own
-- assessment, and a timed drill records both score and duration. The manifest
-- determines which attempts qualify; this table never invents a rule.
create table public.strategy_mastery_attempt (
  id                bigserial primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  strategy_id       text not null,
  lesson_id         text not null,
  requirement_kind  text not null check (requirement_kind in ('drill', 'quiz', 'recall')),
  requirement_id    text,
  score             real,
  duration_ms       integer check (duration_ms is null or duration_ms >= 0),
  payload           jsonb not null default '{}'::jsonb,
  attempted_at      timestamptz not null default now()
);

create index strategy_attempt_user_idx
  on public.strategy_mastery_attempt (user_id, strategy_id, lesson_id, attempted_at desc);

alter table public.strategy_mastery_attempt enable row level security;
create policy strategy_attempt_read on public.strategy_mastery_attempt
  for select using (auth.uid() = user_id);
create policy strategy_attempt_append on public.strategy_mastery_attempt
  for insert with check (auth.uid() = user_id);
