import { redirect } from "next/navigation";

/**
 * The preflop trainer moved to /drill, where it now sits beside the drill built
 * from your own hands.
 *
 * A redirect rather than a deletion: this URL has been handed out, and a
 * bookmark that 404s is a worse outcome than a four-line file.
 */
export default function PreflopRedirect() {
  redirect("/drill");
}
