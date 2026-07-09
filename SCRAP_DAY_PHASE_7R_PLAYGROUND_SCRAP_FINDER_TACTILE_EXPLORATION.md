# Scrap Day Phase 7R.PG.2 / 7R.5D Scrap Finder Tactile Exploration

## Scope

This is a design-playground-only exploration for `/design/scrap-day-v2`.

It does not modify production Scrap Finder behavior or layout. Production remains on the accepted Phase 7R.5B / 7R.5C dedicated finder.

## Variants

The playground now shows:

- Base current accepted finder: reference only.
- Subtle bottom press detail: recommended playground candidate.
- Even lighter whisper lip: comparison only.

The variants are shown on:

- Wine red leather
- Ivory leather

## Design Rationale

The bottom press detail works best when it reads as a small underside cue rather than a handle, knob, or separate component. It gives the finder a faint ritual/tool memory without returning to the old blue plastic or postage-edge language.

Subtle bottom press detail is the recommended playground candidate because it is visible enough to test the physical-tool memory while remaining centered, small, brand-toned, and non-interactive.

The whisper lip is safer if the stronger tab still feels too visible; it preserves the idea while staying closer to the current accepted finder. It is not the primary version because it may be too invisible to justify shipping.

Neither tactile detail should move to production without explicit product-owner approval after visual review with real photos.

## Risks

- It may become decorative clutter.
- It may imply interaction.
- It may be invisible on some themes.
- It may feel too hardware-like if too strong.

## Recommendation

Keep this tactile press detail playground-only until product-owner localhost QC accepts it.

do not ship to production yet.

## Production Boundary

Production code must not include the tactile press detail in this phase.

The production Scrap Finder remains governed by Phase 7R.5B / 7R.5C acceptance:

- dedicated finder screen
- selected leather theme background
- borderless photo aperture
- no postage edges
- no blue plastic
- no technical cropper dimensions
- unchanged crop math

## Files Changed

- `app/design/scrap-day-v2/scrap-day-v2-playground.tsx`
- `tests/journal-form-regression.test.mjs`
- `SCRAP_DAY_PHASE_7R_PLAYGROUND_SCRAP_FINDER_TACTILE_EXPLORATION.md`

## Verification

- Covered by regression guard that the tactile press variants exist only in the playground.
- Covered by production guard that `components/scrap/scrap-table.tsx` does not include the tactile press detail.
