# Scrap Day Phase 7R.1 Design Skill Exploration

## Status

Phase 7R.1 creates a visual north-star playground for Journal Home / Month Sheet only.

Local route:

- `/design/scrap-day-v2`

The playground uses hardcoded sample data, local demo imagery, and local leather texture assets. It does not use Supabase, does not implement real create/edit/save/export behavior, and does not replace production customer routes.

## Design Skill Notes

The UI/UX design skill was used for mobile-first layout, accessibility, touch targets, contrast, restrained interaction states, and responsive testing expectations.

One generic recommendation from the tool, liquid-glass/app-store styling, was not adopted because it conflicts with the product owner's locked direction. Scrap Day should not read as a tech app, dashboard, app-store landing page, or generic modern glass UI. The useful guidance retained for this playground is:

- mobile-first app frame
- 44px touch targets for controls
- adequate contrast on dark and light leather
- no horizontal scroll in the phone surface
- stable square image dimensions
- semantic buttons and labels
- restrained effects and shadows

## Playground Contents

The route includes:

- three visual directions
- 9:16 mobile app frames
- 12 sealed sample days per Month Sheet
- one square Cover Scrap per sealed day
- 3-column mobile grid
- date captions below images in 01 format
- no empty placeholders
- no future slots
- no date overlays
- no photo headlines
- no postage/perforated/stamp-edge frames
- no decorative borders or thick mats around photos
- small journal name
- small Seal Today pill in the upper-right area
- settings icon instead of visible Rename / Lock content
- quiet Month Sheet title and navigation
- leather texture visible behind the paper/content surface
- theme switching across dark brown, wine red, ivory, black, cognac, forest, teal, and burgundy
- paired dark/light compatibility preview for each direction

## Direction A: Minimal Editorial Archive

### Visual Concept

Direction A is the quietest version. The leather texture is visible, the paper surface is almost absent, and the photo grid dominates the first read.

### Preserved Locked Decisions

- 3-column mobile grid.
- Only sealed days.
- Square Cover Scrap tiles.
- Date captions below photos.
- No overlays, headlines, placeholders, decorative frames, or stamp edges.
- Small journal title and small Seal Today action.
- Rename / Lock absent from primary content.

### Hierarchy

Photos are the dominant layer. The journal name, Month Sheet label, and navigation exist but stay visually subordinate.

### Material Layers

Leather is the primary identity layer. Paper is only a faint veil behind the Month Sheet content.

### Typography

Editorial serif for journal/month titles. Interface sans for small labels, controls, and dates.

### Spacing System

Tight grid gaps and compact surface padding. The app shell keeps enough leather margin to establish journal identity without shrinking photos too far.

### Photo Treatment

No frame, no mat, no decorative border, no date overlay. The sample photos form the composition.

### Header/Action Treatment

Seal Today is a small pill. Settings are represented by an icon-only menu trigger. No visible Rename / Lock.

### Paper/Leather Relationship

This direction shows the most leather and least paper. It feels closest to a photo archive embedded directly in the journal.

### Theme Compatibility Notes

Works well on dark leather. On ivory, the paper veil can become too subtle and the grid can feel less intentionally placed.

### Removed Or Reduced Current UI Elements

- Heavy paper panel.
- Visible utility actions.
- Count/status copy.
- Decorative photo edges.

### Risks / Tradeoffs

It may feel a little too spare for users who expect a clear "sheet" object inside the journal.

## Direction B: Tactile Journal Insert

### Visual Concept

Direction B treats Month Sheet as a light physical insert resting on the leather. It is more tactile than A but keeps photos dominant.

### Preserved Locked Decisions

- 3-column sealed-day grid.
- Date below each image.
- No overlays, placeholders, headlines, stamp edges, or decorative photo borders.
- Small journal name and small Seal Today pill.
- Rename / Lock hidden from main content.

### Hierarchy

Photos remain first, but the paper insert has a more noticeable presence.

### Material Layers

Leather background, translucent paper surface, photo grid, then quiet type/actions.

### Typography

Same serif/sans split as A. Slightly stronger Month Sheet hierarchy because the paper surface is more legible.

