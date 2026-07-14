# Scrap the Day Phase 7R.6A Customer Copy Inventory

## 1. Scope

Phase 7R.6A created a documentation-only snapshot of customer-facing copy for the Scrap the Day Journal experience. The primary control document is [`SCRAP_DAY_COPY_DECK.md`](./SCRAP_DAY_COPY_DECK.md).

The inventory reflects the current working tree on 11 July 2026, including pre-existing uncommitted product work. This phase did not redesign UI, change behavior, or apply any suggested rewrite to production.

## 2. Surfaces scanned

- App metadata and browser/PWA labels
- Public Journal access, activation, PIN, lock, and recovery states
- Journal Home and Month Sheet
- Daily Memory Stamp detail
- Create/edit, validation, save progress, capacity, and delete flows
- Cover Scrap selection and Additional Moments
- Sortable photo grid and screen-reader announcements
- Scrap Finder / Scrap Table
- Full-screen Photo Viewer and private-photo states
- Save / Share modal
- Daily 9:16 export artwork, filename, fallbacks, and errors
- Empty, loading, error, status, and retry states on public Journal routes
- Product-controlled aria labels, title attributes, alt text, live-region text, and screen-reader-only text
- `/journal/demo` fixtures and demo-only labels, separated from production copy
- Admin Journal-theme preview content, separated from admin operations

## 3. Files scanned / notable files

### Routes and metadata

- `app/layout.tsx`
- `app/page.tsx`
- `app/c/[publicToken]/page.tsx`
- `app/c/[publicToken]/m/[memoryId]/page.tsx`
- `app/journal/demo/page.tsx`
- `app/memory/demo/page.tsx`
- `app/icon.svg`

### Customer access and Journal surfaces

- `components/capsule/capsule-page.tsx`
- `components/capsule/pin-gate.tsx`
- `components/capsule/recovery-flow.tsx`
- `components/capsule/persistent-memory-flow.tsx`
- `components/journal/journal-home.tsx`
- `components/journal/journal-identity-header.tsx`
- `components/journal/monthly-stamp-sheet.tsx`
- `components/journal/month-sheet-grid.tsx`
- `components/journal/month-tile.tsx`
- `components/journal/journal-memory-page.tsx`
- `components/journal/bottom-ritual-action.tsx`
- `components/journal/journal-demo-flow.tsx`

### Stamp, create/edit, photo, finder, and export surfaces

- `components/stamp/daily-memory-stamp.tsx`
- `components/stamp/stamp-grid.tsx`
- `components/stamp/cropped-stamp-image.tsx`
- `components/memory/memory-form.tsx`
- `components/memory/journal-photo-picker.tsx`
- `components/memory/sortable-photo-grid.tsx`
- `components/memory/photo-viewer.tsx`
- `components/memory/photo-collection.tsx`
- `components/memory/completed-state.tsx`
- `components/scrap/scrap-table.tsx`
- `components/export/daily-stamp-export-composer.tsx`
- `lib/export/daily-memory-stamp-export.ts`

### Copy sources, state helpers, and customer-visible errors

- `data/journal.ts`
- `data/journal-product.ts`
- `data/journal-stamps.ts`
- `data/local-date.ts`
- `data/memory-demo.ts`
- `data/memory-form-product.ts`
- `data/journal-themes.ts`
- `lib/capsule/api.ts`
- `lib/capsule/opening.ts`
- `lib/capsule/server-gate.ts`
- `lib/supabase/client.ts`
- `lib/media/private-url-cache.ts`

### Admin preview and regression references

- `components/admin/admin-journal-themes-page.tsx`
- `tests/journal-form-regression.test.mjs`
- `tests/daily-stamp-export.test.mjs`
- `tests/journal-product.test.mjs`
- `tests/capsule-opening.test.mjs`
- `tests/recovery-security.test.mjs`

Admin operational copy, bookmark-only UI, voice-memo UI, test prose, design-playground annotations, console diagnostics, and database/API codes were excluded from the customer application set. Admin theme-preview content and inactive Journal copy constants are retained in clearly marked `internal only` rows where they help owner review.

## 4. Number of strings inventoried

The deck contains **327 inventory rows** across production, accessibility, demo, Admin Preview, internal-error, and explicit-gap entries.

Status breakdown:

| Status | Rows |
| --- | ---: |
| proposed | 181 |
| needs review | 63 |
| do not change | 17 |
| internal only | 66 |
| approved | 0 |
| **Total** | **327** |

