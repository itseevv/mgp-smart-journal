# Phase 6 Implementation Plan — Journal Theme / Background System + Admin Selection

## Context

The Scrap the Day journal product now has the core ritual and archive flow largely working:

- Daily Scrap creation
- Cover Scrap / Scrap Table
- Daily Memory Stamp detail
- Month Sheet archive
- one-day-one-stamp integrity
- Daily 9:16 export / save / share

However, the current visual layer still uses temporary theme/background styling. The product needs a flexible **Journal Theme / Background System** so each physical journal can be visually bound to its leather/color identity.

This phase should not hardcode “10 themes.” The first launch may have 9 themes, 10 themes, or more later. The system must be dynamic and expandable.

---

## Product Decision Summary

### What the system must support

1. **Dynamic theme library**
   - Themes are managed in admin.
   - The number of themes is not fixed.
   - Themes can be added, edited, archived, or reordered later.

2. **Theme required when generating a journal capsule**
   - For journal products, theme selection is mandatory during capsule generation.
   - A generated journal/capsule must be linked to exactly one journal theme.
   - The theme can be changed later from the capsule detail/admin page.

3. **Theme applies to customer-facing journal experience**
   - `/c/[publicToken]`
   - Daily Memory Stamp detail
   - Month Sheet
   - Daily export
   - Future monthly export

4. **Theme is more than a color**
   - It includes leather/background texture asset.
   - It includes color tokens.
   - It includes text contrast tokens.
   - It includes paper/mat colors.
   - It includes background framing settings such as focal point and zoom.

5. **The leather background should feel like a large natural leather surface**
   - Not a small repeated tile.
   - Not a flat color.
   - Not a low-resolution patch stretched awkwardly.
   - It should feel like a smooth, premium, continuous piece of leather behind the journal UI.

6. **AI texture expansion/outpainting is deferred**
   - First version should use high-resolution texture assets plus controlled framing.
   - AI generation/outpainting can be evaluated later if some source textures are too small or unsuitable.

---

## Phase Breakdown

Phase 6 should be implemented in two sub-phases:

- **Phase 6A — Theme Data Model + Admin Assignment**
- **Phase 6B — Theme Asset Upload, Preview + Background Rendering**

---

# Phase 6A — Theme Data Model + Admin Assignment

## Goal

Create the system backbone:

- Dynamic theme records
- Capsule-to-theme assignment
- Generate Capsule flow requires a theme
- Capsule detail allows theme changes
- Customer app can receive and resolve the selected theme
- Existing journals without theme fall back safely

## Scope

### In scope

1. Database schema for journal themes.
2. Database schema linking capsules/journals to a selected theme.
3. Admin theme list / basic management.
4. Generate Capsule flow requires selecting a theme for journal products.
5. Capsule detail page allows editing theme assignment.
6. Customer-facing API/RPC returns selected theme data.
7. Frontend theme resolver with fallback.
8. Tests and QA routes.

### Out of scope

- Final visual redesign.
- Final leather texture polish.
- Advanced background image preview controls.
- AI/outpainting.
- Monthly export.
- Full export redesign.
- User-facing theme selection.
- User ability to change theme.
- Full asset manager for theme images.
- Production domain/Vercel work.

---

## Recommended Data Model

### New table: `journal_themes`

Suggested fields:

