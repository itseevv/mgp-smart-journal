# Backlog: Phase 2B - Additional Moments Optional Adjust Scrap

**Status:** Deferred / Backlog
**Priority:** P1 after Phase 3 one-day-one-stamp integrity, unless product owner prioritizes full image-control UX first
**Owner:** Product + Engineering
**Related phases:** Phase 2 / Phase 2A Scrap Table, Phase 3 local date integrity
**Do not implement as part of Phase 3. This document is for project tracking.**

---

## 1. Product Context

The current product direction is **Scrap the Day / Seal the Day**.

The core creation ritual is:

1. The user names the day with **One line to keep**.
2. The user selects a required **Cover Scrap**.
3. The Cover Scrap automatically enters the **Scrap Table / Finder Tool**.
4. The user adjusts the square crop and confirms the scrap.
5. The user may seal the day with only the Cover Scrap.
6. The user may optionally add up to 8 more moments.

Current implemented behavior:

- Cover photo automatically enters Scrap Table.
- Cover crop is persisted through crop metadata.
- Additional moments are optional.
- Additional moments currently use automatic square stamp display crop.
- Additional moments do **not** yet support manual "Adjust scrap."

This backlog item adds optional manual crop adjustment for additional moments.

---

## 2. Product Decision

**Cover Scrap:**
The required first image. It automatically opens the Scrap Table after upload.

**Additional moments:**
Optional supporting images. They should **not** automatically open the Scrap Table after upload. The user should not feel forced to crop every image.

However, every additional moment should be adjustable if the user wants control.

The product rule is:

> Additional moments are auto-scrapped by default, but each can optionally be adjusted through the same Scrap Table.

---

## 3. Why This Matters

This preserves the low-effort daily ritual while still giving aesthetic control to users who care.

Without this:

- Additional moments may crop poorly in square stamp frames.
- Users may feel the Cover Scrap is polished but supporting photos are arbitrary.
- The final Memory Stamp may feel less curated.

With this:

- The core path stays lightweight.
- Power users can fine-tune every photo.
- The same Scrap Table metaphor applies consistently across all moments.

---

## 4. Scope

Implement optional manual Adjust Scrap for additional moments.

### In Scope

- Add an "Adjust scrap" affordance to additional moment thumbnails in edit/sealing mode.
- Reuse the existing Scrap Table / Finder Tool component.
- Allow crop metadata to be saved per additional photo.
- Keep auto square display crop as the default for additional moments without crop metadata.
- Keep fullscreen viewer showing original full photo.
- Preserve max 9 total images: 1 cover + 8 additional moments.
- Preserve no-voice-memo journal UX.
- Preserve mobile-first behavior.

### Out of Scope

- Do not force additional moments through Scrap Table.
- Do not redesign the saved Memory Stamp layout.
- Do not change one-day-one-stamp logic.
- Do not implement share/export.
- Do not implement Year in Stamps.
- Do not add new media types.
- Do not add filters, stickers, templates, AI, OCR, video, or Live Photo support.

---

## 5. UX Requirements

### 5.1 Uploading Additional Moments

After the Cover Scrap is confirmed, the sealing page shows:

- **Add more moments (optional)**
- Helper: **Up to 8 more moments.**

When the user uploads additional photos:

- Photos appear as additional moment thumbnails.
- Each thumbnail uses the existing stamp-edge visual frame.
- Each thumbnail uses an automatic square display crop by default.
- The user is not sent into Scrap Table automatically.

### 5.2 Adjusting an Additional Moment

Each additional moment should expose a lightweight action.

Possible UI:

- Tap thumbnail to open action sheet / inline menu.
- Visible small link/button: **Adjust scrap**.
- Overflow menu with **Adjust scrap**, **Replace**, **Remove**.

Preferred copy:

- **Adjust scrap**

Avoid copy like:

- Crop image
- Edit photo
- Adjust aspect ratio
- Template
- Collage

### 5.3 Scrap Table Behavior for Additional Moments

When the user selects **Adjust scrap**:

- Open the same immersive Scrap Table.
- Use the selected additional photo.
- If crop metadata exists, initialize Scrap Table to the saved crop.
- If crop metadata does not exist, initialize to center square crop.
- User can pan/zoom under the fixed finder.
- User confirms with **Use this scrap**.
- Return to the sealing/edit page.
- The additional thumbnail updates to the selected crop.

### 5.4 Saved Memory Stamp Behavior

In the saved Daily Memory Stamp:

- Cover uses cover crop metadata.
- Additional moments use their own crop metadata if present.
- Additional moments without metadata use default center square display crop.
- Fullscreen viewer always opens original full image.
- No visible crop controls in polished saved detail.

