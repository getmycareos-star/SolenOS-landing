import { BRAND_NAME } from "@/lib/brand";



type WordmarkSize = "sm" | "md" | "lg";



type Props = {

  /** sm = sidebar/mobile, md = header, lg = auth/loading */

  size?: WordmarkSize;

  className?: string;

  /** Heading level when used as primary mark */

  as?: "h1" | "span" | "div";

};



/**

 * Official solenos wordmark — lowercase, slate + sage, letterpress inset.

 * Do not recreate, recolor, or distort. Use this component only.

 */

export function SolenosWordmark({ size = "md", className = "", as: Tag = "span" }: Props) {

  return (

    <Tag

      className={`solenos-wordmark solenos-wordmark--${size}${className ? ` ${className}` : ""}`}

      aria-label={BRAND_NAME}

    >

      <span className="solenos-wordmark__solen" aria-hidden="true">

        solen

      </span>

      <span className="solenos-wordmark__os" aria-hidden="true">

        os

      </span>

    </Tag>

  );

}


