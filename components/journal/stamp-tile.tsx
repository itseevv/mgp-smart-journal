"use client";

import Image from "next/image";

import { memoryLocalDateKey, semanticStampDate } from "@/data/journal-stamps";
import type { JournalMemorySummary } from "@/data/journal";

type StampTileProps = {
  memory: JournalMemorySummary;
  thumbnailUrl?: string;
  onOpen: () => void;
};

function dayLabel(memory: JournalMemorySummary) {
  const value = semanticStampDate(memory);
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { day: "2-digit" }).format(value);
}

export function StampTile({ memory, thumbnailUrl, onOpen }: StampTileProps) {
  const day = dayLabel(memory);

  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onOpen}
        className="group block w-full text-left"
        aria-label={`Open ${memory.title}`}
      >
        <span className="relative block aspect-square overflow-hidden bg-[var(--journal-paper-muted)] p-1 shadow-[0_10px_24px_rgba(52,43,31,0.14)] transition-transform duration-300 group-hover:-translate-y-0.5">
          <span className="absolute inset-1 border border-dashed border-[var(--journal-stamp-border)]" />
          <span className="relative block h-full overflow-hidden bg-[var(--journal-filler-a)]">
            {thumbnailUrl ? (
              <Image
                src={thumbnailUrl}
                alt=""
                fill
                unoptimized
                loading="lazy"
                sizes="(min-width: 1024px) 150px, (min-width: 640px) 22vw, 38vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.035]"
              />
            ) : (
              <span className="absolute inset-0 bg-[linear-gradient(135deg,var(--journal-filler-a),var(--journal-filler-b))]" />
            )}
          </span>
          {day ? (
            <span className="absolute left-2 top-2 bg-[var(--journal-paper)] px-1.5 py-0.5 font-sans text-[0.58rem] font-semibold tabular-nums text-[var(--journal-paper-muted-text)]">
              {day}
            </span>
          ) : null}
        </span>
        <span className="mt-2 block truncate font-serif text-[1.1rem] leading-tight text-[var(--journal-paper-text)]">
          {memory.title}
        </span>
        <time
          dateTime={semanticStampDate(memory)?.toISOString()}
          className="mt-1 block font-sans text-[0.62rem] uppercase tracking-[0.12em] text-[var(--journal-paper-muted-text)]"
        >
          {memoryLocalDateKey(memory)}
        </time>
      </button>
    </li>
  );
}
