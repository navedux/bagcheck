"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function BrandMark() {
  return (
    <svg aria-hidden="true" className="site-mark" width="16" height="16" viewBox="0 0 16 16">
      <rect x="0.5" y="0.5" width="7" height="7" fill="var(--raised)" stroke="var(--line-strong)" />
      <rect x="8.5" y="0.5" width="7" height="7" fill="var(--raised)" stroke="var(--line-strong)" />
      <rect x="0.5" y="8.5" width="7" height="7" fill="var(--raised)" stroke="var(--line-strong)" />
      <rect x="8.5" y="8.5" width="7" height="7" fill="var(--p-cyan)" />
    </svg>
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
          Hold Check
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
