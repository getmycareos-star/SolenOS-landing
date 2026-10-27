import { redirect } from "next/navigation";

/** Deep continuity is backend infrastructure, not a caregiver-facing page. */
export default function DeepCareContinuityRedirect() {
  redirect("/workspace");
}
