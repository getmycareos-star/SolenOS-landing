import { CalendarDays, Clock3, FileText, Handshake, History, Home, MessageCircle, MoreHorizontal, Settings, type LucideIcon } from "lucide-react";

export type WorkspaceNavigationItem = {
  id: string;
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

/**
 * Five caregiver-facing destinations. Existing feature routes remain available
 * through More; this registry changes navigation, not the underlying services.
 */
export const WORKSPACE_NAVIGATION = {
  care: [
    {
      id: "today",
      href: "/workspace",
      label: "Today",
      description: "What matters in care right now",
      icon: Home,
    },
    {
      id: "share-update",
      href: "/workspace/daily-care",
      label: "Share an update",
      description: "Tell SolenOS what happened",
      icon: MessageCircle,
    },
    {
      id: "follow-ups",
      href: "/workspace/open-loops",
      label: "Follow-ups",
      description: "Questions and agreed next steps",
      icon: Clock3,
    },
    {
      id: "appointments",
      href: "/workspace/appointments",
      label: "Appointments",
      description: "Prepare and share care information",
      icon: CalendarDays,
    },
  ],
  support: [] as WorkspaceNavigationItem[],
  settings: [
    {
      id: "more",
      href: "/workspace/more",
      label: "More",
      description: "History, documents and settings",
      icon: MoreHorizontal,
    },
  ],
} satisfies {
  care: WorkspaceNavigationItem[];
  support: WorkspaceNavigationItem[];
  settings: WorkspaceNavigationItem[];
};

/** Existing routes retained as secondary destinations; permissions stay at route/API boundaries. */
export const WORKSPACE_SECONDARY_NAVIGATION: WorkspaceNavigationItem[] = [
  {
    id: "care-assistant",
    href: "/workspace/companion",
    label: "Care Assistant",
    description: "Ask about saved care information",
    icon: MessageCircle,
  },
  {
    id: "care-history",
    href: "/workspace/timeline",
    label: "Care history",
    description: "Earlier updates, changes and corrections",
    icon: History,
  },
  {
    id: "documents",
    href: "/workspace/documents",
    label: "Documents",
    description: "Original files and reviewed details",
    icon: FileText,
  },
  {
    id: "reminders",
    href: "/workspace/reminders",
    label: "Reminders",
    description: "Upcoming reminders and their status",
    icon: Clock3,
  },
  {
    id: "care-sharing",
    href: "/workspace/handoffs",
    label: "Share care information",
    description: "Prepare information for another person",
    icon: Handshake,
  },
  {
    id: "notifications",
    href: "/workspace/notifications",
    label: "Notifications",
    description: "Review care updates and delivery notices",
    icon: MessageCircle,
  },
  {
    id: "advanced-care-record",
    href: "/workspace/care-continuity",
    label: "Advanced care record",
    description: "Review detailed care-record information",
    icon: FileText,
  },
  {
    id: "settings",
    href: "/workspace/settings",
    label: "Settings",
    description: "Account, privacy and accessibility",
    icon: Settings,
  },
];
