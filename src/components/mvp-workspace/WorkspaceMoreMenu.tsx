"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 12 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = Math.min(menuRef.current?.offsetWidth || 252, viewportWidth - 24);
    const menuHeight = Math.min(menuRef.current?.offsetHeight || 440, viewportHeight - 24);
    const left = Math.max(12, Math.min(rect.right - menuWidth, viewportWidth - menuWidth - 12));
    const roomBelow = viewportHeight - rect.bottom - 12;
    const top = roomBelow >= menuHeight + 8
      ? rect.bottom + 8
      : Math.max(12, rect.top - menuHeight - 8);
    setMenuPosition({ top, left });
  }, []);

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const handleToggle = useCallback(() => {
    setOpen((value) => !value);
  }, []);

  const handleSelect = useCallback((action: WorkspaceAction) => {
    closeMenu();
    onAction(action);
  }, [closeMenu, onAction]);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();

    function handlePointerOutside(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu(true);
    }
    document.addEventListener("pointerdown", handlePointerOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, closeMenu, updateMenuPosition]);

  const visibleItems = MENU_ITEMS.filter((item) =>
    item.condition ? item.condition({ onAction, isPinned, isArchived }) : true,
  );

  return (
    <div className="workspace-more-menu">
      <button
        ref={triggerRef}
        type="button"
        className="workspace-more-menu-trigger"
        aria-label="More care record actions"
        aria-haspopup="menu"
        aria-controls="solenos-care-record-actions-menu"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <MoreHorizontal size={21} aria-hidden />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          id="solenos-care-record-actions-menu"
          className="workspace-more-menu-dropdown"
          role="menu"
          aria-label="Care record actions"
          style={{ position: "fixed", top: menuPosition.top, left: menuPosition.left }}
        >
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
                <Icon size={17} aria-hidden />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
