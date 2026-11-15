"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Turns the small-screen sidebar into a real modal drawer:
 * focus stays inside it, Escape closes it, background content is inert,
 * and focus returns to the menu button when the drawer closes.
 */
export function WorkspaceNavigationAccessibility() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    const frame = window.requestAnimationFrame(() => {
      const main = document.querySelector<HTMLElement>(".solenos-chat-main");
      if (!main) return;
      main.tabIndex = -1;
      main.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    const host = document.querySelector<HTMLElement>(".solenos-chat-sidebar-host");
    const sidebar = document.getElementById("solenos-navigation");
    const workspace = document.querySelector<HTMLElement>(".solenos-chat-workspace");
    const trigger = document.querySelector<HTMLButtonElement>(".solenos-sidebar-toggle");
    if (!host || !sidebar || !workspace || !trigger) return;

    const media = window.matchMedia("(max-width: 760px)");
    let wasOpen = false;
    let originalOverflow = "";
    let keyHandler: ((event: KeyboardEvent) => void) | null = null;

    const focusableElements = () =>
      Array.from(sidebar.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((element) => element.offsetParent !== null && !element.hasAttribute("disabled"));

    const removeKeyboardHandler = () => {
      if (keyHandler) document.removeEventListener("keydown", keyHandler, true);
      keyHandler = null;
    };

    const sync = () => {
      const mobile = media.matches;
      const open = mobile && host.classList.contains("is-sidebar-open");

      if (!mobile) {
        removeKeyboardHandler();
        host.inert = false;
        host.removeAttribute("aria-hidden");
        sidebar.removeAttribute("role");
        sidebar.removeAttribute("aria-modal");
        workspace.inert = false;
        workspace.removeAttribute("aria-hidden");
        if (wasOpen) document.body.style.overflow = originalOverflow;
        wasOpen = false;
        return;
      }

      if (open) {
        host.inert = false;
        host.removeAttribute("aria-hidden");
        sidebar.setAttribute("role", "dialog");
        sidebar.setAttribute("aria-modal", "true");
        sidebar.setAttribute("aria-label", "SolenOS navigation");
        workspace.inert = true;
        workspace.setAttribute("aria-hidden", "true");

        if (!wasOpen) {
          originalOverflow = document.body.style.overflow;
          document.body.style.overflow = "hidden";
          window.requestAnimationFrame(() => {
            const closeButton = sidebar.querySelector<HTMLElement>(".solenos-chat-sidebar-top button");
            (closeButton || focusableElements()[0])?.focus();
          });
        }

        if (!keyHandler) {
          keyHandler = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
              event.preventDefault();
              trigger.click();
              return;
            }
            if (event.key !== "Tab") return;
            const elements = focusableElements();
            if (!elements.length) {
              event.preventDefault();
              sidebar.focus();
              return;
            }
            const first = elements[0];
            const last = elements[elements.length - 1];
            const current = document.activeElement;
            if (event.shiftKey && (current === first || !sidebar.contains(current))) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && (current === last || !sidebar.contains(current))) {
              event.preventDefault();
              first.focus();
            }
          };
          document.addEventListener("keydown", keyHandler, true);
        }
      } else {
        removeKeyboardHandler();
        host.inert = true;
        host.setAttribute("aria-hidden", "true");
        sidebar.removeAttribute("role");
        sidebar.removeAttribute("aria-modal");
        workspace.inert = false;
        workspace.removeAttribute("aria-hidden");
        if (wasOpen) {
          document.body.style.overflow = originalOverflow;
          trigger.focus({ preventScroll: true });
        }
      }
      wasOpen = open;
    };

    const observer = new MutationObserver(sync);
    observer.observe(host, { attributes: true, attributeFilter: ["class"] });
    media.addEventListener("change", sync);
    sync();

    return () => {
      observer.disconnect();
      media.removeEventListener("change", sync);
      removeKeyboardHandler();
      host.inert = false;
      host.removeAttribute("aria-hidden");
      sidebar.removeAttribute("role");
      sidebar.removeAttribute("aria-modal");
      workspace.inert = false;
      workspace.removeAttribute("aria-hidden");
      if (wasOpen) document.body.style.overflow = originalOverflow;
    };
  }, []);

  return null;
}
