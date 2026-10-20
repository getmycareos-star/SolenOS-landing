"use client";

import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "icon" | "destructive";

export type ButtonProps = {
  variant?: ButtonVariant;
  loading?: boolean;
  /** Icon-only button (variant="icon") will be styled as a 44x44 tap target. */
  active?: boolean;
  /** When true, render the child element (e.g. Link/a) with button styling. */
  asChild?: boolean;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

/**
 * Reusable SolenOS button system.
 * Primary (filled), Secondary (outline), Icon (44x44 tap target), Destructive (muted tone).
 * Every state has a visible pressed response (scale + color) within 100ms.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", loading = false, active = false, asChild = false, className = "", children, disabled, ...rest },
    ref,
  ) => {
    const classes = [
      "solenos-btn",
      `solenos-btn--${variant}`,
      loading ? "is-loading" : "",
      active ? "is-active" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    if (asChild && isValidElement(children)) {
      const child = children as ReactElement<{
        className?: string;
        ref?: React.Ref<unknown>;
      }>;
      return cloneElement(child, {
        ref,
        className: [child.props.className, classes].filter(Boolean).join(" "),
        ...rest,
      });
    }

    return (
      <button
        ref={ref}
        type="button"
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-pressed={variant === "icon" ? active : undefined}
        {...rest}
      >
        {loading ? (
          <span className="solenos-btn__spinner" aria-hidden="true">
            <Loader2 size={18} aria-hidden />
          </span>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