```sql
create table if not exists journal_themes (
  id uuid primary key default gen_random_uuid(),

  slug text not null unique,
  name text not null,
  description text,

  status text not null default 'draft',
  sort_order integer not null default 0,

  -- Texture asset. Can be null during early setup / placeholder themes.
  texture_storage_path text,
  texture_public_url text,
  texture_width integer,
  texture_height integer,
  texture_mime_type text,

  -- Background rendering controls.
  focus_x numeric not null default 0.5,
  focus_y numeric not null default 0.5,
  zoom numeric not null default 1.0,
  overlay_color text,
  overlay_opacity numeric not null default 0,

  -- App/export visual tokens.
  fallback_background_color text not null default '#6f2730',
  text_primary text not null default '#fff3df',
  text_secondary text not null default '#d7c2aa',
  paper_surface text not null default '#f3ead8',
  paper_surface_muted text not null default '#e6d8bf',
  stamp_border text not null default '#7d3a3d',
  accent_color text not null default '#d6aa72',
  logo_variant text not null default 'light',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Notes:

- `status` should support at least: `draft`, `active`, `archived`.
- Only `active` themes should be available in Generate Capsule selection by default.
- Draft themes can be previewed/edited in admin.
- Archived themes should not be selectable for new capsules but should remain usable for existing capsules.

### Existing table update: `capsules`

Add:

```sql
alter table capsules
add column if not exists journal_theme_id uuid references journal_themes(id);
```

Product rule:

- For `product_type = 'journal'`, `journal_theme_id` should be required at generate time.
- Do not necessarily add a strict database NOT NULL immediately if existing dev/test data would break.
- Enforce requirement in admin flow first.
- Add DB-level constraints later if safe.

---

## Seed / Placeholder Themes

Add a seed or migration-safe initialization for initial placeholder themes.

Important:

- Do not hardcode “10 themes.”
- The seed can create any number of initial themes.
- The system should work with 1, 9, 10, 12, or more themes.

Example placeholder theme slugs:

```text
ruby-red
black
dark-brown
cream
teal
blush
sepia
olive
navy
```

These can be placeholders. Final theme names/assets can change later.

---

## Admin UX — Theme Library

Add admin interface for theme library management.

### Route suggestion

```text
/admin/journal-themes
/admin/journal-themes/new
/admin/journal-themes/[themeId]
```

If admin routing structure prefers another naming convention, adapt accordingly.

### Theme list should show

- Theme preview swatch / background preview.
- Theme name.
- Slug.
- Status.
- Sort order.
- Whether texture asset exists.
- Number of assigned capsules if easy.
- Edit button.

### Theme edit should support in Phase 6A

- Name
- Slug
- Status
- Sort order
- Fallback background color
- Text colors
- Paper colors
- Accent color
- Logo variant
- Texture path fields if already available, but advanced upload/preview can be Phase 6B.

Phase 6A can keep texture upload minimal or disabled if Phase 6B will implement upload properly.

---

## Admin UX — Generate Capsule Flow

Update Generate Capsule flow.

### Product rule

For journal product generation:

```text
journal_theme_id is required.
```

### Requirements

1. When generating a single journal capsule:
   - Show theme selector.
   - It must list active journal themes.
   - User must choose one theme before generating.

2. When generating a batch:
   - MVP can apply one selected theme to all generated capsules in that batch.
   - Later per-capsule theme assignment can be considered.
   - Do not overcomplicate batch workflow now.

3. Validation:
   - If product type is `journal` and no theme selected, block generation.
   - Show clear admin error: “Choose a journal theme before generating journal capsules.”

4. Bookmark / non-journal products:
   - Do not require journal theme unless product decision changes later.
   - Do not break existing bookmark/capsule generation.

---

## Admin UX — Capsule Detail

On capsule detail/admin page:

- Show current journal theme.
- Allow changing theme later.
- If capsule is already activated, show a small warning:
  - “Changing the theme will update the customer-facing journal background.”
- Save change.
- Record admin audit if existing audit infra supports it.

---

## Public App / API Integration

Update API/RPC and frontend mapping so customer-facing journal pages receive theme data.

### Required behavior

1. `/c/[publicToken]` loads capsule/journal theme.
2. `/c/[publicToken]/m/[memoryId]` loads same theme.
3. `/journal/demo` can use demo theme.
4. If theme missing:
   - fallback to default theme.
   - app should not crash.

### TypeScript model

Suggested frontend type:

```ts
export type JournalTheme = {
  id?: string;
  slug: string;
  name: string;
  status?: "draft" | "active" | "archived";

  textureUrl?: string;
  textureStoragePath?: string;
  textureWidth?: number;
  textureHeight?: number;

  focusX: number;
  focusY: number;
  zoom: number;
  overlayColor?: string;
  overlayOpacity: number;

  fallbackBackgroundColor: string;
  textPrimary: string;
  textSecondary: string;
  paperSurface: string;
  paperSurfaceMuted: string;
  stampBorder: string;
  accentColor: string;
  logoVariant: "light" | "dark" | string;
};
```

Add a resolver:

```ts
resolveJournalTheme(themeFromApi?: Partial<JournalTheme>): JournalTheme
```

The resolver should:

- Merge API theme with safe defaults.
- Clamp `focusX`, `focusY`, `zoom`, `overlayOpacity`.
- Fallback if texture is missing.
- Avoid hardcoded theme count.

---

## Phase 6A Acceptance Criteria

Phase 6A is accepted when:

1. Admin can create/list/edit journal theme records.
2. Generate Capsule for journal products requires a theme.
3. Capsule detail shows and can update assigned theme.
4. Customer journal route receives and uses theme data at least at token level.
5. Existing journals without theme fallback safely.
6. `/journal/demo` still works.
7. Tests pass.
8. No final visual redesign is attempted.

---

## Phase 6A Tests

Add/update tests for:

1. Theme resolver fallback.
2. Theme resolver clamps invalid values.
3. Generate Capsule validation requires theme for journal.
4. Bookmark/non-journal generation is not blocked by missing theme.
5. Capsule detail theme update mapping.
6. Public journal API returns theme data.
7. Customer app does not crash if theme missing.
8. Existing flows:
   - lock/unlock
   - rename
   - Seal Today
   - Month Sheet
   - Daily detail
   - export

---

# Phase 6B — Theme Asset Upload, Preview + Background Rendering

## Goal

Make theme assets useful visually.

Phase 6A creates the library and assignment.
Phase 6B lets admin upload leather texture images and preview how each theme will appear in:

- mobile app background
- Daily Memory Stamp view
- Daily 9:16 export background
- future Monthly 9:16 export background

## Scope

### In scope

1. Upload/replace texture asset for a theme.
2. Store texture asset in a theme asset location.
3. Validate image type and dimensions.
4. Preview mobile 9:16 background.
5. Configure focus point and zoom.
6. Configure overlay opacity/tint.
7. Render theme background in customer app.
8. Render theme background in Daily export.
9. Document asset requirements.
10. Tests and QA.

### Out of scope

- AI outpainting / AI upscaling.
- Final visual redesign.
- Full admin asset manager.
- User-facing theme selection.
- Monthly export.
- Production custom domain.
- Complex responsive art direction per breakpoint.
- Automatic perfect texture generation.

---

## Asset Storage Strategy

Theme texture assets are not user-private memory content. They are brand/design assets.

Recommended options:

### Option A — Public Supabase Storage bucket

Bucket:

```text
journal-theme-assets
```

Path:

```text
journal-themes/{themeId}/texture-original.{ext}
journal-themes/{themeId}/texture-preview.{ext}
```

Pros:
- Easier to use in CSS backgrounds.
- Easier for public customer pages.
- No signed URL refresh needed.
- Good for non-sensitive brand assets.

Cons:
- Publicly accessible asset URLs.
- Need correct CORS for canvas export.

### Option B — App-served/proxied asset route

Example:

```text
/api/theme-assets/{themeId}/texture
```

Pros:
- Same-origin canvas usage can be easier.
- More control over caching/headers.

Cons:
- More backend complexity.

### Recommendation

Use **Option A** for MVP if CORS/export works.
If canvas export is tainted, fetch the asset as a blob in export renderer before drawing to canvas, or use app proxy.

---

## Source Asset Requirements

Admin upload should accept:

- JPEG
- PNG
- WebP

Recommended source quality:

- Prefer vertical 9:16 or near 9:16.
- Minimum recommended: `1080 × 1920`.
- Better: `2160 × 3840` or `2400 × 4267`.
- Landscape images are allowed but may need focal/zoom adjustment.
- Avoid tiny sample patches.
- Avoid low-resolution screenshots.
- Avoid visible repeated seams.

Admin UI should warn if:

- Width < 1080
- Height < 1920
- File is extremely small / likely low-res
- Aspect ratio is very far from 9:16

Do not block all imperfect uploads; warn and allow admin to test preview.

---

## Background Rendering Model

Use one shared rendering model for app and export.

### Recommended approach in React app

Use a `JournalBackground` component.

Concept:

```tsx
<JournalBackground theme={theme}>
  {children}
