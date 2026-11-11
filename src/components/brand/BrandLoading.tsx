import { SolenosWordmark } from "./SolenosWordmark";
import { LivingArchiveMark } from "./LivingArchiveMark";

type Props = { message?: string; animate?: boolean };

/** Full-page brand loading state. Animation is opt-in so disabled modules remain unchanged. */
export function BrandLoading({ message = "Preparing your care context…", animate = false }: Props) {
  return (
    <div className="brand-loading" role="status" aria-live="polite">
      {animate ? <LivingArchiveMark size="lg" /> : null}
      <SolenosWordmark size="lg" as="div" />
      <p className="brand-loading__message">{message}</p>
    </div>
  );
}
