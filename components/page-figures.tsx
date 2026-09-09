"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The pages of a portion that contain a picture, rendered from the original PDF.
 *
 * Text extraction cannot see a results table, a range grid, or a board-texture
 * diagram — those are images, and they arrive as a caption with nothing under
 * it. That is worse than it sounds: a missing paragraph leaves a gap you notice,
 * a missing table leaves nothing at all, so you read on believing you have the
 * whole section.
 *
 * The fix is not to abandon the text reader and go back to rendering PDF pages.
 * It is to render *only* the pages where something would otherwise be lost, and
 * to say plainly that is what they are.
 *
 * Rendered on demand rather than on mount. Most portions have no figures, most
 * that do have one, and loading a multi-megabyte PDF before you have asked to
 * see anything would make every section slower for the sake of a few.
 */
export function PageFigures({
  pdfUrl,
  pages,
}: {
  pdfUrl: string;
  pages: number[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const target = container.current;
    if (!target) return;

    async function render() {
      setState("loading");
      const pdfjs = await import("pdfjs-dist");

      // Emitted by the bundler from this URL rather than copied into /public,
      // so the worker can never drift from the library version. If it cannot be
      // emitted, pdf.js falls back to the main thread — slower, not broken.
      if (!pdfjs.GlobalWorkerOptions.workerPort) {
        try {
          pdfjs.GlobalWorkerOptions.workerPort = new Worker(
            new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
            { type: "module" },
          );
        } catch {
          pdfjs.GlobalWorkerOptions.workerSrc = "";
        }
      }

      const doc = await pdfjs.getDocument({ url: pdfUrl }).promise;
      if (cancelled || !target) return;
      target.replaceChildren();

      for (const n of pages) {
        if (cancelled) break;
        if (n < 1 || n > doc.numPages) continue;

        const page = await doc.getPage(n);
        if (cancelled) break;

        const width = target.clientWidth || 700;
        const base = page.getViewport({ scale: 1 });
        // Rendered at device resolution and scaled down in CSS. A table of
        // numbers is unreadable otherwise, which would defeat the point.
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({
          scale: (width / base.width) * ratio,
        });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        canvas.className = "mb-4 rounded-lg bg-white";

        const context = canvas.getContext("2d");
        if (!context) continue;

        target.appendChild(canvas);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        page.cleanup();
      }

      if (!cancelled) setState("idle");
    }

    render().catch(() => {
      if (!cancelled) setState("failed");
    });

    return () => {
      cancelled = true;
    };
  }, [open, pdfUrl, pages]);

  if (pages.length === 0) return null;

  const label =
    pages.length === 1
      ? `There is a figure on page ${pages[0]}`
      : `There are figures on pages ${pages.join(", ")}`;

  return (
    <div className="mx-auto mt-8 max-w-[52rem] rounded-xl border border-zinc-800 p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-baseline gap-3 text-left"
      >
        <span className="text-sm text-zinc-300">{label}</span>
        <span className="ml-auto shrink-0 text-xs text-zinc-500">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {/* Said plainly, because the whole risk here is not knowing something was
          missed. */}
      {!open && (
        <p className="mt-1 text-xs text-zinc-600">
          Tables and diagrams are images, so they are not in the text above.
        </p>
      )}

      {open && (
        <div className="mt-4">
          {state === "loading" && (
            <p className="py-6 text-center text-sm text-zinc-500">
              Loading the page…
            </p>
          )}
          {state === "failed" && (
            <p className="py-6 text-center text-sm text-rose-400">
              Could not render that page.
            </p>
          )}
          <div ref={container} />
        </div>
      )}
    </div>
  );
}
