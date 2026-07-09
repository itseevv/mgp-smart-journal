# Scrap the Day Implementation Phase 5A

## Summary

Phase 5A adds Daily Memory Stamp 9:16 static export.

Saved Daily Memory Stamp detail now has a subtle `Save / Share` action beside `Edit stamp`. It opens a mobile-first export composer with a scaled 9:16 preview, `Save Image`, optional `Share`, and friendly loading/error states.

The exported artifact is generated client-side as a 1080 x 1920 PNG from stamp data and private media URLs. It is not a screenshot of the app page.

## Files Changed

- `components/export/daily-stamp-export-composer.tsx`
- `components/memory/memory-icons.tsx`
- `components/stamp/daily-memory-stamp.tsx`
- `lib/export/daily-memory-stamp-export.ts`
- `public/brand/logo-square-mgp.jpeg`
- `tests/daily-stamp-export.test.mjs`
- `SCRAP_DAY_IMPLEMENTATION_PHASE_5A.md`

## Export Entry Point Behavior

- Saved journal detail shows a secondary `Save / Share` action.
- `Edit stamp` remains available and is not replaced.
- The action opens a dialog-style export composer.
- `/journal/demo?screen=detail&photos=1`
- `/journal/demo?screen=detail&photos=2`
- `/journal/demo?screen=detail&photos=9`

## Export Composer Behavior

- Title: `Save or share`.
- Preview: generated 9:16 PNG scaled to fit mobile screens.
- Primary action: `Save Image`.
- Secondary action: `Share`.
- Close button included.
- Loading state appears while canvas generation runs.
- Friendly error: `Couldn’t create the image. Please try again.`
- Unsupported file sharing shows: `Sharing isn’t supported here. You can save the image instead.`

The composer does not include a format selector, template selector, monthly export option, journal name, photo count, voice memo UI, or debug/demo controls.

## 9:16 Export Artifact Design

The PNG includes:

- Date label from semantic `localDate` when available.
- One-line normalized title.
- Crop-aware Daily Memory Stamp photo sheet.
- Warm paper mat.
- Current placeholder journal leather background theme.
- Small Modern Goddess Patina logo mark.

The PNG excludes:

- App buttons.
- Edit links.
- Journal name.
- `Private by nature.`
- Demo labels.
- Photo count.
- Voice memo content.
- Storage/debug text.
- `powered by`.
- `SD`.

## Canvas / Export Rendering Approach

- Renderer lives in `lib/export/daily-memory-stamp-export.ts`.
- Output is fixed at 1080 x 1920 PNG.
- Renderer accepts theme tokens and a brand mark config.
- Export uses canvas drawing from structured stamp data.
- It draws the leather background, date, title, paper mat, stamp-edge photo frames, and brand logo.
- It uses a single fixed 9:16 format; no format picker constants were added.

## Private Signed Media Handling

- The composer receives the existing `resolvePhotoUrl` function from saved stamp detail.
- For real journal routes, that resolver continues to use the existing private signed URL cache.
- The renderer fetches resolved URLs as blobs, creates object URLs, draws those into canvas, and revokes object URLs after export.
- Signed URLs are not displayed in the UI, included in filenames, or intentionally logged.

## Crop Metadata

- Export photo items preserve existing `PhotoCropMetadata`.
- Cover crop metadata is passed into the renderer.
- Missing crop metadata falls back to a safe center-square crop when dimensions are available.
- Additional photos use the same crop-aware path if metadata exists later; otherwise they center-crop into square stamp frames.

## Save / Download

- `Save Image` creates/downloads a PNG in the browser.
- Filename is safe and token-free: `scrap-the-day-YYYY-MM-DD.png`.
- No server-side export copy or storage path was added.

## Web Share

- `Share` uses the Web Share API with a PNG `File` when supported.
- If file sharing is unsupported, the composer shows the save-image fallback message.
- No Instagram, TikTok, Xiaohongshu, OAuth, public hosting, or social API integration was added.

