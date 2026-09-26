"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** The side-eye bag. Regenerate with `python3 scripts/brand/icon.py`. */
function BrandMark() {
  return (
    <Image
      src="/brand/bagcheck-icon.svg"
      alt=""
      aria-hidden="true"
      width={22}
      height={22}
      className="site-mark"
      priority
    />
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const home = pathname === "/";
  const about = pathname === "/about";

  return (
    <header className="site-nav">
      <div className="site-nav-bar">
        <Link href="/" className="site-brand" aria-current={home ? "page" : undefined}>
          <BrandMark />
          Bagcheck
        </Link>
        <nav aria-label="Site">
          <Link href="/about" className="site-link" aria-current={about ? "page" : undefined}>
            About
          </Link>
        </nav>
      </div>
      <div
        className="border-ticks border-t border-[var(--line)]"
        style={{ "--tick": "var(--p-green)" } as CSSProperties}
      />
    </header>
  );
}