The deck also documents **11 “No current copy” rows**. Eight are actionable production copy/state gaps: PWA labels, Daily Detail title fallback, empty Detail photos, saved status, Scrap Finder drag instructions, Photo Viewer unavailable state, Save / Share ready state, and Save / Share busy-action state. The remaining rows document icon or redirect surfaces that intentionally render no copy. Some gaps may require behavior or state wiring and therefore must not be implemented as part of a later copy-only pass without separate approval.

## 5. Copy debt themes found

1. **Legacy system vocabulary reaches customers.** Public Journal routes still show “capsule,” “memory,” “media,” “upload,” “session,” “cleanup,” “commit,” “export,” and “Supabase” in some errors, progress states, and access screens.
2. **Product naming is not fully governed.** The UI alternates among Daily Scrap, Daily Memory Stamp, stamp, memory, photo, photograph, image, moment, and media item.
3. **The sealing ritual is inconsistent.** Home uses “Seal the Day,” its menu uses “Seal Today,” creation uses “Seal this day,” and completed-day navigation uses “Today’s Stamp.”
4. **Capitalization varies.** Journal, journal, Stamp, and stamp appear in equivalent product roles.
5. **Retry language varies.** “Retry,” “Please retry,” and “Try again” are used for the same customer action.
6. **Loading states change vocabulary mid-flow.** A detail route can move from “Opening stamp…” to “Loading memory…”. Save progress moves from Moments language into “media items” and “stamp details.”
7. **Accessibility sometimes exposes device filenames.** Photo alt text, open-photo labels, remove buttons, and reorder announcements can read a local filename instead of a stable product label and position.
8. **Some requested states have no dedicated copy.** The Detail has no title fallback, zero-photo message, or saved line; the viewer lacks an unavailable state; and the export modal has no ready confirmation.
9. **Demo and Admin previews can imply non-production copy.** Admin preview text includes “Private by nature.”, a theme name as the Journal title, “Daily Scrap” as a sample entry title, and a text “MGP” mark that do not match current production rendering.
10. **Punctuation is inconsistent.** Straight and curly apostrophes, three dots and ellipsis characters, and button-label periods coexist.

## 6. Customer-facing technical copy needing review

Highest-priority examples are:

- “Supabase browser environment is not configured.”
- “The capsule could not be opened from this connection. Check the link, network, or origin configuration and retry.”
- “Opening this capsule took too long while checking the private device session.”
- “Private media cleanup is still pending for {count} item/items.”
- “Private media cleanup could not be completed yet.”
- “Removing unfinished media…”
- “Saved {current} of {total} media items”
- “Old media cleanup still needs another attempt.”
- “Saving stamp details”
- “The memory could not be committed. Your saved draft is ready to retry.”
- “Queued old media for private cleanup”
- “9:16 preview of the saved Daily Memory Stamp export”

Each appears in the deck with a proposed customer-facing alternative or a warning where wording alone may not be sufficient.

## 7. Duplicate or inconsistent terms

| Concept | Current variants |
| --- | --- |
| Journal object | journal, Journal, capsule, memory capsule, memory |
| Daily object | Daily Scrap, Daily Memory Stamp, stamp, memory |
| Saved visuals | Cover Scrap, scrap, moment, photo, photograph, image, media item |
| Home ritual | Seal the Day, Seal Today, Seal Another Day, Today’s Stamp |
| Create/save ritual | Seal this day, Save stamp, Sealing day…, Saving stamp details |
| Retry action | Try again, Retry save, Retry cleanup, Please retry, Retry Cancel |
| Loading/opening | Opening journal…, Opening stamp…, Loading memory…, Creating image... |
| Journal naming | journal title, journal name, My Journal |

## 8. Suggested next step

The product owner should edit the **Owner Final Copy** column in [`SCRAP_DAY_COPY_DECK.md`](./SCRAP_DAY_COPY_DECK.md), change decided rows to `approved`, and leave Notes where wording or state behavior remains uncertain.

A later implementation phase should apply only approved rows, preserve variables and accessibility meaning, and make no layout or styling changes.

## 9. Production change statement

Phase 7R.6A changed documentation only:

- `SCRAP_DAY_COPY_DECK.md`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_7R_6A_COPY_INVENTORY.md`

No production code, app behavior, UI layout, styling, or visible production copy was changed. `npm test` was not run because this phase made no production-code change.
