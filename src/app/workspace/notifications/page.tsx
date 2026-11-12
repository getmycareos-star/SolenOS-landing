import { redirect } from "next/navigation";

/** Notification preferences and the care-update inbox belong under Settings. */
export default function NotificationsRedirect() {
  redirect("/workspace/settings#settings-notifications");
}
