# Scrap the Day Customer Copy Deck

Phase 7R.6A inventory snapshot. This is the product owner's editable copy control document. It records the customer-visible copy in the current working tree on 11 July 2026. It does not change runtime copy or behavior.

## Copy governance

### Product owner editing

- Edit only the **Owner Final Copy** cell when deciding final wording.
- Change **Status** to `approved` when that wording is ready to implement.
- Leave a note when intent, timing, or a dynamic value is uncertain.
- A blank Owner Final Copy cell means no owner decision has been recorded.

### Later Codex application

- Apply only rows whose **Status** is `approved`.
- Copy approved wording exactly; do not creatively rewrite it.
- Preserve every dynamic variable shown in braces, including counts, names, dates, positions, and limits.
- Preserve accessibility meaning. A shorter visible label does not automatically replace a fuller accessible label.
- Change copy only. Do not change layout, styling, interaction, or behavior while applying this deck.

### Rules

- Do not remove an accessibility label without an approved replacement.
- Do not remove validation or error copy unless the removal is explicitly approved.
- Do not trade functional clarity for poetic language.
- Keep customer UI concise.
- Treat `proposed` as a Codex suggestion, not an approval.
- Treat `needs review` as either unresolved wording or a copy gap.
- Treat `internal only` as excluded from the production customer-copy pass unless the owner explicitly promotes it.

## Inventory conventions

- **Current Copy** is exact source wording. JSX entities are rendered as customers read them.
- Dynamic values use braces, for example `{monthTitle}`, `{photoName}`, `{count}`, and `{limit}`.
- `No current copy` records a requested state for which the current UI has no dedicated message.
- Repeated exact strings share one row when their role and intended wording are the same; all relevant occurrences are named in Notes.
- Product-supplied photo names are inventoried. Customer filenames and journal-entry titles are dynamic content, not fixed product copy.
- Production journal routes are `/c/[publicToken]` and `/c/[publicToken]/m/[memoryId]`. Demo and Admin Preview copy are separated below.

## App Metadata

| Copy ID | Surface | Route / Context | Component / File | UI Role | Current Copy | Suggested Rewrite | Owner Final Copy | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| appMetadata.title | App Metadata | All routes; browser tab | `app/layout.tsx` | page title | Scrap the Day | Scrap the Day |  | proposed | Existing product title is concise and on-brand. |
| appMetadata.description | App Metadata | All routes; search/social metadata | `app/layout.tsx` | meta description | Write the feeling. Scrap the day. Seal it in your journal. | Keep the feeling. Scrap the day. Seal it in your Journal. |  | proposed | Review capitalization of Journal as a product term. |
| appMetadata.pwaLabels | App Metadata | Installed/PWA browser surfaces | No manifest found | copy gap | No current copy | Scrap the Day |  | needs review | No web app manifest, application name, or short name is present. Do not create one in a copy-only phase. |
| appMetadata.iconTextAlternative | App Metadata | Browser/app icon | `app/icon.svg` | accessibility gap | No current copy |  |  | do not change | The SVG contains no `<title>`; browser icons do not generally expose one as page content. |

## Customer Access, Lock, and Recovery

These strings appear before or around the Journal on the same public routes. They are included because a Journal customer can encounter them, even though several still use the legacy internal term “capsule.”

