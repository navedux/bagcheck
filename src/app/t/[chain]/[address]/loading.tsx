import { CHECK_LOADING } from "@/lib/copy";

/**
 * Shown the moment a check is opened, while the server reads Nansen. Same
 * skeleton as the check so the swap reads as content arriving, not a jump.
 */
export default function CheckLoading() {
  return (
    <main
      className="mx-auto w-full max-w-4xl flex-1 px-6 pt-10 pb-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="check-loading">
        <div className="flex items-center gap-2.5">
          <span className="skel h-[22px] w-[22px]" />
          <div className="grid gap-1.5">
            <span className="skel h-[14px] w-16" />
            <span className="skel h-[11px] w-32" />
          </div>
        </div>
        <div className="mt-8 flex items-center gap-4">
          <span className="skel h-[34px] w-56" />
          <span className="skel h-[22px] w-24" />
        </div>
        <div className="mt-5 grid items-start gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
          <div className="grid gap-3">
            <span className="skel h-[15px] w-72 max-w-full" />
            <span className="skel h-[12px] w-28" />
            <span className="skel mt-2 h-[36px] w-40" />
          </div>
          <div className="grid gap-4">
            <span className="skel h-[10px] w-full" />
            <span className="skel h-[10px] w-full" />
            <span className="skel h-[10px] w-full" />
          </div>
        </div>
        <div className="load-rail mt-10" aria-hidden="true">
          <span />
        </div>
        <p className="caption mt-3">{CHECK_LOADING}</p>
      </div>
    </main>
  );
}
