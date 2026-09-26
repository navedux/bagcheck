import type { Metadata } from "next";
import { HomeClient } from "@/components/HomeClient";
import { JsonLd } from "@/components/JsonLd";
import { liveChecksSpent } from "@/lib/nansen";
import { homeStructuredData } from "@/lib/structured-data";

// Whether today's live checks are spent can change at any moment, so home
// renders per request. The shared-budget read behind it is cached for 30 s.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const paused = await liveChecksSpent();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 pt-10 pb-6">
      <JsonLd data={homeStructuredData()} />
      <HomeClient paused={paused} />
    </main>
  );
}
