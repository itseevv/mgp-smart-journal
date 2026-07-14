# Product Data Promises

## Status

Internal product and copy reference. Last reviewed: 13 July 2026.

This document records the agreed direction, current technical evidence, copy boundaries, and launch gates for customer-facing claims about NFC access, storage, privacy, ownership, export, and self-hosting.

It is not itself a Privacy Policy or Terms of Service, and it is not legal advice. Re-review it whenever the storage architecture, export behavior, commercial model, or legal terms change.

## Product-owner intent

The product owner is willing to make and fund the following commercial commitments:

- Storage included with the Journal should not require a subscription.
- Existing customers should not later be charged a recurring fee to retain or open content stored within the Journal's included capacity.
- Customer memories remain the customer's content.
- Full-Journal export should be delivered so customers can take their stored content with them.
- Lifetime storage is an intended product promise, subject to the operational and policy launch gates below.

Self-hosting is not currently an agreed customer capability.

## Executive decision table

| Claim | Decision | Publication status |
|---|---|---|
| Up to 3,285 photos per Journal | Supported by the current product and database limits | May publish |
| No subscription required for included storage | Accepted commercial commitment | May publish with the scope stated |
| Private by default | Supported by the current access model | May publish |
| Protected by a six-digit Owner PIN | Supported by the current product | May publish |
| Your memories remain yours | Accepted ownership principle | May publish after Terms grant only the limited processing licence the service needs |
| Lifetime storage included | Accepted direction, but not yet fully operationally substantiated | Publish only after the lifetime-storage gates are complete and the term is defined prominently |
| Export your entire Journal at any time | Feasible with the current data model, but not implemented | Do not publish until full export ships and is verified |
| Export every original upload at full resolution | Not supported by the current media pipeline | Do not publish |
| 100% private / 100% secure | Absolute claim is not supportable | Never publish |
| Only you can ever access your data | Not technically accurate | Do not publish |
| Even we cannot access your photos | Not technically accurate without end-to-end encryption | Do not publish |
| Self-hosting available | Not currently productized | Do not publish |
| Your data can never be lost / the service will operate forever | Not supportable | Never publish |

## Approved customer-facing language

The following is the strongest currently supportable language bank. It is a reference for later product-page writing, not a required final layout.

### May be used now

- **No subscription required for your Journal's included storage.**
- **Up to 3,285 photos across 365 Daily Memory Stamps.**
- **Private by default.**
- **Protected by your six-digit Owner PIN.**
- **Your memories remain yours.**
- **No battery or Bluetooth pairing is required for the passive NFC entry point.**
- **The NFC chip opens your Journal; it does not hold the photographs themselves.**
- **Save or share any Daily Memory Stamp as an image.**

Any phone-compatibility or “no app download required” wording must still be checked against the final supported-device matrix and production browser flow.

### May be used only after the relevant launch gates

- **Lifetime storage included.**
- **Export your entire Journal at any time.**
- **Download every memory stored in your Journal.**
- **Delete your Journal data when you choose.**
- **If the service is ever discontinued, we will provide advance notice and a complete export path.**

### Must not be used

- **100% private.**
- **100% secure.**
- **Only you can ever access your photos.**
- **Even we cannot see your data.**
- **Impossible to hack.**
- **Your data can never be lost.**
- **Unlimited storage.**
- **Permanent availability guaranteed.**
- **Export your original full-resolution uploads.**
- **Self-hosting available.**
- **Delete every trace instantly.**

## Definition of “lifetime storage”

The data model has no automatic expiry or time-to-live rule. That supports long-term retention, but it does not by itself prove that data can never be lost or that the service will operate forever.

If `Lifetime storage included` is used, the meaning must be stated prominently near the claim and in the Terms. The recommended definition is:

> Lifetime storage means storage for the operational life of the Scrap Day service, within the capacity included with the purchased Journal and subject to the Terms. If the service is ever discontinued, customers will receive advance notice and an opportunity to export their Journal.

The definition must not be hidden in a way that makes the headline promise materially misleading. “Lifetime” does not mean:

- unlimited storage;
- guaranteed operation for the customer's biological lifetime;
- immunity from outages or security incidents;
- retention after a customer requests deletion;
- retention of unlawful content;
- storage beyond the included product capacity.

