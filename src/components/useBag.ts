"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { bagTicketSchema, type BagTicket } from "@/lib/bag";
import { checkPath } from "@/lib/format";
import { bagSnapshot, parseBag, saveBag, subscribeBag } from "@/lib/storage";
import type { Chain } from "@/lib/types";

export function useBag(
  chain: Chain,
  address: string,
  urlEntryDate?: string,
) {
  const router = useRouter();
  const raw = useSyncExternalStore(
    subscribeBag,
    () => bagSnapshot(chain, address),
    () => "",
  );
  const stored = parseBag(raw);
  const ticket: BagTicket = urlEntryDate
    ? { ...stored, entryDate: urlEntryDate }
    : stored;

  useEffect(() => {
    if (!urlEntryDate && ticket.entryDate) {
      router.replace(checkPath(chain, address, ticket.entryDate));
    }
  }, [urlEntryDate, ticket.entryDate, chain, address, router]);

  function commit(next: BagTicket, syncDate = false) {
    const parsed = bagTicketSchema.safeParse(next);
    const clean = parsed.success ? parsed.data : next;
    saveBag(chain, address, clean);
    if (!syncDate) return;
    router.replace(checkPath(chain, address, clean.entryDate));
  }

  return { ticket, commit };
}
