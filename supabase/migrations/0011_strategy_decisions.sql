-- Every observed preflop decision for a strategy, including decisions the
-- current rule set deliberately does not judge yet.

create table public.strategy_hand_decision (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  review_id           uuid not null references public.strategy_hand_review(id) on delete cascade,
  hand_id             uuid not null references public.played_hand(id) on delete cascade,
  strategy_id         text not null,
  ps_hand_id          text not null,
  played_at           timestamptz not null,
  decision_index      smallint not null,
  family              text not null,
  coverage_status     text not null check (coverage_status in
                        ('gradeable', 'drill-only', 'not-supported')),
  skip_reason         text,
  node_id             text,
  hand_class          text not null,
  actual              text not null,
  expected            text,
  action_grade        text check (action_grade in
                        ('best', 'correct', 'inaccuracy', 'wrong', 'blunder')),
  effective_stack_bb  real,
  chart_version       integer not null,
  created_at          timestamptz not null default now(),

  unique (user_id, review_id, decision_index)
);

create index strategy_hand_decision_strategy_idx
  on public.strategy_hand_decision (user_id, strategy_id, played_at desc);
create index strategy_hand_decision_coverage_idx
  on public.strategy_hand_decision (user_id, strategy_id, coverage_status);

alter table public.strategy_hand_decision enable row level security;
create policy strategy_hand_decision_owner on public.strategy_hand_decision
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