### Spacing System

Similar tight grid with a touch more surface separation. Still avoids a heavy card feeling.

### Photo Treatment

Photos are clean square crops with no extra frame or mat.

### Header/Action Treatment

Header remains compact. Seal Today and navigation controls use neutral theme-safe treatments.

### Paper/Leather Relationship

The paper layer is more explicit. It better signals a journal insert but risks becoming too card-like if pushed further.

### Theme Compatibility Notes

Most robust across ivory and dark leather because paper/text contrast is easiest to control. Needs restraint to avoid returning to the heavy cream-card feeling.

### Removed Or Reduced Current UI Elements

- Explanatory copy.
- Primary Rename / Lock links.
- Old photo mat/frame layers.
- Giant central action blocks.

### Risks / Tradeoffs

Can drift back toward the rejected heavy paper surface if shadow, opacity, or padding increase.

## Direction C: Refined Hybrid

### Visual Concept

Direction C combines A's editorial restraint with B's tactile journal identity. It keeps the paper light, the photos dominant, and the leather visibly tied to the physical journal.

### Preserved Locked Decisions

- 3-column mobile grid.
- One sealed day equals one square Cover Scrap.
- Only sealed days are shown.
- Date captions below images in 01 format.
- No date overlays.
- No placeholders or future slots.
- No photo headlines.
- No postage/perforated/stamp-edge frames.
- No decorative borders or thick mats around photos.
- Small journal name.
- Small Seal Today pill.
- Rename / Lock not visible as main content.
- Quiet month title/navigation.
- Visible leather texture.
- Very light paper/content surface.

### Hierarchy

Photos are the first read. Journal identity is the second read. Controls are present but quiet.

### Material Layers

Neutral desktop matte outside the app, leather inside the phone shell, light paper surface for the Month Sheet, square photos as the primary content, then small captions and controls.

### Typography

Editorial serif carries journal/month identity. Sans serif handles operational UI. The type scale stays compact inside the mobile frame.

### Spacing System

Tight image gaps, compact header, and a light paper inset that avoids excessive dead space. Photos remain large enough to read as daily-life images.

### Photo Treatment

Clean square crops, no border, no mat, no overlay, no stamp-edge language. The photos themselves create the visual composition.

### Header/Action Treatment

Small journal name, small Seal Today pill, small settings icon, quiet month navigation. No Rename / Lock clutter and no large central CTA.

### Paper/Leather Relationship

The paper surface is visible enough to read as a journal sheet but light enough that it does not compete with the photo grid. Leather remains visible around the sheet on both dark and light themes.

### Theme Compatibility Notes

This direction holds best across dark brown, wine/burgundy, and ivory. It also gives forest, teal, cognac, and black enough contrast without hardcoded blue or one-theme assumptions.

### Removed Or Reduced Current UI Elements

- Heavy paper card treatment.
- Visible Rename / Lock page content.
- Redundant JOURNAL eyebrow.
- Count/status explanation copy.
- Old photo border/mat/frame layers.
- Central giant Seal Today block.

### Risks / Tradeoffs

It still needs production validation with real private thumbnails, varied crop metadata, and all journal theme assets before it becomes the implemented visual system.

## Original Exploration Recommendation

Direction C was the original exploration recommendation before product-owner review.

It best answers the product owner's questions:

- The Month Sheet reads as a premium editorial memory archive.
- Photos are clearly the hero.
- Leather texture feels like journal identity without overpowering the grid.
- The surface feels quiet and premium rather than dashboard-like.
- Paper is light enough to avoid the rejected heavy-card feeling.
- There are no obvious decorative frames, mats, borders, placeholders, or old stamp-edge patterns.

Direction A is useful as the restraint boundary. Direction B is useful as the tactile boundary. Direction C is the better launch candidate because it balances both.

## Product Owner Selection

Selected direction: Direction B — Tactile Journal Insert.

The product owner selected Direction B because it has the best leather/paper contrast, the paper sheet feels like a comfortable journal insert, and the material system is tactile without becoming a childish scrapbook treatment. Direction B remains photo-first and is the best fit for the premium editorial memory archive direction.