## Lifetime-storage launch gates

Do not treat lifetime storage as fully substantiated until all of the following are in place:

- A paid production hosting plan appropriate for long-term availability.
- Scheduled database backups or point-in-time recovery.
- Independent, encrypted, off-site backup of the actual `memory-media` Storage objects.
- A documented retention schedule for live data, deleted data, exports, logs, and backups.
- Automated backup monitoring and alerting.
- A successfully tested restore procedure covering both database metadata and media files.
- A service-discontinuation plan with a defined advance-notice period and export window.
- Terms defining the included capacity, lifetime, acceptable use, deletion, and discontinuation boundaries.
- A Privacy Policy identifying the controller, processors, purposes, data locations, retention, user rights, and contact route.

Important infrastructure limitation: managed Supabase database backups do not include the image objects stored through the Storage API. Database backup alone is therefore insufficient to support the lifetime-storage promise.

## No-subscription commitment

The accepted commitment is narrow and durable:

> A customer will not need a recurring subscription to retain or use the storage capacity included with the purchased Journal.

This does not prevent the business from later offering optional paid extras, additional capacity, new products, or premium services. It does mean that existing included storage and access must not later be placed behind a mandatory recurring fee.

Avoid broader claims such as “everything will always be free forever.”

## Customer ownership

The intended principle is that customers retain ownership of the photographs and words they add to their Journal. The Terms should give the service only the limited licence required to host, process, display, back up, and export that content.

The preferred marketing expression is:

> Your memories remain yours.

Avoid `Your data is yours forever`. Ownership and permanent hosting are different promises, and “forever” conflicts with customer deletion requests, lawful removal, and service termination.

Before expanding the claim to `You stay in control of what you keep, export or delete`, the product must ship:

- full-Journal export;
- whole-Journal deletion;
- deletion status and failure handling;
- a documented backup-deletion and retention policy;
- a customer route for data-access, correction, export, and erasure requests.

## Privacy and security boundary

The current system supports `Private by default` because:

- customer media is stored in a non-public bucket;
- owner-based row-level security protects application data and media;
- access is protected by a six-digit Owner PIN;
- raw PINs are not stored;
- failed PIN attempts are rate-limited and temporarily blocked;
- media is delivered through time-limited signed URLs;
- the fulfilment Admin UI is designed not to expose customer photos, private media paths, or signed URLs.

The system does not support `100% private` or `Only you can ever access it` because:

- it is not end-to-end encrypted;
- trusted server components use a service-role credential that can bypass row-level security;
- infrastructure providers process and host the data;
- authorized operational access, incident response, legal requests, mistakes, and security breaches cannot be described as impossible;
- signed media URLs remain usable until their expiry time.

If stronger privacy is required later, it must be expressed as specific, testable controls rather than an absolute percentage.

## Full-Journal export boundary

The current production feature exports one Daily Memory Stamp as a 1080 × 1920 PNG and can save or share that image. It does not export the complete Journal.

The data model can support a future full export containing:

- Journal name and theme information;
- each Daily Memory Stamp's local date, title, and ordering;
- stored display photographs;
- crop and layout metadata;
- a machine-readable JSON or CSV manifest;
- optionally, rendered Daily Memory Stamp images.

The current upload pipeline does not preserve the original uploaded file. It re-encodes each photograph into:

- a display image with a maximum edge of 2,000 pixels; and
- a 480-pixel thumbnail.

Therefore, after full export ships, the accurate promise is:

> Export all content stored in your Journal.

It is not accurate to promise:

> Export every original, full-resolution upload.

Supporting original-file export would require changing the upload and storage model to retain original uploads, with corresponding storage-cost, privacy, backup, and deletion consequences.

### Full-export launch gates

- Define exactly which files and metadata constitute a complete export.
- Implement an authorized whole-Journal export endpoint or background job.
- Package the export in a documented, portable format such as ZIP plus JSON/CSV.
- Handle large files, progress, retries, timeouts, and partial failures.
- Use short-lived download access and automatically delete generated export archives.
- Test exports at the full 3,285-photo capacity.
- State clearly that exported photos are the stored display versions unless originals are retained in the future.

## Self-hosting decision

