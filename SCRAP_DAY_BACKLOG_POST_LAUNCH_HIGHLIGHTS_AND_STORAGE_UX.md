# Scrap Day Backlog: Post-launch Highlights and Storage UX

## Status

- **Stage:** Post-launch backlog
- **Launch blocker:** No
- **Implementation approval:** Not granted by this document
- **Recorded:** 2026-08-13

## Context

The product is moving away from selling or presenting a fixed number of
Memory Days or Memory Stamps. A customer may use the same Journal for frequent,
light daily rituals or for occasional, media-rich life events. The product must
support both patterns without asking the customer to classify themselves or the
day before they start recording.

The commercial limit is shared account-level Archive capacity rather than a
customer-visible count of Memories. The Starter Pack includes 1 GB. Dates remain
part of the Memory and archive experience, but they do not define the purchased
entitlement.

## Locked Product Constraints

1. Daily and important Memories use the same Memory model and the same creation
   entry point.
2. Do not ask whether the customer is creating a "daily" or "special" Memory in
   onboarding or at the start of creation.
3. Preserve the existing title and date fields. A daily Memory does not require a
   separate reduced form.
4. Preserve the existing launch creation experience, including the current photo
   and voice-note capabilities, until a separately approved implementation phase.
5. Do not infer importance from media quantity. A short voice note may be more
   meaningful than a large photo set.
6. Customers should be able to record at their own rhythm. Higher media usage
   consumes the shared archive faster; it does not turn the Memory into a
   different product type.
7. Included and purchased capacity belongs to the customer's Archive account,
   not permanently to one Journal, Folio, Capsule, NFC chip, or Chapter.
8. The commercial promise is **no subscription**. Existing Memories, NFC access,
   export, and creation within purchased capacity must not later be placed behind
   a recurring membership.
9. The current Starter Pack entitlement is **1 GB**, shared across compressed
   photos, Voice Notes, written Memories, and video after video support launches.

## BL-009: Highlights Collection

### Objective

Let customers curate a collection of the Memories that matter most without
removing those Memories from the chronological archive.

### Experience

- A customer can add or remove an existing Memory from **Highlights**.
- The action remains lightweight and reversible.
- Highlights use a cover-led collection treatment inspired by saved story
  collections: cover, title, and date or year.
- Opening a Highlight opens the same complete Memory detail view used elsewhere.
- The chronological archive remains the source of truth; Highlights are a
  curated view, not a second copy of the Memory.
- Do not automatically add a Memory to Highlights based on photo count, video
  duration, storage use, title, or date.
- Do not show an empty Highlights shelf to a customer who has not created one.

### Candidate interaction

- Post-save action: `Add to Highlights`
- Existing Memory action menu: `Add to Highlights` / `Remove from Highlights`
- The exact placement and wording require a separate design phase.

### Acceptance criteria

1. Highlighting never changes the underlying Memory content or archive date.
2. A Memory appears at most once in Highlights.
3. Removing a Highlight never deletes the Memory.
4. The customer explicitly controls Highlight membership.
5. Highlights work for a one-photo Memory, voice-led Memory, or media-rich event.

### Dependencies and expected scope

- Persistent Highlight metadata or a collection relationship
- Read and mutation APIs with owner authorization
- Collection UI and Memory action UI
- Empty, loading, error, and removal states
- Frontend and backend regression coverage

This is intentionally deferred because it changes both frontend and backend and
must not block the first launch.

## BL-010: Archive Capacity Disclosure and Expansion UX

### Objective

Keep storage accounting transparent without making capacity anxiety part of the
daily recording ritual.

### Product communication

- Do not lead with GB in the headline or primary USP.
- Do not advertise unlimited storage when a finite limit exists.
- State the exact included capacity in product details and before purchase.
- Explain that actual usage depends on the size and mix of photos, video, and
  voice recordings.
- Permit photos, video, voice, and text to share one archive allowance rather
  than selling separate media quotas.

Candidate product copy:

> Every Memento includes a private digital archive. Add photos, video, voice and
> words in any combination. Expand your archive only if you ever need more space.

Hero capacity proof:

> 1GB of archive storage included. No subscription.

Required purchase-detail copy before video launches:

> Includes 1GB of account storage shared across compressed photos, Voice Notes
> and written Memories. Actual number of Memories varies by your media mix.

Required purchase-detail copy after video launches:

> Includes 1GB of account storage shared across compressed photos, video, Voice
> Notes and written Memories. Actual number of Memories varies by your media mix.

### In-product behaviour

- Do not show a persistent storage meter on the primary archive/home screen.
- Show exact used and total capacity in Settings or Archive Details.
- Notify at approximately 80% and 95% use.
- At 100%, preserve viewing, export, and deletion. Block only new storage use
  until the customer frees space or expands the archive.
- Provide an `Expand archive` action from the capacity view and threshold
  notifications.
- A paid 1 GB expansion is a one-time purchase currently targeted at **£19.99
  including VAT**. It is a fairness SKU, not the primary profit engine.
- After a successful expansion, add the capacity to the same account-level
  Archive pool and refresh the displayed entitlement and remaining capacity.
- Expansion must not require a new Journal or physical product and must not
  require the customer to reactivate an existing product.
- Prepare the low-complexity digital expansion before video launches or before
  the first customers approach the 80% threshold. It may initially be an in-app
  or hidden Shopify SKU rather than a public launch collection item.

Candidate capacity view:

```text
Archive storage
0.8 GB of 1 GB used

[ Expand archive ]
```

### Paid expansion fulfilment flow

Capacity is owned by the customer's account-level Archive. It must not be
granted to a single Capsule, NFC Seal, Journal, browser session, or email
address.

```text
Authenticated Archive
        |
        v
Customer selects Expand archive (+1 GB)
        |
        v
Backend creates purchase intent
(archive_account_id + SKU + signed/opaque reference)
        |
        v
Shopify checkout and payment
        |
        v
Paid-order webhook reaches backend
        |
        v
Verify HMAC, payment state, SKU, quantity and idempotency key
        |
        v
Append +1 GB grant to Archive storage-entitlement ledger
        |
        v
Quota service recomputes total, used and remaining capacity
        |
        v
Frontend revalidates and displays the new account-level total
```

Example ledger after one expansion:

```text
Starter entitlement       +1 GB
Order expansion           +1 GB
--------------------------------
Archive total              2 GB
```

Required behaviour:

1. The customer must be authenticated into the target Archive before the
   purchase intent is created.
2. The backend creates an opaque purchase-intent reference tied to the internal
   `archive_account_id`, the fixed expansion SKU, and quantity. The browser must
   not be allowed to choose an arbitrary account identifier or storage amount.
3. The reference is passed to Shopify in a signed or server-controlled order
   attribute/metafield so the paid order can be reconciled with the Archive.
4. A Shopify paid-order webhook is the source of truth. The backend verifies
   the Shopify HMAC, paid state, line-item SKU and quantity before granting
   storage. The checkout success page alone never grants capacity.
5. Webhook processing is idempotent. A stable order/line-item key prevents
   retries or duplicate events from granting the same capacity twice.
6. Capacity is recorded as an append-only entitlement event, not by silently
   overwriting a total. The quota service derives the current total from valid
   grants and returns total, used and remaining capacity to the frontend.
7. On return from checkout, the frontend revalidates server-side entitlement.
   If the webhook is still pending, show `Adding storage...` and poll briefly;
   then update, for example, from `0.8 GB of 1 GB` to `0.8 GB of 2 GB`.
8. Failed webhook deliveries enter a retry/reconciliation path. Support must be
   able to locate the purchase intent and Shopify order without asking the
   customer to buy again.
9. A refund never deletes Memories. If policy requires capacity reversal, add
   an auditable reversal event; an over-quota Archive keeps viewing, export and
   deletion access while new media uploads remain paused.

### Admin role

Admin is a control and reconciliation surface, not the normal mechanism that
delivers paid capacity. It should allow authorized staff to:

- search by Archive account, purchase intent, or Shopify order;
- view starter grants, paid grants, reversals, used capacity and current quota;
- retry or reconcile failed fulfilment;
- apply a reason-coded, audited manual correction when automated reconciliation
  cannot resolve an exception;
- see who made a correction and when.

The admin capacity screen does not need access to the customer's private media.
Routine paid expansions should complete automatically through the verified
webhook flow.

This flow depends on the Archive Owner/account layer and account-level pooled
quota described in BL-011. The current single-Capsule model cannot safely
support it without that foundation.

### Technical disclosures

The customer-facing product detail or support documentation must state:

- supported file formats;
- maximum single-file size;
- whether media is stored as an original or an optimized version;
- video processing/compression behaviour;
- upload retry and failure behaviour;
- what "long-term" or "lifetime" storage means;
- export and account-closure behaviour.

