import { HomeClient } from "@/components/HomeClient";
import { liveChecksSpent } from "@/lib/nansen";

// Whether today's live checks are spent can change at any moment, so home
// renders per request. The shared-budget read behind it is cached for 30 s.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const paused = await liveChecksSpent();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 pt-10 pb-6">
      <HomeClient paused={paused} />
    </main>
  );
}