| Copy ID | Surface | Route / Context | Component / File | UI Role | Current Copy | Suggested Rewrite | Owner Final Copy | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| access.loading.opening | Customer Access | `/c/[publicToken]`, memory route | `components/capsule/capsule-page.tsx` | loading state | Opening capsule… | Opening your Journal… |  | proposed | Customer-facing legacy term. |
| access.notFound | Customer Access | Public route, unknown token | `components/capsule/capsule-page.tsx` | error state | This capsule could not be found. | This Journal could not be found. |  | proposed | Customer-facing legacy term. |
| access.unavailable | Customer Access | Disabled public item | `components/capsule/capsule-page.tsx` | error state | This memory capsule is unavailable. Please contact the maker if you believe this is a mistake. | This Journal is unavailable. Please contact the maker if you believe this is a mistake. |  | proposed | Appears from both initial and refreshed gate state. |
| access.openError | Customer Access | Public route | `components/capsule/capsule-page.tsx` | error state | The capsule could not be opened. | The Journal could not be opened. |  | proposed | Customer-facing legacy term. |
| access.temporaryError | Customer Access | Public route | `components/capsule/capsule-page.tsx`; `lib/capsule/server-gate.ts` | error state | The capsule is temporarily unavailable. Please retry. | The Journal is temporarily unavailable. Please try again. |  | proposed | A shorter fallback variant without “Please retry” also exists in `capsule-page.tsx`. |
| access.retry | Customer Access | Public route error | `components/capsule/capsule-page.tsx` | CTA | Try again |  |  | needs review | Shared retry label. |
| access.connectionError | Customer Access | Public route bootstrap | `lib/capsule/opening.ts` | error state | The capsule could not be opened from this connection. Check the link, network, or origin configuration and retry. | The Journal could not be opened from this connection. Check the link and your connection, then try again. |  | proposed | “Origin configuration” is operational language. |
| access.serviceResponseError | Customer Access | Public route bootstrap | `lib/capsule/opening.ts` | error state | The capsule service returned an unexpected response. Please retry. | The Journal could not be opened. Please try again. |  | proposed | Avoids service terminology. |
| access.genericRetryError | Customer Access | Public route bootstrap | `lib/capsule/opening.ts` | error state | The capsule could not be opened. Please retry. | The Journal could not be opened. Please try again. |  | proposed | Customer-facing legacy term. |
| access.configurationError | Customer Access | Public route bootstrap | `lib/supabase/client.ts` | error state | Supabase browser environment is not configured. | This Journal is temporarily unavailable. Please try again later. |  | proposed | Highly technical configuration error can surface directly through `capsule-page.tsx`. |
| access.sessionCheckTimeout | Customer Access | Public route bootstrap | `lib/capsule/api.ts` | error state | Opening this capsule took too long while checking the private device session. Please retry. | Opening your Journal took too long. Please try again. |  | proposed | Remove implementation detail. |
| access.sessionCreateTimeout | Customer Access | Public route bootstrap | `lib/capsule/api.ts` | error state | Opening this capsule took too long while establishing a private device session. Please retry. | Opening your Journal took too long. Please try again. |  | proposed | Duplicate user outcome with different technical cause. |
| access.sessionFailed | Customer Access | Public route bootstrap | `lib/capsule/api.ts` | error state | A private device session could not be established. Please check your connection and retry. | Your Journal could not be opened. Check your connection and try again. |  | proposed | Avoids session terminology. |
| access.inspectTimeout | Customer Access | Public route bootstrap | `lib/capsule/api.ts` | error state | Opening this capsule took too long. Please retry. | Opening your Journal took too long. Please try again. |  | proposed | Customer-facing legacy term. |
| access.invalidMemoryAddress | Customer Access | Invalid memory id | `components/capsule/capsule-page.tsx` | error state | This memory address is not valid. | This Stamp link is not valid. |  | proposed | Review whether “Stamp link” is the clearest product term. |
| access.backToJournal | Customer Access | Invalid memory id; detail errors; create/edit | `components/capsule/capsule-page.tsx`; `components/journal/journal-memory-page.tsx`; `components/capsule/persistent-memory-flow.tsx` | link | Back to journal | Back to Journal |  | proposed | Capitalization should be governed consistently. |
| access.lockJournal | Customer Access | Create/edit header; settings menu | `components/capsule/persistent-memory-flow.tsx`; `components/journal/journal-identity-header.tsx` | button/menu item | Lock journal | Lock Journal |  | proposed | Functional label. |
| access.activate.eyebrow | Customer Access | First opening | `components/capsule/pin-gate.tsx` | eyebrow | Activate this journal | Open your Journal |  | proposed | “Activate” is operational; verify lifecycle meaning before approval. |
| access.activate.title | Customer Access | First opening | `components/capsule/pin-gate.tsx` | title | Create your Owner PIN | Create your Owner PIN |  | needs review | Clear security copy; capitalization is inconsistent elsewhere. |
| access.activate.helper | Customer Access | First opening | `components/capsule/pin-gate.tsx` | helper | Choose six digits you will use when opening this capsule on another device. | Choose six digits to open your Journal on another device. |  | proposed | Customer-facing legacy term. |
| access.unlock.eyebrow | Customer Access | Returning opening | `components/capsule/pin-gate.tsx` | eyebrow | Private memory | Your Journal |  | proposed | “Private memory” is inconsistent with Journal. |
| access.unlock.title | Customer Access | Returning opening | `components/capsule/pin-gate.tsx` | title | Unlock this memory | Open your Journal |  | proposed | Uses preferred product term. |
| access.unlock.helper | Customer Access | Returning opening | `components/capsule/pin-gate.tsx` | helper | Enter the six-digit Owner PIN for this capsule. | Enter your six-digit Owner PIN. |  | proposed | Removes redundant legacy term. |
| access.pin.label | Customer Access | Activate/unlock | `components/capsule/pin-gate.tsx` | field label/aria label | Owner PIN |  |  | needs review | Visible label and aria label. |
| access.pin.confirmLabel | Customer Access | Activate | `components/capsule/pin-gate.tsx` | field label | Confirm PIN |  |  | needs review | Accessible label is “Confirm Owner PIN.” |
| access.pin.confirmAria | Customer Access | Activate | `components/capsule/pin-gate.tsx` | aria label | Confirm Owner PIN |  |  | needs review | Preserve distinction from the first PIN field. |
| access.pin.lengthError | Customer Access | Activate/unlock/recovery | `components/capsule/pin-gate.tsx`; `components/capsule/recovery-flow.tsx` | validation | Enter exactly six digits. |  |  | needs review | Reused validation. |
| access.pin.mismatchError | Customer Access | Activate/recovery | `components/capsule/pin-gate.tsx`; `components/capsule/recovery-flow.tsx` | validation | The two PIN entries do not match. |  |  | needs review | Reused validation. |
| access.pin.activating | Customer Access | Activate | `components/capsule/pin-gate.tsx` | progress CTA | Activating securely… | Securing your Journal… |  | proposed | Keeps assurance without operational lifecycle language. |
| access.pin.unlocking | Customer Access | Unlock | `components/capsule/pin-gate.tsx` | progress CTA | Unlocking securely… | Opening your Journal… |  | proposed | Keeps the result clear. |
| access.pin.activateCta | Customer Access | Activate | `components/capsule/pin-gate.tsx` | CTA | Activate journal | Open Journal |  | proposed | Verify that “activate” is not legally/operationally required. |
| access.pin.unlockCta | Customer Access | Unlock | `components/capsule/pin-gate.tsx` | CTA | Unlock memory | Open Journal |  | proposed | Current wording is inconsistent with the product. |
| access.pin.forgot | Customer Access | Unlock | `components/capsule/pin-gate.tsx` | link | Forgot PIN? |  |  | needs review | Functional and concise. |
| access.pin.lockedError | Customer Access | Failed PIN attempts | `components/capsule/capsule-page.tsx` | error | Too many attempts. Try again in about 15 minutes. |  |  | needs review | Timing is functional security information. |
| access.pin.invalidError | Customer Access | Failed PIN | `components/capsule/capsule-page.tsx` | error | That PIN could not unlock this capsule. | That PIN could not open this Journal. |  | proposed | Customer-facing legacy term. |
| access.pin.serviceError | Customer Access | PIN service failure | `components/capsule/capsule-page.tsx` | error | The capsule service is temporarily unavailable. Please retry. | Your Journal is temporarily unavailable. Please try again. |  | proposed | Avoids service terminology. |
| access.recovery.openError | Customer Access | Forgot PIN | `components/capsule/capsule-page.tsx`; `components/capsule/recovery-flow.tsx` | error | Recovery could not be opened. Please retry. | Recovery could not be opened. Please try again. |  | proposed | Repeated in initial check and retry. |
| access.recovery.back | Customer Access | Recovery flow | `components/capsule/recovery-flow.tsx` | link | Back to PIN |  |  | needs review | Functional navigation. |
| access.recovery.checking | Customer Access | Recovery flow | `components/capsule/recovery-flow.tsx` | loading state | Checking recovery… |  |  | needs review | Short status. |
| access.recovery.unavailableTitle | Customer Access | Recovery disabled | `components/capsule/recovery-flow.tsx` | title | Recovery is not enabled | Recovery is not available |  | proposed | “Enabled” is configuration language. |
| access.recovery.unavailableBody | Customer Access | Recovery disabled | `components/capsule/recovery-flow.tsx` | body | This journal does not currently have a Recovery Passcode. A future support process can issue one after ownership is verified. | This Journal does not have a Recovery Passcode. Contact support to verify ownership and request one. |  | proposed | Current future-process wording is operational and vague. |
| access.recovery.errorTitle | Customer Access | Recovery service error | `components/capsule/recovery-flow.tsx` | title | Recovery is temporarily unavailable |  |  | needs review | Clear state title. |
| access.recovery.errorBody | Customer Access | Recovery service error | `components/capsule/recovery-flow.tsx` | body | The recovery service could not be reached. Your journal has not been changed. | Recovery could not be reached. Your Journal has not been changed. |  | proposed | Removes service language and governs capitalization. |
| access.recovery.ownerEyebrow | Customer Access | Recovery code and new PIN | `components/capsule/recovery-flow.tsx` | eyebrow | Owner PIN recovery |  |  | needs review | Repeated across two steps. |
| access.recovery.enterTitle | Customer Access | Recovery code | `components/capsule/recovery-flow.tsx` | title | Enter your Recovery Passcode |  |  | needs review | Functional security wording. |
| access.recovery.codeHelper | Customer Access | Recovery code | `components/capsule/recovery-flow.tsx` | helper | This is the backup code issued with your journal. | This is the backup code issued with your Journal. |  | proposed | Capitalization only. |
| access.recovery.codeLabel | Customer Access | Recovery code | `components/capsule/recovery-flow.tsx` | field/aria label | Recovery Passcode |  |  | needs review | Visible and accessible label. |
| access.recovery.codePlaceholder | Customer Access | Recovery code | `components/capsule/recovery-flow.tsx` | placeholder | XXXX-XXXX-XXXX-XXXX |  |  | do not change | Communicates required format. |
| access.recovery.incompleteError | Customer Access | Recovery code | `components/capsule/recovery-flow.tsx` | validation | Enter the complete Recovery Passcode. |  |  | needs review | Functional validation. |
| access.recovery.lockedError | Customer Access | Recovery code/reset | `components/capsule/recovery-flow.tsx` | error | Recovery is temporarily unavailable after several unsuccessful attempts. Please try again later. |  |  | needs review | Security information; do not soften without review. |
| access.recovery.verifyError | Customer Access | Recovery code/reset | `components/capsule/recovery-flow.tsx` | error | The Recovery Passcode could not be verified. |  |  | needs review | Retry variant adds “Please retry.” |
| access.recovery.verifyRetryError | Customer Access | Recovery request failure | `components/capsule/recovery-flow.tsx` | error | The Recovery Passcode could not be verified. Please retry. | The Recovery Passcode could not be verified. Please try again. |  | proposed | Separate network/failure variant. |
| access.recovery.continueCta | Customer Access | Recovery code | `components/capsule/recovery-flow.tsx` | CTA | Continue to new PIN |  |  | needs review | Functional step label. |
| access.recovery.newPinTitle | Customer Access | Recovery reset | `components/capsule/recovery-flow.tsx` | title | Create a new PIN |  |  | needs review | Functional. |
| access.recovery.newPinBody | Customer Access | Recovery reset | `components/capsule/recovery-flow.tsx` | body | Choose six digits. Your Recovery Passcode will be verified when you submit the reset, and previous devices will lose access only if it succeeds. | Choose six digits. When the reset succeeds, previous devices will lose access. |  | proposed | Preserves the security consequence with less process detail. |
| access.recovery.newPinLabel | Customer Access | Recovery reset | `components/capsule/recovery-flow.tsx` | field/aria label | New Owner PIN |  |  | needs review | Visible and accessible label. |
| access.recovery.confirmNewPinLabel | Customer Access | Recovery reset | `components/capsule/recovery-flow.tsx` | field label | Confirm new PIN |  |  | needs review | Accessible label is “Confirm new Owner PIN.” |
| access.recovery.confirmNewPinAria | Customer Access | Recovery reset | `components/capsule/recovery-flow.tsx` | aria label | Confirm new Owner PIN |  |  | needs review | Preserve distinction. |
| access.recovery.resetCta | Customer Access | Recovery reset | `components/capsule/recovery-flow.tsx` | CTA | Verify passcode and reset PIN | Reset PIN |  | proposed | Validation remains described in the step. |
| access.recovery.submittingTitle | Customer Access | Recovery reset | `components/capsule/recovery-flow.tsx` | progress title | Securing your journal… | Securing your Journal… |  | proposed | Capitalization only. |
| access.recovery.submittingBody | Customer Access | Recovery reset | `components/capsule/recovery-flow.tsx` | progress helper | Keep this page open while access is reset. |  |  | needs review | Functional instruction. |
| access.recovery.verifyingTitle | Customer Access | Recovery code | `components/capsule/recovery-flow.tsx` | progress title | Checking passcode… |  |  | needs review | Functional status. |
| access.recovery.verifyingBody | Customer Access | Recovery code | `components/capsule/recovery-flow.tsx` | progress helper | Keep this page open for a moment. |  |  | needs review | Functional instruction. |
| access.recovery.interruptedError | Customer Access | Interrupted reset | `components/capsule/recovery-flow.tsx` | error | The response was interrupted. Retry safely with the same recovery request. | The response was interrupted. Try again with the same recovery request. |  | proposed | “Safely” is vague; the idempotent request remains important. |
| access.recovery.responseLostTitle | Customer Access | Interrupted success | `components/capsule/recovery-flow.tsx` | title | Your PIN was reset |  |  | needs review | Confirms the completed action. |
| access.recovery.responseLostBody | Customer Access | Interrupted success | `components/capsule/recovery-flow.tsx` | body | The original success response was interrupted, so its new Recovery Passcode cannot be shown. You can replace it once within this recovery window. | Your PIN was reset, but the new Recovery Passcode could not be shown. You can create one replacement now. |  | proposed | Removes response/window jargon. |
| access.recovery.replacementUnavailable | Customer Access | Replacement code | `components/capsule/recovery-flow.tsx` | error | A replacement Recovery Passcode is no longer available for this request. | A replacement Recovery Passcode is no longer available. |  | proposed | Removes request jargon. |
| access.recovery.replacementError | Customer Access | Replacement code | `components/capsule/recovery-flow.tsx` | error | The replacement request could not be completed. Please retry. | A replacement Recovery Passcode could not be created. Please try again. |  | proposed | Names the customer outcome. |
| access.recovery.replacementCta | Customer Access | Interrupted success | `components/capsule/recovery-flow.tsx` | CTA | Generate one replacement code | Create one replacement code |  | proposed | “Create” is plainer than “Generate.” |
| access.recovery.saveEyebrow | Customer Access | Recovery success | `components/capsule/recovery-flow.tsx` | eyebrow | Save this now | Keep this somewhere safe |  | proposed | Clear without urgency-driven phrasing. |
| access.recovery.successTitle | Customer Access | Recovery success | `components/capsule/recovery-flow.tsx` | title | Your new Recovery Passcode |  |  | needs review | Functional. |
| access.recovery.successBody | Customer Access | Recovery success | `components/capsule/recovery-flow.tsx` | body | Your previous recovery code no longer works. Save this new code somewhere safe. | Your previous Recovery Passcode no longer works. Keep this new one somewhere safe. |  | proposed | Uses the governed term consistently. |
| access.recovery.copy | Customer Access | Recovery success | `components/capsule/recovery-flow.tsx` | button/status | Copy / Copied / Select and copy |  |  | needs review | Three states; clipboard failure changes label to “Select and copy.” |
| access.recovery.acknowledge | Customer Access | Recovery success | `components/capsule/recovery-flow.tsx` | checkbox label | I have saved my new Recovery Passcode |  |  | needs review | Required acknowledgement. |
| access.recovery.continueJournal | Customer Access | Recovery success | `components/capsule/recovery-flow.tsx` | CTA | Continue to journal | Continue to Journal |  | proposed | Capitalization only. |