This selection supersedes the original exploration recommendation. The next step is to continue Direction B variant review in the design playground before production implementation.

Before production adoption, Phase 7R.2 / 7R.3 now continues as a playground-only Month Sheet variant review. Production customer routes remain out of scope until the product owner visually reviews the next set of Direction B variants.

## Phase 7R.2 / 7R.3 Direction B Month Sheet Variant Iteration

Scope:

- Update `/design/scrap-day-v2` only.
- Do not change `/c/[publicToken]`.
- Do not change `/journal/demo?screen=home`.
- Continue from Direction B rather than redesigning from scratch.
- Remove the "MONTH SHEET" copy from every in-frame Month Sheet.
- Remove date captions below photos except where the variant tests date-on-photo.
- Keep realistic daily-life sample imagery and a populated month grid.

### Variant 1: Direction B, Date Removed

Reasoning:

- Keeps the selected leather/paper contrast almost intact.
- Removes the visible "MONTH SHEET" label and date captions below each tile.
- Tightens the grid spacing so the photos feel a little larger and more even.

Tradeoff:

- Safest continuation of Direction B, but it still carries the heaviest paper-sheet presence of the four variants.

### Variant 2: No Date, No Paper Sheet

Reasoning:

- Tests a two-layer system: leather background plus photo grid and month navigation.
- Removes the middle paper object entirely to see whether the screen becomes cleaner and more photo-first.
- Maximizes visual space for the Cover Scrap grid.

Tradeoff:

- Strongest for photo dominance, but may lose the comfortable journal-insert feeling that made Direction B preferable.

### Variant 3: Ultra-Light Transparent Month-Sheet Overlay

Reasoning:

- Preserves a soft insert feeling without the full paper-card weight.
- Uses a sheer grey-gauze overlay with lower padding and smaller gaps.
- Lets the Cover Scraps become significantly larger while keeping the leather/paper contrast visible.
- Includes an ivory compatibility frame because this seems the most promising transparent-overlay direction.

Tradeoff:

- Best balance of tactile softness and photo emphasis, but the overlay must remain legible across all leather themes.

### Variant 4: Transparent Overlay With Date On Photo

Reasoning:

- Starts from Variant 3.
- Keeps the transparent overlay and removes date captions below photos.
- Places a small white date directly on the top-left of each photo with no filled label background.

Tradeoff:

- Restores day context while preserving grid density, but the date may interrupt quiet photo reading if it becomes too noticeable.

### Key Tradeoffs To Review

- Date removed vs date on image: removing dates gives the calmest archive read and lets photos carry the grid; date-on-image restores temporal scanning without adding a caption row, but risks adding visual noise over the image.
- No paper vs transparent overlay: removing paper makes the layout cleanest and largest, but weakens the tactile journal insert metaphor; the ultra-light overlay keeps a soft sheet memory while avoiding the heavy card feeling.
- Photo size and emphasis: Variant 2 and Variant 3 create the strongest photo emphasis. Variant 1 is more conservative. Variant 4 keeps Variant 3's size while adding a subtle date layer.

### Provisional Strongest Variant

Variant 3 currently seems strongest because it keeps the product owner's preferred leather/paper comfort while reducing the middle layer enough for the photos to become the clear hero. It should not be collapsed into production yet; the product owner should visually compare all four variants first.

### Product Owner Refinement: Wine Red Transparent Overlay With Date On Photo

The product owner identified the wine red transparent-overlay/date-on-photo direction as closest so far. The overall layout, photo emphasis, transparent overlay direction, and date-on-photo treatment are directionally good and should not restart from scratch.

Requested playground-only refinements:

- Make `Margot's Journal` feel like subtle leather debossing / blind embossing rather than white title text.
- Remove the transparent overlay's visible border, white edge, and inset line so it reads as sheer mist / grey gauze instead of a paper card.

### Product Owner Refinement: Stronger Deboss, Theme Contrast, Bottom CTA Variant

The product owner confirmed the current wine red transparent-overlay/date-on-photo direction is closest so far, but requested further refinement before production adoption.

Requested playground-only refinements:

- Make the journal name read more like true leather blind debossing, with layered shallow highlight/shadow depth rather than flat dark text.
- Let the `August 2026` month title vary by leather theme: light/ivory text on dark or saturated leather, dark ink on ivory leather.
- Add a new comparison variant that keeps the same transparent overlay, large 3-column photo grid, and date-on-photo treatment, but moves `Seal Today` to a sticky bottom CTA and centers the debossed journal name in the top leather area.

Bottom CTA variant tradeoffs:

- Cleaner top area because the main action no longer competes with journal identity or month navigation.
- Potentially stronger primary action because `Seal Today` stays visible at the bottom of the phone frame.
- Risk that a persistent bottom CTA feels too app-like or intrusive for the quiet luxury journal tone.
- Risk/benefit relative to photo prominence: it may improve header calm, but must not cover or visually crush the photo grid.

### Brand Guideline Alignment Pass

The latest playground pass uses the Modern Goddess Patina brand guideline as the visual source of truth and keeps the bottom sticky CTA direction as the preferred Month Sheet concept.

Brand palette used:

- Deep Burgundy `#421819` as the anchor field and primary CTA color on light leather.
- Champagne Peach `#E4B48F` as the refined identity accent on dark leather.
- Vintage Blush `#B28C7B` as the sheer overlay tint.
- Warm Ivory `#E8DBCC` for high-contrast month type and calm CTA surfaces on dark leather.
- Cocoa Taupe `#62453A` for tactile depth and documentation-level production handoff guidance.

Typography system tested:

- Display stack: `Cormorant Garamond`, `Bodoni Moda`, `DM Serif Display`, `Georgia`, `serif`.
- Utility stack: `Inter`, `Aptos`, `Source Sans 3`, `system-ui`, `sans-serif`.
- No external fonts were added; this remains a visual direction test, not final font licensing.

Fake deboss was rejected because the attempted blind-emboss simulation looked muddy and bug-like in the small mobile header. The journal title is now a simple quiet editorial identity mark: smaller than the month title, centered in the leather header, and colored with theme-aware brand tones rather than shadows, bevels, glow, or fake leather depth.

Month title contrast:

- Dark and saturated leather uses Warm Ivory for `August 2026`.
- Ivory leather uses Deep Burgundy.
- The month remains the primary typographic moment above the grid.

CTA color:

- Dark leather uses a Warm Ivory ritual button with Deep Burgundy text.
- Ivory leather uses a Deep Burgundy button with Warm Ivory text.
- Shadows are kept soft so the CTA feels tactile but not like an app-store sales button.

Overlay color:

- The transparent overlay now uses Vintage Blush, Warm Ivory, Champagne Peach, and Cocoa Taupe tints.
- There is no visible border, outline, or inset line.
- The overlay is intended to read as sheer editorial mist, not a grey glass panel or heavy paper card.

Compatibility notes:

- Wine / burgundy leather: strongest brand fit; Champagne Peach journal identity and Warm Ivory month title feel warm and editorial.
- Black leather: month contrast is strong; Warm Ivory CTA keeps the screen from feeling technical.
- Teal / green leather: brand palette still warms the cooler leather and avoids random blue UI.
- Ivory leather: Deep Burgundy title and CTA preserve brand anchoring without flat black.

Remaining risks before production implementation:

- Final font availability and licensing must be settled before production.
- Brand color tokens should be standardized instead of staying inline in the playground.
- Real customer thumbnails may change the perceived density and CTA overlap risk.
- The bottom CTA must be tested in real scrolling production context before adoption.

### Production Typography / Palette Handoff Notes

Future production implementation should standardize:

- display serif
- utility sans
- brand color tokens
- theme-aware contrast tokens
- CTA colors
- overlay colors
- photo grid spacing

Do not implement those globally until the product owner accepts the playground direction.

## Future Implementation Plan

### Phase 7R.2: Product Owner Review

Product owner reviewed `/design/scrap-day-v2` and locked Direction B — Tactile Journal Insert as the Month Sheet north star.

