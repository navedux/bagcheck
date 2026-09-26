"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { trackPage } from "@/lib/analytics";

function PageViews() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // One page view per URL; trackPage skips URLs with a wallet or a buy date in them.
  useEffect(() => {
    trackPage();
  }, [pathname, search]);
  return null;
}

/** Rendered once from the root layout. What is and isn't sent lives in lib/analytics. */
export function Analytics() {
  return (
    <Suspense fallback={null}>
      <PageViews />
    </Suspense>
  );
}
