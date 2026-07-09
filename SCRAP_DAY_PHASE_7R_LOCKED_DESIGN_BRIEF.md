# Scrap Day Phase 7R Locked Design Brief

## Status

Phase 7R is a controlled visual redesign reset. It pauses Phase 7.1.x production patching and creates a local-only visual playground before any further customer route implementation.

This is not a new product direction, not a free redesign, and not a rewrite of locked product rules. The product owner has already locked the core product, UX, copy language, and visual intent. Phase 7R exists to establish a stronger visual north star before production UI changes continue.

## Product Direction

Scrap Day is a premium physical journal with an embedded journal-level NFC chip. Scanning the NFC chip opens the dedicated digital page for that specific journal.

The positioning is:

> Write the feeling. Scrap the day. Seal it in your journal.

The physical journal holds what the day felt like. The digital layer holds what the day looked like. The NFC scan is the ritual bridge between the two.

The digital experience should feel like a private visual memory archive: editorial, photo-first, tactile, intimate, premium, restrained, and connected to the physical journal through the selected leather texture.

It must not feel like a dashboard, storage vault, generic collage app, childish scrapbook toy, file upload tool, social feed, or tech/smart-journal interface.

## Locked Terms

Preserve these customer-facing terms:

- Journal
- Daily Scrap
- Cover Scrap
- Daily Memory Stamp
- Month Sheet
- Seal Today
- One line to keep
- Find today's scrap

Avoid these terms on customer journal surfaces unless unavoidable:

- vault
- upload
- technical
- smart journal
- smart album
- collage
- file storage
- media vault
- generic memory capsule language

## Locked Product Rules

- One day equals one main Daily Memory Stamp per local calendar day.
- If today is already sealed, Seal Today opens today's existing stamp.
- Backfilled dates belong to the selected local date.
- One required Cover Scrap.
- Up to 8 optional additional moments.
- 9 images total in the customer UX.
- Voice memo remains removed from customer journal UX.
- Creation remains cover-first: date visible, one line visible, Cover Scrap chosen, Scrap Finder used, return to sealing page, seal allowed with only Cover Scrap plus one-line title.
- Scrap Finder keeps fixed frame plus movable/zoomable photo interaction.
- Crop metadata semantics must not change.
- App photo display uses normalized square frames conceptually.
- Fullscreen viewer shows the original full image.
- Month Sheet shows sealed days sequentially by local_date order.
- Month Sheet does not show streaks, missing-day pressure, calendar gaps, tile headlines, future empty slots, or placeholder cells.
- Daily 9:16 export is not redesigned in Phase 7R.
- Export generation must keep working unchanged.

## Locked Visual Direction

The visual direction is editorial art book / magazine-style memory archive. It should feel like quiet luxury and daily-life aesthetic curation.

Photo readability wins over decoration. The Cover Scrap is the core Month Sheet unit. Photos must be large enough to understand quickly. Dates and labels must not cover photos.

WeChat Moments-style tight photo treatment is a key reference for app photo grids:

- tight gaps
- no decorative border
- no date overlay
- readable images
- photos themselves form the composition

Physical scrap-a-day monthly sheets are a reference for collection feeling, but not for childish craft styling.

## Material Hierarchy

- Outer desktop browser background: neutral matte fallback.
- Mobile journal shell: selected journal leather texture.
- Leather texture: journal identity tied to the physical journal.
- Paper/content surface: very light, not a thick cream card.
- Photos: dominant visual content.
- Type and buttons: quiet controls.
- Brand/logo: subtle maker's mark later.

Leather texture should be consistently visible across customer journal screens after production implementation: Journal Home / Month Sheet, Daily Memory Stamp detail, Create/Edit flow, and Scrap Finder. Detail/create pages must not fall back to flat hardcoded brown.

## Locked Month Sheet Decisions