## Journal Home and Month Sheet

| Copy ID | Surface | Route / Context | Component / File | UI Role | Current Copy | Suggested Rewrite | Owner Final Copy | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| journalHome.title.default | Journal Home | `/c/[publicToken]` | `data/journal.ts`; `lib/capsule/api.ts` | default/fallback journal name | My Journal | My Journal |  | proposed | Also used by detail/export and demo. Owner-entered names replace it. |
| journalHome.title.label | Journal Home | Rename mode | `components/journal/journal-identity-header.tsx` | screen-reader label | Journal title | Journal name |  | proposed | Aligns visible concept with “journal name.” |
| journalHome.title.placeholder | Journal Home | Rename mode | `components/journal/journal-identity-header.tsx` | placeholder | Up to {maxTitleLength} characters | Name your Journal |  | proposed | `{maxTitleLength}` is currently 20 and remains in helper text. |
| journalHome.title.limitHelper | Journal Home | Rename mode | `components/journal/journal-identity-header.tsx` | helper | Up to {maxTitleLength} characters |  |  | needs review | `{maxTitleLength}` is dynamic; currently 20. |
| journalHome.title.count | Journal Home | Rename mode | `components/journal/journal-identity-header.tsx` | count | {titleLength}/{maxTitleLength} |  |  | do not change | Dynamic functional counter. |
| journalHome.title.save | Journal Home | Rename mode | `components/journal/journal-identity-header.tsx` | CTA | Save title | Save name |  | proposed | Align with journal name terminology. |
| journalHome.title.saving | Journal Home | Rename mode | `components/journal/journal-identity-header.tsx` | progress CTA | Saving... | Saving… |  | proposed | Punctuation consistency only. |
| journalHome.title.cancel | Journal Home | Rename mode | `components/journal/journal-identity-header.tsx` | button | Cancel |  |  | needs review | Shared functional label. |
| journalHome.title.saveError | Journal Home | Rename failure | `components/journal/journal-home.tsx` | error | The journal title could not be saved. Please retry. | The Journal name could not be saved. Please try again. |  | proposed | Aligns terminology and retry style. |
| journalHome.title.fullAttribute | Journal Home | Journal heading | `components/journal/journal-identity-header.tsx` | title attribute | {journalTitle} |  |  | do not change | Dynamic owner-entered journal name; display is limited to 20 characters. |
| journalHome.settings | Journal Home | Settings trigger | `components/journal/journal-identity-header.tsx` | aria label | Journal settings |  |  | needs review | Icon-only button. |
| journalHome.settings.rename | Journal Home | Settings menu | `components/journal/journal-identity-header.tsx` | menu item | Rename | Rename Journal |  | proposed | Gives the menu item an explicit object. |
| journalHome.settings.lock | Journal Home | Settings menu | `components/journal/journal-identity-header.tsx` | menu item | Lock journal | Lock Journal |  | proposed | Govern capitalization consistently. |
| journalHome.loading | Journal Home | `/c/[publicToken]` | `components/journal/journal-home.tsx` | loading state | Opening journal… | Opening your Journal… |  | proposed | Warm and direct. |
| journalHome.error | Journal Home | `/c/[publicToken]` | `components/journal/journal-home.tsx` | error state | The journal could not be opened. | The Journal could not be opened. |  | proposed | Capitalization only. |
| journalHome.retry | Journal Home | Home error | `components/journal/journal-home.tsx` | CTA | Try again |  |  | needs review | Shared retry label. |
| journalHome.cleanup.pending | Journal Home | Pending cleanup banner | `components/journal/journal-home.tsx` | warning | Private media cleanup is still pending for {count} {item/items}. | A few saved moments still need attention. |  | proposed | Customer-facing technical copy; `{count}` is dynamic in current copy. Review whether the banner should expose a count. |
| journalHome.cleanup.retry | Journal Home | Pending cleanup banner | `components/journal/journal-home.tsx` | CTA | Retry cleanup | Try again |  | proposed | Avoids cleanup jargon. |
| journalHome.cleanup.retrying | Journal Home | Pending cleanup banner | `components/journal/journal-home.tsx` | progress CTA | Retrying… | Trying again… |  | proposed | Matches proposed CTA. |
| journalHome.cleanup.error | Journal Home | Pending cleanup banner | `components/journal/journal-home.tsx` | error | Private media cleanup could not be completed yet. | Those saved moments still need attention. Please try again. |  | proposed | Customer-facing technical copy. |
| journalHome.primary.openTray | Journal Home | Bottom CTA | `components/journal/bottom-ritual-action.tsx` | CTA | Seal the Day | Seal the Day |  | proposed | Current locked visual direction uses this tray label; preferred terms list says “Seal Today,” so owner review is required before any later change. |
| journalHome.primary.optionsAria | Journal Home | Bottom action tray | `components/journal/bottom-ritual-action.tsx` | aria label | Seal the Day options |  |  | needs review | Must continue to describe the menu. |
| journalHome.primary.today | Journal Home | Bottom action tray | `components/journal/bottom-ritual-action.tsx` | menu item | Seal Today | Seal Today |  | proposed | Preferred product term. |
| journalHome.primary.todaySealed | Journal Home | Bottom action tray | `components/journal/bottom-ritual-action.tsx` | menu item | Today's Stamp | Today’s Stamp |  | proposed | Preferred product term; suggestion standardizes curly apostrophe. |
| journalHome.primary.anotherDay | Journal Home | Bottom action tray | `components/journal/bottom-ritual-action.tsx` | menu item | Seal Another Day | Choose another day |  | proposed | Clarifies that this opens a backfill date choice rather than immediately sealing. |
| monthSheet.title | Journal Home | Month Sheet | `data/journal-stamps.ts`; `components/journal/monthly-stamp-sheet.tsx` | title | {monthName} {year} |  |  | do not change | Dynamic `en-US` long month/year, e.g. “July 2026.” |
| monthSheet.titleFallback | Journal Home | Invalid month key | `data/journal-stamps.ts` | title fallback | Month Sheet | Month Sheet |  | proposed | Preferred product term. |
| monthSheet.backCurrent | Journal Home | Past/future month | `components/journal/monthly-stamp-sheet.tsx` | link | Back to this month |  |  | needs review | An aria-hidden duplicate reserves layout space but is not announced. |
| monthSheet.navigation | Journal Home | Month controls | `components/journal/monthly-stamp-sheet.tsx` | aria label | Month navigation |  |  | needs review | Labels the control group. |
| monthSheet.previous | Journal Home | Month controls | `components/journal/monthly-stamp-sheet.tsx` | aria label/title | View {previousMonthTitle} | Previous month: {previousMonthTitle} |  | proposed | `{previousMonthTitle}` is dynamic. Suggestion strengthens direction for assistive technology. |
| monthSheet.next | Journal Home | Month controls | `components/journal/monthly-stamp-sheet.tsx` | aria label/title | View {nextMonthTitle} | Next month: {nextMonthTitle} |  | proposed | `{nextMonthTitle}` is dynamic; next can be disabled. |
| monthSheet.gridAria | Journal Home | Month grid | `components/journal/month-sheet-grid.tsx` | aria label | Saved cover scraps arranged as a monthly sheet | Daily Stamps for {monthTitle} |  | proposed | Current label is descriptive but long; `{monthTitle}` is not currently passed to this component. Applying this suggestion could require a prop but must not change layout. |
| monthSheet.openStamp | Journal Home | Month tile | `components/journal/month-tile.tsx` | aria label | Open {stampTitle} | Open {stampTitle} |  | needs review | `{stampTitle}` is customer-entered. Date is visible but not included in the accessible label. |
| monthSheet.tileTitle | Journal Home | Month tile | `components/journal/month-tile.tsx` | title attribute | {stampTitle} |  |  | do not change | Dynamic customer-entered title. |
| monthSheet.dateMarker | Journal Home | Month tile | `components/journal/month-tile.tsx` | visible date marker | {dayNumber} |  |  | do not change | Dynamic day number with leading zero removed. |
| monthSheet.dateMarkerAria | Journal Home | Month tile | `components/journal/month-tile.tsx` | accessibility gap | No dedicated current copy | {fullDate}. Open {stampTitle} |  | needs review | Requested scan item: the visible day marker has no separate accessible text; the button announces only the title. |
| monthSheet.emptyPast.title | Journal Home | Empty past month | `components/journal/monthly-stamp-sheet.tsx` | empty-state title | No sealed days here. | No Daily Scraps here. |  | proposed | Uses preferred product term. |
| monthSheet.emptyPast.body | Journal Home | Empty past month | `components/journal/monthly-stamp-sheet.tsx` | empty-state body | Choose a date to keep one. | Choose a date to keep one. |  | proposed | Concise and ritual-led. |
| monthSheet.emptyFuture.title | Journal Home | Empty future month | `components/journal/monthly-stamp-sheet.tsx` | empty-state title | This sheet is waiting. | This Month Sheet is waiting. |  | proposed | Makes the product object explicit. |
| monthSheet.emptyFuture.body | Journal Home | Empty future month | `components/journal/monthly-stamp-sheet.tsx` | empty-state body | Come back when the month arrives. |  |  | needs review | Clear and warm. |
| monthSheet.emptyCurrent.title | Journal Home | Empty current month | `components/journal/monthly-stamp-sheet.tsx` | empty-state title | No scraps yet. | No Daily Scraps yet. |  | proposed | Uses preferred product term. |
| monthSheet.emptyCurrent.body | Journal Home | Empty current month | `components/journal/monthly-stamp-sheet.tsx` | empty-state body | Find one little piece of today. | Find today’s scrap. |  | proposed | Uses preferred product term and avoids cutesy “little.” |