Product owner selected the bottom sticky CTA version for production Month Sheet implementation. Header logo was considered and rejected for this surface; the Month Sheet header should show only the quiet journal title plus the settings control. Faux deboss was also rejected because it read as muddy and bug-like at mobile header scale. The final journal title direction is a quiet serif identity, not fake deboss. Date-on-photo treatment is selected for Month Sheet production and supersedes the earlier date-below experiment for this surface only.

Production implementation is limited to Journal Home / Month Sheet first:

- `/c/[publicToken]` journal home
- `/journal/demo?screen=home`
- shared Month Sheet / Journal Home components used by those routes

Daily Memory Stamp Detail, Create/Edit, Scrap Finder, exports, admin, auth, database, texture storage, and duplicate-day logic remain deferred.

### Phase 7R.3: Implement Chosen Month Sheet Direction

After product-owner review of the four Direction B variants, implement the accepted Month Sheet treatment in production for Journal Home / Month Sheet only.

Extract minimal shared components only as needed:

- `JournalMobileShell` refinement
- `JournalIdentityHeader`
- `PaperSurface` / `PaperPanel`
- `PhotoGrid`
- `PhotoTile`
- `MonthSheet`
- `MonthTile`
- `RitualButton`
- `TextLink` / `IconButton`

Do not over-abstract before visual acceptance.

### Phase 7R.4: Apply To Daily Memory Stamp Detail

Apply the accepted visual system to Daily detail:

- Phase 7R.4 applies selected Month Sheet visual system to Daily Detail.
- Daily Detail should inherit brand-guided typography, lightweight overlay, borderless photo-first grid.
- Export remains deferred.
- adaptive photo grid
- no borders/mats/frames
- leather background preserved
- actions de-emphasized
- fullscreen original photo viewer unchanged

### Phase 7R.5: Apply To Create/Edit And Scrap Finder

Apply the accepted system to Create/Edit and Scrap Finder:

- Create/Edit should use a form-specific translucent overlay, not the old heavy cream card.
- Fullscreen photo viewer should remain immersive and not constrained inside the journal shell.
- Sticky bottom CTA is accepted for Month Sheet only, not Create/Edit.
- stable scrolling
- dedicated Scrap Finder screen
- Scrap Finder uses the accepted visual system.
- Scrap Finder remains a dedicated ritual step, not an inline cropper.
- Scrap Finder uses the selected leather theme background.
- Scrap Finder avoids blue plastic, postage edges, and technical image dimensions.
- Create/Edit overlay must remain theme-aware across leather colors.
- clean Cover Scrap preview
- clean additional moment thumbnails
- normal in-flow Save/Cancel unless sticky behavior is solved later
- crop math and metadata unchanged

### Phase 7R.5D: Month Sheet Stable Stage + Scrap Finder Playground Refinement

Stage A keeps the accepted visual direction and applies one production refinement to Month Sheet only: the translucent overlay now behaves like a stable editorial stage with a responsive minimum height. It still grows naturally, renders only actual sealed days, preserves local_date ordering, keeps the accepted 3-column grid, keeps date-on-photo markers, and does not introduce placeholders, empty calendar gaps, or forced 31-day slots.

The Scrap Finder tactile direction remains playground-only. Subtle bottom press detail is the preferred playground candidate because it adds a small ritual-tool cue without returning to blue plastic, postage edges, or heavy hardware. The base current finder stays as the accepted production reference, and the whisper lip remains only a comparison in case the press detail is still too visible.

Production Scrap Finder must not ship the tactile press detail until the product owner explicitly accepts it after localhost review. The next gated step after Stage A acceptance is Phase 7R Preview Refresh for the existing Vercel preview.

### Phase 7R.5F: Final Mobile Refinement + Backfill CTA Playground

Track A applies the final production mobile polish. Daily Detail now uses the same horizontal density system as Month Sheet while preserving content-driven height, the Scrap Finder Zoom control is grouped with the finder/photo area instead of the action buttons, and the empty Month state uses brand/theme color tokens without changing copy.

Track B is playground-only. The product owner is testing journal-identity-primary typography hierarchy, where the journal name becomes the primary identity text and the month title becomes secondary. Production homepage typography remains unchanged until this is approved.

The product owner is also testing bottom CTA / backfill action models in the playground:

