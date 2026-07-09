# Scrap Day Phase 7R.0 Visual Redesign Reset Checkpoint

## Status

Phase 7.1.x production patching is paused. Phase 7R starts by documenting what changed, what was accepted, what was rejected, and why a local visual playground is needed before more production route edits.

## What Phase 7.1 Changed

Phase 7.1 implemented a narrow customer-facing editorial visual-system slice across Month Sheet, Daily Memory Stamp detail, Scrap Finder, and demo routes.

Key changes:

- Month Sheet moved toward a compact 3-column mobile app grid.
- Month Sheet rendered sealed days only.
- Month tiles used date captions below photos instead of date overlays.
- Daily detail moved to an adaptive editorial photo grid.
- Old perforated/stamp framing was removed from Month Sheet and Daily detail app grids.
- Scrap Finder moved away from blue plastic styling and toward theme-aware leather/paper tokens.
- The active journal theme was passed into Scrap Finder.
- Shared primitives were introduced: `PaperPanel`, `RitualButton`, `TextLinkButton`, `IconButton`, `JournalIdentityHeader`, and `MonthTile`.
- `SCRAP_DAY_COPY_DECK.md` was created as a Markdown copy reference.

## What Phase 7.1.1 Changed

Phase 7.1.1 was a product-owner visual acceptance pass on Phase 7.1.

Key changes:

- Removed the visible customer Home "Journal" eyebrow.
- Moved Rename and Lock into a small top-right settings menu.
- Lightened the Month Sheet paper panel.
- Restored themed leather context to Daily Memory Stamp detail.
- Made journal create/edit/view wrappers participate in the themed leather surface contract.
- Moved Scrap Finder through a portal to read as a dedicated screen instead of inline form content.
- Adjusted Scrap Finder viewport layout to reduce long-page behavior.
- Replaced create/edit Cover Scrap and additional moment preview frames with editorial photo frames.
- Preserved crop math, metadata shape, 9-image cap, one-day-one-stamp logic, and export generation.

## What Phase 7.1.2 Changed

Phase 7.1.2 targeted Create/Edit scrolling, date contrast, and Scrap Finder standalone presentation.

Key changes:

- Made `JournalMobileShell` the vertical scroll container.
- Added overflow contracts so journal create/edit content can extend inside the scrollable shell.
- Added bottom padding for sticky save controls.
- Scoped date label/value/icon rows to paper-safe tokens.
- Converted Scrap Finder into a full fixed overlay with a centered mobile surface on desktop.
- Locked document body scrolling while Scrap Finder is open.
- Preserved existing finder pan/zoom/crop math and metadata.
- Kept blue finder colors and old stamp-edge treatments out of app surfaces.

## Directionally Accepted Parts

The following Phase 7.1 family changes remain directionally accepted:

- Home / Month Sheet 3-column photo-first direction.
- Larger readable Cover Scrap tiles.
- Date below images.
- No date overlay.
- Leather as background identity on Home.
- Removing empty Month Sheet placeholder cells from the app layout.
- Moving Rename / Lock out of primary page content.
- Keeping voice memo removed.
- Preserving cover-first creation and the 9-image cap.
- Keeping Scrap Finder crop interaction and metadata semantics unchanged.

## Rejected Parts

The Phase 7.1.x patching process and parts of the resulting visual system are rejected for this reset:

- Visual system still feels too similar to the old UI.
- Paper surface still feels too heavy.
- Rename / Lock were still too visible for too long during patching.
- JOURNAL eyebrow was redundant.
- Daily Detail could lose leather texture and become a flat background.
- Scrap Finder became embedded / scroll-based instead of a true screen.
- Create/Edit scrolling broke.
- Date contrast broke on paper.
- Save/Cancel sticky behavior broke layout and covered content.
- Photo grids still had too many border/mat/frame layers.
- Create/edit photo previews still had perforated/stamp-like treatment.
- Production UI was being patched issue-by-issue without first establishing a stronger visual north star.

## Why Production Patching Is Paused

The issue is no longer a single broken component. The risk is that local fixes keep chasing symptoms while the overall visual target remains under-defined. That produces more churn in production customer routes, more regression risk, and a UI that is technically closer to the rules but still visually short of the product owner's premium/editorial expectation.

Phase 7R pauses this pattern. The next step is a local-only playground that can compare coherent Month Sheet directions before production implementation resumes.

## Phase 7R.0 Completion

This checkpoint is documentation-only. It does not modify production customer routes and does not touch database, auth, local_date, duplicate-day logic, texture upload/storage, Supabase policies, admin theme data model, export canvas generation, migrations, crop metadata, or the 9-image cap.
