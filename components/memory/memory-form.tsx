"use client";

import { useEffect, useState, type FormEvent } from "react";

import { JournalPhotoPicker } from "@/components/memory/journal-photo-picker";
import { PhotoPicker } from "@/components/memory/photo-picker";
import { VoiceRecorder } from "@/components/memory/voice-recorder";
import {
  CalendarIcon,
  ChevronLeftIcon,
} from "@/components/memory/memory-icons";
import type { JournalMemorySummary } from "@/data/journal";
import type { JournalTheme } from "@/data/journal-themes";
import {
  findDuplicateStampForLocalDate,
  localDateKey,
} from "@/data/journal-stamps";
import { resolvedLocalTimezone } from "@/data/local-date";
import {
  getMemoryFormProductRules,
  type MemoryFormProductMode,
} from "@/data/memory-form-product";
import type {
  MemoryDraft,
  MemoryMediaConfig,
  MemoryPhoto,
  MemoryVoiceMemo,
} from "@/data/memory-demo";
import type { SaveProgress, SaveStatus } from "@/lib/capsule/api";

type FormErrors = {
  photos?: string;
  title?: string;
};

type MemoryFormProps = {
  config: MemoryMediaConfig;
  draft: MemoryDraft;
  isEditing: boolean;
  onDraftChange: (draft: MemoryDraft) => void;
  onRemovePhoto: (photo: MemoryPhoto) => void;
  onVoiceMemosChange: (voiceMemos: MemoryVoiceMemo[]) => void;
  onSave: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
  registerObjectUrl: (url: string) => void;
  saveStatus?: SaveStatus;
  saveMessage?: string;
  saveProgress?: SaveProgress;
  onBusyChange?: (busy: boolean) => void;
  productMode?: MemoryFormProductMode;
  currentMemoryId?: string;
  journalStamps?: JournalMemorySummary[];
  onOpenJournalStamp?: (memoryId: string) => void;
  theme?: JournalTheme;
  resolveVoiceMemoUrl?: (
    memo: MemoryVoiceMemo,
    forceRefresh?: boolean,
  ) => Promise<string>;
};

function formatDateTimeParts(isoDate: string) {
  const value = new Date(isoDate);
  return {
    date: new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(value),
    time: new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(value),
  };
}

function toLocalDateTimeInput(isoDate: string) {
  const value = new Date(isoDate);
  const localValue = new Date(
    value.getTime() - value.getTimezoneOffset() * 60_000,
  );
  return localValue.toISOString().slice(0, 16);
}

function formatLocalDateLabel(localDate: string, fallbackIsoDate: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  const value =
    year && month && day
      ? new Date(year, month - 1, day)
      : new Date(fallbackIsoDate);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(value);
}