- current single CTA behavior
- compact bottom action tray
- plus / add-day affordance

Empty-state action path needs design decision before production behavior changes. The playground now shows empty Month state variants alongside the CTA models, but production copy and behavior remain unchanged.

Copy will be finalized later through Phase 7R.6A Copy Inventory.

### Phase 7R.5G: Journal Shell Consistency + CTA Action Tray Playground

Journal identity shell header belongs to browsing/artifact/archive surfaces:

- Month Sheet
- Daily Memory Stamp View
- future generated Daily Export image/canvas artifact

It should not appear on Create/Edit, Scrap Finder, Save/Share modal chrome, or fullscreen viewer. Those surfaces are action/task utilities, and extra journal identity hierarchy would slow the user's immediate task.

Save/Share modal is a utility/action surface and should not receive the journal identity shell header. Future Phase 7.2 Export Redesign should include journal name inside the generated 9:16 export artifact, not in the modal chrome.

The product owner is testing a balanced journal-name/month-title hierarchy after the prior journal-identity-primary pass overcorrected. The new playground variants test current reference, balanced identity, and a slightly stronger identity while keeping the journal name aligned with the top-right More control.

The product owner is testing a `Seal the Day` bottom CTA tray for Today's Stamp / Seal Today / Seal Another Day. CTA tray is not yet production-approved and must remain playground-only until selected.

Copy will be finalized later through Phase 7R.6A Copy Inventory.

### Phase 7R.5H: Home CTA / Typography Production + Daily Detail Action Layout Playground

Variant C typography hierarchy was selected for production Home / Month Sheet. The journal name is now more present than the earlier quiet production reference, but it remains aligned with the top-right settings control and should not overpower the Month title.

The bottom CTA default label changed to `Seal the Day`.

The production CTA tray provides:

- Today's Stamp when today is already sealed
- Seal Today when today is open
- Seal Another Day as the backfill entry point

The CTA tray uses existing frontend routing and existing create/edit date selection. Backend, local_date, duplicate-day, and one-day-one-stamp rules remain unchanged.

Daily Detail content-only overlay is now being explored in playground only. The playground variants test keeping the overlay as date/title/photo-grid content while moving Back to month sheet, Save / Share, and Edit stamp onto the journal shell/leather layer.

Copy will be finalized later in Phase 7R.6A Copy Inventory.

### Phase 7R.5I: CTA Tray Visual Alignment + Daily Detail Shell Playground

Production CTA tray interaction was already accepted in Phase 7R.5H. Phase 7R.5I only aligns the tray visual styling to the approved playground version: compact contextual menu, brand translucency, matching radius/spacing, quiet secondary option styling, and no permanent two-button treatment.

Daily Detail content-only overlay is now being explored in playground only. Production Daily Detail remains unchanged until the product owner selects a direction.

Initial Daily Detail exploration direction:

- back arrow on shell top-left
- journal name centered
- settings top-right
- overlay contains date/title/photos
- edit is icon-only or inside settings
- Save / Share becomes bottom primary CTA

The playground initially showed current reference plus shell-navigation variants for overlay edit, settings-menu edit, and subtle shell status across 1-photo, 5-photo, and 9-photo states in wine and ivory leather. Phase 7R.5I.1 supersedes these candidate variants with the cleaner no-settings/no-status candidate below.

Copy will be finalized later in Phase 7R.6A Copy Inventory.

### Phase 7R.5I.1: Final Detail Playground Polish + Bottom CTA Production Parity

Production bottom CTA visual was aligned to the approved playground button. The `Seal the Day` CTA keeps the same accepted interaction and tray logic, but its Home-specific button sizing now matches the playground proportion more closely instead of inheriting the thinner generic ritual-button sizing.

Daily Detail candidate cleanup remains playground-only:

- Daily Detail candidate now removes `Saved in this journal.`
- Daily Detail candidate removes the top-right settings/more button
- Daily Detail candidate keeps edit as a small pencil icon
- Daily Detail candidate keeps Save / Share as bottom primary CTA
- Shell alignment uses an invisible right spacer so the journal name remains centered without showing a redundant settings control