These limits are technical safeguards, not the core marketing proposition.

### Acceptance criteria

1. Exact capacity is visible before purchase and in account details.
2. The main recording flow does not continuously foreground remaining GB.
3. Threshold notifications are sent once per threshold crossing unless usage
   later falls below and crosses the threshold again.
4. A paid expansion updates the server-side entitlement before the frontend
   presents the added capacity as available.
5. Duplicate order events cannot grant the same expansion twice.
6. A refund never deletes customer media automatically.
7. An expansion is attached to the customer's Archive account, not inferred from
   an email address and not permanently attached to one Capsule.
8. The customer retains access to old content without buying an expansion or
   starting a subscription.

## BL-011: Account-level Archive and Multi-Seal Chapters

### Objective

Support a growing Archive in which multiple detachable NFC Chapter Seals open
different Chapters while all Memories and purchased capacity remain owned by one
customer account.

### Product roles

- **Leather Journal:** durable long-term base.
- **Fabric Folio:** validated aesthetic layer and primary physical profit SKU.
- **Chapter Seal:** detachable NFC entry point for a Chapter.
- **Chapter Keeper:** collectible leather holder for a retired Seal; the stored
  Seal remains scannable.
- **Archive storage:** account-level digital resource that grows with use.
- **1 GB Digital Expansion:** fair non-physical expansion option.

Do not position Fabric Folio replacement around wear. Its value is the verified
aesthetic differentiation, collectability, and ability to change the appearance
of the Journal.

### Ideal experience

1. Seal A starts Chapter 01 and deep-links into that Chapter.
2. The customer may buy a digital 1 GB expansion without buying any hardware.
3. A later Seal B starts Chapter 02 and deep-links into that Chapter.
4. Seal A continues to open Chapter 01 after it is moved into a Chapter Keeper.
5. Both Chapters appear in one account-level Archive with All Memories and
   Highlights views.
6. New storage joins the common Archive capacity pool.
7. Lost, disabled, replaced, or transferred Seals do not own or delete the
   customer's digital Memories.

### Required architecture before public Chapter Seal sales

- durable Archive Owner/account identity;
- multiple NFC chips bound to one Archive;
- default Chapter/deep-link destination per chip;
- account-level pooled quota and entitlement ledger;
- All Memories and Highlights views across Chapters;
- lost, disable, rebind, unlink, and transfer rules;
- order-to-account attribution that does not rely on matching email alone;
- idempotent Shopify webhook fulfilment and audited Admin correction.

The current code remains Capsule-oriented. Do not publicly promise the complete
multi-Seal experience or sell Chapter Seal Sets until this architecture is
implemented and verified.

### Candidate post-architecture SKUs

- 1 GB Digital Expansion: £19.99 including VAT.
- Chapter Seal + Chapter Keeper + 1 GB: candidate £34.99, pending real BOM and
  fulfilment validation.
- Fabric Folio + Chapter Seal + 1 GB: existing Fabric Folio price plus £19.99;
  do not casually discount the already validated Folio.

These are future candidates, not launch commitments. Chapter Seal Set, Chapter
Keeper, physical expansion bundles, and a 3 GB pack remain hidden at launch.

## Future Exploration: Progressive Media Disclosure

The current creation flow should remain shared by all customers. If future
usability testing shows that nine visible photo positions or several media tools
make everyday creation feel heavy, test progressive disclosure without asking
the customer to label the day.

Preferred neutral pattern:

1. Show the first three or four media positions.
2. Offer `Add more` or `Keep adding to this Memory`.
3. Reveal additional positions and media tools in the same editor.

Avoid copy such as `Make today a special day` as the only path to more media. It
still asks the customer to classify the day and implies that small Memories are
less important. Importance should emerge from the customer's content and later
curation, not from an upload gate.

This exploration may require higher per-Memory media limits, video support,
account-level quota enforcement, and new upload states. It needs its own scoped
design and implementation approval.

## Out of Scope

- Selecting the final Starter Pack capacity or price
- Selecting the final Momento main-product retail price
- Recalculating storage cost and reserve value beyond the current internal
  planning assumption of £12 per additional GB
- Shopify purchase and webhook implementation
- Account-level entitlement database implementation
- Video ingestion and transcoding implementation
- Changes to the current launch UI or database limits

Those decisions belong to separate pricing and implementation tasks.