---

## 6. Data Requirements

Re-use the existing crop metadata model introduced for Cover Scrap.

Expected behavior:

- `photos.crop_metadata` can exist for any photo, not only cover.
- Metadata should remain nullable.
- Existing photos without crop metadata remain valid.
- The same `PhotoCropMetadata` shape can be used:
  - `kind`
  - `aspectRatio`
  - normalized crop rect
  - original image width / height
  - createdAt / updatedAt if supported

Recommended update:

- Allow `kind` values such as:
  - `cover-scrap`
  - `moment-scrap`

If current implementation only supports `cover-scrap`, extend safely without breaking existing records.

Do not add a new migration if `crop_metadata` already exists.

---

## 7. Component / Code Areas To Inspect

Likely files:

- `components/scrap/*`
- `components/memory/memory-form.tsx`
- `components/memory/photo-picker.tsx`
- `components/memory/sortable-photo-grid.tsx`
- `components/stamp/*`
- `components/journal/journal-memory-page.tsx`
- `components/journal/journal-demo-flow.tsx`
- `lib/scrap/crop-math.ts`
- `lib/capsule/api.ts`
- `data/memory-demo.ts`
- `data/journal-product.ts`
- `tests/*.test.mjs`
- `scripts/qa-journal-route.mjs`

Adapt based on actual repo structure.

---

## 8. Acceptance Criteria

### Creation/Edit Flow

- Cover still automatically opens Scrap Table after upload.
- Additional moments do not automatically open Scrap Table.
- Additional moment thumbnails show an "Adjust scrap" affordance.
- Tapping "Adjust scrap" opens Scrap Table for that specific photo.
- Confirming returns to the sealing page.
- Crop persists after saving.
- User can still seal without adjusting additional moments.

### Saved Detail

- Additional crop metadata is reflected in the saved Memory Stamp.
- Fullscreen viewer still shows the original full image.
- Polished saved detail does not show crop controls.

### Limits

- 9 total images max remains enforced.
- Additional moments max remains 8.
- Voice memo UI remains hidden.

### Regression

- Cover Scrap flow still works.
- Scrap Table remains mobile-first.
- Scrap Table image is not distorted.
- Stamp-edge frame remains visible.
- No SD mark returns.

---

## 9. QA Checklist

Use mobile viewport 390px or 393px.

1. Open `/journal/demo?screen=create`.
2. Add a Cover Scrap.
3. Confirm Scrap Table opens automatically for cover.
4. Confirm cover crop returns to sealing page.
5. Add two additional moments.
6. Confirm no automatic Scrap Table opens for additional moments.
7. Tap an additional moment.
8. Confirm "Adjust scrap" is available.
9. Open Scrap Table for that additional moment.
10. Adjust crop and confirm.
11. Confirm thumbnail updates.
12. Save stamp.
13. Open saved detail.
14. Confirm adjusted additional crop appears.
15. Tap additional image.
16. Confirm fullscreen viewer shows original full photo.
17. Edit stamp again.
18. Confirm existing additional crop can be adjusted again.
19. Try adding a 10th image and confirm blocked.
20. Confirm no voice memo UI.

---

## 10. Tests To Add

At minimum:

1. Additional moments do not auto-open Scrap Table after upload.
2. Additional moment has an Adjust Scrap affordance.
3. Adjust Scrap opens Scrap Table with the correct photo id.
4. Confirming crop updates that additional photo's crop metadata.
5. Save payload includes crop metadata for additional moments.
6. Load mapping preserves crop metadata for additional moments.
7. Saved stamp uses crop metadata for additional moments.
8. Fullscreen viewer uses original photo.
9. Total max remains 9.
10. Voice memo remains disabled.

---

## 11. Suggested Implementation Strategy

1. Refactor Scrap Table invocation so it can accept any photo, not only cover.
2. Add a selected-photo context/state:
   - `targetPhotoId`
   - `targetRole`: `cover` or `additional`
3. If `targetRole === cover`, preserve existing cover behavior.
4. If `targetRole === additional`, update only that photo's crop metadata.
5. Add UI affordance for additional moments.
6. Update save/load mapping.
7. Add tests and QA script coverage.

---

## 12. Project Management Notes

Recommended priority:

- Do after Phase 3 one-day-one-stamp integrity unless product owner decides image-control polish is more urgent.

Reason for deferral:

- Cover Scrap is the core ritual.
- Additional moment crop is a power-user enhancement.
- The system should first guarantee that each day maps to one Daily Memory Stamp.

Tracking label suggestion:

- `phase-2b`
- `backlog`
- `ux-enhancement`
- `crop-metadata`
- `additional-moments`