## Daily Memory Stamp Detail

| Copy ID | Surface | Route / Context | Component / File | UI Role | Current Copy | Suggested Rewrite | Owner Final Copy | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dailyDetail.loading | Daily Detail | `/c/[publicToken]/m/[memoryId]` | `components/journal/journal-memory-page.tsx` | loading state | Opening stamp… | Opening your Stamp… |  | proposed | Detail-context loading state. |
| dailyDetail.memoryLoading | Daily Detail | Nested saved-memory load | `components/capsule/persistent-memory-flow.tsx` | loading state | Loading memory… | Opening your Stamp… |  | proposed | Can appear after the Journal context loads; inconsistent with the preceding “Opening stamp…” state. |
| dailyDetail.error | Daily Detail | Memory load failure | `components/journal/journal-memory-page.tsx` | error state | This stamp could not be opened. | This Stamp could not be opened. |  | proposed | Product-term capitalization. |
| dailyDetail.errorBack | Daily Detail | Memory load failure | `components/journal/journal-memory-page.tsx` | link | Back to journal | Back to Journal |  | proposed | Shared navigation. |
| dailyDetail.back | Daily Detail | Detail shell | `components/stamp/daily-memory-stamp.tsx` | aria label | Back to month sheet | Back to Month Sheet |  | proposed | Icon-only button; preferred product term. |
| dailyDetail.journalTitle | Daily Detail | Detail shell | `components/stamp/daily-memory-stamp.tsx`; `components/journal/journal-identity-header.tsx` | heading/title attribute | {journalTitle} |  |  | do not change | Dynamic owner-entered name; falls back to “My Journal.” |
| dailyDetail.date | Daily Detail | Detail artifact | `components/stamp/daily-memory-stamp.tsx` | date | {longDate} |  |  | do not change | Dynamic `en-US` long date, e.g. “July 4, 2026.” |
| dailyDetail.title | Daily Detail | Detail artifact | `components/stamp/daily-memory-stamp.tsx` | title | {stampTitle} |  |  | do not change | Dynamic customer-entered “One line to keep.” |
| dailyDetail.titleFallback | Daily Detail | Empty/legacy title | `components/stamp/daily-memory-stamp.tsx` | copy gap | No current copy | Today’s Stamp |  | needs review | The component renders `memory.title` directly. Export separately falls back to “Untitled stamp.” |
| dailyDetail.edit | Daily Detail | Detail artifact | `components/stamp/daily-memory-stamp.tsx` | aria label | Edit stamp | Edit Stamp |  | proposed | Icon-only button. |
| dailyDetail.photosSection | Daily Detail | Photo area | `components/stamp/daily-memory-stamp.tsx` | aria label | Daily photographs | Daily moments |  | proposed | Avoids file-type framing while retaining meaning. |
| dailyDetail.gridAria | Daily Detail | Photo grid | `components/stamp/stamp-grid.tsx` | aria label | Daily Memory Stamp | Daily Memory Stamp |  | proposed | Preferred product term. |
| dailyDetail.openPhoto | Daily Detail | Photo tile | `components/stamp/stamp-grid.tsx` | aria label | Open {photoName} full screen | Open moment {position} full screen |  | proposed | `{photoName}` is usually a customer filename or generated “Photograph {position}”; positional wording avoids exposing filenames. |
| dailyDetail.photoLoading | Daily Detail | Photo tile | `components/memory/photo-collection.tsx` | loading state | Loading… | Opening… |  | proposed | The short status is visible inside unresolved photos. |
| dailyDetail.photoUnavailable | Daily Detail | Photo tile failure | `components/memory/photo-collection.tsx` | error/helper | Photograph unavailable. Open to retry. | That moment is unavailable. Open it to try again. |  | proposed | Avoids technical language and uses the product concept. |
| dailyDetail.emptyPhotos | Daily Detail | Stamp with zero photos | `components/stamp/stamp-grid.tsx` | copy gap | No current copy | No moments are available for this Stamp. |  | needs review | Current grid renders empty with no message. This should be rare because create validation requires a cover. |
| dailyDetail.savedStatus | Daily Detail | Detail artifact | `components/stamp/daily-memory-stamp.tsx` | copy gap | No current copy | Saved in your Journal. |  | needs review | Requested scan item; the current accepted detail removed the earlier status line. |
| dailyDetail.saveShare | Daily Detail | Bottom action | `components/stamp/daily-memory-stamp.tsx` | CTA | Save / Share | Save / Share |  | proposed | Opens the export composer. |
| dailyDetail.duplicate.title | Daily Detail | Attempted second stamp today | `components/journal/journal-memory-page.tsx` | state title | Today is already sealed in this journal. | Today’s Stamp |  | proposed | Better as the state identity than explanatory copy. |
| dailyDetail.duplicate.body | Daily Detail | Attempted second stamp today | `components/journal/journal-memory-page.tsx` | state body | You can revisit today’s stamp instead of making another one. | Today is already kept in your Journal. |  | proposed | Concise; owner may choose to remove if the CTA is sufficient. |
| dailyDetail.duplicate.cta | Daily Detail | Attempted second stamp today | `components/journal/journal-memory-page.tsx` | CTA | Open today’s stamp | Today’s Stamp |  | proposed | Preferred product term. |
| dailyDetail.limit.title | Daily Detail | Journal at photo capacity | `components/journal/journal-memory-page.tsx` | state title | This journal needs a little space. | This Journal is full. |  | proposed | Clearer and less cutesy. |
| dailyDetail.limit.body | Daily Detail | Journal at photo capacity | `components/journal/journal-memory-page.tsx` | state body | Delete a saved moment or stamp before sealing another day. | Remove a saved moment or Stamp before keeping another day. |  | proposed | Avoids “seal” ambiguity for a capacity problem. |
| dailyDetail.limit.back | Daily Detail | Journal at photo capacity | `components/journal/journal-memory-page.tsx` | CTA | Back to journal | Back to Journal |  | proposed | Shared navigation. |

## Create And Seal Today Flow

