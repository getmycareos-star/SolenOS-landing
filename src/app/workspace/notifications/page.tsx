import { redirect } from "next/navigation";

/** Notification preferences and access belong under Settings. */
export default function NotificationsRedirect() {
  redirect("/workspace/settings#settings-notifications");
}
