# Scrap the Day Patch 1 Fix

Date: 2026-06-30

## What Was Wrong

The rendered journal create/edit screen could still appear as the old generic memory form:

- "New memory"
- "Name this memory"
- "Photographs"
- "0 of 30 photos"
- "Voice memos"
- "Record a voice memo"
- "Save memory"

That fails the Batch 1 product promise. The journal customer create/edit flow must be image-only, capped at 9 images, and written in Scrap the Day ritual language.

## Root Cause

Batch 1 left the form behavior dependent on a loose `journalMode` boolean and scattered conditional copy inside generic memory components. That made the route fragile and left no regression test proving the journal route passed a journal-specific product configuration all the way into:

- `PersistentMemoryFlow`
- `MemoryForm`
- `PhotoPicker`

The form also still had journal copy gaps, such as "Today's Scrap" instead of "New Daily Scrap" and "Coffee before the rain" instead of "What would you call today?"

## Files Changed

- `components/journal/journal-memory-page.tsx`
- `components/capsule/persistent-memory-flow.tsx`
- `components/memory/memory-form.tsx`
- `components/memory/photo-picker.tsx`
- `data/memory-form-product.ts`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_IMPLEMENTATION_PATCH_1_FIX.md`

## How The Fix Works

### Max 9 Image Limit

- Added `data/memory-form-product.ts`.
- Journal form rules now explicitly set `maxPhotosPerEntry` to `DAILY_MEMORY_STAMP_MAX_PHOTOS`.
- `PersistentMemoryFlow` clamps `maxPhotosPerMemory` through product rules before passing config to the form.
- `PhotoPicker` also clamps with `maxPhotosPerEntry`, so the visible picker cannot show or use 30 for journal mode.

### Voice Memo Disabled State

- Journal form rules explicitly set `voiceMemosEnabled` to `JOURNAL_VOICE_MEMOS_ENABLED`, currently `false`.
- `MemoryForm` renders the `VoiceRecorder` only when `voiceMemosEnabled` is true.
- Non-journal memory/bookmark behavior keeps voice memo capability intact.
- Backend voice memo tables, APIs, types, and storage paths are untouched.

### Scrap the Day Copy

Journal mode now uses explicit product copy:

- Header: "New Daily Scrap"
- Title label: "One line to keep"
- Placeholder: "What would you call today?"
- Moments section: "Moments"
- Helper/counter: "Up to 9 moments." and "0 of 9 moments"
- Add button: "Add moments"
- Save CTA: "Seal this day"
- Edit header: "Edit stamp"
- Reorder cover label: "Cover scrap"

The polished saved Daily Memory Stamp still does not show a visible cover badge.

## Non-Journal Behavior

The old memory-mode copy and voice recorder remain available through the `memory` product mode for non-journal flows such as bookmark/demo routes. This fix is scoped to the journal customer create/edit path.

## Verification Results

| Command | Result | Notes |
| --- | --- | --- |
| `npm run lint` | Passed | `eslint . --max-warnings=0` |
| `npm test` | Passed | 37 Node tests passed |
| `npm run build` | Passed | First sandboxed attempt hit the known Turbopack local process/port EPERM; rerun with approved escalation passed. |

Targeted regression:

- `tests/journal-form-regression.test.mjs` verifies journal form rules use 9 images, voice memos disabled, Scrap the Day copy, and that `JournalMemoryPage` passes `productMode="journal"` into the flow.

## Manual QA Checklist

- Open `/c/[publicToken]`.
- Tap "Seal Today."
- Confirm the create form has no 30-photo limit.
- Confirm there is no voice memo section.
- Confirm CTA says "Seal this day."
- Add 1 image and save.
- Add 9 images and save.
- Try to add a 10th image and confirm it is blocked.
- Edit an existing stamp and confirm first image says "Cover scrap" only in edit/reorder mode.

## Remaining Limitations

- No cropper / Scrap Table / Finder Tool yet.
- No share/export yet.
- No DB migration or backend local-date uniqueness yet.
- Direct-route duplicate-day prevention remains a later backend/form-level hardening item.