## Brand Mark / MGP Logo

- Official logo asset provided by product owner was saved to:
  - `public/brand/logo-square-mgp.jpeg`
- Export renderer uses:
  - `/brand/logo-square-mgp.jpeg`
- The logo is only used in the exported artifact/preview, not as extra branding in the private app detail view.
- No fake `SD` mark or `powered by` text was added.

## Theme Placeholder Note

- The renderer accepts a `JournalTheme`.
- Current export uses `defaultJournalTheme`, matching the current placeholder app theme.
- Future admin-selected journal background assets should feed the same theme source used by app views and export.
- No admin theme/background selection or full visual redesign was implemented.

## Intentionally Not Implemented

- Monthly Sheet export.
- Year in Stamps.
- Video export.
- Format picker.
- Template picker.
- Social platform integrations.
- Server-side export storage.
- Admin theme selection.
- Full visual redesign.
- Phase 2B Additional Moments Adjust Scrap.
- New cropper work.
- Local-date DB changes.
- Supabase storage path changes.

## Verification

- `npm test` passed: 67 tests.
- `npm run lint` passed.
- `npm run build` passed outside sandbox.
- First sandbox build failed with the known Turbopack process/port `EPERM`; unsandboxed rerun passed.
- `npm run qa:journal:smoke -- http://127.0.0.1:3000` passed with local loopback access.
- `npm run qa:journal:mobile:smoke -- http://127.0.0.1:3000` passed at 390px using bundled Playwright and cached Chromium.
- Targeted 390px Playwright export composer probe passed:
  - opened `/journal/demo?screen=detail&photos=1`
  - clicked `Save / Share`
  - generated preview image at 1080 x 1920
  - confirmed preview ratio is 9:16
  - confirmed `Save Image` and `Share`
  - confirmed no horizontal overflow
- `git diff --check` passed.
- Stable dev server was stopped after QA.

## Manual QA Checklist

Use mobile viewport 390px or 393px.

Daily detail:

1. Open `/journal/demo?screen=detail&photos=1`.
2. Confirm `Save / Share` appears and `Edit stamp` remains.
3. Open the export composer.
4. Confirm preview is 9:16.
5. Confirm preview includes date, title, stamp image, and small MGP logo.
6. Confirm preview does not include journal name.
7. Confirm preview does not include `Private by nature.`
8. Confirm preview does not include app buttons/edit links.
9. Tap `Save Image`.
10. Confirm PNG is generated/downloaded.
11. Confirm filename is safe.
12. Tap `Share` if supported.
13. Confirm system share sheet opens, or fallback message appears.

Multi-photo:

1. Open `/journal/demo?screen=detail&photos=2`.
2. Open `/journal/demo?screen=detail&photos=9`.
3. Confirm multi-photo stamp exports.
4. Confirm stamp-edge frames render.
5. Confirm crop metadata is respected for cover.
6. Confirm no `SD` mark.

Mobile:

1. Test at 375px.
2. Test at 390px or 393px.
3. Test at 430px.
4. Confirm composer has no horizontal overflow.
5. Confirm buttons are reachable.

Private media:

1. Test a real `/c/[publicToken]/m/[memoryId]` if available.
2. Confirm export works with signed private media.
3. Confirm no raw storage paths or signed URLs are displayed.

## Known Limitations

- Real Supabase-backed signed-media export was not manually tested in this workspace.
- Mobile browser download behavior varies by platform; Web Share is provided as the preferred mobile path where file sharing is supported.
- The current export visual system uses the existing placeholder journal theme.
- The logo is the square brand image provided for this patch; final export sizing/placement may be tuned during the later visual system redesign.

## Recommended Next Patch

Phase 5B: Monthly Sheet 9:16 export.

Alternate next patch: visual system redesign, if product priority shifts to final material/brand polish before monthly export.