| Copy ID | Surface | Route / Context | Component / File | UI Role | Current Copy | Suggested Rewrite | Owner Final Copy | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| createEdit.header.new | Create/Edit | New stamp | `data/memory-form-product.ts`; `components/memory/memory-form.tsx` | eyebrow | New Daily Scrap | New Daily Scrap |  | proposed | Preferred product term. |
| createEdit.header.edit | Create/Edit | Existing stamp | `data/memory-form-product.ts`; `components/memory/memory-form.tsx` | eyebrow | Edit stamp | Edit Stamp |  | proposed | Product-term capitalization. |
| createEdit.formAria.new | Create/Edit | New stamp | `data/memory-form-product.ts`; `components/memory/memory-form.tsx` | aria label | Create Daily Memory Stamp | Create Daily Memory Stamp |  | proposed | Preserve action and object. |
| createEdit.formAria.edit | Create/Edit | Existing stamp | `data/memory-form-product.ts`; `components/memory/memory-form.tsx` | aria label | Edit stamp | Edit Daily Memory Stamp |  | proposed | Makes the accessible object explicit. |
| createEdit.date.label | Create/Edit | Journal form | `components/memory/memory-form.tsx` | field label | Date |  |  | needs review | Functional label. |
| createEdit.date.chooseAria | Create/Edit | Journal form | `components/memory/memory-form.tsx` | aria label | Choose stamp date | Choose Stamp date |  | proposed | Invisible native date input. |
| createEdit.date.display | Create/Edit | Journal form | `components/memory/memory-form.tsx` | date value | {longDate} |  |  | do not change | Dynamic `en-US` long date. |
| createEdit.title.label | Create/Edit | Journal form | `data/memory-form-product.ts` | field label | One line to keep | One line to keep |  | proposed | Preferred product term. |
| createEdit.title.placeholder | Create/Edit | Journal form | `data/memory-form-product.ts` | placeholder | What would you call today? | One line from today |  | proposed | More descriptive and less abstract; keep concise in the field. |
| createEdit.title.required | Create/Edit | Submit without title | `data/memory-form-product.ts` | validation | Add one line to keep. | Add one line to keep. |  | proposed | Clear and aligned with label. |
| createEdit.cover.required | Create/Edit | Submit without cover | `data/memory-form-product.ts` | validation | Choose at least one cover scrap before sealing. | Choose today’s Cover Scrap. |  | proposed | There can be only one cover; uses preferred product term. |
| createEdit.duplicate.validation | Create/Edit | Duplicate local date | `components/memory/memory-form.tsx`; `components/capsule/persistent-memory-flow.tsx`; `lib/capsule/api.ts` | validation/error | That day is already sealed in this journal. | That date already has a Daily Memory Stamp. |  | proposed | Repeated at client validation, save guard, and commit error. |
| createEdit.duplicate.cta | Create/Edit | Duplicate local date | `components/memory/memory-form.tsx` | CTA | Open that stamp instead. | Open that Stamp |  | proposed | Removes unnecessary “instead” and terminal punctuation from a button. |
| createEdit.save.new | Create/Edit | New stamp | `data/memory-form-product.ts` | CTA | Seal this day | Save stamp |  | proposed | Uses the preferred “Save stamp” term; Home retains the sealing ritual. |
| createEdit.save.edit | Create/Edit | Existing stamp | `data/memory-form-product.ts` | CTA | Save stamp | Save stamp |  | proposed | Preferred product term. |
| createEdit.save.retry | Create/Edit | Save error/partial failure | `components/memory/memory-form.tsx` | CTA | Retry save | Try again |  | proposed | Shorter; the surrounding state already establishes saving. |
| createEdit.save.preparing | Create/Edit | Save in progress | `data/memory-form-product.ts` | progress CTA | Preparing moments… | Preparing moments… |  | proposed | Clear and nontechnical. |
| createEdit.save.adding | Create/Edit | Save in progress | `data/memory-form-product.ts` | progress CTA | Adding moments… | Adding moments… |  | proposed | Avoids upload jargon in Journal mode. |
| createEdit.save.details | Create/Edit | Save in progress | `data/memory-form-product.ts` | progress CTA | Sealing day… | Saving Stamp… |  | proposed | Aligns final action with “Save stamp.” |
| createEdit.save.finishing | Create/Edit | Cleanup in progress | `components/memory/memory-form.tsx` | progress CTA | Finishing save… | Finishing… |  | proposed | Avoids implementation detail. |
| createEdit.cancel | Create/Edit | New/edit stamp | `components/memory/memory-form.tsx` | button | Cancel |  |  | needs review | Shared functional label. |
| createEdit.save.status | Create/Edit | Save progress | `components/memory/memory-form.tsx`; `lib/capsule/api.ts` | live status | {saveMessage} |  |  | needs review | Displays the exact dynamic messages inventoried below. |
| createEdit.save.bytes | Create/Edit | Save progress | `components/memory/memory-form.tsx` | status detail | {sourceMB} selected · {preparedMB} prepared |  |  | needs review | Customer-facing technical size detail. Consider removing from customer UI; do not remove without explicit approval. |
| createEdit.save.stopRecording | Create/Edit | Save while recording | `components/memory/memory-form.tsx` | status | Stop the recording before saving or leaving this form. |  |  | internal only | Journal mode disables voice memos, so this is not reachable in the current Journal product. |
| createEdit.save.removeUnfinished | Create/Edit | Cancel after partial save | `components/capsule/persistent-memory-flow.tsx` | progress | Removing unfinished media… | Tidying unfinished moments… |  | proposed | Customer-facing technical copy. |
| createEdit.save.removeUnfinishedError | Create/Edit | Cancel cleanup failure | `components/capsule/persistent-memory-flow.tsx` | error | Unfinished media could not be cleaned up yet. Retry Cancel. | Those unfinished moments still need attention. Try Cancel again. |  | proposed | Customer-facing technical copy. |
| createEdit.save.prepareCount | Create/Edit | Photo preparation | `lib/capsule/api.ts` | progress | Preparing {current} of {total} images | Preparing moment {current} of {total}… |  | proposed | Dynamic progress; “images” is inconsistent with Moments. |
| createEdit.save.preparationFailure | Create/Edit | Photo preparation failure | `lib/capsule/api.ts` | error | {count} image needs/images need attention before saving. | {count} moment needs/moments need attention before saving. |  | proposed | Preserve singular/plural behavior. |
| createEdit.save.savingMedia | Create/Edit | Save start | `lib/capsule/api.ts` | progress | Saving media | Saving moments… |  | proposed | Customer-facing technical copy. |
| createEdit.save.mediaProgress | Create/Edit | Save progress | `lib/capsule/api.ts` | progress | Saved {current} of {total} media items | Saved {current} of {total} moments |  | proposed | Technical copy; note that a photo can count as two underlying files, so a product rewrite may require behavior review. Copy-only application must preserve truthful counts. |
| createEdit.save.itemFailure | Create/Edit | Save failure | `lib/capsule/api.ts` | item error | Save failed. Retry to continue from this item. | That moment could not be saved. Try again to continue. |  | proposed | Avoids “item.” |
| createEdit.save.failedItems | Create/Edit | Save failure | `lib/capsule/api.ts` | error | {count} media item failed/media items failed. Saved items are preserved; retry the failed items. | {count} moment could not be saved. Your other moments are safe; try again. |  | proposed | Preserve singular/plural; current count may represent upload jobs, not customer moments. |
| createEdit.save.previousCleanup | Create/Edit | Retry after partial save | `lib/capsule/api.ts` | progress | Finishing cleanup from the previous save… | Finishing your previous save… |  | proposed | Removes cleanup jargon. |
| createEdit.save.previousCleanupError | Create/Edit | Retry after partial save | `lib/capsule/api.ts` | error | Old media cleanup still needs another attempt. | Your previous save still needs attention. Please try again. |  | proposed | Customer-facing technical copy. |
| createEdit.save.stampDetails | Create/Edit | Final commit | `lib/capsule/api.ts` | progress | Saving stamp details | Saving Stamp… |  | proposed | Avoids database/process framing. |
| createEdit.save.journalLimit | Create/Edit | Capacity error | `lib/capsule/api.ts` | error | This journal needs a little space before another day can be sealed. | This Journal is full. Remove a saved moment before keeping another day. |  | proposed | Clear and actionable. |
| createEdit.save.memoryConflict | Create/Edit | Commit conflict | `lib/capsule/api.ts` | error | This memory belongs to a different capsule. | This Stamp belongs to a different Journal. |  | proposed | Customer-facing legacy and technical terms. |
| createEdit.save.mediaConflict | Create/Edit | Commit conflict | `lib/capsule/api.ts` | error | One or more media items belong to a different memory. | One or more moments belong to a different Stamp. |  | proposed | Customer-facing technical terms. |
| createEdit.save.commitError | Create/Edit | Commit failure | `lib/capsule/api.ts` | error | The memory could not be committed. Your saved draft is ready to retry. | Your Stamp could not be saved. Your moments are still here; please try again. |  | proposed | Removes database and draft jargon. |
| createEdit.save.cleanupQueued | Create/Edit | Post-save cleanup | `lib/capsule/api.ts` | progress | Queued old media for private cleanup | Finishing your save… |  | proposed | Customer-facing operational copy. |
| createEdit.save.complete | Create/Edit | Save success | `lib/capsule/api.ts` | status | Complete | Saved |  | proposed | Short customer outcome. |
| createEdit.delete.open | Create/Edit | Saved Stamp detail | `components/capsule/persistent-memory-flow.tsx` | button | Delete stamp | Delete Stamp |  | proposed | Destructive action. |
| createEdit.delete.title | Create/Edit | Delete confirmation | `components/capsule/persistent-memory-flow.tsx` | dialog title | Delete this stamp? | Delete this Stamp? |  | proposed | Product-term capitalization. |
| createEdit.delete.body | Create/Edit | Delete confirmation | `components/capsule/persistent-memory-flow.tsx` | dialog body | Its saved moments will also be removed. This cannot be undone. |  |  | needs review | Clear irreversible consequence; do not soften. |
| createEdit.delete.keep | Create/Edit | Delete confirmation | `components/capsule/persistent-memory-flow.tsx` | button | Keep stamp | Keep Stamp |  | proposed | Product-term capitalization. |
| createEdit.delete.confirm | Create/Edit | Delete confirmation | `components/capsule/persistent-memory-flow.tsx` | destructive CTA | Delete stamp | Delete Stamp |  | proposed | Product-term capitalization. |
| createEdit.delete.deleting | Create/Edit | Delete in progress | `components/capsule/persistent-memory-flow.tsx` | progress CTA | Deleting… |  |  | needs review | Clear status. |
| createEdit.delete.error | Create/Edit | Delete failure | `components/capsule/persistent-memory-flow.tsx` | error | The stamp could not be deleted. Please retry. | The Stamp could not be deleted. Please try again. |  | proposed | Product term and retry style. |