</JournalBackground>
```

Implementation idea:

- A wrapper with fallback background color.
- An absolutely positioned `<img>` background layer.
- `object-fit: cover`.
- `object-position: ${focusX}% ${focusY}%`.
- Optional transform scale for zoom.
- Overlay layer for tint/darkening.
- Content above.

Pseudo-structure:

```tsx
<div className="journal-background" style={{ backgroundColor: theme.fallbackBackgroundColor }}>
  {theme.textureUrl && (
    <img
      src={theme.textureUrl}
      className="journal-background__texture"
      style={{
        objectFit: "cover",
        objectPosition: `${theme.focusX * 100}% ${theme.focusY * 100}%`,
        transform: `scale(${theme.zoom})`,
      }}
      alt=""
      aria-hidden="true"
    />
  )}
  <div
    className="journal-background__overlay"
    style={{
      backgroundColor: theme.overlayColor ?? "transparent",
      opacity: theme.overlayOpacity,
    }}
  />
  <div className="journal-background__content">
    {children}
  </div>
</div>
```

Important:
- Prevent image zoom from exposing empty edges.
- Use `overflow: hidden`.
- Keep text readable through overlay/tokens.
- Respect mobile dimensions.

### Export rendering

Daily export renderer should accept the same theme tokens.

For canvas:

- Draw fallback background color.
- Draw texture image with object-fit cover math.
- Apply focal point.
- Apply zoom.
- Draw overlay.
- Draw title/date/paper/stamp elements above.

Create shared utility:

```ts
computeObjectFitCoverRect({
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
  focusX,
  focusY,
  zoom,
})
```

Use for both preview and export if possible.

---

## Admin Theme Preview Controls

Add controls to theme edit page.

### Required controls

- Upload / Replace texture
- Name
- Slug
- Status
- Fallback background color
- Text primary / secondary
- Paper surface / muted
- Stamp border
- Accent color
- Logo variant
- Focus X
- Focus Y
- Zoom
- Overlay color
- Overlay opacity

### Preview panels

At minimum:

1. **Mobile App Preview**
   - 9:16-ish phone preview
   - shows background + sample paper card
   - shows sample title/date text
   - shows rough stamp/photo area

2. **Daily Export Preview**
   - 9:16 poster preview
   - can be static mock
   - should use the same background renderer

Optional later:
- Monthly export preview
- Theme contrast checker

---

## How to Handle Texture Framing

The admin should be able to tune:

### `focus_x`
- 0 = left
- 0.5 = center
- 1 = right

### `focus_y`
- 0 = top
- 0.5 = center
- 1 = bottom

### `zoom`
- Default 1.0
- Suggested range 1.0–2.0
- Allows texture to feel softer / more macro
- Prevent zoom lower than 1.0 if it exposes edges

### `overlay_opacity`
- Suggested range 0–0.6
- Helps darken/lighten busy leather textures
- Supports readability

### `overlay_color`
- Usually black, dark ruby, cream, or transparent
- Keep simple

---

## Future AI Texture Processing — Deferred

Do not implement AI now.

Document future options:

1. AI outpainting for small texture samples.
2. AI upscaling.
3. Tileable texture generation.
4. Procedural leather texture generation.
5. Manual designer-generated 9:16 background assets.

Reason for deferral:
- AI output may be inconsistent.
- Leather texture may look fake.
- MVP needs controllable and stable backgrounds.
- High-resolution source assets + framing controls are more reliable.

---

## Phase 6B Acceptance Criteria

Phase 6B is accepted when:

1. Admin can upload/replace a theme texture image.
2. Admin can preview theme as mobile 9:16 background.
3. Admin can adjust focus/zoom/overlay.
4. Customer app background uses the assigned theme texture.
5. Daily export background uses the assigned theme texture.
6. Missing texture gracefully falls back to theme color.
7. Theme count remains dynamic.
8. Generate Capsule theme assignment still works.
9. Existing flows still work.

---

## Phase 6B Tests

Add/update tests for:

1. Theme asset upload validation.
2. Allowed mime types.
3. Dimension warning logic.
4. Background renderer resolves texture URL.
5. Fallback color works when texture missing.
6. Focus/zoom values are clamped.
7. Canvas object-fit cover rect math.
8. Export renderer receives theme.
9. Public app uses capsule assigned theme.
10. Missing theme fallback.

Manual QA:

1. Create a draft theme.
2. Upload a leather texture.
3. Adjust focus/zoom.
4. Save.
5. Assign theme to a test journal capsule.
6. Open `/c/[publicToken]`.
7. Confirm background appears.
8. Open Daily detail.
9. Export 9:16.
10. Confirm export uses same theme background.

---

# Technical Guardrails

## Do not hardcode theme count

Bad:

```ts
const THEMES = [theme1, theme2, ... theme10]
```

Good:

```ts
const themes = await listActiveJournalThemes()
```

Hardcoded seed data is acceptable only as initial placeholder records, not as the long-term source of truth.

## Do not make theme selection user-facing

Theme is assigned by admin before/after capsule generation.

User should not pick theme in MVP.

## Do not break existing capsules

Existing capsules without theme must fallback gracefully.

## Do not break bookmark product

Journal theme assignment applies to journal products only unless product direction changes.

## Do not make theme assets private user media

Theme assets are brand/product assets. They should not share the same logic as private memory photos unless necessary.

## Do not do full visual redesign inside Phase 6

This phase builds infrastructure.
Visual redesign comes after theme system and Vercel preview are in place.

---

# Suggested File Areas

Codex should inspect actual repo structure, but likely areas include:

```text
app/admin/capsules/*
app/api/admin/capsules/*
components/admin/*
lib/admin/*
data/journal-themes.ts
data/journal.ts
lib/capsule/api.ts
supabase/migrations/*
supabase/functions/capsule-access/index.ts
components/journal/*
components/stamp/*
components/export/*
app/globals.css
tests/*.test.mjs
scripts/*
```

New files may include:

```text
data/journal-theme-types.ts
data/journal-theme-defaults.ts
components/journal/journal-background.tsx
components/admin/journal-theme-form.tsx
components/admin/journal-theme-preview.tsx
lib/journal-theme/background-rendering.ts
lib/export/theme-background.ts
```

---

# Recommended Implementation Order

## Phase 6A order

1. Add `journal_themes` table and `capsules.journal_theme_id`.
2. Add TypeScript theme types/default resolver.
3. Seed placeholder active themes.
4. Add admin theme library list/edit.
5. Add required theme selection to Generate Capsule.
6. Add theme editing to Capsule Detail.
7. Return theme in journal home/detail API.
8. Apply theme tokens in customer app at a basic level.
9. Tests + report.

## Phase 6B order

1. Add theme texture upload/replace.
2. Add asset validation/dimension detection.
3. Add focus/zoom/overlay fields in admin UI.
4. Add mobile preview panel.
5. Add shared `JournalBackground` renderer.
6. Use assigned theme in app background.
7. Update Daily export renderer to use same theme.
8. Add object-fit cover canvas helper.
9. Tests + report.

---

# Required Patch Reports

## Phase 6A report

Create:

```text
SCRAP_DAY_IMPLEMENTATION_PHASE_6A.md
```

Include:

- Summary
- Files changed
- DB migration filename
- Theme data model
- Admin theme library
- Generate Capsule required theme behavior
- Capsule detail theme editing
- Customer API/theme resolver behavior
- Fallback behavior
- Tests/build results
- Known limitations
- Next step: Phase 6B

## Phase 6B report

Create:

```text
SCRAP_DAY_IMPLEMENTATION_PHASE_6B.md
```

Include:

- Summary
- Files changed
- Texture upload/storage approach
- Asset validation rules
- Preview controls
- Background renderer
- Export background integration
- CORS/canvas notes
- Fallback behavior
- Tests/build results
- Known limitations
- Next step: Vercel preview / visual system redesign

---

# Relationship to Later Work

## After Phase 6A + 6B

Proceed to:

1. **Vercel Preview Deployment**
   - Stable mobile QA URL.
   - Real `/c/[publicToken]` testing.
   - Export/share testing over HTTPS.

2. **Visual System Redesign**
   - Redesign app view + export view using the real theme system.
   - Redesign Daily 9:16 export.
   - Improve leather/paper/stamp/brand mark.

3. **Monthly 9:16 Export**
   - Use 4 × 8 Month Sheet.
   - Use same theme system.
   - Use MGP mark.
   - No headlines.
   - No journal name.

4. **Launch Hardening**
   - Real NFC tags.
   - Custom domain.
   - Mobile Safari/Chrome QA.
   - Supabase production migration.
   - Admin workflow QA.

---

# Open Product Notes

## Theme asset quality

The final product will only look as good as the leather texture assets.
Small screenshot-like samples are not suitable for final launch backgrounds.

Recommended final asset preparation:

- Shoot or source high-resolution leather textures.
- Prefer vertical 9:16 or large flexible crops.
- Avoid repeated/tiled seams.
- Prepare each theme with enough resolution for 1080 × 1920 export.
- Test each theme with text and paper card overlay.

## Theme naming

Theme names should be customer/product-friendly internally, but may not be exposed to end users.

Examples:

```text
Ruby
Black
Sepia
Blush
Teal
Cream
Olive
Navy
Chocolate
```

Final names can align with product variant names.

## Admin theme selection timing

Theme should be selected before activation / fulfillment, but editable later.

If theme is changed after activation, customer pages should update immediately.
