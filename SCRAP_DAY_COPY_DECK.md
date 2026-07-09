# Scrap the Day Phase 7 Copy Deck

Planning artifact only. This proposes a future `content/scrap-day-copy.ts`
shape and records the current customer-facing strings touched by the Phase 7
surfaces. Do not import this into runtime yet.

## Proposed Registry Shape

```ts
export const scrapDayCopy = {
  journal: {
    identity: {},
    home: {},
    monthSheet: {},
  },
  createFlow: {
    date: {},
    title: {},
    coverScrap: {},
    moments: {},
    save: {},
    errors: {},
  },
  scrapFinder: {},
  dailyStamp: {},
  exportModal: {},
  exportPoster: {},
  emptyStates: {},
  loadingStates: {},
  errorStates: {},
  accessibility: {},
} as const;
```

## Journal Home And Month Sheet

| Proposed key | Current text value | Proposed Phase 7 value |
| --- | --- | --- |
| `journal.identity.eyebrow` | `Journal` | `Journal` |
| `journal.identity.rename` | `Rename` | `Rename` |
| `journal.identity.lock` | `Lock` | `Lock` |
| `journal.identity.sealToday` | `Seal Today` | `Seal Today` |
| `journal.identity.opening` | `Opening...` | `Opening...` |
| `journal.identity.saveTitle` | `Save title` | `Save title` |
| `journal.identity.savingTitle` | `Saving...` | `Saving...` |
| `journal.identity.cancel` | `Cancel` | `Cancel` |
| `journal.home.loading` | `Opening journal…` | `Opening journal...` |
| `journal.home.openError` | `The journal could not be opened.` | `The journal could not be opened.` |
| `journal.home.tryAgain` | `Try again` | `Try again` |
| `journal.home.duplicateToday` | `Today is sealed.` | `Today is sealed.` |
| `journal.home.limitReached` | `Make a little space before sealing today.` | `Make a little space before sealing today.` |
| `journal.home.cleanupPending(count)` | `Private media cleanup is still pending for {count} item/items.` | `A few moments still need tidying.` |
| `journal.home.cleanupRetry` | `Retry cleanup` | `Try again` |
| `journal.monthSheet.eyebrow` | `Month Sheet` | `Month Sheet` |
| `journal.monthSheet.backToCurrent` | `Back to this month` | `Back to this month` |
| `journal.monthSheet.emptyPast.title` | `No sealed days here.` | `No sealed days here.` |
| `journal.monthSheet.emptyPast.body` | `Choose a date to keep one.` | `Choose a date to keep one.` |
| `journal.monthSheet.emptyFuture.title` | `This sheet is waiting.` | `This sheet is waiting.` |
| `journal.monthSheet.emptyFuture.body` | `Come back when the month arrives.` | `Come back when the month arrives.` |
| `journal.monthSheet.emptyCurrent.title` | `No scraps yet.` | `No scraps yet.` |
| `journal.monthSheet.emptyCurrent.body` | `Find one little piece of today.` | `Find one little piece of today.` |

## Create And Seal Today Flow

| Proposed key | Current text value | Proposed Phase 7 value |
| --- | --- | --- |
| `createFlow.header.new` | `New Daily Scrap` | `New Daily Scrap` |
| `createFlow.header.edit` | `Edit stamp` | `Edit stamp` |
| `createFlow.date.label` | `Date` | `Date` |
| `createFlow.date.chooseAria` | `Choose stamp date` | `Choose stamp date` |
| `createFlow.title.label` | `One line to keep` | `One line to keep` |
| `createFlow.title.placeholder` | `What would you call today?` | `What would you call today?` |
| `createFlow.title.required` | `Add one line to keep.` | `Add one line to keep.` |
| `createFlow.duplicate.message` | `That day is already sealed in this journal.` | `That day is already sealed.` |
| `createFlow.duplicate.cta` | `Open that stamp instead.` | `Open that stamp` |
| `createFlow.save.new` | `Seal this day` | `Seal this day` |
| `createFlow.save.edit` | `Save stamp` | `Save stamp` |
| `createFlow.save.preparing` | `Preparing moments…` | `Preparing moments...` |
| `createFlow.save.adding` | `Adding moments…` | `Adding moments...` |
| `createFlow.save.details` | `Sealing day…` | `Sealing day...` |
| `createFlow.save.finishing` | `Finishing save…` | `Finishing...` |
| `createFlow.save.retry` | `Retry save` | `Try again` |
| `createFlow.cancel` | `Cancel` | `Cancel` |

## Cover Scrap And Moments

| Proposed key | Current text value | Proposed Phase 7 value |
| --- | --- | --- |
| `createFlow.cover.title` | `Cover Scrap` | `Cover Scrap` |
| `createFlow.cover.choose` | `Choose today's scrap` | `Choose today's scrap` |
| `createFlow.cover.helper` | `One photo is enough to seal the day.` | `One photo is enough to seal the day.` |
| `createFlow.cover.adjust` | `Adjust scrap` | `Adjust scrap` |
| `createFlow.cover.replace` | `Replace` | `Replace` |
| `createFlow.cover.remove` | `Remove` | `Remove` |
| `createFlow.cover.typeError` | `Only images can become a Cover Scrap.` | `Choose an image for the Cover Scrap.` |
| `createFlow.cover.sizeError` | `That image is larger than 25MB.` | `That image is larger than 25MB.` |
| `createFlow.moments.toggle` | `Add more moments (optional)` | `Add more moments` |
| `createFlow.moments.helper` | `Up to 8 more moments.` | `Up to 8 more moments.` |
| `createFlow.moments.add` | `Add moments` | `Add moments` |
| `createFlow.moments.itemLabel` | `Moment` | `Moment` |
| `createFlow.moments.typeError` | `Only images can be added as moments.` | `Only images can become moments.` |
| `createFlow.moments.sizeError` | `Images larger than 25MB were not added.` | `Images larger than 25MB were not added.` |
| `createFlow.moments.full` | `This stamp already has its optional moments.` | `This stamp already has its moments.` |

