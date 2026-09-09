-- A daily ceiling, and a recall you repeat until it is right.
--
-- Two changes, both aimed at the same complaint: reading fast and finishing a
-- book without retaining any of it.
--
-- **The daily limit is a ceiling, not a target.** Every reading app ships a
-- streak that rewards reading more. This does the opposite — past the limit the
-- next portion does not open until tomorrow. Four chapters in one sitting is
-- precisely the behaviour that produces the feeling of having read a book and
-- the inability to say what was in it, and the spacing effect is not a
-- suggestion: the same hours spread across days retain far better than the same
-- hours massed into one evening.
--
-- **A portion is finished when the recall is complete, not when it is
-- attempted.** Previously any attempt opened the next portion. Now the attempt
-- is marked, the gaps are named, and you write again until nothing is missing.
-- `attempts` exists so the interface can offer a way out when the tool is wrong
-- about a passage — a reader trapped by a bad extraction abandons the whole
-- thing, and that failure costs more than a leniently-passed section.

alter table public.profiles
  -- Pages per day. Small on purpose: a limit that never binds is decoration.
  add column if not exists daily_pages smallint not null default 12
    check (daily_pages between 1 and 200);

alter table public.passage
  -- How many times a summary has been written for this portion.
  add column if not exists attempts int not null default 0,
  -- When the recall was judged to cover the passage. This, not `recalled_at`,
  -- is what opens the next portion and what admits the section to the book's
  -- summary.
  add column if not exists complete_at timestamptz,
  -- What the last attempt left out, as a list, so the reader can see exactly
  -- what to go back for rather than a paragraph of prose about it.
  add column if not exists missing jsonb;

-- "How much have I read today" is the query the limit runs on every page view.
create index if not exists passage_complete_idx
  on public.passage (user_id, complete_at)
  where complete_at is not null;
