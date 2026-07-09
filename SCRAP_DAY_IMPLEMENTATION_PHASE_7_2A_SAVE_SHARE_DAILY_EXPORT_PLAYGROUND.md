# Scrap Day Phase 7.2A - Save/Share + Daily Export Artifact Playground

## Scope

Phase 7.2A adds a playground-only review route for:

- Save / Share modal chrome
- Daily 9:16 export artifact composition

This phase does not change production Save / Share behavior or the export
renderer.

## Playground Route

- `/design/daily-export-v2`
- Route marker: `data-daily-export-v2-playground="true"`
- Production guard marker: `data-daily-export-v2-non-production="true"`

## Save / Share Candidates

- Simple title: `Save or share`
- Close button
- Prominent 9:16 export preview
- `Save Image` primary action
- `Share` secondary action
- Ready and loading states
- No journal identity header in the modal chrome
- No journal name in the modal chrome outside the export preview

## Daily Export Candidates

- The artifact mirrors the accepted Daily Memory Stamp view rather than a
  separate poster template.
- Full 9:16 leather texture background.
- Journal shell title at the top.
- Translucent Daily Detail-style overlay.
- Date, one-line title, and borderless square photo grid.
- Photo cases: 1, 2, 5, and 9 photos.
- Theme cases: wine leather and ivory leather.
- Transparent MGP maker's mark near the bottom.
- No old square logo treatment, marketing copy, format picker, or UI buttons
  inside the generated image.

## Explicit Non-Goals

- No production Save / Share modal implementation.
- No export canvas or renderer changes.
- No copy inventory implementation.
- No monthly export implementation.
- No database, auth, local_date, duplicate-day, upload/storage, or migration changes.
- No changes to the accepted Phase 7R production app visual checkpoint.

## Next Gate

Product review should approve the modal chrome and Daily Memory Stamp-style
artifact before Phase 7.2B production implementation.
