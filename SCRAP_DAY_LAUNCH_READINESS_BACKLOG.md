# Scrap the Day Launch Readiness Backlog

## Status

Planning input / backlog. Do not treat this as an implementation plan yet.

## Date Recorded

2026-07-06

## Target

The product owner wants the whole system ready by **2026-07-11**.

Ready means the product is coherent and shippable across:

- Frontend journal creation, detail, Month Sheet, and export flows.
- Backend persistence, access control, local-date integrity, recovery, and admin flows.
- Redesign and visual polish.
- NFC chip / capsule provisioning flow.
- Deployment and Vercel preview.
- Pre-launch hardening, QA, and regression coverage.

## Why This Exists

Several areas now technically work or have clear product direction, but are not yet optimized or launch-ready. This file is the unified tracking entry so the next planning pass can turn the backlog into a prioritized implementation sequence.

This record intentionally separates:

- What is known to be unfinished or not yet optimized.
- What should be planned later.
- What should not be implemented immediately without sequencing.

## Known Backlog Inputs

### Phase 2B - Additional Moments Optional Adjust Scrap

Source: `SCRAP_DAY_BACKLOG_PHASE_2B_ADDITIONAL_MOMENTS_ADJUST_SCRAP.md`

Status: deferred / backlog.

Summary:

- Additional moments currently auto-crop into square stamp frames.
- Additional moments do not yet support manual "Adjust scrap."
- Future behavior should keep auto-crop as the default while allowing each additional moment to optionally enter the same Scrap Table.
- Cover Scrap must still automatically enter Scrap Table.
- Additional moments must not be forced through Scrap Table.

Launch relevance:

- Needed if final Memory Stamps must feel curated across all photos, not only the cover.
- Should be sequenced carefully because it touches create/edit UX, crop metadata, save/load mapping, saved detail rendering, and QA coverage.

### Export & Visual System Redesign

Source: `SCRAP_DAY_BACKLOG_VISUAL_SYSTEM_REDESIGN.md`

Status: deferred until journal theme/background system and Vercel preview are in place.

Summary:

- Daily 9:16 export works technically after Phase 5A.
- The current poster is not visually acceptable for launch.
- The Memory Stamp is too small, poster composition feels empty, photo borders feel too heavy, logo integration is weak, and the leather background is temporary.
- App Daily Memory Stamp, Month Sheet, daily export, and monthly export need a shared visual system.

Launch relevance:

- Required for the product to feel premium, coherent, and ready to share.
- Should not be solved as tiny local export tweaks only; it needs a shared app/export design direction.

### Journal Theme / Background System

Source: `SCRAP_DAY_BACKLOG_VISUAL_SYSTEM_REDESIGN.md`

Status: dependency for visual/export redesign.

Summary:

- Around 10 journal leather/background designs are expected.
- Admin should select the journal theme before activation.
- User-facing NFC page and export layouts should reuse the same selected theme source.
- Current theme tokens/backgrounds are placeholders.

Launch relevance:

- Needed before final export polish and final mobile visual QA.
- Also touches admin flow and capsule activation expectations.

### Vercel Preview / Real Mobile QA

Source: product owner note, Phase 5A limitations, visual redesign backlog.

Status: required before final launch confidence.

Summary:

- Local QA has proven core flows, but real mobile behavior needs Vercel preview validation.
- Export save/share behavior varies by platform.
- Visual polish must be tested on real mobile screens.

Launch relevance:

- Required before calling export, NFC route, and mobile-first journal flows ready.

### Launch Hardening

Source: product owner note and existing implementation/audit docs.

Status: planning input.

Summary:

- Review frontend and backend regression coverage.
- Verify access control, private media handling, signed URLs, admin session behavior, recovery flows, and capsule provisioning.
- Confirm deployment environment variables and production build behavior.
- Re-run smoke, mobile, security, and recovery checks before launch.

Launch relevance:

- Required before production rollout.
- Should be a dedicated final pass, not mixed into visual polish without a checklist.

## Not Yet an Implementation Plan

The next planning pass should decide:

- Development order.
- What must ship before 2026-07-11.
- What can remain backlog after launch.
- Which work is blocking versus polish.
- Which pieces need backend migrations, admin UI, QA scripts, or Vercel/mobile verification.

Do not start implementation from this file alone. Use it as the source of truth for the next sequencing and implementation-plan request.
