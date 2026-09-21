import Image from "next/image";
import { domainLogoUrl } from "@/lib/logo";
import { CHAIN_DOMAIN, type Chain } from "@/lib/types";

/**
 * Chain logo. `circled` wraps it in the hairline mark square so it stays
 * legible on the ink background of an active segment.
 */
export function ChainMark({
  chain,
  size = 14,
  circled = false,
}: {
  chain: Chain;
  size?: number;
  circled?: boolean;
}) {
  const img = (
    <Image
      src={domainLogoUrl(CHAIN_DOMAIN[chain], size * 2)}
      alt=""
      width={size}
      height={size}
    />
  );
  if (!circled) return img;
  return (
    <span aria-hidden="true" className="mark mark-sm">
      {img}
    </span>
  );
}
