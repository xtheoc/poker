-- Imported hands, and the graded mistakes found in them.
--
-- Until now hand review ran entirely in the browser and forgot everything on
-- reload, which quietly disabled the only thing that makes the leak engine
-- worth having: **a leak is a pattern across sessions, and a tool that cannot
-- remember last week can only ever see one sitting.** The confidence thresholds
-- are written in terms of sessions; without storage, every import started at
-- zero and nothing could ever become confirmed.
--
-- Two decisions here are worth stating.
--
-- **The raw text is stored alongside the parsed columns.** It roughly triples
-- the row size and it is worth it. PokerStars changed its hand-history format
-- twice in the year before this was written, and a parser fix six months from
-- now must be replayable over hands already imported rather than needing the
-- files again — which by then the client's retention setting will have deleted.
--
-- **Sittings are not a table.** A session is defined as hands separated by less
-- than an hour, and deriving that at read time means importing an old file
-- re-groups history correctly. Stored session rows would drift out of agreement
-- with the hands they claim to summarise the first time a file arrived late.

create table public.played_hand (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,

  -- The PokerStars hand number. This is what makes importing idempotent: the
  -- watcher will re-read the same file constantly, and a folder gets dragged in
  -- twice by anyone who is not sure whether it worked the first time.
  ps_hand_id         text not null,
  played_at          timestamptz not null,

  table_name         text,
  game_type          text not null default 'cash'
                       check (game_type in ('cash', 'tournament')),
  fast_fold          boolean not null default false,
  max_seats          smallint,
  big_blind          numeric(12, 4) not null,
  currency           text,

  -- Null when the hand was observed rather than played: no hole cards means
  -- nothing to grade and nothing to count towards a win rate.
  hero_alias         text,
  hero_cards         text[],
  -- One of the 169 classes, e.g. 'AKo'. Denormalised from the cards because
  -- every query that groups mistakes wants it and none of them want the suits.
  hand_class         text,
  position           text,

  -- Result in big blinds rather than currency. At NL2 a dollar figure makes a
  -- winning session look like nothing happened, and stops comparing the moment
  -- the stake changes.
  net_bb             real,
  vpip               boolean not null default false,
  pfr                boolean not null default false,
  saw_flop           boolean not null default false,
  went_to_showdown   boolean not null default false,
  won_at_showdown    boolean not null default false,
  won                boolean not null default false,

  -- Preflop decisions the chart set covered. The denominator for accuracy, and
  -- the honest answer to "why did you only grade nine of my sixty hands".
  charted_decisions  smallint not null default 0,
  -- Which chart version graded it, so a re-grade under new numbers is visible
  -- rather than silently rewriting history.
  chart_version      int,

  raw                text not null,
  imported_at        timestamptz not null default now(),

  unique (user_id, ps_hand_id)
);

-- Every session view is "my hands, newest first".
create index played_hand_user_played_idx
  on public.played_hand (user_id, played_at desc);

alter table public.played_hand enable row level security;

drop policy if exists played_hand_owner on public.played_hand;
create policy played_hand_owner on public.played_hand
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- One row per charted decision the chart disagreed with.
--
-- Its own table rather than a count on the hand, because the evidence is the
-- product: "you call too wide in the small blind" is only believable when it
-- can show the seven hands it is talking about, and replaying a real mistake is
-- the thing that actually stops it happening again.
create table public.hand_violation (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  hand_id         uuid not null references public.played_hand(id) on delete cascade,

  -- Duplicated from the hand so the leaks query never needs a join. Grouping
  -- and ranking mistakes is the hot path on both the Today page and the session
  -- review, and it runs on every visit.
  ps_hand_id      text not null,
  played_at       timestamptz not null,

  -- e.g. '6max-2.5x/100bb/vs-rfi/BB/BTN'. Describes the situation, not the
  -- chart version, so publishing better numbers regrades rather than orphans.
  node_id         text not null,
  spot            text not null,
  hand_class      text not null,
  chosen          text not null,
  expected        text not null,
  action_grade    text not null check (action_grade in
                    ('inaccuracy', 'wrong', 'blunder')),
  kind            text not null check (kind in
                    ('too-loose', 'too-tight', 'wrong-line')),
  -- Null for authored charts, which carry no EV. Present the day a source that
  -- knows EV is installed, at which point leak ranking switches to real cost.
  ev_loss_bb      real,
  chart_version   int,

  created_at      timestamptz not null default now()
);

-- Ranking leaks reads every violation for a user; drilling one reads a node's.
create index hand_violation_user_idx
  on public.hand_violation (user_id, played_at desc);
create index hand_violation_node_idx on public.hand_violation (user_id, node_id);

alter table public.hand_violation enable row level security;

drop policy if exists hand_violation_owner on public.hand_violation;
create policy hand_violation_owner on public.hand_violation
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