## Cover Scrap And Moments

| Copy ID | Surface | Route / Context | Component / File | UI Role | Current Copy | Suggested Rewrite | Owner Final Copy | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| coverScrap.title | Cover Scrap | Create/edit form | `components/memory/journal-photo-picker.tsx` | section title/badge | Cover Scrap | Cover Scrap |  | proposed | Preferred product term; appears as heading and on selected cover. |
| coverScrap.chooseAria | Cover Scrap | File chooser | `components/memory/journal-photo-picker.tsx` | aria label | Choose today's scrap | Choose today’s scrap |  | proposed | Preferred product term; punctuation only. |
| coverScrap.choose | Cover Scrap | Empty state | `components/memory/journal-photo-picker.tsx` | CTA | Choose today's scrap | Choose today’s scrap |  | proposed | Preferred product term; punctuation only. |
| coverScrap.helper | Cover Scrap | Empty state | `components/memory/journal-photo-picker.tsx` | helper | One photo is enough to seal the day. | One scrap is enough to keep the day. |  | proposed | Avoids photo/file framing and keeps ritual language. |
| coverScrap.adjust | Cover Scrap | Selected cover | `components/memory/journal-photo-picker.tsx` | button | Adjust scrap | Adjust scrap |  | proposed | Preferred product term. |
| coverScrap.replace | Cover Scrap | Selected cover | `components/memory/journal-photo-picker.tsx` | button | Replace |  |  | needs review | Functional action. |
| coverScrap.remove | Cover Scrap | Selected cover | `components/memory/journal-photo-picker.tsx` | button | Remove |  |  | needs review | Functional action. |
| coverScrap.imageAlt | Cover Scrap | Selected cover | `components/memory/journal-photo-picker.tsx` | image alt | {photoName} | Cover Scrap |  | proposed | `{photoName}` is usually a device filename. Product-controlled alt avoids exposing it but should remain meaningful. |
| coverScrap.typeError | Cover Scrap | Invalid selection | `components/memory/journal-photo-picker.tsx` | validation | Only images can become a Cover Scrap. | Choose a photo for the Cover Scrap. |  | proposed | Clear without file-type jargon. |
| coverScrap.sizeError | Cover Scrap | Oversized selection | `components/memory/journal-photo-picker.tsx` | validation | That image is larger than 25MB. | That photo is too large. Choose one under 25MB. |  | proposed | Keeps the actionable limit. |
| moments.toggle | Additional Moments | Create/edit form | `components/memory/journal-photo-picker.tsx` | disclosure button | Add more moments (optional) | Add more moments |  | proposed | Preferred product term; optionality is evident from the form. |
| moments.helper | Additional Moments | Expanded disclosure | `components/memory/journal-photo-picker.tsx` | helper | Up to 8 more moments. Choose up to {remaining} at once. | Add up to 8 more moments. You can choose {remaining} now. |  | proposed | `{remaining}` is dynamic from 0–8. |
| moments.addAria | Additional Moments | File chooser | `components/memory/journal-photo-picker.tsx` | aria label | Add more moments | Add more moments |  | proposed | Preferred product term. |
| moments.add | Additional Moments | Expanded disclosure | `components/memory/journal-photo-picker.tsx` | CTA | Add moments ({remaining} left) | Add moments |  | proposed | Preferred product term; the nearby helper already gives the remaining count. |
| moments.preparingButton | Additional Moments | Selection processing | `components/memory/journal-photo-picker.tsx` | progress CTA | Preparing moments… | Preparing moments… |  | proposed | Clear and nontechnical. |
| moments.fullButton | Additional Moments | Nine moments selected | `components/memory/journal-photo-picker.tsx` | disabled CTA | All moments added | Stamp is full |  | proposed | Matches the current validation vocabulary and result. |
| moments.batchLimit | Additional Moments | Too many selected | `components/memory/journal-photo-picker.tsx` | validation | Choose up to {remaining} {moment/moments} at once. No moments were added. | Choose up to {remaining} more {moment/moments}. No moments were added. |  | proposed | `{remaining}` and plural are dynamic. |
| moments.typeError | Additional Moments | Invalid selection | `components/memory/journal-photo-picker.tsx` | validation | Only images can be added as moments. | Only photos can be added as moments. |  | proposed | “Photo” is clearer than “image” here. |
| moments.sizeError | Additional Moments | Oversized selection | `components/memory/journal-photo-picker.tsx` | validation | Images larger than 25MB were not added. | Photos over 25MB were not added. |  | proposed | Concise and actionable. |
| moments.preparingCount | Additional Moments | Selection processing | `components/memory/journal-photo-picker.tsx` | progress | Preparing moment {current} of {total}… | Preparing moment {current} of {total}… |  | proposed | Dynamic progress. |
| moments.prepareError | Additional Moments | Selection processing | `components/memory/journal-photo-picker.tsx` | error | {photoName} could not be prepared. | That moment could not be added. |  | proposed | Avoids customer filename and technical preparation language. |
| moments.reorderHelper | Additional Moments | Sortable grid | `components/memory/journal-photo-picker.tsx`; `data/memory-form-product.ts` | copy gap | No visible current copy | Press and drag to reorder your moments. |  | needs review | `data/memory-form-product.ts` contains “Press and drag to reorder. The first image is the Cover Scrap.” but JournalPhotoPicker does not render it. Do not add UI in this phase. |
| moments.sortableItem | Additional Moments | Sortable grid | `components/memory/sortable-photo-grid.tsx` | aria label | Moment {position} of {total}. Press to pick up and move. | Moment {position} of {total}. Press to pick up and move. |  | needs review | `{position}` and `{total}` are dynamic; keyboard behavior is supplied by the drag library. |
| moments.sortableRole | Additional Moments | Sortable grid | `components/memory/sortable-photo-grid.tsx` | aria roledescription | sortable photo | sortable moment |  | proposed | Aligns with customer vocabulary. |
| moments.removeAria | Additional Moments | Sortable grid | `components/memory/sortable-photo-grid.tsx` | aria label | Remove {photoName} | Remove moment {position} |  | proposed | Current implementation has `{photoName}` but not position available in the label expression. Applying this later may require passing position while preserving behavior. |
| moments.movedAnnouncement | Additional Moments | Sortable grid | `components/memory/sortable-photo-grid.tsx` | screen-reader live status | {photoName} moved to position {position} of {total}. | Moment moved to position {position} of {total}. |  | proposed | Avoids announcing a device filename. |
| moments.defaultCoverLabel | Additional Moments | Generic sortable grid | `components/memory/sortable-photo-grid.tsx` | badge fallback | First photo | Cover Scrap |  | proposed | Not used by the current Journal additional-moments grid, which passes an empty badge. |
| moments.defaultItemLabel | Additional Moments | Generic sortable grid | `components/memory/sortable-photo-grid.tsx` | label fallback | Photo | Moment |  | proposed | Current Journal call already passes “Moment.” |
| moments.sectionCounter | Additional Moments | Create/edit form | `components/memory/journal-photo-picker.tsx` | copy gap | No dedicated current copy | {count} of 8 moments |  | needs review | Requested count-label scan item. The current CTA exposes only `{remaining} left`. |
| moments.overallLimit | Additional Moments | Form product rules | `data/memory-form-product.ts` | helper | Up to 9 moments. | Up to 9 moments. |  | internal only | Defined as `photoHelper` but not rendered by JournalPhotoPicker. |
| moments.limitReached | Additional Moments | Form product rules | `data/memory-form-product.ts` | status | Stamp is full | Stamp is full |  | internal only | Defined but not rendered by the current Journal picker. |
| moments.limitMessage | Additional Moments | Form product rules | `data/memory-form-product.ts` | validation | This stamp holds up to {limit} moments. Remove one to add another. | This Stamp holds up to {limit} moments. Remove one to add another. |  | internal only | Defined but not rendered by the current Journal picker. |
| moments.addedMessage | Additional Moments | Form product rules | `data/memory-form-product.ts` | status | {count} {moment/moments} added. |  |  | internal only | Defined but not rendered by the current Journal picker. |
| moments.partialLimit | Additional Moments | Form product rules | `data/memory-form-product.ts` | validation | {addedCount} {moment was/moments were} added. {rejectedCount} {was/were} not added because this stamp holds up to {limit} moments. |  |  | internal only | Defined but the current Journal picker uses its own all-or-nothing batch-limit message. |
| moments.overLimit | Additional Moments | Form product rules | `data/memory-form-product.ts` | validation | {rejectedCount} {moment was/moments were} not added because this stamp holds up to {limit} moments. |  |  | internal only | Defined but not rendered by the current Journal picker. |
| moments.oversized | Additional Moments | Form product rules | `data/memory-form-product.ts` | validation | {count} {moment was/moments were} not added because each image must be 25MB or smaller. |  |  | internal only | Defined but the current Journal picker uses “Images larger than 25MB were not added.” |
| moments.failedRetry | Additional Moments | Form product rules | `data/memory-form-product.ts` | error helper | Retry Seal this day after correcting the issue, or remove the affected moment. |  |  | internal only | Defined but not rendered by the current Journal picker; also conflicts with proposed Save Stamp terminology. |

