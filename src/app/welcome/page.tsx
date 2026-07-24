import { redirect } from "next/navigation";

/** Legacy Entry Home path — keep links alive. */
export default function WelcomeRedirectPage() {
  redirect("/start");
}
