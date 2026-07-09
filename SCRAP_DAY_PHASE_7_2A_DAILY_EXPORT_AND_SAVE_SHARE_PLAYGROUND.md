# Scrap Day Phase 7.2A - Daily Export And Save/Share Playground

## Playground Refinement Note

- Save/Share modal preview now uses proportional artifact scaling, so the mini preview behaves like one complete Daily Memory Stamp export image.
- Ready state copy was simplified by removing the extra `Image ready.` status line.
- Loading state was simplified to a quiet one-line `Creating image...` message on the leather preview surface, without an inner overlay card or duplicate status line.
- The full transparent Modern Goddess Patina logo lockup with text replaces the symbol-only mark in the export artifact playground.
- Artifact-only playground examples remain full showcase size; only the modal preview uses proportional miniaturization.

## Production Boundary

The accepted playground direction is now the source of truth for production Save/Share modal chrome and Daily Export artifact styling. Month Sheet, Create/Edit, Scrap Finder, database/auth/local-date logic, crop math, storage, migrations, and the 9-image cap remain out of scope.

## Phase 7.2A.2 Production Parity Note

- Modal preview must be a proportional miniature of the same generated export artifact, not a separate DOM recreation that can drift.
- The production modal preview now displays the actual generated blob image with a 9:16 aspect ratio and `object-fit: contain`.
- The actual export artifact uses dedicated 1080x1920 export-specific scale tokens for journal name, date, title, overlay, grid gap, and logo sizing.
- Downloaded PNG proportions were corrected so journal name/date/title are no longer directly scaled from app CSS into the export canvas.
- Hard reuse of app-view CSS pixel sizes caused the disproportional export and is avoided in the canvas renderer.
- Canvas text rendering now quotes multi-word font families and uses the Daily Memory Stamp utility font stack for the date, preventing the date from inheriting the larger display font.
- The full transparent Modern Goddess Patina logo lockup with text is used for the export maker's mark; icon-only and old opaque square logos remain out of the export artifact.
