import { SolenosWordmark } from "./SolenosWordmark";
import { LivingArchiveMark } from "./LivingArchiveMark";

type Props = { message?: string };

/** Full-page brand loading state. It indicates waiting, never persistence success. */
export function BrandLoading({ message = "Preparing your care context…" }: Props) {
  return (
    <div className="brand-loading" role="status" aria-live="polite">
      <LivingArchiveMark size="lg" />
      <SolenosWordmark size="lg" as="div" />
      <p className="brand-loading__message">{message}</p>
    </div>
  );
}
