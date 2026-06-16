"use client";

import Image from "next/image";

import type { JournalMemorySummary } from "@/data/journal";

type MemoryCardProps = {
  memory: JournalMemorySummary;
  thumbnailUrl?: string;
  onOpen: () => void;
};

function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
  }).format(new Date(isoDate));
}

export function MemoryCard({
  memory,
  thumbnailUrl,
  onOpen,
}: MemoryCardProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group grid w-full grid-cols-[5.25rem_1fr] gap-4 border-b border-rule py-4 text-left"
        aria-label={`Open ${memory.title}`}
      >
        <span className="relative aspect-square overflow-hidden rounded-[2px] bg-paper-deep">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt=""
              fill
              unoptimized
              loading="lazy"
              sizes="84px"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center px-2 text-center font-sans text-[0.62rem] text-ink-soft">
              Photograph
            </span>
          )}
        </span>
        <span className="min-w-0 self-center">
          <time
            dateTime={memory.capturedAt}
            className="font-sans text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-ink-soft"
          >
            {formatDate(memory.capturedAt)}
          </time>
          <span className="mt-1 block truncate font-serif text-[1.55rem] leading-tight tracking-[-0.03em] text-ink">
            {memory.title}
          </span>
          <span className="mt-2 block font-sans text-[0.68rem] text-ink-soft">
            {memory.photoCount}{" "}
            {memory.photoCount === 1 ? "photo" : "photos"}
            {memory.voiceMemoCount > 0
              ? ` · ${memory.voiceMemoCount} ${
                  memory.voiceMemoCount === 1 ? "voice memo" : "voice memos"
                }`
              : ""}
          </span>
        </span>
      </button>
    </li>
  );
}
