"use client";

import { useEffect, useState, type FormEvent } from "react";

import { PhotoPicker } from "@/components/memory/photo-picker";
import { VoiceRecorder } from "@/components/memory/voice-recorder";
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
  resolveVoiceMemoUrl,
}: MemoryFormProps) {
  const [errors, setErrors] = useState<FormErrors>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const dateTime = formatDateTimeParts(draft.capturedAt);
  const isSaving =
    saveStatus === "preparing" ||
    saveStatus === "uploading" ||
    saveStatus === "savingMetadata" ||
    saveStatus === "cleaningUp";

  useEffect(() => {
    onBusyChange?.(isRecording || isSaving);
  }, [isRecording, isSaving, onBusyChange]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    if (!draft.title.trim()) nextErrors.title = "Give this memory a title.";
    if (draft.photos.length === 0) {
      nextErrors.photos = "Add at least one photograph before saving.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSave();
  };

  return (
    <article className="memory-entry">
      <header className="flex items-center justify-between border-b border-rule pb-4">
        <p className="font-sans text-xs font-semibold tracking-[0.08em] text-oxblood">
          {isEditing ? "Edit memory" : "New memory"}
        </p>
        <p className="font-sans text-[0.68rem] text-ink-soft">
          {isEditing ? "Unsaved changes" : "Draft"}
        </p>
      </header>

      <form className="mt-7" aria-label={isEditing ? "Edit memory" : "Create a memory"} onSubmit={submit}>
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

        <label className="mt-8 block">
          <span className="mb-2 block font-sans text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
            Memory title
          </span>
          <input
            type="text"
            maxLength={200}
            value={draft.title}
            onChange={(event) => {
              onDraftChange({ ...draft, title: event.target.value });
              if (errors.title) setErrors((current) => ({ ...current, title: undefined }));
            }}
            placeholder="Name this memory"
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? "title-error" : undefined}
            className="w-full border-0 border-b border-rule bg-transparent px-0 pb-3 font-serif text-[2.15rem] leading-tight tracking-[-0.035em] text-ink outline-none placeholder:text-ink/38 focus:border-oxblood"
          />
          {errors.title ? (
            <span id="title-error" className="mt-2 block font-sans text-xs text-oxblood" role="alert">
              {errors.title}
            </span>
          ) : null}
        </label>

        <div className="mt-9">
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
          />
          {errors.photos ? (
            <p className="mt-2 font-sans text-xs text-oxblood" role="alert">
              {errors.photos}
            </p>
          ) : null}
        </div>

        <div className="mt-9">
          <VoiceRecorder
            config={config}
            voiceMemos={draft.voiceMemos}
            onChange={onVoiceMemosChange}
            onRecordingChange={setIsRecording}
            registerObjectUrl={registerObjectUrl}
            resolveVoiceMemoUrl={resolveVoiceMemoUrl}
          />
        </div>

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
            {isSaving
              ? saveStatus === "preparing"
                ? "Preparing photos…"
                : saveStatus === "uploading"
                  ? "Uploading media…"
                  : saveStatus === "cleaningUp"
                    ? "Finishing save…"
                    : "Saving memory…"
              : saveStatus === "error" || saveStatus === "partialFailure"
                ? "Retry save"
              : isEditing
                ? "Save changes"
                : "Save memory"}
          </button>
        </div>
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
