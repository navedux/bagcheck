import { HomeClient } from "@/components/HomeClient";
import { liveChecksSpent } from "@/lib/nansen";

// Whether today's live checks are spent can change during the day; re-read it
// at most every 30 seconds rather than on every visit.
export const revalidate = 30;

export default async function HomePage() {
  const paused = await liveChecksSpent();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 pt-10 pb-6">
      <HomeClient paused={paused} />
    </main>
  );
}
