-- Strategy-specific hand review.
--
-- A hand can be assigned to more than one strategy over its lifetime. The
-- generic `hand_violation` table remains the shared workspace review; these
-- rows hold each strategy's separate opinion without overwriting it.

create table public.strategy_hand_review (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  hand_id             uuid not null references public.played_hand(id) on delete cascade,
  strategy_id         text not null,
  filter_version      text not null,
  chart_version       integer not null,
  charted_decisions   smallint not null default 0,
  mistake_count       smallint not null default 0,
  net_bb              real,
  vpip                boolean not null default false,
  pfr                 boolean not null default false,
  reviewed_at         timestamptz not null default now(),

  unique (user_id, hand_id, strategy_id)
);

create index strategy_hand_review_strategy_idx
  on public.strategy_hand_review (user_id, strategy_id, reviewed_at desc);

alter table public.strategy_hand_review enable row level security;
create policy strategy_hand_review_owner on public.strategy_hand_review
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The evidence behind a strategy review. These fields deliberately mirror the
-- generic violation table so the same leak engine can rank either dataset.
create table public.strategy_hand_violation (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  review_id       uuid not null references public.strategy_hand_review(id) on delete cascade,
  hand_id         uuid not null references public.played_hand(id) on delete cascade,
  strategy_id     text not null,
  lesson_id       text,
  ps_hand_id      text not null,
  played_at       timestamptz not null,
  node_id         text not null,
  spot            text not null,
  hand_class      text not null,
  chosen          text not null,
  expected        text not null,
  action_grade    text not null check (action_grade in
                    ('inaccuracy', 'wrong', 'blunder')),
  kind            text not null check (kind in
                    ('too-loose', 'too-tight', 'wrong-line')),
  ev_loss_bb      real,
  chart_version   integer not null,
  created_at      timestamptz not null default now()
);

create index strategy_hand_violation_strategy_idx
  on public.strategy_hand_violation (user_id, strategy_id, played_at desc);
create index strategy_hand_violation_lesson_idx
  on public.strategy_hand_violation (user_id, strategy_id, lesson_id);

alter table public.strategy_hand_violation enable row level security;
create policy strategy_hand_violation_owner on public.strategy_hand_violation
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