## Scrap Finder / Scrap Table

| Copy ID | Surface | Route / Context | Component / File | UI Role | Current Copy | Suggested Rewrite | Owner Final Copy | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| scrapFinder.title | Scrap Finder | Full-screen modal | `components/scrap/scrap-table.tsx` | title | Find today's scrap | Find today’s scrap |  | proposed | Preferred product term; punctuation only. |
| scrapFinder.helper | Scrap Finder | Full-screen modal | `components/scrap/scrap-table.tsx` | helper | Move the photo under the finder. | Move the photo beneath the finder. |  | proposed | Slightly more natural spatial instruction. |
| scrapFinder.close | Scrap Finder | Full-screen modal | `components/scrap/scrap-table.tsx` | button/aria label | Close |  |  | needs review | Visible and accessible label. |
| scrapFinder.photoAlt | Scrap Finder | Finder image | `components/scrap/scrap-table.tsx` | image alt | {photoName} | Photo for today’s Cover Scrap |  | proposed | Current value is a customer filename. |
| scrapFinder.unavailable | Scrap Finder | Missing selected photo | `components/scrap/scrap-table.tsx` | error state | This photograph is not available. | That photo is not available. |  | proposed | Warm, direct, nontechnical. |
| scrapFinder.zoom | Scrap Finder | Finder controls | `components/scrap/scrap-table.tsx` | field label | Zoom |  |  | needs review | Functional range-control label. |
| scrapFinder.confirm | Scrap Finder | Finder footer | `components/scrap/scrap-table.tsx` | CTA | Use this scrap | Use this scrap |  | proposed | Preferred product term. |
| scrapFinder.chooseAnother | Scrap Finder | Finder footer | `components/scrap/scrap-table.tsx` | button | Choose another | Choose another |  | proposed | Functional and concise. |
| scrapFinder.reset | Scrap Finder | Finder footer | `components/scrap/scrap-table.tsx` | button | Reset | Reset position |  | proposed | Clarifies what resets. |
| scrapFinder.cancel | Scrap Finder | Finder footer | `components/scrap/scrap-table.tsx` | button | Cancel |  |  | needs review | Returns without applying crop. |
| scrapFinder.dragAria | Scrap Finder | Finder image | `components/scrap/scrap-table.tsx` | accessibility gap | No current copy | Move photo to choose today’s scrap |  | needs review | Pointer-drag region has no explicit aria label or keyboard instructions. Do not add behavior in this copy-only phase. |
| scrapFinder.dialogAria | Scrap Finder | Full-screen modal | `components/scrap/scrap-table.tsx` | accessible dialog name | Find today's scrap | Find today’s scrap |  | proposed | Inherited from the heading through `aria-labelledby`. |

## Photo Viewer

| Copy ID | Surface | Route / Context | Component / File | UI Role | Current Copy | Suggested Rewrite | Owner Final Copy | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| photoViewer.dialog | Photo Viewer | Full-screen modal | `components/memory/photo-viewer.tsx` | aria label | Photo {position} of {total} | Moment {position} of {total} |  | proposed | `{position}` and `{total}` are dynamic. |
| photoViewer.count | Photo Viewer | Full-screen modal | `components/memory/photo-viewer.tsx` | count | {position} / {total} |  |  | do not change | Dynamic visible count. |
| photoViewer.close | Photo Viewer | Full-screen modal | `components/memory/photo-viewer.tsx` | aria label | Close photo viewer | Close moment viewer |  | proposed | Icon-only button. |
| photoViewer.loading | Photo Viewer | Full-screen modal | `components/memory/photo-viewer.tsx` | loading state | Loading photograph… | Opening moment… |  | proposed | Avoids technical/photo framing. |
| photoViewer.imageAlt | Photo Viewer | Full-screen image | `components/memory/photo-viewer.tsx` | image alt | {photoName} | Moment {position} |  | proposed | Current `{photoName}` is often a customer filename. Position is not currently passed into the alt expression. |
| photoViewer.previous | Photo Viewer | Full-screen modal | `components/memory/photo-viewer.tsx` | aria label | Previous photo | Previous moment |  | proposed | Icon-only button. |
| photoViewer.next | Photo Viewer | Full-screen modal | `components/memory/photo-viewer.tsx` | aria label | Next photo | Next moment |  | proposed | Icon-only button. |
| photoViewer.caption | Photo Viewer | Full-screen modal | `components/memory/photo-viewer.tsx` | label | Photograph {position} | Moment {position} |  | proposed | `{position}` is dynamic. |
| photoViewer.unavailable | Photo Viewer | Missing/failed URL | `components/memory/photo-viewer.tsx` | copy gap | No current copy | That moment is not available. |  | needs review | With no display URL, the current viewer can remain on “Loading photograph…” indefinitely. A copy change alone cannot fix the state behavior. |
| photoViewer.openCover | Photo Viewer | Non-Journal legacy collection | `components/memory/photo-collection.tsx` | aria label | Open {photoName} in photo viewer | Open moment 1 |  | internal only | The current Journal detail uses StampGrid instead of this collection. |
| photoViewer.openAdditional | Photo Viewer | Non-Journal legacy collection | `components/memory/photo-collection.tsx` | aria label | Open {photoName} in photo viewer | Open moment {position} |  | internal only | Not used by current Journal detail. |
| photoViewer.additionalGroup | Photo Viewer | Non-Journal legacy collection | `components/memory/photo-collection.tsx` | aria label | Additional photographs | Additional moments |  | internal only | Not used by current Journal detail. |

## Save / Share Modal

| Copy ID | Surface | Route / Context | Component / File | UI Role | Current Copy | Suggested Rewrite | Owner Final Copy | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| saveShare.title | Save / Share | Detail modal | `components/export/daily-stamp-export-composer.tsx` | modal title | Save or share | Save or share |  | proposed | Clear and concise. |
| saveShare.close | Save / Share | Detail modal | `components/export/daily-stamp-export-composer.tsx` | aria label | Close save and share preview | Close save and share |  | proposed | Shorter while preserving meaning. |
| saveShare.previewAlt | Save / Share | Ready preview | `components/export/daily-stamp-export-composer.tsx` | image alt | 9:16 preview of the saved Daily Memory Stamp export | Preview of your Daily Memory Stamp |  | proposed | Avoids aspect-ratio and export terminology. |
| saveShare.creating | Save / Share | Generating preview | `components/export/daily-stamp-export-composer.tsx` | loading state | Creating image... | Preparing your Stamp… |  | proposed | Avoids technical image-generation language. |
| saveShare.ready | Save / Share | Ready preview | `components/export/daily-stamp-export-composer.tsx` | copy gap | No current copy | Your Stamp is ready. |  | needs review | Tests explicitly confirm “Image ready.” is absent; ready state is visual only. |
| saveShare.error | Save / Share | Preview/render failure | `components/export/daily-stamp-export-composer.tsx` | error | Couldn’t create the image. Please try again. | Your Stamp image could not be created. Please try again. |  | proposed | Retains the customer outcome and retry. |
| saveShare.save | Save / Share | Detail modal | `components/export/daily-stamp-export-composer.tsx` | CTA | Save Image | Save image |  | proposed | Sentence-case consistency. |
| saveShare.share | Save / Share | Detail modal | `components/export/daily-stamp-export-composer.tsx` | CTA | Share |  |  | needs review | Uses native share where supported. |
| saveShare.unsupported | Save / Share | Unsupported/failed share | `components/export/daily-stamp-export-composer.tsx` | screen-reader status | Sharing isn’t supported here. You can save the image instead. | Sharing is not available here. Save the image instead. |  | proposed | Direct and nontechnical. |
| saveShare.shared | Save / Share | Share success | `components/export/daily-stamp-export-composer.tsx` | screen-reader status | Shared. | Shared |  | proposed | Status punctuation is optional; owner to decide. |
| saveShare.canceled | Save / Share | Native share canceled | `components/export/daily-stamp-export-composer.tsx` | screen-reader status | Share canceled. | Share canceled |  | proposed | Status punctuation consistency. |
| saveShare.preparingAction | Save / Share | Save/share while render is busy | `components/export/daily-stamp-export-composer.tsx` | copy gap | No current copy | Preparing… |  | needs review | Both action buttons are disabled without changing their labels. |

## Daily Export

