import { WALLET_LOADING } from "@/lib/copy";

/** Shown the moment a wallet is opened, while Nansen reads its balances. */
export default function WalletLoading() {
  return (
    <main
      className="mx-auto w-full max-w-4xl flex-1 px-6 pt-10 pb-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="check-loading">
        <span className="skel h-[12px] w-40" />
        <span className="skel mt-5 h-[40px] w-[28rem] max-w-full" />
        <span className="skel mt-5 h-[13px] w-72 max-w-full" />
        <div className="mt-10 grid gap-3">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="flex items-center gap-3 border-t border-[var(--line)] pt-3">
              <span className="skel h-[22px] w-[22px]" />
              <span className="skel h-[14px] w-24" />
              <span className="ml-auto skel h-[14px] w-20" />
            </div>
          ))}
        </div>
        <div className="load-rail mt-10" aria-hidden="true">
          <span />
        </div>
        <p className="caption mt-3">{WALLET_LOADING}</p>
      </div>
    </main>
  );
}
