import Image from "next/image";
import { logoUrl } from "@/lib/logo";

export function TokenMark({ symbol }: { symbol: string }) {
  return (
    <span aria-hidden="true" className="mark">
      <Image src={logoUrl(symbol)} alt="" width={22} height={22} />
    </span>
  );
}
