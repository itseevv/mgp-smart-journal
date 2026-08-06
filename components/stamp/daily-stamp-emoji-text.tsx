import { Fragment } from "react";

import { dailyStampTextParts } from "@/lib/export/daily-memory-stamp-export";

const nativeEmojiFontFamily =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export function DailyStampEmojiText({ value }: { value: string }) {
  return dailyStampTextParts(value).map((part, index) =>
    part.kind === "text" ? (
      <Fragment key={`text-${index}`}>{part.text}</Fragment>
    ) : (
      <span
        key={`${part.codepoint}-${index}`}
        role="img"
        aria-label={part.text}
        data-native-emoji="true"
        className="inline-block leading-none align-[-0.12em]"
        style={{ fontFamily: nativeEmojiFontFamily }}
      >
        {part.text}
      </span>
    ),
  );
}
