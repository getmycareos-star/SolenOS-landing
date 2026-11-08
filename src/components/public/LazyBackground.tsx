"use client";

import { useEffect, useRef, useState } from "react";

type LazyBackgroundProps = {
  className: string;
  image: string;
  label: string;
};

/** Defer non-critical editorial photography until it approaches the viewport. */
export function LazyBackground({ className, image, label }: LazyBackgroundProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px", threshold: 0.01 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={elementRef}
      className={className}
      role="img"
      aria-label={label}
      style={shouldLoad ? { background: image } : undefined}
      data-background-loaded={shouldLoad ? "true" : "false"}
    />
  );
}
