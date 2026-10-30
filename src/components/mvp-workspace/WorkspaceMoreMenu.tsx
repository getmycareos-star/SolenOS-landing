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
  | "unpin"
  | "archive"
  | "restore"
  | "delete"
  | "add_to_home";

interface WorkspaceMoreMenuProps {
  onAction: (action: WorkspaceAction) => void;
  isPinned?: boolean;
  isArchived?: boolean;
}

const MENU_ITEMS: {
  id: WorkspaceAction;
  label: string;
  icon: LucideIcon;
  condition?: (props: WorkspaceMoreMenuProps) => boolean;
}[] = [
  { id: "share_care_summary", label: "Share care summary", icon: Share2 },
  { id: "pin", label: "Pin", icon: Pin, condition: (props) => !props.isPinned && !props.isArchived },
  { id: "unpin", label: "Unpin", icon: Pin, condition: (props) => Boolean(props.isPinned) },
  { id: "archive", label: "Archive", icon: Archive, condition: (props) => !props.isArchived },
  { id: "restore", label: "Restore", icon: Archive, condition: (props) => Boolean(props.isArchived) },
  { id: "delete", label: "Delete", icon: Trash2, condition: (props) => !props.isArchived },
  { id: "add_to_home", label: "Add to Home", icon: Home },
];

export function WorkspaceMoreMenu({
  onAction,
  isPinned = false,
  isArchived = false,
}: WorkspaceMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => setOpen((value) => !value), []);
  const handleSelect = useCallback((action: WorkspaceAction) => {
    setOpen(false);
    onAction(action);
  }, [onAction]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const visibleItems = MENU_ITEMS.filter((item) =>
    item.condition ? item.condition({ onAction, isPinned, isArchived }) : true,
  );

  return (
    <div className="workspace-more-menu" ref={menuRef}>
      <Button
        variant="icon"
        className="workspace-more-menu-trigger"
        aria-label="More care record actions"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={handleToggle}
        type="button"
      >
        <MoreHorizontal size={20} aria-hidden />
      </Button>
      {open && (
        <div className="workspace-more-menu-dropdown" role="menu" aria-label="Care record actions">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className="workspace-more-menu-item"
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
