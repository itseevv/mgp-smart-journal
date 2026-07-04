# Scrap the Day Implementation Audit

Date: 2026-06-30
Audited repo: /Users/yi/Documents/Shopify/Journal Chip

## Scope and Guardrails

This audit follows the attached product brief. I inspected the current codebase, ran the available project checks, and did not intentionally change production code. The only intended output is this report.

Notes:
- The workspace path provided to the shell was /Users/yi/Documents/Journal Chip, but the actual repository is /Users/yi/Documents/Shopify/Journal Chip.
- Two pre-existing untracked files were present and not modified: Journal-Level NFC Product Direction Summary.pdf and brand-development-2026-06-24.zip.
- npm run build changed the generated next-env.d.ts route import during verification; I restored it to its pre-build content so this audit only adds the requested markdown report.

Verification run:

| Command | Result | Notes |
| --- | --- | --- |
| npm run lint | Passed | eslint . --max-warnings=0 |
| npm test | Passed | 30 Node test-runner tests passed |
| npm run build | Passed | First attempt hit sandbox EPERM writing .next/trace-build; rerun with elevated filesystem access passed. Next.js 16.2.7 / Turbopack built all app routes. |

## 1. Current Tech Stack

### Framework

- Next.js App Router, package version range ^16.0.0, build observed as Next.js 16.2.7.
- React ^19.2.0 and React DOM ^19.2.0.
- TypeScript strict mode enabled in tsconfig.json.
- Client-heavy product surfaces use useState/useEffect/useMemo/useRef directly; there is no global state library.

### Routing Structure

Customer routes:

| Route | Current role |
| --- | --- |
| app/c/[publicToken]/page.tsx | Public NFC/QR route. Loads a coarse server-side gate, then renders CapsulePage. |
| app/c/[publicToken]/m/[memoryId]/page.tsx | Journal memory detail/create route. Same public token gate, plus a memory id. |
| app/memory/demo/page.tsx | Local/demo in-memory MemoryFlow route. |

Admin routes:

| Route | Current role |
| --- | --- |
| app/admin/capsules/page.tsx | Internal capsule provisioning dashboard. |
| app/admin/capsules/[capsuleId]/page.tsx | Internal capsule detail, QR download, fulfilment controls, recovery rotation. |
| app/api/admin/session/route.ts | Signed admin session cookie. |
| app/api/admin/capsules/* | Admin list/generate/export/detail/QR/recovery APIs. |

Routing observations:

- /c/[publicToken] is the correct NFC-level entry point and should be kept.
- For journal products, CapsulePage routes to JournalHome when no memoryId exists and JournalMemoryPage when memoryId exists.
- For bookmark products, CapsulePage still supports the older single-memory flow.
- New memory creation currently generates a UUID before content exists and pushes to /c/[publicToken]/m/[memoryId].

### Styling System

- Tailwind CSS v4 via app/globals.css using @import "tailwindcss" and @theme inline.
- Global CSS variables already include paper/leather/editorial tokens: --paper, --paper-deep, --leather, --ink, --ink-soft, --oxblood, --olive, --rule.
- Typography uses system/editorial font stacks in CSS variables.
- There is a reusable .memory-entry paper surface with subtle texture.
- Current styling is globally fixed; there is no per-journal theme model in TypeScript or the database.

### State Management

- Local component state only.
- lib/capsule/api.ts includes a module-level sessionMemoryCache for unlocked memory payloads.
- PrivateMediaUrlCache resolves and caches Supabase signed URLs per mounted flow.
- Form drafts are kept in React state inside MemoryFlow/PersistentMemoryFlow.

### Backend, Database, and Storage

Backend:

- Supabase JS client on browser and server.
- Supabase anonymous auth is used as a technical private device session.
- Supabase Edge Function supabase/functions/capsule-access/index.ts handles inspect, activate, unlock, lock, cleanup, and recovery actions.
- Security-definer Postgres RPCs own sensitive operations and metadata commits.

Database migrations define:

| Object | Current purpose |
| --- | --- |
| capsules | Physical product instance. Has public_token, product_type, status, owner PIN hash, recovery legacy field, title, timestamps. |
| capsule_access | Auth user to capsule owner access. |
| memories | Generic memory record. Has capsule_id, title, occurred_at, created_at, updated_at. Initially unique per capsule, later multi-memory for journals. |
| photos | Ordered images per memory. Has storage path, order_index 0-29, mime/size/dimensions, thumbnail metadata. |
| voice_memos | Ordered audio per memory. Has title, storage path, duration, mime/size. |
| media_cleanup_queue | Deferred deletion of private storage paths. |
| capsule_batches / capsule_fulfillment / admin_action_audit | Internal provisioning and fulfilment. |
| recovery tables | Recovery passcode lifecycle, lockout, audit. |

Storage:

- Private Supabase Storage bucket memory-media.
- Object paths are currently capsules/{capsuleId}/memories/{memoryId}/photos/{photoId}/display.ext, thumb.ext, and voice paths.
- Signed URLs are generated with a 600-second lifetime and refreshed in the client.

### Image Upload, Editing, and Export Libraries

Upload and processing:

- Browser canvas-based image optimization in lib/media/photo-optimisation.ts.
- Display and thumbnail variants are generated client-side.
- tus-js-client handles resumable upload for prepared files above standardUploadMaxBytes.
- Supabase Storage upload handles smaller files.
- @dnd-kit/dom and @dnd-kit/react power drag reorder in SortablePhotoGrid.
- Next Image displays private object URLs/signed URLs with unoptimized set on relevant private media.

Missing for new direction:

- No cropper library is installed.
- No crop metadata exists.
- No Scrap Table / stamp finder tool component exists.
- No public share image export library exists. qrcode is used for admin QR output only.
- Next pulls sharp transitively, but the app does not use a server-side image-composition/export pipeline today.

### Build and Test Commands

From package.json:

| Command | Purpose |
| --- | --- |
| npm run dev | next dev |
| npm run build | next build |
| npm run start | next start |
| npm run lint | eslint . --max-warnings=0 |
| npm test | node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/*.test.mjs |
| npm run seed:capsule | Seed a capsule |
| npm run seed:batch | Seed/admin-generate a batch |
| npm run issue:recovery | Issue recovery code |

## 2. Current Product Flow

### What happens when a user opens/scans a journal URL?

1. NFC/QR opens /c/[publicToken].
2. app/c/[publicToken]/page.tsx calls getCapsuleInitialGate(publicToken) server-side.
3. CapsulePage mounts with initialGate.
4. Browser creates/loads a Supabase anonymous session.
5. Browser invokes capsule-access with action inspect.
6. Depending on state:
   - not found/unavailable/error shows a simple message.
   - unactivated shows PinGate in activate mode.
   - locked shows PinGate in unlock mode with recovery option.
   - unlocked and product_type = journal shows JournalHome.

This is strong NFC infrastructure for the new product. The user-facing language still says capsule in several public states.

### Current homepage

For journals, components/journal/journal-home.tsx is the default home.

Current behavior:

- Loads data through loadJournalHome, backed by get_journal_home RPC.
- Shows journal title, rename affordance, memory count, photo count out of maxPhotos.
- Shows a vertical ordered list of MemoryCard rows.
- Shows first memory thumbnail for each card.
- CTA is Add your first memory or Add a memory.
- If photoCount >= maxPhotos, blocks creation and shows 100-photo limit copy.
- Sort order comes from SQL: occurred_at desc, created_at desc, id desc.

Gap versus new direction:

- It is a list/archive, not a Monthly Stamp Sheet.
- It emphasizes counts and a photo limit, which conflicts with low-pressure ritual language.
- It sorts by occurred_at rather than sealed date / creation order.
- It does not group/filter by current month.
- It creates missing-day pressure less than a calendar would, but it still does not feel like a collected month sheet.

### Current add memory flow

Flow starts in JournalHome.addMemory:

- Blocks if journal photoCount >= maxPhotos.
- Generates crypto.randomUUID().
- Navigates to /c/[publicToken]/m/[memoryId].
- JournalMemoryPage loads JournalMemoryContext, including effectivePhotoLimit.
- PersistentMemoryFlow mounts MemoryForm in create mode.

Current MemoryForm:

- Shows date/time first, editable.
- Requires title.
- Requires at least one photograph.
- Allows selecting multiple images in one input.
- Allows up to config.maxPhotosPerMemory, normally 30 but reduced by journal remaining capacity.
- Allows drag reorder; the first photo appears largest in final display and is labelled First photo in edit/reorder mode.
- Allows voice memos up to five minutes total.
- Save uploads media, commits metadata, refreshes the saved memory, and shows CompletedState.

Gap versus new direction:

- Cover photo is not selected first as a separate commitment.
- No immediate Scrap Table / Finder Tool cropper.
- Additional images are presented as normal photos, not optional moments after the cover scrap.
- Max per memory is 30 rather than 9 total.
- Voice memo is outside the new MVP direction.
- Copy says memory, photographs, photo limit, upload/media in places.

### Current memory detail view

components/memory/completed-state.tsx renders the saved view:

- Date/time label.
- Large title.
- PhotoCollection with first photo as a wide 4:3 hero and remaining photos as horizontal thumbnails.
- Optional voice memo cards.
- Edit memory footer.

Gap versus new direction:

- Not a fixed 3 by 3 Daily Memory Stamp.
- First photo is visually large but not a cropped stamp-like cover scrap.
- Additional images are a carousel, not grid slots with material fillers.
- Final display does not currently show a visible cover badge, which is good, but edit mode does show First photo.
- No journal theme/leather background per journal.
- No brand/monogram placement for share output.

### Current upload/storage/share features

Reusable upload/storage features:

- Image type and size validation in PhotoPicker.
- Browser image decode, resize, WebP/JPEG encoding, display and thumbnail variants in optimisePhotoForUpload.
- Upload retry/resumable behavior via tus-js-client and Supabase Storage.
- Ordered metadata commit through commit_memory RPC.
- Private signed URL cache and refresh.
- Cleanup queue for removed storage objects.

Share/export today:

- Admin CSV export exists for fulfilment.
- Admin QR SVG/PNG download exists.
- No customer daily/monthly/yearly share image export exists.
- No video export exists.

## 3. Current Data Model

### Existing frontend types

File: data/memory-demo.ts

- MemoryMediaConfig
- MemoryPhoto
- MemoryVoiceMemo
- MemoryDraft
- MemoryEntry
- PersistentMemoryEntry

Important fields:

- MemoryDraft.capturedAt maps to DB memories.occurred_at.
- MemoryDraft.title maps to DB memories.title.
- MemoryDraft.photos is ordered by array position and committed as photos.order_index.
- MemoryPhoto stores dimensions, display path, thumbnail path, and transient object URLs/files.
- There is no coverScrap field; order_index 0 is the implicit first/cover image.
- There is no crop metadata.
- There is no sealedAt in TS; created_at exists in backend summaries.

File: data/journal.ts

- journalConfig.defaultTitle = My Journal.
- journalConfig.maxPhotos = 100.
- CapsuleProductType = bookmark | journal.
- JournalMemorySummary includes id, title, capturedAt, createdAt, photoCount, voiceMemoCount, firstThumbnailStoragePath, thumbnail dimensions.
- JournalHomeData includes title, photoCount, maxPhotos, cleanupPendingCount, memories.
- JournalMemoryContext calculates totalJournalPhotos, existingMemoryPhotos, effectivePhotoLimit.

### Existing database entities

The current journal is represented by capsules where product_type = journal plus capsules.title. There is no separate journals table.

The current daily artifact equivalent is memories:

- id uuid primary key.
- capsule_id uuid.
- title text.
- occurred_at timestamptz.
- created_at/updated_at.
- A journal may have multiple memories after phase 4.
- A bookmark may still have only one memory by commit_memory enforcement.

Photos are represented by photos:

- id uuid primary key.
- memory_id uuid.
- storage_path text unique.
- order_index integer 0-29.
- mime_type, size_bytes, width, height.
- thumbnail_storage_path and thumbnail metadata added by phase 3c.

Voice memos are represented by voice_memos and are not part of the new MVP direction.

### Date and one-per-day status

- Date exists as memories.occurred_at and is editable in MemoryForm.
- created_at exists and can serve as sealed/creation ordering for the new Monthly Stamp Sheet.
- There is no one-memory-per-day constraint.
- Multiple memories for the same calendar day are currently allowed for journals.
- The database does not store the user timezone or a normalized local journal date.

### Crop metadata status

- No crop metadata exists in frontend types or SQL migrations.
- Current image processing creates resized variants by fitting inside max edges, not by user crop rectangle.
- The app can produce a crop output with existing canvas infrastructure, but it cannot reconstruct/re-edit a crop without adding metadata.

### Journal color/theme status

- app/globals.css has fixed global color tokens, including leather and paper.
- There is no theme key on capsules.
- There are no fields for journalBackground, journalTextureOverlay, textOnJournal, mutedTextOnJournal, paperSurface, stampBorder, accentMetal, or logoMarkColor.
- There is no per-journal contrast logic.

## 4. Reuse / Replace Map

| Module / route | Classification | Reason and migration note |
| --- | --- | --- |
| app/c/[publicToken]/page.tsx | KEEP as-is | Correct journal-level NFC route. Keep URL stable. |
| app/c/[publicToken]/m/[memoryId]/page.tsx | KEEP but rename/reframe later | Useful detail/create route. Could eventually become a hidden implementation detail behind Seal Today. |
| components/capsule/capsule-page.tsx | MODIFY | Gate/routing logic is reusable; public copy says capsule/memory capsule and component naming reflects old direction. Keep internals during MVP, reframe user-facing copy. |
| components/capsule/pin-gate.tsx | KEEP but rename/reframe copy | PIN ritual and recovery are useful. Copy says capsule. |
| components/capsule/recovery-flow.tsx | KEEP as-is for now | Security feature is independent of product direction. Copy can be softened later. |
| components/capsule/persistent-memory-flow.tsx | MODIFY | Strong persistence orchestration, cleanup, caching. Needs cover-first stages and optional moments; later rename to persistent daily stamp flow. |
| components/journal/journal-home.tsx | REPLACE UI, keep data loading | Replace list/count UI with Monthly Stamp Sheet. Keep loadJournalHome, title editing, lock, cleanup retry. |
| components/journal/memory-card.tsx | MODIFY / likely replace with StampTile | Existing first-thumbnail card maps well to monthly cover scraps, but layout is a list row not a collection stamp. |
| components/journal/journal-memory-page.tsx | MODIFY | Context loading is useful; copy and photo-limit gating must change. |
| components/memory/memory-form.tsx | REPLACE for creation, keep pieces | Current all-in-one form conflicts with cover-first flow. Split into SealTodayFlow steps: cover selection, Scrap Table, one-line title, optional moments. |
| components/memory/photo-picker.tsx | MODIFY / split | Keep file validation/object URL logic. Need single-cover mode and optional moment mode with max 8. |
| components/memory/sortable-photo-grid.tsx | MODIFY | Keep dnd-kit for edit/reorder mode. Remove visible First photo badge from polished display; cover can remain labelled only in edit mode. |
| components/memory/completed-state.tsx | REPLACE UI | Replace hero + carousel with Daily Memory Stamp: leather background, paper mat, 3 by 3 grid, fillers, subtle identity. |
| components/memory/photo-collection.tsx | REPLACE for stamp display, KEEP viewer pieces | Current hero/carousel does not match fixed grid. PrivatePhoto signed URL handling is reusable. |
| components/memory/photo-viewer.tsx | KEEP optional | Useful for detail tap/zoom, not core to share artifact. |
| components/memory/voice-recorder.tsx and voice-memo.tsx | DELETE later, not now | Voice memo is outside MVP. Keep until product owner confirms whether legacy memories need playback. Hide from new Seal Today flow first. |
| components/memory/memory-flow.tsx | DELETE later, not now | Demo-only old flow under /memory/demo. Could become a visual test route or be removed after replacement. |
| data/memory-demo.ts | MODIFY | Rename/reframe types over time. Add DailyMemoryStamp/CoverScrap aliases while keeping DB mapping stable. |
| data/journal.ts | MODIFY | Add theme types/tokens and journal-facing constants. maxPhotos should stop being primary UI copy. |
| lib/capsule/api.ts | MODIFY | Keep Supabase/session/upload/RPC plumbing. Add mapping helpers for DailyMemoryStamp and coverScrap; pass crop metadata if added. |
| lib/media/photo-optimisation.ts | KEEP and extend | Canvas pipeline is the best base for crop output variants. Add crop-specific renderer rather than a separate upload path. |
| lib/media/private-url-cache.ts | KEEP | Essential for private stamp/month sheet media. |
| lib/media/upload-queue.ts | KEEP | Upload concurrency remains useful. |
| supabase/functions/capsule-access/index.ts | KEEP with targeted additions | Security boundary is sound. May need loadUnlockedMemory to return cover/crop metadata later. |
| supabase/migrations/* memory/photo schema | MODIFY carefully | Avoid full rewrite. Add theme key, optional crop metadata, maybe sealed/local date and 9-photo constraint in phases. |
| app/api/admin/* and components/admin/* | KEEP mostly as-is | Provisioning, QR, fulfilment, recovery are valuable. Later update product copy and theme assignment. |
| docs/phase-*.md | KEEP historical context | These docs explain existing architecture. Add new migration docs after product implementation begins. |
| app/globals.css | MODIFY | Existing tactile tokens are useful. Needs theme-token expansion and per-journal variables. |

Special attention areas:

- NFC routing: keep /c/[publicToken] stable.
- Journal landing page: replace visual/product model first, preserve load and lock behavior.
- Memory list/vault UI: no vault term found, but list/count/photo-limit framing should be replaced.
- Photo upload logic: keep and wrap; do not rewrite.
- Image crop/edit logic: absent; must be added.
- Share/export logic: absent for customer artifacts; must be added.
- Storage quota UI: present as photo limits. Remove from primary ritual, keep backend errors/internal guards.
- Database/API calls: keep RPC boundary; modify response shape incrementally.
- Mock/demo data: memory demo route is old and should not drive new product direction.

## 5. Compatibility Strategy

The lowest-risk migration is semantic layering over the existing memory/photo model, followed by targeted schema additions only where needed.

### Object mapping

| New object | Current implementation mapping | Notes |
| --- | --- | --- |
| Journal | capsules row with product_type = journal and title | Add theme key/tokens to capsules later; no new journals table needed for MVP. |
| Daily Memory Stamp | memories row | Use title and occurred_at. Add sealed/local date only if one-per-day or month sorting requires stronger semantics. |
| Cover Scrap | photos row where order_index = 0 | Existing first thumbnail path already powers journal cards. Add crop output/metadata for future edit. |
| Additional moments | photos rows where order_index = 1..8 | Existing rows beyond order_index 8 should be preserved but hidden/de-emphasized for legacy records until handled. |
| Monthly Stamp Sheet | get_journal_home memories list, grouped by month | Use firstThumbnailStoragePath as cover scrap image. Prefer createdAt for sealed order unless product chooses occurredAt. |
| Year in Stamps | Aggregated first photos only | Future query should fetch one cover per day/stamp, not all photos. |

### Preserve storage and upload plumbing

Do not rewrite Supabase Storage or media upload. The existing flow already handles:

- Private media bucket.
- Signed URLs.
- Browser image optimization.
- Thumbnail variants.
- Upload retry and resumable upload.
- Cleanup of removed private objects.

The Scrap Table should output a File/Blob that looks like any other prepared photo to the current save pipeline. If crop editing must be reversible, store crop metadata as a new nullable JSONB column on photos, but do not require it for legacy rows.

### Handle existing memories safely

Existing memories can contain up to 30 photos. Do not delete or truncate them.

Recommended compatibility behavior:

- Treat order_index 0 as coverScrap.
- Treat order_index 1-8 as visible optional moments in Daily Memory Stamp.
- If more than 9 photos exist, keep all in DB/storage, show the first 9 in the stamp, and expose overflow only in legacy edit mode or a quiet More media affordance until product decides.
- Existing uncropped first photos can be displayed object-cover in stamp frames until the owner re-scraps them.
- Existing voice memos remain playable in legacy detail/edit until product decides whether to hide or remove them.

### Avoid a full database rewrite

Do not replace memories/photos with new tables for MVP. Add small columns/RPC response fields only when a phase requires them:

- capsules.theme_key or capsules.theme jsonb, if themes must persist per physical journal.
- photos.crop_metadata jsonb, if re-editable crop is required.
- memories.sealed_at timestamptz, if created_at is insufficient.
- memories.local_date date plus local timezone, if one-stamp-per-local-day must be enforced.

### Reframe before restructuring

The first code PR should reframe primary UI copy and introduce new domain naming at component boundaries without moving routes or rewriting persistence. That creates immediate product alignment while keeping the working upload/security model intact.

## 6. Recommended Implementation Phases

### Phase 0: Audit only

Status: this report.

Verification:

- npm run lint passes.
- npm test passes.
- npm run build passes.

### Phase 1: Product language and primary CTA reframe

Goal: remove storage/photo-count pressure from primary journal UI and introduce Scrap the Day language without schema changes.

Likely files:

- app/layout.tsx
- components/journal/journal-home.tsx
- components/journal/memory-card.tsx
- components/journal/journal-memory-page.tsx
- components/capsule/capsule-page.tsx
- components/capsule/persistent-memory-flow.tsx
- components/memory/memory-form.tsx
- components/memory/photo-picker.tsx
- components/memory/sortable-photo-grid.tsx
- components/memory/completed-state.tsx
- tests/*.test.mjs for copy guardrails if desired

Acceptance criteria:

- Journal home CTA says Seal Today.
- Primary home copy says Month Sheet / Daily Scrap / Memory Stamp language instead of Add memory.
- Photo counts and 100-photo limit are removed from the primary header and only appear as quiet error/limit states.
- Existing activation, lock/unlock, create, save, edit, delete flows still work.
- No route or database schema changes.

Verification:

- npm run lint
- npm test
- npm run build
- Manual journal scan/open, create one existing-style memory, return home.

### Phase 2: Journal theme tokens and visual foundation

Goal: support multiple journal leather colors and safe contrast without changing artifact layouts yet.

Likely files:

- data/journal.ts or new data/journal-themes.ts
- app/globals.css
- components/capsule/capsule-page.tsx
- components/journal/journal-home.tsx
- components/memory/completed-state.tsx
- supabase migration only if persisting theme_key now
- lib/capsule/api.ts and get_journal_home if theme data comes from DB

Acceptance criteria:

- A JournalTheme type exists with tokens aligned to the product brief.
- Existing default theme reproduces current leather/paper feel.
- Components consume CSS variables or a theme object, not hardcoded white text on leather.
- Light and dark leather themes remain readable.

Verification:

- npm run lint
- npm run build
- Manual visual check for default and one light theme.

### Phase 3: Monthly Stamp Sheet using existing data

Goal: replace JournalHome list with a paper-like current-month collection page.

Likely files:

- components/journal/journal-home.tsx
- components/journal/memory-card.tsx or new components/journal/monthly-stamp-sheet.tsx and stamp-tile.tsx
- lib/capsule/api.ts if helper mapping is introduced
- Possibly get_journal_home ordering/query later

Acceptance criteria:

- Default journal home shows the current month title and cover scraps as a collection grid.
- Empty days are not rendered.
- No calendar gaps or streak/habit language.
- Sorting uses sealed/creation order where available; if using createdAt, document this decision.
- Tapping a stamp opens the existing detail route.
- Cleanup retry and lock remain reachable.

Verification:

- npm run lint
- npm run build
- Seed or mock multiple memories across a month and confirm no missing-day gaps.

### Phase 4: Daily Memory Stamp detail display

Goal: replace CompletedState display with the 3 by 3 artifact.

Likely files:

- components/memory/completed-state.tsx or new components/stamp/daily-memory-stamp.tsx
- components/memory/photo-collection.tsx for reusable PrivatePhoto extraction or new stamp grid image component
- app/globals.css
- data/journal.ts theme tokens

Acceptance criteria:

- Saved detail view shows leather background + ivory/paper mat.
- Top shows one-line title.
- Middle shows fixed 3 by 3 grid.
- Slot 1 is the cover scrap; slots 2-9 are optional moments.
- Missing slots use subtle material fillers, not empty holes.
- No visible cover photo badge in polished artifact.
- Edit mode can still identify/reorder the cover photo.

Verification:

- npm run lint
- npm run build
- Manual check with 1, 2, 5, 9, and legacy >9 photos.

### Phase 5: Cover-first Seal Today flow and Scrap Table cropper

Goal: make cover photo required and enter the stamp finder immediately after selection.

Likely files:

- components/capsule/persistent-memory-flow.tsx
- new components/scrap/cover-scrap-picker.tsx
- new components/scrap/scrap-table.tsx
- lib/media/photo-optimisation.ts or new lib/media/crop-photo.ts
- data/memory-demo.ts types extended with crop metadata/transient crop output

Acceptance criteria:

- Seal Today first opens a single-image cover picker.
- After image selection, user enters Scrap Table / Finder Tool.
- User can drag/zoom/position under a stamp-shaped frame.
- Confirm creates the cover scrap output image.
- User then enters One line to keep / What would you call today?
- User can Seal Today with only the cover and title.
- No confetti or heavy game motion.

Verification:

- npm run lint
- npm run build
- Mobile browser manual check for pointer/touch drag and zoom.
- Save/reload confirms cover output persists as first photo.

### Phase 6: Optional moments, max 8, and edit behavior

Goal: make additional moments optional and low pressure.

Likely files:

- components/memory/photo-picker.tsx
- components/memory/sortable-photo-grid.tsx
- components/capsule/persistent-memory-flow.tsx
- data/memory-demo.ts
- lib/capsule/api.ts
- supabase migration/RPC only when backend enforcement is added

Acceptance criteria:

- Additional moments step appears after cover/title.
- User can skip it and seal.
- User can add up to 8 additional images.
- Additional images auto-fit by default.
- Manual scrap/edit for additional images is optional, not required.
- Backend either enforces max 9 for new journal stamps or the UI clearly prevents exceeding it while preserving legacy records.

Verification:

- npm run lint
- npm run build
- Manual check with cover-only and cover + 8 moments.

### Phase 7: Static share/export entry points

Goal: produce daily and monthly still-image exports before any motion work.

Likely files:

- new lib/export/render-daily-stamp.ts or client canvas utilities
- new components/share/export-actions.tsx
- Daily stamp and monthly sheet components must expose stable export layouts
- Potential API route if server-side composition is chosen

Acceptance criteria:

- Daily stamp can export 1:1 and/or 4:5 still image.
- Monthly sheet can export a still image.
- Export respects private media access and does not leak signed URLs into logs.
- Sharing remains optional.

Verification:

- npm run lint
- npm run build
- Manual export test on mobile Safari/Chrome, with private signed media.

### Phase 8: Future Year in Stamps

Goal: visual yearly index using cover scraps only.

Likely files:

- New year query/RPC that fetches one cover per daily stamp.
- New YearInStamps component.
- Optional export path.

Acceptance criteria:

- Year view uses daily cover scraps only, not all 9 photos per day.
- It scales to 365 stamps without loading full display images unnecessarily.

## 7. Risks / Unknowns

| Risk / unknown | Impact | Mitigation |
| --- | --- | --- |
| No cropper exists | Cover-first ritual is the largest missing capability. | Build a focused Scrap Table using pointer events + canvas, or add a small crop library after evaluating mobile support. |
| No crop metadata | Crops cannot be re-edited precisely later. | Store final cropped output first; add nullable photos.crop_metadata when re-edit is required. |
| Current per-memory limit is 30 photos | New product requires cover + up to 8 moments. | UI-enforce 9 first; later tighten commit_memory for new journal stamps while preserving legacy >9 records. |
| Current journal max is 100 photos | Product should not talk about photo quota. | Keep as internal guard for now, remove from primary UI. Revisit storage limits with pricing. |
| Multiple memories per day are allowed | Daily Memory Stamp may need one per local date. | Product owner must confirm whether to enforce one stamp per journal per local day. |
| No journal timezone/local date | One-per-day and Month Sheet can be wrong around travel/time zones. | Add local_date/timezone only if daily uniqueness or precise month grouping is required. |
| Monthly sorting currently uses occurred_at desc first | New brief says sealed date / creation order. | Use createdAt as sealed order in UI or add sealed_at for explicit semantics. |
| Existing records can have >9 photos and voice memos | New display could hide user content. | Preserve data; show first 9 in stamp and retain legacy edit/view access for overflow/audio until product decision. |
| Private signed URLs and canvas export | Drawing cross-origin signed images to canvas may taint export unless CORS is correct. | Test early on Supabase Storage signed URLs; consider fetching blobs with auth and object URLs before canvas render. |
| HEIC/HEIF unsupported in current browser pipeline | Many iPhone photos may fail in some browsers. | Existing error handles this; consider HEIC conversion library/server path later if launch audience needs it. |
| Theme contrast | Light leather colors can break existing text assumptions. | Add theme tokens for textOnJournal/mutedTextOnJournal and test light/dark themes. |
| Admin product still supports bookmark | New direction may not need bookmark. | Keep for now; remove only after product/ops confirms no live bookmark capsules. |
| Share export scope can grow | Daily/monthly/yearly plus formats can turn into a full editor. | Start with static still exports only, as brief says. |

## 8. Proposed First Implementation Patch

Smallest useful first patch: rename/reframe the primary journal experience without changing routes, database schema, upload/storage logic, or component ownership.

### Files to edit

- app/layout.tsx
  - Change metadata title/description from Memory Capsule to Scrap the Day / journal-level NFC language.

- components/journal/journal-home.tsx
  - Change CTA to Seal Today.
  - Change empty state to daily scrap/stamp language.
  - Remove the primary header photo count and memory count emphasis; keep lock/rename/cleanup behavior.
  - Keep the existing list layout for this first patch, but label it as a Month Sheet or recent Daily Scraps so product language moves before layout work.

- components/journal/memory-card.tsx
  - Reframe card labels from memories/photos/voice memos to daily scraps/moments where possible.

- components/journal/journal-memory-page.tsx
  - Reframe full-journal error state away from 100 of 100 photos language in primary copy.

- components/memory/memory-form.tsx and components/memory/photo-picker.tsx
  - Change primary creation copy to One line to keep, Today’s Scrap, Add more moments where it does not imply the cover-first cropper is already built.
  - Keep validation and multi-photo behavior intact for this patch.

- components/memory/sortable-photo-grid.tsx
  - Change edit-mode First photo label to Cover scrap.

- components/memory/completed-state.tsx
  - Reframe Edit memory to Edit Daily Scrap / Edit stamp.

### Components to reuse

- CapsulePage, PinGate, RecoveryFlow, PersistentMemoryFlow.
- Existing PhotoPicker, SortablePhotoGrid, savePersistentMemory, loadJournalHome, updateJournalTitle.
- Existing private media URL cache and upload pipeline.

### Components not to create yet

- Scrap Table / Finder Tool cropper.
- Monthly Stamp Sheet replacement grid.
- Daily Memory Stamp 3 by 3 component.
- Share/export UI.
- Year in Stamps.

### Acceptance criteria

- Journal user sees Seal Today as the main CTA.
- Primary customer UI no longer foregrounds photo quota language on the home screen.
- Existing create/save/edit/delete behavior remains unchanged.
- Existing routes remain unchanged.
- No SQL migration is added.
- npm run lint, npm test, and npm run build pass.

### What not to touch yet

- Do not delete bookmark support.
- Do not delete voice memos.
- Do not rename database tables or columns.
- Do not change /c/[publicToken] or /c/[publicToken]/m/[memoryId].
- Do not change storage paths.
- Do not add cropper dependencies before a focused cropper decision.

## 9. Questions for Product Owner

1. Should a journal allow exactly one Daily Memory Stamp per local calendar day, or can a user seal multiple stamps on the same day?

2. For existing/legacy memories with more than 9 photos, should the new UI hide overflow after the first 9, keep a legacy viewer, or prompt the owner to choose which moments remain in the stamp?

3. Are voice memos intentionally out of scope for Scrap the Day MVP, or should existing voice memos remain visible in a secondary/legacy section?

4. Should Month Sheet grouping use sealed/created date even when the editable occurred_at date differs, or should the user-controlled day decide the month?
