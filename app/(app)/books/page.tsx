import { redirect } from "next/navigation";

/**
 * The librarian merged into /library, alongside the books you own.
 *
 * A redirect rather than a deletion: this URL is in a browser history and
 * possibly on a home screen, and a bookmark that 404s is a worse outcome than a
 * four-line file.
 */
export default function BooksRedirect() {
  redirect("/library");
}
