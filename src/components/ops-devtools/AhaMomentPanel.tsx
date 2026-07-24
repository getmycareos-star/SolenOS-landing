"use client";

import type { AhaMomentView } from "@/lib/mvp-surface-area";
import { TrustInsightFooter } from "@/components/trust/TrustDiscoveryNote";

type Props = {
  view: AhaMomentView;
  className?: string;
};

export function AhaMomentPanel({ view, className }: Props) {
  return (
    <div className={`aha-moment-panel${className ? ` ${className}` : ""}`}>
      <h3 className="aha-moment-headline">{view.headline}</h3>
      {view.is_first_value_moment && (
        <p className="panel-muted">First situation captured — structure, not a summary.</p>
      )}

      <div className="aha-moment-sections">
        {Object.entries(view.sections).map(([key, section]) => {
          if (section.items.length === 0) return null;
          return (
            <section key={key} className="aha-moment-section">
              <h4>{section.title}</h4>
              <ul>
                {section.items.map((item, i) => (
                  <li key={`${key}-${i}`}>{item}</li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {view.is_first_value_moment && <TrustInsightFooter />}
    </div>
  );
}
