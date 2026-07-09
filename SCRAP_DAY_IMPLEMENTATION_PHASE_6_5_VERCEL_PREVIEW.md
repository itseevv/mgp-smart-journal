# Scrap Day Phase 6.5 Vercel Preview Deployment

## Vercel Deployment

- Stable preview URL: `https://journal-chip-preview.vercel.app`
- Final preview deployment URL: `https://journal-chip-hi96mpw4i-itseevvs-projects.vercel.app`
- Final preview deployment id: `dpl_7YhdyUp4i3W1VmkpyjSDh9uMmEXm`
- Vercel project: `itseevvs-projects/journal-chip`
- Framework preset fixed from `Other` to `Next.js`.
- Vercel SSO protection was temporarily disabled for QA, then restored after testing.

## Environment Variables Configured

### Vercel Preview

Configured without exposing secret values:

- `NEXT_PUBLIC_SUPABASE_URL` -> DEV Supabase project `ernuyqpzybofsqkrpiqr`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSCODE`
- `ADMIN_SESSION_SECRET`
- `APP_BASE_URL=https://journal-chip-preview.vercel.app`

### Supabase DEV Edge Function

Configured on DEV project `ernuyqpzybofsqkrpiqr`:

- `ALLOWED_ORIGIN=https://journal-chip-preview.vercel.app`
- `APP_BASE_URL=https://journal-chip-preview.vercel.app`
- `ALLOWED_ORIGINS=http://localhost:3000`

Existing required secrets were present:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RECOVERY_CODE_PEPPER_V1`

Also deployed updated DEV Edge Function:

- `capsule-access`

## Routes Tested

- `/journal/demo?screen=home&month=2026-07` -> 200
- `/journal/demo?screen=create` -> 200
- `/journal/demo?screen=crop` -> 200
- `/journal/demo?screen=detail&photos=9` -> 200
- `/admin/journal-themes` -> 200
- `/api/admin/session` -> 200 unauthenticated, then admin login succeeded
- `/c/c766b057ec13e93237b91caa4ac94cb76420db9f65550003` -> opened, activated/unlocked, loaded journal

## Mobile Devices / Browsers Tested

- Playwright Chromium desktop: `1280x900`
- Playwright Chromium iPhone 14 emulation
- Playwright Chromium Pixel 7 emulation

Physical iPhone Safari and Android Chrome were not available in this Codex environment.

## Texture Upload / Rendering Result

- Admin passcode login worked from `/admin/capsules`.
- Journal theme list loaded from `/admin/journal-themes`.
- Created QA theme: `phase-65-preview-mraskxep`
- Uploaded texture to Supabase bucket `journal-theme-assets`.
- Uploaded test asset: `dark-brown-leather-texture-9x16.webp`
- Uploaded dimensions: `2160 x 3840`
- Uploaded MIME type: `image/webp`
- Assigned QA theme to test journal capsule.
- Customer `/c/[publicToken]` received the assigned theme after deploying the updated `capsule-access` Edge Function.
- Desktop customer outer page did not stretch the uploaded texture globally:
  - `main` background image: `none`
  - outer background color: theme fallback color
- Mobile journal shell used uploaded texture:
  - shell `::before` background included Supabase storage texture URL
  - shell background size: `cover`

## Create / Seal / Export Result

- Activated test capsule with owner PIN.
- Ran create flow on preview:
  - `Seal Today`
  - chose Cover Scrap
  - Scrap Table opened
  - confirmed crop with `Use this scrap`
  - sealed as `Phase 6.5 preview stamp`
  - detail route opened successfully
- Daily Memory Stamp export worked on Vercel:
  - export composer opened
  - generated image preview was ready
  - preview blob dimensions: `1080 x 1920`

## No ngrok URLs

- Searched app/source/config paths for `ngrok` / `ngrok-free`.
- No ngrok URL remains in user-facing app routes or deployed config.
- Remaining local references are only in dev/test documentation and scripts.

## Deployment Fixes Made

- Added `.vercelignore` so preview uploads do not include `.next/`, `.vercel/`, `node_modules/`, `.env*`, PDFs, or ZIPs.
- Added `.vercel/` to `.gitignore`.
- Fixed Phase 6A admin batch token generation SQL to call `extensions.gen_random_bytes(24)`.
- Added migration:
  - `supabase/migrations/202607070001_scrap_day_phase_6_5_admin_batch_token_generation.sql`
- Applied that minimal SQL to DEV Supabase with `supabase db query --linked --file ...`.
- Deployed DEV `capsule-access` Edge Function so customer routes receive assigned journal theme data.

## Known Issues / Follow-Ups

- Deferred to Phase 7: mobile journal identity/header area still needs a clearer visual boundary and material hierarchy.
- Vercel rejected a `7.4MB` PNG texture upload with `413 Request Entity Too Large`; a `1.3MB` WebP upload worked. Production texture uploads should stay comfortably under Vercel request body limits or move to a direct-to-storage upload path later.
- Vercel SSO protection is restored. External phone testing of the preview URL requires either temporary SSO disablement again or a Vercel-approved access path.

## Commands Run And Results

- `git status --short` -> dirty worktree confirmed.
- `git log --oneline -5` -> current branch history inspected.
- `npm test` -> passed, 85 tests.
- `npm run lint` -> passed.
- `npx vercel project add journal-chip` -> created Vercel project.
- `npx vercel link --yes --team itseevvs-projects --project journal-chip` -> linked local checkout.
- `npx vercel env add ... preview` -> configured Preview env vars.
- `npx supabase secrets set --project-ref ernuyqpzybofsqkrpiqr ...` -> configured DEV Edge Function origins.
- `npx vercel project update journal-chip --framework nextjs --auto-detect build-command --auto-detect output-directory` -> fixed project preset.
- `npx vercel deploy --target preview --yes --force` -> final preview build succeeded.
- `npx vercel alias set journal-chip-hi96mpw4i-itseevvs-projects.vercel.app journal-chip-preview.vercel.app` -> stable alias updated.
- `npx supabase db query --linked --file supabase/migrations/202607070001_scrap_day_phase_6_5_admin_batch_token_generation.sql` -> DEV RPC fix applied.
- `npx supabase functions deploy capsule-access --project-ref ernuyqpzybofsqkrpiqr` -> DEV Edge Function deployed.
- Playwright Chromium route/admin/customer/export smoke -> passed.
- `npx vercel project protection enable journal-chip --sso` -> Vercel SSO protection restored.
