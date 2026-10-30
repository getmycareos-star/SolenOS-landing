"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type LucideIcon, MoreHorizontal, Pin, Archive, Trash2, Share2, Home, Pencil, Eye, Download } from "lucide-react";

export type WorkspaceAction =
  | "share_care_summary" | "add_to_home" | "edit_record" | "view_record_details"
  | "download_export" | "archive" | "restore" | "pin" | "unpin" | "delete";

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
  destructive?: boolean;
}[] = [
  { id: "share_care_summary", label: "Share care summary", icon: Share2 },
  { id: "add_to_home", label: "Add to Home", icon: Home },
  { id: "edit_record", label: "Edit record", icon: Pencil },
  { id: "view_record_details", label: "View record details", icon: Eye },
  { id: "download_export", label: "Download / Export", icon: Download },
  { id: "archive", label: "Archive", icon: Archive, condition: (props) => !props.isArchived },
  { id: "restore", label: "Restore", icon: Archive, condition: (props) => Boolean(props.isArchived) },
  { id: "pin", label: "Pin", icon: Pin, condition: (props) => !props.isPinned },
  { id: "unpin", label: "Unpin", icon: Pin, condition: (props) => Boolean(props.isPinned) },
  { id: "delete", label: "Delete", icon: Trash2, destructive: true },
];

export function WorkspaceMoreMenu({ onAction, isPinned = false, isArchived = false }: WorkspaceMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const handleToggle = useCallback(() => setOpen((value) => !value), []);
  const handleSelect = useCallback((action: WorkspaceAction) => {
    setOpen(false);
    onAction(action);
  }, [onAction]);

  useEffect(() => {
    if (!open) return;
    function handlePointerOutside(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const visibleItems = MENU_ITEMS.filter((item) =>
    item.condition ? item.condition({ onAction, isPinned, isArchived }) : true,
  );

  return (
    <div className="workspace-more-menu" ref={menuRef}>
      <button
        type="button"
        className="workspace-more-menu-trigger"
        aria-label="More care record actions"
        aria-haspopup="menu"
        aria-controls="solenos-care-record-actions-menu"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <MoreHorizontal size={20} aria-hidden />
      </button>
      {open && (
        <div id="solenos-care-record-actions-menu" className="workspace-more-menu-dropdown" role="menu" aria-label="Care record actions">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={`workspace-more-menu-item${item.destructive ? " is-destructive" : ""}`}
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
