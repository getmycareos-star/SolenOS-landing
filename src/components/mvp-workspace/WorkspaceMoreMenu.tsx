"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type LucideIcon,
  MoreHorizontal,
  Pin,
  Archive,
  Trash2,
  Share2,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

export type WorkspaceAction =
  | "share_care_summary"
  | "pin"
  | "archive"
  | "delete"
  | "add_to_home";

interface WorkspaceMoreMenuProps {
  onAction: (action: WorkspaceAction) => void;
  /** Whether the workspace is currently pinned. */
  isPinned?: boolean;
  /** Whether the workspace is currently archived. */
  isArchived?: boolean;
  /** Whether the PWA install prompt is available. */
  canAddToHome?: boolean;
  /** Whether the workspace has any care information. */
  hasCareInfo?: boolean;
}

const MENU_ITEMS: {
  id: WorkspaceAction;
  label: string;
  icon: LucideIcon;
  variant?: "default" | "destructive";
  condition?: (props: WorkspaceMoreMenuProps) => boolean;
}[] = [
  {
    id: "share_care_summary",
    label: "Share care summary",
    icon: Share2,
  },
  {
    id: "pin",
    label: "Pin",
    icon: Pin,
    condition: (props) => !props.isPinned && !props.isArchived,
  },
  {
    id: "archive",
    label: "Archive",
    icon: Archive,
    condition: (props) => !props.isArchived,
  },
  {
    id: "delete",
    label: "Delete",
    icon: Trash2,
    variant: "destructive",
    condition: (props) => !props.isArchived,
  },
  {
    id: "add_to_home",
    label: "Add to Home",
    icon: Home,
    condition: (props) => props.canAddToHome === true,
  },
];

export function WorkspaceMoreMenu({
  onAction,
  isPinned = false,
  isArchived = false,
  canAddToHome = false,
  hasCareInfo = false,
}: WorkspaceMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    setOpen((v) => !v);
  }, []);

  const handleSelect = useCallback(
    (action: WorkspaceAction) => {
      setOpen(false);
      onAction(action);
    },
    [onAction],
  );

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const visibleItems = MENU_ITEMS.filter((item) => {
    if (item.condition) return item.condition({ onAction: () => {}, isPinned, isArchived, canAddToHome, hasCareInfo });
    return true;
  });

  return (
    <div className="workspace-more-menu" ref={menuRef}>
      <Button
        variant="icon"
        className="workspace-more-menu-trigger"
        aria-label="More actions"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={handleToggle}
        type="button"
      >
        <MoreHorizontal size={20} aria-hidden />
      </Button>
      {open && (
        <div className="workspace-more-menu-dropdown" role="menu" aria-label="Workspace actions">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={`workspace-more-menu-item${item.variant === "destructive" ? " workspace-more-menu-item--destructive" : ""}`}
                onClick={() => handleSelect(item.id)}
              >
                <Icon size={16} aria-hidden />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