Self-hosting is technically possible in principle because the application uses Next.js, PostgreSQL, Supabase Auth, Supabase Storage, database migrations, and Edge Functions. Supabase itself has a self-hosted distribution.

Self-hosting is not currently a customer feature. A deployable self-hosted edition would also need:

- a supported deployment package;
- database, Auth, Storage, and Edge Function migration tooling;
- customer-managed secrets and key rotation;
- backup, monitoring, updates, security hardening, high availability, and support documentation;
- a safe media migration process;
- a solution for NFC tags already encoded with the hosted `APP_BASE_URL`, such as reprogramming or a permanent redirect domain;
- a clear division of security, availability, recovery, and support responsibility.

Until that work is complete, do not say `Self-hosting available`. At most, use an internal roadmap statement that the architecture is sufficiently portable for a future self-hosted edition to be investigated.

## Additional claims that remain unsupported

Do not promise the following without new evidence or product work:

- zero data loss;
- uninterrupted or permanent service availability;
- offline access;
- compatibility with every phone or every phone case;
- storage in one specific country for all processing and backups;
- immediate deletion from every backup and log;
- public/private sharing controls for the complete Journal;
- video or voice support in the current Journal product;
- unlimited or expandable capacity;
- access recovery when both the Owner PIN and Recovery Passcode are lost;
- whole-Journal portability before full export ships.

## Product-page information hierarchy

When this material is eventually used on a product detail page, the recommended order is:

1. Human outcome: the physical Journal keeps what the day felt like; the digital layer keeps what it looked like.
2. Simple mechanism: tap the passive NFC entry point to open this Journal's private digital page.
3. Included capacity and price model: up to 3,285 photos, with no subscription required for the included storage.
4. Privacy reassurance: private by default and protected by the Owner PIN.
5. Plain-language explanation that photographs live in private cloud storage, not on the NFC chip.
6. Export and ownership controls, but only after those features have passed their launch gates.
7. Detailed FAQ and policy links.

The page should explain technology clearly without positioning the Journal as a technical dashboard, file vault, or generic smart device.

## Evidence in this repository

- `data/journal-product.ts`: 365-day model, nine photos per Daily Memory Stamp, and 3,285-photo capacity.
- `supabase/migrations/202607130001_journal_year_photo_capacity.sql`: database-enforced Journal capacity.
- `supabase/migrations/202606110001_phase_3a_persistent_capsule.sql`: PIN-backed ownership model, row-level security, and private Storage bucket.
- `docs/phase-3a-supabase.md`: security model, signed media access, and media processing behavior.
- `docs/phase-7-provisioning.md`: NFC/QR locator boundary and Admin privacy boundary.
- `lib/media/photo-optimisation.ts`: re-encoding of uploads into display and thumbnail variants.
- `data/memory-demo.ts`: current 2,000-pixel display and 480-pixel thumbnail settings.
- `components/export/daily-stamp-export-composer.tsx`: current single-Day save/share capability.
- `lib/admin/app-base-url.ts`: hosted domain embedded in generated NFC/QR URLs.

## External infrastructure references

- Supabase database backups: <https://supabase.com/docs/guides/platform/backups>
- Supabase Storage access control: <https://supabase.com/docs/guides/storage/security/access-control>
- Supabase private Storage delivery: <https://supabase.com/docs/guides/storage/serving/downloads>
- Supabase shared-responsibility model: <https://supabase.com/docs/guides/deployment/shared-responsibility-model>
- Supabase self-hosting responsibilities: <https://supabase.com/docs/guides/self-hosting>
- UK CAP guidance on substantiating objective advertising claims: <https://www.asa.org.uk/advice-online/substantiation.html>
- UK CMA unfair-commercial-practices guidance: <https://www.gov.uk/government/publications/unfair-commercial-practices-cma207/unfair-commercial-practices>

## Re-review triggers

Review and update this document before publishing new data claims whenever any of the following changes:

- storage provider or production region;
- backup and disaster-recovery design;
- included capacity or commercial pricing;
- original-file retention behavior;
- full-Journal export or deletion capability;
- public/private sharing behavior;
- PIN, recovery, authentication, or encryption model;
- Privacy Policy, Terms, DPA, or subprocessor list;
- self-hosting or service-discontinuation policy.