function updateLocalDate(isoDate: string, localDate: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  const value = new Date(isoDate);
  value.setFullYear(year, month - 1, day);
  return value.toISOString();
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 MB";
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function MemoryForm({
  config,
  draft,
  isEditing,
  onDraftChange,
  onRemovePhoto,
  onVoiceMemosChange,
  onSave,
  onCancel,
  showCancel = isEditing,
  registerObjectUrl,
  saveStatus = "idle",
  saveMessage = "",
  saveProgress,
  onBusyChange,
  productMode = "memory",
  currentMemoryId,
  journalStamps = [],
  onOpenJournalStamp,
  theme,
  resolveVoiceMemoUrl,
}: MemoryFormProps) {
  const [errors, setErrors] = useState<FormErrors>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceNoteConfirmed, setIsVoiceNoteConfirmed] = useState(true);
  const [isPreparingPhotos, setIsPreparingPhotos] = useState(false);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const dateTime = formatDateTimeParts(draft.capturedAt);
  const productRules = getMemoryFormProductRules(productMode);
  const { copy } = productRules;
  const isJournalProduct = productMode === "journal";
  const voiceMemosEnabled = productRules.voiceMemosEnabled;
  const selectedLocalDate =
    isJournalProduct && draft.localDate === ""
      ? ""
      : draft.localDate ?? localDateKey(draft.capturedAt);
  const duplicateStamp =
    isJournalProduct && selectedLocalDate
      ? findDuplicateStampForLocalDate(
          journalStamps,
          selectedLocalDate,
          currentMemoryId,
        )
      : undefined;
  const journalSaveDisabled =
    isJournalProduct &&
    (!selectedLocalDate ||
      !draft.title.trim() ||
      draft.photos.length === 0 ||
      Boolean(duplicateStamp) ||
      !isVoiceNoteConfirmed);
  const isSaving =
    saveStatus === "preparing" ||
    saveStatus === "uploading" ||
    saveStatus === "savingMetadata" ||
    saveStatus === "cleaningUp";
  const saveButtonLabel = isSaving
    ? saveStatus === "preparing"
      ? copy.preparing
      : saveStatus === "uploading"
        ? copy.savingMedia
        : saveStatus === "cleaningUp"
          ? "Finishing save…"
          : copy.savingDetails
    : saveStatus === "error" || saveStatus === "partialFailure"
      ? "Retry save"
      : isEditing
        ? copy.saveEdit
        : copy.saveNew;
  const articleClassName = isJournalProduct
    ? "journal-create-edit-form"
    : "memory-entry";
  const formHeaderClassName = isJournalProduct
    ? "journal-create-edit-form__header flex items-center gap-3 pb-4"
    : "flex items-center justify-between border-b border-rule pb-4";
  const formTitleLabelClassName = isJournalProduct
    ? "journal-form-label mb-2 block font-sans text-[0.65rem] font-semibold uppercase"
    : "mb-2 block font-sans text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink-soft";
  const titleInputClassName = isJournalProduct
    ? "journal-form-title-input w-full border-0 bg-transparent px-0 pb-3 font-serif text-[1.55rem] leading-tight outline-none sm:text-[1.75rem]"
    : "w-full border-0 border-b border-rule bg-transparent px-0 pb-3 font-serif text-[2.15rem] leading-tight tracking-[-0.035em] text-ink outline-none placeholder:text-ink/38 focus:border-oxblood";

  useEffect(() => {
    onBusyChange?.(isRecording || isSaving || isPreparingPhotos);
  }, [isPreparingPhotos, isRecording, isSaving, onBusyChange]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPreparingPhotos) return;
    if (isJournalProduct && !selectedLocalDate) return;
    if (isJournalProduct && !isVoiceNoteConfirmed) return;
    const nextErrors: FormErrors = {};
    if (!draft.title.trim()) {
      nextErrors.title = copy.titleRequiredError;
    }
    if (draft.photos.length === 0) {
      nextErrors.photos = copy.photosRequiredError;
    }
    if (duplicateStamp) {
      nextErrors.photos = "That day is already sealed in this journal.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSave();
  };

  return (
    <article
      className={articleClassName}
      data-journal-create-edit-form={
        isJournalProduct ? "translucent-form-overlay" : undefined
      }
    >
      <header className={formHeaderClassName}>
        {isJournalProduct && onCancel ? (
          <button
            type="button"
            aria-label="Back without saving"
            data-journal-form-action="back"
            onClick={onCancel}
            disabled={isPreparingPhotos || isRecording || isSaving}
            className="journal-create-edit-back-button editorial-icon-button shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
        ) : null}
        <p
          className={
            isJournalProduct
              ? "journal-create-edit-form__eyebrow font-sans text-xs font-semibold tracking-[0.08em]"
              : "font-sans text-xs font-semibold tracking-[0.08em] text-oxblood"
          }
        >
          {isEditing ? copy.editTitle : copy.newTitle}
        </p>
        {!isJournalProduct ? (
          <p className="font-sans text-[0.68rem] text-ink-soft">
            {isEditing ? "Unsaved changes" : "Draft"}
          </p>
        ) : null}
      </header>

      <form
        className="mt-7"
        aria-label={
          isEditing ? copy.editAriaLabel : copy.createAriaLabel
        }
        onSubmit={submit}
      >
        {isJournalProduct ? (
          <div>
            <span className="mb-1.5 block font-sans text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--journal-paper-muted-text)]">
              Date
            </span>
            <label className="journal-form-date-row relative flex min-h-12 cursor-pointer items-center justify-between gap-3 pb-2 font-sans text-sm">
              <time
                dateTime={selectedLocalDate || undefined}
                data-journal-date-value="paper-text"
                className="text-[var(--journal-paper-text)]"
              >
                {selectedLocalDate
                  ? formatLocalDateLabel(selectedLocalDate, draft.capturedAt)
                  : "Choose a date"}
              </time>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--journal-photo-edge)] text-[var(--journal-paper-muted-text)]">
                <CalendarIcon className="h-4 w-4" />
              </span>
              <input
                type="date"
                value={selectedLocalDate}
                onChange={(event) => {
                  if (!event.target.value) return;
                  const nextLocalDate = event.target.value;
                  onDraftChange({
                    ...draft,
                    capturedAt: updateLocalDate(
                      draft.capturedAt,
                      nextLocalDate,
                    ),
                    localDate: nextLocalDate,
                    localTimezone:
                      draft.localTimezone ?? resolvedLocalTimezone(),
                  });
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Choose stamp date"
              />
            </label>
            {duplicateStamp ? (
              <div
                className="mt-3 border-l-2 border-oxblood/35 bg-paper-deep/25 px-3 py-2 font-sans text-xs leading-relaxed text-ink-soft"
                role="alert"
              >
                <p>That day is already sealed in this journal.</p>
                <button
                  type="button"
                  onClick={() => onOpenJournalStamp?.(duplicateStamp.id)}
                  className="mt-1 font-semibold text-oxblood underline underline-offset-4"
                >
                  Open that stamp instead.
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div>
                <span className="mb-1.5 block font-sans text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                  Date
                </span>
                <time
                  dateTime={draft.capturedAt}
                  className="block border-b border-rule pb-2 font-sans text-sm"
                >
                  {dateTime.date}
                </time>
              </div>
              <div className="min-w-24">
                <span className="mb-1.5 block font-sans text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                  Time
                </span>
                <time
                  dateTime={draft.capturedAt}
                  className="block border-b border-rule pb-2 text-right font-sans text-sm"
                >
                  {dateTime.time}
                </time>
              </div>
            </div>
            {isEditingDate ? (
              <div className="mt-3">
                <label
                  htmlFor="memory-date-time"
                  className="mb-1.5 block font-sans text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink-soft"
                >
                  Date and time
                </label>
                <input
                  id="memory-date-time"
                  type="datetime-local"
                  value={toLocalDateTimeInput(draft.capturedAt)}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    onDraftChange({
                      ...draft,
                      capturedAt: new Date(event.target.value).toISOString(),
                    });
                  }}
                  className="w-full border-0 border-b border-rule bg-transparent pb-2 font-sans text-sm outline-none focus:border-oxblood"
                />
                <button
                  type="button"
                  onClick={() => setIsEditingDate(false)}
                  className="mt-2 font-sans text-[0.68rem] text-oxblood underline underline-offset-4"
                >
                  Done
                </button>
              </div>
            ) : (
              <p className="mt-2 font-sans text-[0.68rem] text-ink-soft">
                Date and time are added automatically.{" "}
                <button
                  type="button"
                  onClick={() => setIsEditingDate(true)}
                  className="font-semibold text-oxblood underline underline-offset-4"
                >
                  Edit
                </button>
              </p>
            )}
          </>
        )}

        <label className={isJournalProduct ? "mt-7 block" : "mt-8 block"}>
          <span className={formTitleLabelClassName}>
            {copy.titleLabel}
          </span>
          <input
            type="text"
            maxLength={200}
            value={draft.title}
            onChange={(event) => {
              onDraftChange({ ...draft, title: event.target.value });
              if (errors.title) setErrors((current) => ({ ...current, title: undefined }));
            }}
            placeholder={copy.titlePlaceholder}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? "title-error" : undefined}
            className={titleInputClassName}
          />
          {errors.title ? (
            <span id="title-error" className="mt-2 block font-sans text-xs text-oxblood" role="alert">
              {errors.title}
            </span>
          ) : null}
        </label>

        <div className="mt-9">
          {isJournalProduct ? (
            <JournalPhotoPicker
              config={config}
              photos={draft.photos}
              registerObjectUrl={registerObjectUrl}
              theme={theme}
              onChange={(photos) => {
                onDraftChange({ ...draft, photos });
                if (errors.photos) {
                  setErrors((current) => ({ ...current, photos: undefined }));
                }
              }}
              onRemovePhoto={onRemovePhoto}
              onPreparingChange={setIsPreparingPhotos}
            />
          ) : (
            <PhotoPicker
              config={config}
              photos={draft.photos}
              registerObjectUrl={registerObjectUrl}
              onAdd={(photos) => {
                onDraftChange({ ...draft, photos: [...draft.photos, ...photos] });
                if (errors.photos) setErrors((current) => ({ ...current, photos: undefined }));
              }}
              onReorder={(photos) => onDraftChange({ ...draft, photos })}
              onRemove={onRemovePhoto}
              productMode={productMode}
            />
          )}
          {errors.photos ? (
            <p className="mt-2 font-sans text-xs text-oxblood" role="alert">
              {errors.photos}
            </p>
          ) : null}
        </div>

        {voiceMemosEnabled ? (
          <div className="mt-9">
            <VoiceRecorder
              config={config}
              voiceMemos={draft.voiceMemos}
              onChange={onVoiceMemosChange}
              onRecordingChange={setIsRecording}
              registerObjectUrl={registerObjectUrl}
              resolveVoiceMemoUrl={resolveVoiceMemoUrl}
              journalMode={isJournalProduct}
              onConfirmationChange={setIsVoiceNoteConfirmed}
            />
          </div>
        ) : null}

        {isJournalProduct ? (
          <div
            className="journal-create-edit-actions mt-8 flex flex-col gap-2 pt-3"
            data-journal-create-edit-actions="in-flow-form-footer"
          >
            <button
              type="submit"
              disabled={
                journalSaveDisabled ||
                isPreparingPhotos ||
                isRecording ||
                isSaving
              }
              className="journal-create-edit-save-button min-h-13 px-5 py-4 font-sans text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveButtonLabel}
            </button>
            {showCancel && onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                disabled={isPreparingPhotos || isRecording || isSaving}
                className="journal-create-edit-cancel-button py-2 font-sans text-xs font-semibold underline underline-offset-4 disabled:opacity-50"
              >
                Cancel
              </button>
            ) : null}
          </div>
        ) : !isJournalProduct ? (
          <div className="mt-9 flex flex-col-reverse gap-3 sm:flex-row">
            {showCancel && onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={isRecording || isSaving}
              className="flex-1 rounded-sm border border-rule px-5 py-4 font-sans text-sm font-semibold text-ink disabled:opacity-50"
            >
              Cancel
            </button>
            ) : null}
            <button
              type="submit"
              disabled={isRecording || isSaving}
              className="flex-1 rounded-sm bg-ink px-5 py-4 font-sans text-sm font-semibold text-paper shadow-[0_6px_18px_rgba(45,42,36,0.12)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveButtonLabel}
            </button>
          </div>
        ) : null}
        {saveMessage ? (
          <p
            className={`mt-3 text-center font-sans text-xs ${
              saveStatus === "error" || saveStatus === "partialFailure"
                ? "text-oxblood"
                : "text-ink-soft"
            }`}
            role={saveStatus === "error" ? "alert" : "status"}
          >
            {saveMessage}
          </p>
        ) : null}
        {saveProgress?.sourceBytes && saveProgress.optimisedBytes ? (
          <p className="mt-1 text-center font-sans text-[0.68rem] text-ink-soft">
            {formatBytes(saveProgress.sourceBytes)} selected ·{" "}
            {formatBytes(saveProgress.optimisedBytes)} prepared
          </p>
        ) : null}
        {isRecording ? (
          <p className="mt-3 text-center font-sans text-xs text-ink-soft" role="status">
            Stop the recording before saving or leaving this form.
          </p>
        ) : null}
      </form>
    </article>
  );
}
