-- Where the pictures are.
--
-- Text extraction returns text, and a poker book's results table, range grid or
-- board-texture diagram is frequently an *image*. Those pages arrive as a
-- caption and nothing else, so the reader silently drops what is often the
-- densest content on the page — and silently is the problem. A missing
-- paragraph you notice; a missing table you do not, because nothing is left
-- behind to mark where it was.
--
-- So each portion records which of its pages carry an image, and the reader
-- renders those pages from the original PDF beside the text. Not every page:
-- rendering the whole book would defeat the point of extracting it at all. Only
-- the ones where something would otherwise be lost without trace.

alter table public.passage
  -- One-based page numbers within this portion that contain an image.
  -- Null or empty means the portion is pure text and nothing needs rendering.
  add column if not exists figure_pages int[];
