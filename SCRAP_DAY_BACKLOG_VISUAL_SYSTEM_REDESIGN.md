# Scrap the Day - Export & Visual System Redesign Backlog

## Status

Deferred. Do not implement until after the journal theme/background system and Vercel preview are in place.

## Why this exists

Phase 5A proved that Daily Memory Stamp export technically works: PNG generation, save, and share are functional. However, the exported 9:16 poster is not visually acceptable for launch.

Current issues:

- Poster feels too empty.
- Memory Stamp image area is too small.
- Photo borders feel too heavy.
- Logo has an unwanted background block.
- Logo is not visually integrated.
- Export does not yet feel like a premium lifestyle / journal product.
- Current leather background is temporary and too rough.
- App view and export view do not yet share a polished visual system.

## Future redesign scope

### Daily 9:16 Export

- Redesign poster composition.
- Make the Memory Stamp larger and more central.
- Improve date/title hierarchy.
- Reduce excessive empty space.
- Refine paper mat and stamp frame.
- Use uploaded transparent MGP logo.
- Place MGP logo subtly, likely bottom-right or top-right.
- Do not show journal name in first version.
- Do not show "Private by nature."
- Do not use "powered by."
- Do not use SD mark.

### Monthly 9:16 Export

- Use 4x8 fixed Month Sheet grid.
- Show month title.
- Show small day markers only.
- Do not show headlines.
- Do not show journal name.
- Use MGP mark only.

### Shared Visual System

- App Daily Memory Stamp view.
- App Month Sheet view.
- Daily export.
- Monthly export.
- Shared leather background / journal theme.
- Shared paper mat.
- Shared stamp-edge frame.
- Shared logo placement rules.
- Mobile-first layout rhythm.

### Journal Background / Leather Theme System

- Around 10 journal leather/background designs.
- Admin selects the journal's leather/background before activation.
- Selected theme controls the user-facing NFC page background.
- Export layouts reuse the same theme source.
- Current theme tokens/backgrounds are placeholders.

### Admin Theme Selection

- Add an admin field for journal theme/background.
- Theme is selected before journal activation.
- User does not select the theme in MVP.

### Leather / Paper Material Polish

- Replace the current rough leather simulation.
- Tune paper texture.
- Tune color contrast across journal themes.
- Ensure accessibility and readability.

### Stamp-Edge Polish

- Finalize perforation edge style.
- Tune large, medium, and small variants.
- Make sure it looks physical but not childish.

### Typography and Spacing

- Refine editorial serif scale.
- Establish a mobile-first rhythm.
- Avoid a functional dashboard feeling.

## Dependencies

- Journal theme/background system.
- Admin-selected journal theme.
- Final or placeholder transparent MGP logo asset.
- Vercel preview for real mobile QA.

## Not part of immediate implementation

- Do not redesign export by local tweaks only.
- Do not implement monthly export until visual system direction is clearer.
- Do not implement admin theme asset upload in this backlog item unless separately scoped.