## Scrap Finder

| Proposed key | Current text value | Proposed Phase 7 value |
| --- | --- | --- |
| `scrapFinder.title` | `Find today's scrap` | `Find today's scrap` |
| `scrapFinder.instructions` | `Move the photo under the finder.` | `Move the photo under the finder.` |
| `scrapFinder.close` | `Close` | `Close` |
| `scrapFinder.closeAria` | `Close Scrap Table` | `Close Scrap Table` |
| `scrapFinder.zoom` | `Zoom` | `Zoom` |
| `scrapFinder.confirm` | `Use this scrap` | `Use this scrap` |
| `scrapFinder.chooseAnother` | `Choose another` | `Choose another` |
| `scrapFinder.reset` | `Reset` | `Reset` |
| `scrapFinder.cancel` | `Cancel` | `Cancel` |
| `scrapFinder.unavailable` | `This photograph is not available.` | `This photograph is not available.` |

## Daily Memory Stamp Detail

| Proposed key | Current text value | Proposed Phase 7 value |
| --- | --- | --- |
| `dailyStamp.backToMonth` | `Back to month sheet` | `Back to month sheet` |
| `dailyStamp.photoGridAria` | `Daily Memory Stamp` | `Daily Memory Stamp` |
| `dailyStamp.photoOpenAria(name)` | `Open {photoName} full screen` | `Open {photoName} full screen` |
| `dailyStamp.footerNote` | `Saved to this journal.` | `Saved to this journal.` |
| `dailyStamp.saveShare` | `Save / Share` | `Save / Share` |
| `dailyStamp.edit` | `Edit stamp` | `Edit stamp` |

## Save And Share Modal

| Proposed key | Current text value | Proposed Phase 7 value |
| --- | --- | --- |
| `exportModal.title` | `Save or share` | `Save or share` |
| `exportModal.closeAria` | `Close export composer` | `Close` |
| `exportModal.previewAlt` | `9:16 preview of the saved Daily Memory Stamp export` | `9:16 preview of the saved Daily Memory Stamp` |
| `exportModal.creating` | `Creating image…` | `Creating image...` |
| `exportModal.ready` | `Image ready.` | `Image ready.` |
| `exportModal.error` | `Couldn’t create the image. Please try again.` | `Could not create the image. Please try again.` |
| `exportModal.save` | `Save Image` | `Save Image` |
| `exportModal.preparing` | `Preparing…` | `Preparing...` |
| `exportModal.share` | `Share` | `Share` |
| `exportModal.shareUnsupported` | `Sharing isn’t supported here. You can save the image instead.` | `Sharing is not supported here. Save the image instead.` |
| `exportModal.shared` | `Shared.` | `Shared.` |
| `exportModal.shareCanceled` | `Share canceled.` | `Share canceled.` |

## Daily 9:16 Export Output

| Proposed key | Current text value | Proposed Phase 7 value |
| --- | --- | --- |
| `exportPoster.brandAlt` | `Modern Goddess Patina` | `Modern Goddess Patina` |
| `exportPoster.fallbackTitle` | `Untitled stamp` | `Untitled stamp` |
| `exportPoster.filename(localDate)` | `scrap-the-day-{localDate}.png` | `scrap-the-day-{localDate}.png` |
| `exportPoster.filenameFallback` | `undated` | `undated` |

## Loading, Error, And Accessibility Strings

| Proposed key | Current text value | Proposed Phase 7 value |
| --- | --- | --- |
| `loading.memory` | `Loading memory…` | `Opening stamp...` |
| `error.missingPrivatePath` | `A photograph is missing its private storage path.` | `A photograph is not available.` |
| `error.photoUnavailable` | `This photograph is not available.` | `This photograph is not available.` |
| `error.voiceMemoUnavailable` | `This voice memo is not available.` | `This voice memo is not available.` |
| `delete.confirmTitle` | `Delete this stamp?` | `Delete this stamp?` |
| `delete.confirmBody` | `Its saved moments will also be removed. This cannot be undone.` | `Its saved moments will also be removed. This cannot be undone.` |
| `delete.keep` | `Keep stamp` | `Keep stamp` |
| `delete.confirm` | `Delete stamp` | `Delete stamp` |
| `delete.deleting` | `Deleting…` | `Deleting...` |
| `delete.error` | `The stamp could not be deleted. Please retry.` | `The stamp could not be deleted. Please try again.` |
| `accessibility.monthGridAria` | `Saved scraps arranged as a monthly stamp sheet` | `Saved scraps arranged as a monthly sheet` |
| `accessibility.openMonthTile(title)` | `Open {title}` | `Open {title}` |

## Notes For Future Migration

- Keep current values and proposed values separate until the redesign copy is approved.
- Use functions for count-aware values and file names rather than interpolating strings inline.
- Prefer plain ASCII fallbacks in code where exact punctuation is not product-critical.
- Keep the Daily 9:16 export strings in this deck for Phase 7.2; do not change the export canvas in Phase 7.1.
