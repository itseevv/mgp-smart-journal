# Scrap Day Phase 6B.4 Customer Texture Background Fix

## Root Cause

The uploaded 2160 x 3840 leather asset was high-resolution. The low-quality split effect came from our rendering path, not from the image.

Three code paths caused the screenshot failures:

1. `journalThemeStyle` set `--journal-mobile-background-size` to `contain`. On a customer shell that is not exactly the same aspect ratio as the uploaded 9:16 asset, `contain` intentionally leaves empty bands. Those bands exposed the fallback procedural dotted leather layer behind the image.
2. Customer content surfaces still used `journal-leather-surface` in `JournalHome` and `DailyMemoryStamp`. That class paints its own procedural leather background, so the header/month-sheet area could hide the uploaded shell background and make the page look like separate top/middle/bottom backgrounds.
3. Desktop localhost constrained the shell width to `30rem` while keeping `min-height: 100dvh`. On a tall desktop browser window, that made the customer shell much taller than 9:16, so `background-size: cover` enlarged and cropped the uploaded asset differently from a real phone.

## Fix

- Changed uploaded customer mobile background rendering from `contain` to `cover`.
- Kept the uploaded image on the centered `JournalMobileShell`, not on the desktop outer page.
- Removed `journal-leather-surface` from customer journal home and daily stamp detail article wrappers.
- Preserved a 9:16 `JournalMobileShell` frame at desktop widths so localhost desktop previews match the phone framing instead of stretching to the full desktop viewport height.
- Left the upload/storage/data model untouched.
- Left admin preview behavior untouched: admin preview still uses `object-contain` so admins can inspect the full uploaded image.

## Files Changed

- `data/journal-themes.ts`
- `app/globals.css`
- `components/journal/journal-home.tsx`
- `components/stamp/daily-memory-stamp.tsx`
- `tests/journal-theme-assets.test.mjs`
- `tests/journal-themes.test.mjs`

## Regression Guard

Tests now assert:

- Customer shell background uses `cover`, not `contain`.
- The themed shell uses the uploaded `--journal-mobile-background-image`.
- The customer `JournalHome` article no longer uses `journal-leather-surface`.
- The customer `DailyMemoryStamp` article no longer uses `journal-leather-surface`.
- Desktop breakpoint keeps the customer shell at `aspect-ratio: 9 / 16` with `min-height: auto`.

## Verification

- `npm test` passed: 85 tests
- `npm run lint` passed
- `npm run build` passed after rerunning outside the sandbox because local Turbopack needs to spawn a process and bind a local port
- `git diff --check` passed
