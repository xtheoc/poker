import { redirect } from "next/navigation";

/**
 * The shelf merged into /library, alongside what to read next.
 *
 * Reading itself still lives at /reader/<book>. Only the list moved — having
 * two pages that each answered "what am I reading" was the confusion, not the
 * reading surface.
 */
export default function ReaderRedirect() {
  redirect("/library");
}
