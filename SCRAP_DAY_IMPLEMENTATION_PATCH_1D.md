# Scrap the Day Implementation Patch 1D

## Summary

Patch 1D tightens the journal customer create/edit and saved stamp experience after Patch 1C product-owner QA.

The visible journal flow now presents a quieter mobile-first ritual:

- Create/edit opens as a journal sheet, not a dense form.
- The empty create state starts with one required Cover Scrap.
- Optional moments appear only after a cover exists.
- The journal form hides Draft, Time, automatic date/time helper copy, photo counters, and success/reorder instruction noise.
- Daily Memory Stamp detail adapts to the number of images instead of forcing a 3x3 grid for every count.
- Local demo routes can render create states and detail stamps for 1 through 9 images for product-owner QA.

## Files Changed

- `components/memory/memory-form.tsx`
- `components/memory/journal-photo-picker.tsx`
- `components/memory/sortable-photo-grid.tsx`
- `components/memory/memory-icons.tsx`
- `components/stamp/stamp-grid.tsx`
- `data/stamp-layouts.ts`
- `components/journal/journal-demo-flow.tsx`
- `app/journal/demo/page.tsx`
- `tests/journal-form-regression.test.mjs`
- `tests/journal-product.test.mjs`
- `scripts/qa-journal-route.mjs`
- `scripts/qa-journal-mobile-browser.mjs`

## Product Decisions Implemented

### Create/Edit Page Simplification

The journal create/edit route now removes the dense generic form cues from the customer experience:

- No visible Time field.
- No Draft status.
- No "Date and time are added automatically" helper.
- No "Edit" metadata toggle row.
- No "0 of 9 moments" counter.
- No "1 moment added" success text.
- No long "Press and drag to reorder" instruction in the journal flow.

The visible create copy is now centered on the ritual:

- `New Daily Scrap`
- `One line to keep`
- `What would you call today?`
- `Cover Scrap`
- `Choose today's scrap`
- `One photo is enough to seal the day.`
- `Seal this day`

### Date Control

The journal form keeps user-controlled day selection while reducing visible metadata weight.

- Date remains editable.
- The visible form shows only a date row.
- Time is preserved internally from the existing captured date but is not shown in the journal customer UI.
- No database fields, route params, or storage paths were changed.

### Cover-First Without Cropper

This patch does not add the Scrap Table / Finder Tool cropper.

Until that exists:

- The first image remains the Cover Scrap.
- The empty create state asks for one Cover Scrap.
- Optional moments are hidden until a cover exists.
- The cover preview is larger and visually primary in create/edit.
- Additional moments are optional and capped at 8.

### Adaptive Daily Memory Stamp Layout

Saved stamp detail now uses adaptive layouts so 1-6 image stamps look intentional instead of sparse:

- 1 image: single featured image, 0 fillers.
- 2 images: duo, 0 fillers.
- 3 images: featured trio, 0 fillers.
- 4 images: quad, 0 fillers.
- 5 images: featured five, 0 fillers.
- 6 images: six grid, 0 fillers.
- 7 images: nine grid, 2 fillers.
- 8 images: nine grid, 1 filler.
- 9 images: nine grid, 0 fillers.

The stamp still shows at most 9 images and does not expose backend overflow UI.

### Demo And QA Routes

The journal demo route now supports direct QA URLs:

- `/journal/demo`
- `/journal/demo?screen=create`
- `/journal/demo?screen=create&photos=1`
- `/journal/demo?screen=create&photos=2`
- `/journal/demo?screen=detail&photos=1`
- `/journal/demo?screen=detail&photos=9`

`/memory/demo` continues to redirect to `/journal/demo`.

## What Was Intentionally Not Implemented

- No database-level local date uniqueness.
- No DB theme persistence.
- No cropper.
- No Scrap Table / Finder Tool.
- No true cover-first crop workflow.
- No separate optional-moments step after crop.
- No share/export.
- No Year in Stamps.
- No route renames.
- No Supabase storage path changes.
- No backend voice memo deletion.

## Technical Notes

- The production journal customer route still resolves through:
  `app/c/[publicToken]/m/[memoryId] -> CapsulePage -> JournalMobileShell -> JournalMemoryPage -> PersistentMemoryFlow(productMode="journal") -> MemoryForm`.
- The form continues to use the existing save/edit/delete/upload pipeline.
- Backend and non-journal voice memo capability remains intact.
- The journal product mode clamps the customer-facing photo limit to 9.
- The polished saved stamp does not show a visible Cover Scrap badge.

## Verification Results

- `npm run lint`: passed.
- `npm test`: passed, 39 tests.
- `npm run build`: passed after rerunning outside the sandbox. The first sandbox build failed with the known Turbopack worker permission error: `creating new process / binding to a port / Operation not permitted`.
- `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/qa-journal-route.mjs http://127.0.0.1:3000`: passed.
- `PLAYWRIGHT_MODULE_DIR=/Users/yi/.agents/skills/gstack/node_modules node scripts/qa-journal-mobile-browser.mjs http://127.0.0.1:3000`: passed.

Mobile browser QA checked widths 375, 390, and 430 for:

- `/journal/demo`
- `/journal/demo?screen=create`
- `/journal/demo?screen=create&photos=1`
- `/journal/demo?screen=detail&photos=1` through `photos=9`

It confirmed:

- No old memory/storage copy.
- No dense create form copy.
- No visible `SD` mark.
- No horizontal overflow.
- Expected stamp layout and filler count for every image count from 1 to 9.

## Manual QA Checklist

- Open `/journal/demo`.
- Tap or open `Seal Today`.
- Confirm create form starts with Cover Scrap, not a full 9-slot grid.
- Confirm create form has no visible Time, Draft, automatic date/time helper, voice memo section, or counters.
- Confirm empty create form shows `Choose today's scrap` and `One photo is enough to seal the day.`
- Open `/journal/demo?screen=create&photos=1`.
- Confirm optional moments appear only after the cover exists.
- Open `/journal/demo?screen=create&photos=2`.
- Confirm additional moments are present without long drag instructions.
- Open `/journal/demo?screen=detail&photos=1` through `photos=9`.
- Confirm layouts adapt to the image count and fillers appear only for 7 and 8 images.
- Confirm `/memory/demo` redirects to `/journal/demo`.

## Recommended Next Patch

Patch 2 should implement the real cover-first creation sequence with the Scrap Table / Finder Tool cropper, including:

- Cover selection as the first step.
- Cropping/finding the Cover Scrap.
- Optional moments as a second step.
- More precise mobile gesture QA for crop and reorder.
