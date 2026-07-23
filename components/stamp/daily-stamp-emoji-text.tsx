import { Fragment } from "react";

import {
  dailyStampEmojiAssetUrl,
  dailyStampTextParts,
} from "@/lib/export/daily-memory-stamp-export";

export function DailyStampEmojiText({ value }: { value: string }) {
  return dailyStampTextParts(value).map((part, index) =>
    part.kind === "text" ? (
      <Fragment key={`text-${index}`}>{part.text}</Fragment>
    ) : (
      <span
        key={`${part.codepoint}-${index}`}
        role="img"
        aria-label={part.text}
        className="inline-block h-[1em] w-[1em] bg-contain bg-center bg-no-repeat align-[-0.12em]"
        style={{
          backgroundImage: `url("${dailyStampEmojiAssetUrl(part.codepoint)}")`,
        }}
      />
    ),
  );
}
