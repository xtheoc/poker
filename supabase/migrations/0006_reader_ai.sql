-- Sections, enrichment, and the playbook a book leaves behind.
--
-- The first version of the reader split books by word count and served the raw
-- pages. That is a page-turner with a gate on it, not a study tool: it has no
-- idea where a chapter ends, no idea which sentence carries the claim, and it
-- leaves you with nothing at the end but the feeling of having read something.
--
-- Three additions fix that, and they do three different jobs.
--
-- **Sections** give the split meaning. A portion now belongs to a named part of
-- the book, so "read to the end of the portion" and "read to the end of the
-- idea" become the same instruction. Structure comes from the PDF's own outline
-- where it has one, and is inferred where it does not.
--
-- **Enrichment** is the model's pass over one portion: the claims it actually
-- makes, an example where the text is abstract, and the imperative version. It
-- sits *beside* the book's own pages and never replaces them — the point is to
-- read the real text with help, not to read a summary instead of it.
--
-- **Notes** are what survives. Each recalled portion contributes a rule or two,
-- and their accumulation answers the only question that matters afterwards:
-- what do I actually do at the table?

alter table public.passage
  -- Which section of the book this portion belongs to. Null until a book has
  -- been sectioned, so an existing import keeps working unsectioned.
  add column if not exists section_index int,
  add column if not exists section_title text,
  -- { claims: string[], example: string | null, atTable: string[] }
  --
  -- jsonb rather than columns: this is model output whose shape will change as
  -- the prompt is tuned, and a schema migration per prompt edit would be an
  -- absurd tax. Nothing queries inside it.
  add column if not exists enrichment jsonb,
  add column if not exists enriched_at timestamptz;

create index if not exists passage_section_idx
  on public.passage (book_id, section_index, index);

-- What the book actually taught you, in the imperative.
--
-- Its own table rather than a column on the book, because these accumulate one
-- portion at a time and want to be read in order, traced back to the pages they
-- came from, and — later — checked against the hands you actually play.
create table public.book_note (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  book_id        uuid not null references public.book(id) on delete cascade,
  passage_id     uuid references public.passage(id) on delete set null,

  -- Kept so the playbook stays ordered even if a passage is later re-split.
  passage_index  int not null default 0,
  section_title  text,

  -- One rule, in the imperative, as it would be said at the table. Not a
  -- summary of the chapter — an instruction you could follow tonight.
  rule           text not null,
  -- Where it came from, e.g. 'p112-116', so a claim can always be checked
  -- against the book rather than taken on the model's word.
  source_pages   text,

  created_at     timestamptz not null default now()
);

create index book_note_book_idx
  on public.book_note (book_id, passage_index, created_at);

alter table public.book_note enable row level security;

drop policy if exists book_note_owner on public.book_note;
create policy book_note_owner on public.book_note
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