| Copy ID | Surface | Route / Context | Component / File | UI Role | Current Copy | Suggested Rewrite | Owner Final Copy | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dailyExport.journalTitle | Daily Export | Export artwork | `lib/export/daily-memory-stamp-export.ts` | title | {journalTitle} |  |  | do not change | Dynamic owner-entered Journal name; falls back to “My Journal” and is clamped to 20 characters. |
| dailyExport.date | Daily Export | Export artwork | `lib/export/daily-memory-stamp-export.ts` | date | {MONTH} {day}, {year} |  |  | do not change | Dynamic `en-US` date rendered in uppercase. |
| dailyExport.title | Daily Export | Export artwork | `lib/export/daily-memory-stamp-export.ts` | title | {stampTitle} |  |  | do not change | Customer-entered title with whitespace normalized. |
| dailyExport.titleFallback | Daily Export | Export artwork | `lib/export/daily-memory-stamp-export.ts` | title fallback | Untitled stamp | Today’s Stamp |  | proposed | Aligns with preferred product term and detail fallback proposal. |
| dailyExport.brandAlt | Daily Export | Brand mark model | `lib/export/daily-memory-stamp-export.ts` | alt text | Modern Goddess Patina |  |  | do not change | Brand name; canvas output itself does not expose DOM alt text. |
| dailyExport.filename | Daily Export | Saved/shared PNG | `lib/export/daily-memory-stamp-export.ts` | filename | scrap-the-day-{localDate}.png |  |  | do not change | `{localDate}` is `YYYY-MM-DD`; filename is sanitized and token-free. |
| dailyExport.filenameUndated | Daily Export | Missing date | `lib/export/daily-memory-stamp-export.ts` | filename fallback | undated | date-unknown |  | proposed | More explicit inside the filename; changing this affects downloaded filenames only. |
| dailyExport.loadError | Daily Export | Render internals | `lib/export/daily-memory-stamp-export.ts` | internal error | Image could not be loaded. |  |  | internal only | Not shown directly; the modal maps render failures to its generic error. |
| dailyExport.decodeError | Daily Export | Render internals | `lib/export/daily-memory-stamp-export.ts` | internal error | Image could not be decoded. |  |  | internal only | Not shown directly. |
| dailyExport.photoUnavailable | Daily Export | Render internals | `lib/export/daily-memory-stamp-export.ts` | internal error | This photograph is not available for export. |  |  | internal only | Not shown directly; contains export terminology. |
| dailyExport.canvasUnavailable | Daily Export | Render internals | `lib/export/daily-memory-stamp-export.ts` | internal error | Canvas is not available. |  |  | internal only | Not shown directly. |
| dailyExport.canvasFailure | Daily Export | Render internals | `lib/export/daily-memory-stamp-export.ts` | internal error | Canvas export failed. |  |  | internal only | Not shown directly. |

## Demo-Only Copy

Production components reused by `/journal/demo` are governed in their production sections above. The rows below are fixtures or labels unique to the demo/customer-preview route. They must not be applied to production data.

| Copy ID | Surface | Route / Context | Component / File | UI Role | Current Copy | Suggested Rewrite | Owner Final Copy | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| demo.localLabel | Demo Only | `/journal/demo?screen=create`, crop, edit | `components/journal/journal-demo-flow.tsx` | preview label | Local journal demo | Demo Journal |  | internal only | Visible only while demo is in create/crop/edit mode. |
| demo.journalTitle | Demo Only | `/journal/demo` | `components/journal/journal-demo-flow.tsx` | sample Journal name | My Journal |  |  | internal only | Same as the production fallback, but hard-coded separately in demo state and detail. |
| demo.photoName | Demo Only | `/journal/demo` photos | `components/journal/journal-demo-flow.tsx` | sample image name/alt | Demo moment {position} | Moment {position} |  | internal only | `{position}` is dynamic from 1–9 and can reach accessibility labels. |
| demo.stamp.coffeeRain | Demo Only | Sealed/detail/31 August | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Coffee before the rain |  |  | internal only | Primary detail fixture. |
| demo.stamp.quietMay | Demo Only | Backfill 8 May | `components/journal/journal-demo-flow.tsx` | sample Stamp title | A quiet May morning |  |  | internal only | Backfill fixture. |
| demo.archive.marketFlowers | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Market flowers |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.blueHourWalk | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Blue hour walk |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.peachesSill | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Peaches on the sill |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.lateLightBus | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Late light on the bus |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.firstIcedCoffee | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | First iced coffee |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.windowRain | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Window rain |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.paperBagCherries | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Paper bag cherries |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.trainPlatformLight | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Train platform light |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.cornerShopReceipt | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Corner shop receipt |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.kitchenRadio | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Kitchen radio |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.warmSidewalk | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Warm sidewalk |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.greenBowl | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Little green bowl | Green bowl by the window |  | internal only | “Little” reads cutesy against the stated voice. |
| demo.archive.postcardMorning | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Postcard morning |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.afterDinnerSky | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | After-dinner sky |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.teaWindow | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Tea at the window |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.silverMoon | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Tiny silver moon | Silver moon |  | internal only | “Tiny” may read cutesy; owner review optional because demo-only. |
| demo.archive.busStopRoses | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Bus stop roses |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.pocketNotebook | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Pocket notebook |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.cloudsLibrary | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Clouds over the library |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.quietPear | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | One quiet pear |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.bakeryPaper | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Bakery paper |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.longShadowWalk | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Long shadow walk |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.deskLampGlow | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Desk lamp glow |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.lastMelon | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Last slice of melon |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.freshPage | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Fresh page |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.softThunder | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Soft thunder |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.blueMug | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Blue mug |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.keyRing | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Key ring shine |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.laundrySun | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Laundry sun |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.doorstepMint | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Doorstep mint |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.archive.nightMarket | Demo Only | Month Sheet fixture | `components/journal/journal-demo-flow.tsx` | sample Stamp title | Night market |  |  | internal only | Appears cyclically in Month Sheet fixtures. |
| demo.memoryRedirect | Demo Only | `/memory/demo` | `app/memory/demo/page.tsx` | copy note | No current copy |  |  | internal only | Route redirects directly to `/journal/demo`. |
| demo.rootRedirect | Demo Only | `/` | `app/page.tsx` | copy note | No current copy |  |  | internal only | Root route redirects directly to `/journal/demo`. |

## Admin Preview

Only wording rendered inside the customer-theme preview is included. Admin operational form copy is intentionally excluded.

| Copy ID | Surface | Route / Context | Component / File | UI Role | Current Copy | Suggested Rewrite | Owner Final Copy | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| adminPreview.mobileLabel | Admin Preview | `/admin/journal-themes/[themeId]` | `components/admin/admin-journal-themes-page.tsx` | admin preview heading | Mobile App Preview | Journal Preview |  | internal only | Labels the preview for admins; not customer-visible. |
| adminPreview.mobileEyebrow | Admin Preview | Theme mobile preview | `components/admin/admin-journal-themes-page.tsx` | preview eyebrow | Journal |  |  | internal only | Preview-only customer-like copy; production Home does not show this eyebrow. |
| adminPreview.mobileTitle | Admin Preview | Theme mobile preview | `components/admin/admin-journal-themes-page.tsx` | preview title | {themeName} / Theme | My Journal |  | internal only | Current preview uses admin theme name, not representative customer copy. |
| adminPreview.month | Admin Preview | Theme mobile preview | `components/admin/admin-journal-themes-page.tsx` | preview month | July | July 2026 |  | internal only | Production Month Sheet includes year. |
| adminPreview.footer | Admin Preview | Theme mobile preview | `components/admin/admin-journal-themes-page.tsx` | preview footer | Private by nature. |  |  | internal only | Not present in production; review if the preview should imply it is. |
| adminPreview.exportLabel | Admin Preview | Theme export preview | `components/admin/admin-journal-themes-page.tsx` | admin preview heading | Daily Export Preview | Daily Stamp Preview |  | internal only | Admin-only label. |
| adminPreview.exportDate | Admin Preview | Theme export preview | `components/admin/admin-journal-themes-page.tsx` | sample date | July 6, 2026 |  |  | internal only | Static preview date; production export renders uppercase. |
| adminPreview.exportTitle | Admin Preview | Theme export preview | `components/admin/admin-journal-themes-page.tsx` | sample Stamp title | Daily Scrap | Coffee before the rain |  | internal only | “Daily Scrap” is a product object, not a natural “One line to keep.” |
| adminPreview.exportBrand | Admin Preview | Theme export preview | `components/admin/admin-journal-themes-page.tsx` | sample brand mark | MGP | Modern Goddess Patina logo |  | internal only | Production uses the full MGP logo asset, not text. |
| adminPreview.cardEyebrow | Admin Preview | Theme editor side preview | `components/admin/admin-journal-themes-page.tsx` | admin preview label | Preview |  |  | internal only | Admin-only. |
| adminPreview.cardTitle | Admin Preview | Theme editor side preview | `components/admin/admin-journal-themes-page.tsx` | sample title | {themeName} / Theme |  |  | internal only | Admin theme name or fallback. |

## Explicitly excluded from customer-copy application

- Admin operations outside the theme-preview content, API response codes, database/RPC strings, console diagnostics, test descriptions, design-playground annotations, CSS data attributes, and source comments.
- Bookmark-only memory form, photo-picker, voice-recorder, and voice-memo copy. These components share infrastructure with Journal routes, but Journal mode disables voice memos and uses `JournalPhotoPicker` instead of the legacy picker.
- Customer-authored Journal names, “One line to keep” values, device filenames, recovery codes, and dates as editable content. Their surrounding labels, fallbacks, and formatting are inventoried.
- Placeholder SVG text under `public/images/memory-demo/`; the active `/memory/demo` route redirects to `/journal/demo` and does not render those assets.

## Review focus

1. Remove or replace customer-facing “capsule,” “media,” “upload,” “session,” “cleanup,” “commit,” and “export” language where the deck marks a proposal.
2. Decide whether product terms use title case (`Journal`, `Stamp`, `Cover Scrap`) or sentence case in running text, then apply consistently.
3. Reconcile the Home tray’s current “Seal the Day” with the preferred “Seal Today,” without changing the tray interaction.
4. Align the create action around the preferred “Save stamp” term while keeping the Home sealing ritual.
5. Approve wording for current copy gaps only if the associated state already exists. Rows that would require new state behavior must remain documentation-only until separately scoped.
