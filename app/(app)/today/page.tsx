import { redirect } from "next/navigation";

/**
 * The daily drill is no longer its own page.
 *
 * It became a mode of /drill, because "practise my mistakes" and "practise the
 * tree" are the same activity with a different source of spots — and because a
 * page called Today implied a ration. It does not end any more; it cycles.
 */
export default function TodayRedirect() {
  redirect("/drill");
}
