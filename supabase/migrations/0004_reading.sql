-- What you have read, and what you made of it.
--
-- The curriculum itself stays in the repo as versioned content — it gets edited
-- and argued with like code. This table holds only the part that is yours: what
-- you picked up, what you finished, and whether it landed.
--
-- **The verdict column is the point of the whole table.** A reading list that
-- only knows what you finished can do nothing but read out a fixed order. One
-- that knows a book was too dense, or too basic, or that you put it down at
-- chapter three, can offer a genuinely different next option — which is the
-- difference between a plan and a librarian. The vocabulary is deliberately
-- tiny, because a rating scale nobody can be bothered to fill in is worth less
-- than four buttons that actually get pressed.
--
-- `book_id` refers to an id in `lib/library/curriculum.ts` and is deliberately
-- not a foreign key: the curriculum is a file rather than a table, and a book
-- being dropped from it later must not delete the record that you read it.

create table public.reading_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,

  -- Curriculum id, e.g. 'crushing-microstakes'. Null for a book you added that
  -- the curriculum does not know about.
  book_id      text,
  -- Stored even for curriculum books, so the log still reads correctly if that
  -- book is later renamed or removed from the file.
  title        text not null,
  author       text,

  status       text not null default 'reading'
                 check (status in ('reading', 'finished', 'abandoned')),

  -- How it landed. Null until you say. Each value changes what gets offered
  -- next, which is why there are four of them rather than five stars:
  --   right      -- pitched correctly; carry on through the stages
  --   too-basic  -- knew most of it; skip ahead to something denser
  --   too-hard   -- lost; offer a gentler book at the same stage
  --   bounced    -- could not stay with it; offer a different one entirely
  verdict      text check (verdict in ('right', 'too-basic', 'too-hard', 'bounced')),
  note         text,

  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  updated_at   timestamptz not null default now(),

  -- One row per book per person. Picking a book up again updates that row
  -- rather than starting a second history of the same book.
  unique (user_id, title)
);

create index reading_log_user_idx on public.reading_log (user_id, updated_at desc);

alter table public.reading_log enable row level security;

drop policy if exists reading_log_owner on public.reading_log;
create policy reading_log_owner on public.reading_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
