import { redirect } from "next/navigation";

/** Handoffs are entered and prepared only from AI Companion. */
export default function CareHandoffsRedirect() {
  redirect("/workspace/companion");
}
