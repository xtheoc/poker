-- The reader: your books, split into portions, with the recall that unlocks them.
--
-- The design this schema serves, in one line: **you cannot open the next
-- passage until you have written what the last one said.** Reading quickly is
-- not the problem being solved here — reading quickly while feeling like you
-- absorbed it is, and the only reliable defence against that feeling is being
-- made to produce something from memory before moving on.
--
-- Three decisions worth stating.
--
-- **Extracted text is stored per passage, not per book.** The passage is the
-- unit everything works in: it is what gets shown, what recall is graded
-- against, and what a question is generated from. Splitting once at import
-- means none of that re-parses a 540-page PDF on every visit.
--
-- **Progress lives on the passage row rather than in its own table.** Books
-- here are strictly personal — you upload your own copy, nobody shares one — so
-- a separate progress table would be a join that never earns its keep. If books
-- ever become shared, this is the thing that has to split.
--
-- **The PDF itself goes in private storage, never in a column.** It is tens of
-- megabytes, the browser streams pages from it to render them, and the bytes
-- are a legally-acquired personal copy that must never be publicly reachable.

-- A private bucket. `public = false` matters: these are your own purchased
-- books, and the file must not be fetchable without a signed URL.
insert into storage.buckets (id, name, public)
values ('books', 'books', false)
on conflict (id) do nothing;

-- Objects are namespaced by user id — '<user_id>/grinders.pdf' — so the first
-- path segment is the ownership check. Anything looser would let one account
-- read another's library.
drop policy if exists books_read_own on storage.objects;
create policy books_read_own on storage.objects for select
  using (
    bucket_id = 'books'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists books_write_own on storage.objects;
create policy books_write_own on storage.objects for insert
  with check (
    bucket_id = 'books'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists books_delete_own on storage.objects;
create policy books_delete_own on storage.objects for delete
  using (
    bucket_id = 'books'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create table public.book (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,

  title          text not null,
  author         text,
  -- Curriculum id when this is a book the librarian knows about, so finishing
  -- it in the reader can close it out on the shelf. Not a foreign key: the
  -- curriculum is a file, not a table.
  curriculum_id  text,

  -- Path inside the private 'books' bucket, always '<user_id>/<uuid>.pdf'.
  storage_path   text not null,
  page_count     integer,

  -- Import is not instant on a 500-page PDF, and a half-imported book has to be
  -- distinguishable from a finished one rather than silently showing four
  -- passages and implying that is the whole book.
  status         text not null default 'processing'
                   check (status in ('processing', 'ready', 'failed')),
  error          text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (user_id, storage_path)
);

create index book_user_idx on public.book (user_id, created_at desc);

alter table public.book enable row level security;

drop policy if exists book_owner on public.book;
create policy book_owner on public.book
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- One portion: a few pages with an end you reach in a sitting.
--
-- The unit is deliberately not a chapter. A chapter is however long its author
-- felt like making it, and "read chapter 7 tonight" is the instruction people
-- fail at. A portion is short enough that finishing it is never in doubt, which
-- is the whole mechanism behind every daily-reading app that works.
create table public.passage (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  book_id      uuid not null references public.book(id) on delete cascade,

  -- Reading order, zero-based. The gate is simply: passage n opens once n-1 has
  -- been recalled.
  index        integer not null,
  -- One-based page numbers, matching what the viewer shows.
  first_page   integer not null,
  last_page    integer not null,
  -- Best guess at the section this falls in, for orientation. Often null, and
  -- that is fine — it is a label, not structure.
  heading      text,

  -- Extracted text: what recall is graded against and what questions get
  -- generated from. The rendered pages are what you actually read.
  text         text not null,
  word_count   integer not null default 0,

  -- Progress. On the row, because a book here belongs to exactly one person.
  recall_text  text,
  recalled_at  timestamptz,
  -- How much of the passage the recall actually covered, 0-100. Null until
  -- graded — and the gate opens on having recalled, not on scoring well,
  -- because punishing a poor attempt teaches you to stop attempting.
  score        smallint check (score between 0 and 100),
  -- What the recall missed, so the passage can come back to it later.
  missed       text,

  created_at   timestamptz not null default now(),

  unique (book_id, index)
);

-- The two hot queries: the contents list, and "where was I".
create index passage_book_idx on public.passage (book_id, index);
create index passage_unread_idx on public.passage (book_id, index)
  where recalled_at is null;

alter table public.passage enable row level security;

drop policy if exists passage_owner on public.passage;
create policy passage_owner on public.passage
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
