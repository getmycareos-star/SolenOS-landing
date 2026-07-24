import Link from "next/link";
import type { MvpFaqItem } from "@/lib/mvp-faq";

export function FaqList({
  items,
  headingId = "faq",
  title = "Frequently asked questions",
  showMoreHref,
  showMoreLabel = "See all questions in Help",
}: {
  items: readonly MvpFaqItem[];
  headingId?: string;
  title?: string;
  showMoreHref?: string;
  showMoreLabel?: string;
}) {
  return (
    <section className="public-section" aria-labelledby={headingId}>
      <h2 id={headingId} className="public-section-title">
        {title}
      </h2>
      <dl className="mvp-faq-list">
        {items.map((item) => (
          <div key={item.id} className="mvp-faq-item" id={`faq-${item.id}`}>
            <dt className="mvp-faq-question">{item.question}</dt>
            <dd className="mvp-faq-answer">
              {item.paragraphs.map((p) => (
                <p key={p} className="public-prose">
                  {p}
                </p>
              ))}
              {item.bullets && item.bullets.length > 0 && (
                <ul className="public-quiet-list">
                  {item.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
              {item.links && item.links.length > 0 && (
                <p className="public-prose">
                  {item.links.map((link, i) => (
                    <span key={link.href}>
                      {i > 0 ? " · " : null}
                      <Link href={link.href}>{link.label}</Link>
                    </span>
                  ))}
                </p>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {showMoreHref && (
        <p className="public-prose">
          <Link href={showMoreHref}>{showMoreLabel}</Link>
        </p>
      )}
    </section>
  );
}
