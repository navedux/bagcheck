"use client";

import { useState } from "react";
import { TryTokens } from "@/components/TryTokens";
import { WatchAddModal } from "@/components/WatchAddModal";
import { WatchList } from "@/components/WatchList";

export function HomeWatch({ flush = false }: { flush?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <WatchList
        flush={flush}
        onAdd={() => setOpen(true)}
        empty={<TryTokens onAdd={() => setOpen(true)} />}
      />
      {open ? <WatchAddModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}