Save / Share should continue opening the existing Save/Share modal; modal chrome should not receive the journal identity header. Export artifact redesign remains Phase 7.2.

Copy will be finalized later in Phase 7R.6A Copy Inventory.

### Phase 7R.5J: Strict Visual Parity + Detail Rebalance

Strict correction pass restores the accepted Variant C hierarchy:

- Journal shell title uses the accepted stronger Variant C proportion.
- Month Sheet title uses the shared Variant C relationship rather than page-level one-off sizing.
- Journal name remains centered on the shell header centerline and aligned with action controls.

Daily Detail production now belongs to the same shell system as Month Sheet:

- left shell back arrow
- centered journal name using the same Variant C typography
- no top-right dot-menu
- overlay contains date/title/photos and a small edit pencil
- no `Saved in this journal.`
- Save / Share is a bottom shell primary CTA
- Save / Share still opens the existing Save/Share modal/composer
- modal chrome and export canvas remain unchanged

Scrap Finder primary `Use this scrap` now uses the same primary CTA family as `Seal the Day` and Daily Detail `Save / Share`.

Playground-only work adds a focused Daily Detail vertical spacing study:

- current clean candidate
- airier date/title/grid spacing
- optically centered artifact

The spacing study keeps the same shell/header/action structure and only explores date/title/grid vertical balance. Export artifact redesign remains Phase 7.2. Copy will be finalized later in Phase 7R.6A Copy Inventory.

### Phase 7R.5J Emergency Visual Parity Lock

Approved playground is now the implementation source of truth, not a loose visual reference.

Production must reuse or extract approved playground components and tokens rather than recreating page-specific approximations.

The approved Daily Detail candidate is:

- back arrow shell-left
- journal name shell-center
- no dot menu
- overlay contains date, title, photos, and edit pencil
- no saved status
- bottom Save/Share CTA

The primary CTA family is shared across Month Sheet, Daily Detail, and Scrap Finder:

- Month Sheet `Seal the Day`
- Daily Detail `Save / Share`
- Scrap Finder `Use this scrap`

Product-owner QC rejected the later narrow production shell approximation. Month Sheet and Daily Detail must use the same wider shell-inset surface model as Create/Edit and the approved playground screenshots; their overlay and bottom CTA widths must resolve identically in browser measurement.

Final parity correction: the approved playground shell uses one `12px` inset from the wine-red shell edge. Production Home and Daily Detail must not add the mobile-shell padding and the article padding together into a `24px` inset. Home `Seal the Day` and Detail `Save / Share` must stay bottom anchored inside the journal shell with the same width model as their overlay, and `Back to this month` must sit left aligned under the month title inside the overlay frame. Month Sheet header typography and row height must remain state-invariant across current and non-current months.

Save/Share modal chrome remains unchanged. Export canvas remains deferred to Phase 7.2.

### Phase 7.2: Daily Export Redesign

Redesign Daily 9:16 export only after the app visual system is accepted:

- journal name included by default
- photos occupy roughly 60-70 percent
- transparent MGP logo
- 9:16 only
- no format picker
- inherit accepted app grid/material system

### Later Phases

- Phase 7R.5B: Dedicated Scrap Finder visual refinement.
- Phase 7R.5: Apply visual system to Create/Edit and dedicated Scrap Finder.
- Phase 7.3: Save/Share modal polish.
- Phase 8: Monthly export.
- Phase 6.5: Vercel preview once the core app visual direction is acceptable locally.
- Phase 2B: Additional Moments Optional Adjust Scrap.
- Runtime copy registry beyond `SCRAP_DAY_COPY_DECK.md`.

## Completion Notes

Phase 7R.1 should not be considered complete unless:

- locked design brief exists
- checkpoint report exists
- design exploration report exists
- `/design/scrap-day-v2` works locally
- four Direction B Month Sheet variants are visible
- production customer routes are not changed
- directions follow locked Month Sheet decisions
- old postage/stamp-edge app frames are not reintroduced
- heavy placeholder tiles are not reintroduced
- giant Seal Today block is not reintroduced
- Rename / Lock are not visible as main-content clutter
- photos are clearly the hero
- product owner can visually compare directions