- 3 columns on mobile.
- One sealed day equals one square Cover Scrap.
- Only sealed days are shown.
- No empty placeholders.
- No future empty slots.
- No old fixed 4 x 8 app grid.
- Date caption below image.
- Date caption format: 01, 02, 15.
- No date overlay.
- No photo headlines on Month Sheet tiles.
- No postage, perforated, stamp-edge, decorative border, white photo border, or heavy paper mat around photos.
- Tight gaps.
- Large/readable photos.
- Small journal name.
- No visible redundant JOURNAL eyebrow.
- Rename / Lock hidden in a small settings/menu treatment or strongly de-emphasized.
- Seal Today as a small pill/action in the upper-right area.
- Quiet month title and navigation.
- No giant central Seal Today block.
- No explanatory count/status copy competing with photos.

## Locked Daily Detail Decisions

- Date plus one-line title sit above the photo grid.
- Photos are the visual reward.
- Adaptive square grid: 1 photo is one large square; 2-4 photos use 2 columns; 5-9 photos use 3 columns.
- Tight gaps.
- No postage, perforation, stamp edge, heavy mat, nested frame, photo border, or white photo mat.
- Fullscreen original photo viewer must keep working.
- Save / Share and Edit actions are small and consistent.
- Leather texture remains visible behind the detail surface.

## Locked Create/Edit Decisions

- Date visible and readable on paper.
- One line to keep visible from the beginning.
- Cover-first flow remains.
- Additional moments optional up to 8.
- User can scroll through the full form and reach Add more moments, thumbnails, save/seal, and cancel.
- Save/Cancel should be a normal in-flow action block for now unless sticky behavior is solved later.
- Cover and additional previews use clean editorial photo treatment.
- No postage/perforated/stamp-edge frames in create/edit previews.

## Locked Scrap Finder Decisions

- Scrap Finder is a dedicated focused screen / full-screen overlay / route-like screen within the app experience.
- It must not render inline in the create/edit form body.
- It must visually replace the create/edit form while active.
- It should show only title, helper, close, square finder/photo, zoom, Use this scrap, Choose another / Reset / Cancel.
- It should fit within one mobile app screen as much as possible.
- It keeps selected journal leather theme background.
- It keeps fixed finder plus movable/zoomable photo interaction.
- Crop math and metadata stay unchanged.
- No blue plastic frame, postage/perforated edges, or technical image dimensions.

## Phase 7R Scope

Phase 7R.0 creates the checkpoint report.

Phase 7R.1 creates the local-only design playground route:

- `/design/scrap-day-v2`

The route may use hardcoded demo data, requires no Supabase, and does not implement real create/edit/save/export behavior. It must not replace production routes.

Required docs:

- `SCRAP_DAY_PHASE_7R_LOCKED_DESIGN_BRIEF.md`
- `SCRAP_DAY_PHASE_7R_0_VISUAL_REDESIGN_RESET_CHECKPOINT.md`
- `SCRAP_DAY_PHASE_7R_1_DESIGN_SKILL_EXPLORATION.md`

## Explicit Non-Scope

Phase 7R does not:

- start Phase 6.5 Vercel preview
- start Phase 7.2 export redesign
- continue Phase 7.1.x production patching
- modify production customer routes
- modify database, auth, local_date, duplicate-day logic, texture upload/storage, Supabase policies, admin theme data model, export canvas generation, or migrations
- change one-day-one-stamp rules
- change crop metadata semantics
- change the 9-image frontend cap
- reintroduce voice memo UI
- reintroduce storage/vault language
- reintroduce old postage/perforated/stamp-edge app frames

## Future Export Decisions To Carry Forward

Daily export redesign is Phase 7.2, not Phase 7R. It should later:

- include journal name by default
- ideally allow a future journal-name toggle
- combine digital scrapbook page plus editorial postcard
- let photos occupy roughly 60-70 percent of the composition
- make photos the hero
- use the transparent MGP logo asset when provided
- reject the current tiny unreadable logo treatment
- reject heavy/childish stamp borders
- inherit the accepted app photo grid and material system
- remain Daily 9:16 only
- avoid a format picker

Monthly export remains future Phase 8.
