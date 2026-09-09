"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Adding a book.
 *
 * The file goes straight from the browser to private storage rather than
 * through an API route. A 40 MB PDF posted to a serverless function is a
 * request that fails on any hosted plan worth using, and routing the bytes
 * through the server buys nothing — storage enforces ownership itself, via the
 * policy on the path prefix.
 *
 * The title comes from the filename because the alternative is a form field
 * nobody fills in accurately, and a PDF's embedded metadata title is wrong
 * often enough to be worse than the filename.
 */

/**
 * Upload ceiling.
 *
 * Comfortably above a scanned 600-page book, and low enough that a mistaken
 * drag of a video file fails immediately rather than after four minutes.
 */
const MAX_BYTES = 80 * 1024 * 1024;

export function BookUpload({ userId }: { userId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);

      if (file.size > MAX_BYTES) {
        setError("That file is too big.");
        return;
      }

      const title = file.name
        .replace(/\.pdf$/i, "")
        .replace(/[_-]+/g, " ")
        .trim();

      try {
        setBusy("Uploading…");
        const supabase = createClient();
        // Namespaced by user id: the storage policy checks the first path
        // segment, so this prefix is what makes the file yours.
        const path = `${userId}/${crypto.randomUUID()}.pdf`;

        const { error: uploadError } = await supabase.storage
          .from("books")
          .upload(path, file, { contentType: "application/pdf" });
        if (uploadError) throw new Error(uploadError.message);

        setBusy("Splitting into portions…");
        const response = await fetch("/api/reader/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath: path, title }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(result?.error ?? "Could not read that PDF.");
        }

        router.push(`/reader/${result.bookId}`);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Upload failed.");
      } finally {
        setBusy(null);
        if (input.current) input.current.value = "";
      }
    },
    [router, userId],
  );

  return (
    <div>
      <label className="block">
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy !== null}
          onChange={(e) => onFile(e.target.files?.[0])}
          className="block w-full text-sm text-zinc-500 file:mr-3 file:rounded-lg file:border file:border-zinc-300 file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium disabled:opacity-50 dark:text-zinc-400 dark:file:border-zinc-700"
        />
      </label>

      {busy && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{busy}</p>
      )}
      {error && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
}
