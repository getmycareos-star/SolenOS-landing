import { SolenosWordmark } from "./SolenosWordmark";



type Props = {

  message?: string;

};



/** Calm loading — logo + simple message, no distracting animation. */
export function BrandLoading({ message = "Preparing your care context…" }: Props) {
  return (
    <div className="brand-loading" role="status" aria-live="polite">
      <SolenosWordmark size="lg" as="div" />
      <p className="brand-loading__message" suppressHydrationWarning>
        {message}
      </p>
    </div>
  );
}

