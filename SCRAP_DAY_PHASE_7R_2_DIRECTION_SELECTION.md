# Scrap Day Phase 7R.2 Direction Selection

## Selected Direction

Selected direction: Direction B — Tactile Journal Insert.

The product owner reviewed `/design/scrap-day-v2` and selected Direction B as the production north star for Journal Home / Month Sheet.

## Why Direction B Was Selected

- Best leather/paper contrast.
- Paper sheet feels like a comfortable journal insert.
- Tactile without becoming childish scrapbook.
- Still photo-first.
- Best fit for the premium editorial memory archive direction.

## What To Preserve From Direction B

- Leather background remains visible as journal identity.
- Month Sheet reads as a soft paper insert placed over the leather.
- Paper is light and refined, not a thick cream card.
- Photos remain the hero.
- 3-column mobile grid remains tight and readable.
- One sealed day equals one square Cover Scrap.
- Date captions sit below images in 01 format.
- Header stays compact with small journal name and small Seal Today pill.
- Rename / Lock remain hidden in a settings/menu treatment, not main content.
- Month title and navigation remain quiet.
- Controls use theme-aware paper/ink or leather-safe tokens.

## What To Avoid When Implementing

- Do not implement Direction A.
- Do not implement Direction C unless borrowing tiny details directly supports Direction B.
- Do not make the paper surface heavier than the photo grid.
- Do not add decorative photo borders, white mats, nested frames, postage edges, or perforation.
- Do not use tile headlines or date overlays.
- Do not render empty placeholders or future slots.
- Do not make Seal Today a giant central CTA.
- Do not expose Rename / Lock as primary page content.
- Do not hardcode blue or a one-theme palette that fails on ivory.
- Do not change crop metadata, local_date, duplicate-day handling, one-day-one-stamp logic, image caps, texture upload/storage, auth, database, policies, migrations, or export canvas generation.

## Production Implementation Scope

Phase 7R.3 implements Direction B on:

- `/c/[publicToken]` journal home
- `/journal/demo?screen=home`
- shared Month Sheet components needed by those routes

Out of scope:

- Daily Memory Stamp Detail
- Create/Edit flow
- Scrap Finder
- Save/Share modal
- Daily export canvas
- Monthly export
- Admin pages
