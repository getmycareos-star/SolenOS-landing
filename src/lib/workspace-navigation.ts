import { AlertCircle, Bell, CalendarDays, Clock3, FileText, Handshake, History, Home, MessageCircle, MoreHorizontal, Plus, Settings, type LucideIcon } from "lucide-react";

export type WorkspaceNavigationItem = {
  id: string;
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

/**
 * One caregiver-facing navigation registry. Route-level authorization remains
 * enforced by the workspace session gate and the backend APIs.
 */
export const WORKSPACE_NAVIGATION = {
  care: [
    {
      id: "home",
      href: "/workspace",
      label: "Today",
      description: "What is happening and what matters now",
      icon: Home,
    },
    {
      id: "add-update",
      href: "/workspace/daily-care",
      label: "Add an update",
      description: "Record something you noticed or something that happened",
      icon: Plus,
    },
    {
      id: "care-information",
      href: "/workspace/care-continuity",
      label: "Care information",
      description: "Browse the current care picture and supporting information",
      icon: FileText,
    },
    {
      id: "ask-solenos",
      href: "/workspace/companion",
      label: "Care Assistant",
      description: "Ask questions about saved care information",
      icon: MessageCircle,
    },
  ],
  settings: [
    {
      id: "notifications",
      href: "/workspace/notifications",
      label: "Notifications",
      description: "See care updates and reminders",
      icon: Bell,
    },
    {
      id: "more",
      href: "/workspace/more",
      label: "More",
      description: "Account, privacy, sharing and app preferences",
      icon: MoreHorizontal,
    },
  ],
} satisfies {
  care: WorkspaceNavigationItem[];
  settings: WorkspaceNavigationItem[];
};

/** Care-related destinations are grouped under Care information, not More. */
export const CARE_INFORMATION_NAVIGATION: WorkspaceNavigationItem[] = [
  {
    id: "documents",
    href: "/workspace/documents",
    label: "Documents",
    description: "Find original medical records and review their progress",
    icon: FileText,
  },
  {
    id: "care-history",
    href: "/workspace/timeline",
    label: "Care history",
    description: "Earlier updates, changes and corrections",
    icon: History,
  },
  {
    id: "appointments",
    href: "/workspace/appointments",
    label: "Appointments",
    description: "Prepare for visits and keep appointment details together",
    icon: CalendarDays,
  },
  {
    id: "follow-ups",
    href: "/workspace/open-loops",
    label: "Needs attention",
    description: "Review care matters that remain unresolved",
    icon: Clock3,
  },
  {
    id: "reminders",
    href: "/workspace/reminders",
    label: "Reminders",
    description: "Manage reminders you have saved",
    icon: Clock3,
  },
  {
    id: "care-sharing",
    href: "/workspace/handoffs",
    label: "Care handoffs",
    description: "Prepare and review care summaries shared with others",
    icon: Handshake,
  },
];

/** More is reserved for application and account management destinations. */
export const WORKSPACE_SECONDARY_NAVIGATION: WorkspaceNavigationItem[] = [
  {
    id: "settings",
    href: "/workspace/settings",
    label: "Settings",
    description: "Account, privacy, access and accessibility",
    icon: Settings,
  },
];
