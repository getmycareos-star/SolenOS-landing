import {
  BookOpen,
  CalendarDays,
  Clock3,
  FileText,
  Handshake,
  History,
  MessageCircle,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type WorkspaceNavigationItem = {
  id: string;
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

/**
 * The single caregiver-facing navigation registry.
 * Route ownership stays here; desktop and mobile surfaces only render it.
 */
export const WORKSPACE_NAVIGATION = {
  care: [
    {
      id: "care-record",
      href: "/workspace",
      label: "Care Record",
      description: "Your current care information",
      icon: BookOpen,
    },
    {
      id: "daily-care",
      href: "/workspace/daily-care",
      label: "Daily Care",
      description: "Record what happened",
      icon: CalendarDays,
    },
    {
      id: "follow-ups",
      href: "/workspace/open-loops",
      label: "Follow-ups",
      description: "Things that still need attention",
      icon: Clock3,
    },
    {
      id: "care-timeline",
      href: "/workspace/timeline",
      label: "Care history",
      description: "See how care has changed",
      icon: History,
    },
    {
      id: "documents",
      href: "/workspace/documents",
      label: "Documents",
      description: "Care documents and records",
      icon: FileText,
    },
    {
      id: "appointments",
      href: "/workspace/appointments",
      label: "Appointments",
      description: "Upcoming and past appointments",
      icon: CalendarDays,
    },
    {
      id: "care-handoffs",
      href: "/workspace/handoffs",
      label: "Care Handoffs",
      description: "Prepare information for someone else",
      icon: Handshake,
    },
  ],
  support: [
    {
      id: "ai-companion",
      href: "/workspace/companion",
      label: "Care Assistant",
      description: "Ask questions about saved care information",
      icon: MessageCircle,
    },
  ],
  settings: [
    {
      id: "settings",
      href: "/workspace/settings",
      label: "Settings",
      description: "Your account and preferences",
      icon: Settings,
    },
  ],
} satisfies {
  care: WorkspaceNavigationItem[];
  support: WorkspaceNavigationItem[];
  settings: WorkspaceNavigationItem[];
};
