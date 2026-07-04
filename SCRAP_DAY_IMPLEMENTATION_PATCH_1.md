# Scrap the Day Implementation Patch 1

Date: 2026-06-30
Repo: /Users/yi/Documents/Shopify/Journal Chip

## Summary

This patch moves the visible journal customer experience from generic memory storage toward the Scrap the Day ritual:

- Journal Home now presents a Monthly Stamp Sheet with saved Daily Memory Stamp tiles.
- The main journal CTA is "Seal Today" and checks for an existing stamp on today's local date before creating a new route.
- Saved journal detail now renders a leather-and-paper Daily Memory Stamp artifact with a fixed 3 by 3 grid.
- Journal creation/edit now allows up to 9 images total, labels the first image as the Cover Scrap in reorder mode, and hides voice memo recording.
- Product copy was reframed away from storage, quota, upload, and voice memo language in the journal customer flow.
- Journal theme tokens and internal product constants were added.

No routes, database tables, SQL migrations, Supabase storage paths, activation/lock/recovery flows, signed URL behavior, cleanup retry behavior, or backend voice memo capability were removed.

## Files Changed

- `app/layout.tsx`
- `app/globals.css`
- `components/capsule/capsule-page.tsx`
- `components/capsule/persistent-memory-flow.tsx`
- `components/journal/journal-home.tsx`
- `components/journal/journal-memory-page.tsx`
- `components/journal/monthly-stamp-sheet.tsx`
- `components/journal/stamp-tile.tsx`
- `components/stamp/daily-memory-stamp.tsx`
- `components/stamp/stamp-grid.tsx`
- `components/memory/completed-state.tsx`
- `components/memory/memory-form.tsx`
- `components/memory/photo-picker.tsx`
- `components/memory/sortable-photo-grid.tsx`
- `components/memory/photo-collection.tsx`
- `data/journal.ts`
- `data/journal-product.ts`
- `data/journal-stamps.ts`
- `data/journal-themes.ts`
- `lib/capsule/api.ts`
- `tests/journal-product.test.mjs`
- `SCRAP_DAY_IMPLEMENTATION_PATCH_1.md`

## Product Decisions Implemented

### One Day = One Daily Memory Stamp

- Journal Home "Seal Today" now computes today's local date in the browser.
- It checks existing journal memories by semantic day:
  - `capturedAt` / `occurred_at` first
  - `createdAt` fallback
- If today is already sealed, it navigates to the existing stamp instead of generating a new memory id.
- The UI shows a calm status message: "Today is already sealed. You can revisit today's stamp."

Remaining gap: direct navigation to a new `/c/[publicToken]/m/[memoryId]` can still bypass this UI guard. Backend local-date uniqueness and form-level duplicate-date save prevention are intentionally not included in this patch.

### Frontend Max 9 Images

- Added journal product constants:
  - `DAILY_MEMORY_STAMP_MAX_PHOTOS = 9`
  - `DAILY_MEMORY_STAMP_REQUIRED_COVER_PHOTOS = 1`
  - `DAILY_MEMORY_STAMP_MAX_ADDITIONAL_MOMENTS = 8`
  - `JOURNAL_YEAR_PHOTO_CAPACITY = 3285`
  - `JOURNAL_VOICE_MEMOS_ENABLED = false`
- Journal creation/edit uses a max of 9 images for new stamps.
- Existing stamps with more than 9 backend images are not deleted or truncated; the edit flow prevents adding beyond the existing count.
- The polished Daily Memory Stamp displays only the first 9 images.
- Slot 1 is the first image / order index 0. In edit/reorder mode it is labelled "Cover scrap."
- Empty slots use material fillers rather than unfinished-looking holes.

Backend/schema capability to store more photos remains unchanged.

### Voice Memo Hidden From Journal UX

- Journal creation/edit no longer renders the voice recorder.
- Journal detail no longer renders voice memo cards.
- Journal Home no longer shows voice memo counts.
- Backend voice memo tables, APIs, types, storage paths, and non-journal components remain intact.

### Month Sheet Grouping by User-Controlled Day

- Added `data/journal-stamps.ts` helpers for semantic date, local date key, local month key, grouping, active month selection, and sorting.
- Monthly Stamp Sheet groups by `capturedAt` first, `createdAt` fallback.
- Sorting within a month is by capturedAt ascending, then createdAt ascending.
- Active month is the current month if it has stamps, otherwise the latest stamped month, otherwise the current empty month.

## Intentionally Not Implemented Yet

- Database-level local date uniqueness.
- Form-level duplicate-day save guard for direct route entry.
- Scrap Table / Finder Tool cropper.
- True cover-first creation flow.
- Optional moments step after cover crop.
- Share/export.
- Year in Stamps.
- DB theme persistence.
- Full month navigation.
- OCR, AI, video editing, template marketplace, public social network, or Live Photo support.

## Visual and Technical Limitations

- The new theme tokens are frontend-only and use the default ruby journal theme.
- `get_journal_home` may still return a backend max photo value from existing RPC logic. The journal frontend does not show that quota and still enforces 9 images per stamp. The internal fallback config is now 3285.
- Existing memories with more than 9 backend images are preserved. The polished artifact shows the first 9 only.
- Earlier sheets are shown as a subtle section, but are not navigable yet.
- Manual live-route QA was not run against a real `/c/[publicToken]` journal because no test public token/capsule data was provided in this turn.

## Verification Results

| Command | Result | Notes |
| --- | --- | --- |
| `npm run lint` | Passed | `eslint . --max-warnings=0` |
| `npm test` | Passed | 35 Node test-runner tests passed |
| `npm run build` | Passed | First sandboxed attempt failed because Turbopack was blocked from creating a process/binding a port. Rerun with approved escalation passed. |

Additional targeted test run:

- `npm test -- tests/journal-product.test.mjs` passed. The package script also ran the full test glob.

## Manual Checks To Run With A Real Journal Token

- Open `/c/[publicToken]` and confirm the home shows a Monthly Stamp Sheet, not a storage list.
- Confirm the CTA says "Seal Today."
- Confirm the primary header does not show photo quota/count pressure.
- Confirm Journal Home does not show voice memo counts.
- Tap "Seal Today" when today has no stamp and confirm it opens the existing creation route.
- Tap "Seal Today" when today already has a stamp and confirm it opens today's existing stamp.
- Create/edit a journal stamp and confirm the max is 9 images total.
- Confirm the journal creation/edit flow has no voice memo recorder.
- Confirm the first image is labelled "Cover scrap" only in edit/reorder mode.
- Open an existing saved stamp and confirm leather background, paper mat, 3 by 3 grid, first slot as Cover Scrap, fillers for missing slots, no visible cover badge, and no voice memo section.
- Confirm edit, delete, rename, lock, unlock, recovery, signed private media, and cleanup retry still behave as before.
- Confirm `/c/[publicToken]` and `/c/[publicToken]/m/[memoryId]` routes remain unchanged.

## Recommended Next Patch

1. Add backend/database local-date uniqueness for journal memories using the journal's intended timezone/local-day model.
2. Add form-level duplicate-day detection for direct route entry and backfilled dates.
3. Build the cover-first Scrap Table / Finder Tool cropper and then split creation into Cover Scrap followed by optional moments.
4. Add real month navigation for Month Sheets.
5. Add visual QA with a seeded journal token across mobile and desktop.
