# Scrap the Day Patch 1B

## Root Cause

Patch 1 Fix wired the real journal route to `productMode="journal"`, but the final QA URL I gave was `http://127.0.0.1:3000/memory/demo`.

That route was not the NFC journal route. It rendered:

`app/memory/demo/page.tsx -> MemoryFlow -> MemoryForm(default productMode="memory")`

So the product owner was looking at the old generic memory demo, which still correctly had memory copy, 30-photo defaults, and voice memo UI for the non-journal product.

The actual journal customer route already passed journal rules:

`app/c/[publicToken]/m/[memoryId]/page.tsx -> CapsulePage -> JournalMemoryPage -> PersistentMemoryFlow(productMode="journal") -> MemoryForm(productMode="journal")`

This patch fixes the QA route problem and adds runtime HTML verification so this failure does not pass through source-grep tests again.

## Screenshot Route

The screenshot matched `/memory/demo`, not the journal customer route. `/memory/demo` is now migrated away from the old form and redirects to `/journal/demo`.

## Route Truth

| Route | Component chain | Product mode/config | Runtime journal form state |
|---|---|---|---|
| `/memory/demo` | `app/memory/demo/page.tsx` | Redirects to `/journal/demo` | No old memory form is reachable from this QA URL |
| `/journal/demo` | `JournalDemoPage -> JournalDemoFlow -> MonthlyStampSheet` | Local journal demo | Shows Month Sheet and `Seal Today` |
| `/journal/demo?screen=create` | `JournalDemoPage -> JournalDemoFlow -> MemoryForm(productMode="journal")` | `maxPhotosPerMemory: DAILY_MEMORY_STAMP_MAX_PHOTOS` | 9-image max, voice memos disabled, Scrap the Day copy |
| `/c/[publicToken]/m/[memoryId]` | `CapsulePage -> JournalMemoryPage -> PersistentMemoryFlow -> MemoryForm` | `productMode="journal"` plus `Math.min(productRules.maxPhotosPerEntry, maxPhotos)` | 9-image max, voice memos disabled, Scrap the Day copy |

## What Changed

- Added a dedicated local journal QA route at `/journal/demo`.
- Added a direct create-form QA state at `/journal/demo?screen=create`.
- Migrated `/memory/demo` to redirect to `/journal/demo` so it can no longer be confused with journal QA.
- Added `JournalDemoFlow`, using the same `MemoryForm(productMode="journal")` path as the customer journal create/edit form.
- Added `scripts/qa-journal-route.mjs`, which requests actual local HTML and fails if old memory copy, voice memo copy, or 30-photo UI appears.
- Strengthened the journal form regression test to assert the migrated demo route and journal demo product config.

## Files Changed

- `app/journal/demo/page.tsx`
- `app/memory/demo/page.tsx`
- `components/journal/journal-demo-flow.tsx`
- `scripts/qa-journal-route.mjs`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_IMPLEMENTATION_PATCH_1B.md`

## QA Route

Open the local journal demo:

`http://127.0.0.1:3000/journal/demo`

Direct create-form QA:

`http://127.0.0.1:3000/journal/demo?screen=create`

The old URL now redirects:

`http://127.0.0.1:3000/memory/demo -> /journal/demo`

I attempted to seed a real `/c/[publicToken]` journal route, but the command would have used a service-role key from `.env.local` to mutate the configured Supabase project. That external side effect was rejected by the safety review, so Patch 1B uses the safer local journal demo route.

## Old String Classification

| Occurrence | Classification | Journal customer reachable? | Notes |
|---|---|---:|---|
| `tests/journal-form-regression.test.mjs` old string regex | QA guard | No | Ensures journal copy does not regress |
| `scripts/qa-journal-route.mjs` old string list | Runtime QA guard | No | Fails if local journal HTML exposes old UI |
| `data/memory-form-product.ts` memory rules | Non-journal legacy/default product mode | No | Kept for non-journal behavior; journal uses `journalFormRules` |
| `components/memory/sortable-photo-grid.tsx` default `First photo` | Non-journal fallback prop | No | Journal passes `coverLabel="Cover scrap"` |
| `components/admin/admin-capsule-detail-page.tsx` voice memo count | Admin/internal | No | Not customer journal create/edit UI |
| `components/memory/voice-recorder.tsx` voice memo strings | Non-journal component | No | `MemoryForm` does not render it when `productMode="journal"` |
| `components/memory/completed-state.tsx` voice memo and edit memory copy | Non-journal branch | No | Journal returns `DailyMemoryStamp` before this branch |

There are zero remaining old-string occurrences reachable from the journal customer create/edit route or the local journal QA route.

## Journal Form Wiring

- Max images: `DAILY_MEMORY_STAMP_MAX_PHOTOS = 9`.
- Real journal route clamp: `Math.min(productRules.maxPhotosPerEntry, maxPhotos)`.
- Local journal demo clamp: `maxPhotosPerMemory: DAILY_MEMORY_STAMP_MAX_PHOTOS`.
- Voice memos: `JOURNAL_VOICE_MEMOS_ENABLED = false`; `MemoryForm` does not render `VoiceRecorder`.
- Copy: `getMemoryFormProductRules("journal")` supplies `New Daily Scrap`, `One line to keep`, `Moments`, `Add moments`, and `Seal this day`.

Backend voice memo tables, APIs, storage paths, and non-journal components remain intact.

## Verification

| Check | Result |
|---|---|
| `npm run lint` | Passed |
| `npm test` | Passed, 37 tests |
| `npm run build` | Passed outside sandbox; sandbox build fails on Turbopack process/port permission |
| `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/qa-journal-route.mjs http://127.0.0.1:3000` | Passed |

QA script confirmed:

- `/journal/demo` renders Month Sheet and `Seal Today`.
- `/journal/demo?screen=create` renders Scrap the Day form copy.
- `/journal/demo?screen=create` does not render old memory copy, 30-photo UI, or voice memo UI.
- `/memory/demo` redirects to `/journal/demo`.
- Runtime journal config is `maxPhotosPerEntry: 9`, `voiceMemosEnabled: false`.

## Manual QA Checklist

- Open `http://127.0.0.1:3000/journal/demo`.
- Tap `Seal Today`.
- Confirm the create form has no old memory copy.
- Confirm there is no `30 photos` or `0 of 30 photos`.
- Confirm there is no voice memo section or recorder.
- Confirm CTA says `Seal this day`.
- Add 1 image and save.
- Add 9 images and save.
- Try adding a 10th image and confirm it is blocked.
- Edit the saved stamp and confirm the first image says `Cover scrap` only in edit/reorder mode.

## Remaining Limitations

- No DB-level local date uniqueness yet.
- No Scrap Table / Finder Tool cropper yet.
- No true cover-first crop flow yet.
- No share/export.
- No Year in Stamps.
- `/journal/demo` is a local in-memory QA route, not a Supabase-backed journal.
