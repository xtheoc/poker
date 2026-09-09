-- One card table and one review log, for everything the platform can test.
--
-- A preflop node, a hand that was misplayed, and a concept from chapter four of
-- a book are all rows here. Three separate quiz systems with three separate
-- queues would compete for the same ten minutes a day and none would win; one
-- queue lets the scheduler balance what most needs review against what most
-- recently went wrong, whatever it came from.
--
-- Two decisions in this schema are the ones that cannot be changed later.
--
-- **Card granularity.** A card is a *node* — "CO opening at 100bb" — not a hand
-- at a node. The full 6-max tree is around 85 nodes and 169 hands, so per-hand
-- cards would mean roughly 14,400 of them, at which point intervals stop
-- meaning anything and the deck is unlearnable. Reviewing a node card drills
-- several hands sampled from it; per-hand accuracy lives in the review log and
-- steers that sampling, without ever reaching the scheduler.
--
-- **Item identity is independent of chart version.** `item_key` holds a node id
-- like "6max-2.5x/100bb/rfi/CO", which describes a *situation*. Publishing
-- better numbers for that situation must not orphan a card that has been
-- reviewed against it for six months, so the chart version is recorded
-- alongside rather than being part of the key.

create table public.srs_card (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  kind            text not null check (kind in (
                    'preflop_node',   -- a spot in the preflop tree
                    'hand_replay',    -- a real hand from this user's history
                    'concept',        -- a claim extracted from a book section
                    'leak_drill'      -- a synthesised spot targeting a leak
                  )),
  -- Stable identity of the thing being learned, unique within its kind.
  item_key        text not null,
  -- Which chart set version this card was last reviewed against, so a review
  -- recorded under older numbers stays interpretable instead of being silently
  -- re-scored against a strategy the user was never shown.
  chart_version   int,
  -- Kind-specific detail: the hand id for a replay, the concept text, and so on.
  payload         jsonb not null default '{}'::jsonb,

  -- Why this card exists. Both nullable: a preflop node card is simply part of
  -- the curriculum and needs no justification.
  source_leak_id  uuid,
  source_book_id  uuid,

  -- FSRS-6 state, mirroring the ts-fsrs Card type field for field. Kept as
  -- columns rather than a jsonb blob because the due date is the hot query.
  due             timestamptz not null default now(),
  stability       real        not null default 0,
  difficulty      real        not null default 0,
  elapsed_days    integer     not null default 0,
  scheduled_days  integer     not null default 0,
  learning_steps  smallint    not null default 0,
  reps            integer     not null default 0,
  lapses          integer     not null default 0,
  -- ts-fsrs State: 0 New, 1 Learning, 2 Review, 3 Relearning.
  state           smallint    not null default 0 check (state between 0 and 3),
  last_review     timestamptz,

  suspended       boolean     not null default false,
  -- The exit criterion a generic flashcard app cannot have: once the hand
  -- history stops showing the mistake this card was created to fix, it is
  -- retired rather than reviewed forever. Kept rather than deleted, so the
  -- record of what was once a leak survives.
  retired_at      timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (user_id, kind, item_key)
);

-- The one query that runs on every page load: what is due for me right now.
create index srs_card_due_idx
  on public.srs_card (user_id, due)
  where suspended = false and retired_at is null;

create index srs_card_leak_idx on public.srs_card (source_leak_id)
  where source_leak_id is not null;

alter table public.srs_card enable row level security;

drop policy if exists srs_card_owner on public.srs_card;
create policy srs_card_owner on public.srs_card
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Every review, forever. Append-only: never updated, never deleted.
--
-- This is not an audit log kept out of habit. It is the training set that fits
-- this user's own FSRS parameters once they pass roughly a thousand reviews,
-- and it is what a reschedule replays when those parameters change. Losing it
-- means losing the ability to ever personalise the scheduler.
--
-- The poker columns at the bottom sit deliberately outside the FSRS state. They
-- are what lets a drill sample the hands this user keeps getting wrong, without
-- inflating the deck to one card per hand.
create table public.srs_review_log (
  id                 bigserial primary key,
  card_id            uuid        not null references public.srs_card(id) on delete cascade,
  user_id            uuid        not null references auth.users(id) on delete cascade,

  rating             smallint    not null check (rating between 1 and 4),
  -- Card state *before* the review, which is what parameter fitting needs.
  state              smallint    not null check (state between 0 and 3),
  due                timestamptz not null,
  stability          real        not null,
  difficulty         real        not null,
  elapsed_days       integer     not null,
  last_elapsed_days  integer     not null,
  scheduled_days     integer     not null,
  learning_steps     smallint    not null,
  review             timestamptz not null default now(),

  -- Poker specifics FSRS knows nothing about.
  hand               text,        -- the hand class drilled, e.g. 'AJo'
  chosen_action      text,
  expected_action    text,
  action_grade       text check (action_grade in
                       ('best', 'correct', 'inaccuracy', 'wrong', 'blunder')),
  strategy_freq      real,        -- frequency of the action the user chose
  ev_loss_bb         real,        -- null for authored charts, which carry no EV
  rng_roll           smallint check (rng_roll between 1 and 100),
  duration_ms        integer
);

create index srs_review_log_card_idx on public.srs_review_log (card_id, review desc);
create index srs_review_log_user_idx on public.srs_review_log (user_id, review desc);

alter table public.srs_review_log enable row level security;

-- Select and insert only. There is deliberately no update or delete policy,
-- which is how "append-only" is enforced rather than merely intended.
drop policy if exists srs_review_log_read on public.srs_review_log;
create policy srs_review_log_read on public.srs_review_log
  for select using (auth.uid() = user_id);

drop policy if exists srs_review_log_append on public.srs_review_log;
create policy srs_review_log_append on public.srs_review_log
  for insert with check (auth.uid() = user_id);

-- Per-user scheduler parameters.
--
-- Empty for a new user, and that is correct: FSRS's defaults are fitted on
-- hundreds of millions of reviews and beat anything trained on a few dozen of
-- yours. A personal fit only makes sense once there is enough history to beat
-- them, which is why the review count at training time is recorded.
create table public.srs_params (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  -- 21 floats for FSRS-6. Null means "use the library defaults", which is the
  -- right answer until there is enough history to improve on them.
  w                         real[],
  request_retention         real    not null default 0.9
                              check (request_retention between 0.7 and 0.97),
  maximum_interval          integer not null default 36500,
  enable_fuzz               boolean not null default true,
  enable_short_term         boolean not null default true,
  trained_at                timestamptz,
  review_count_at_training  integer
);

alter table public.srs_params enable row level security;

drop policy if exists srs_params_owner on public.srs_params;
create policy srs_params_owner on public.srs_params
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
