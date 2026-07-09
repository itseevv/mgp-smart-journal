"use client";

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CloseIcon,
  DownloadIcon,
  ShareIcon,
} from "@/components/memory/memory-icons";
import {
  resolveJournalTheme,
  type JournalTheme,
} from "@/data/journal-themes";
import type { MemoryEntry, MemoryPhoto } from "@/data/memory-demo";
import {
  dailyStampExportArtifactModel,
  dailyStampExportFilename,
  renderDailyMemoryStampExport,
  saveDailyStampExportBlob,
  shareDailyStampExportBlob,
  type DailyStampExportBrandMark,
} from "@/lib/export/daily-memory-stamp-export";

type DailyStampExportComposerProps = {
  open: boolean;
  memory: MemoryEntry;
  onClose: () => void;
  resolvePhotoUrl?: (
    photo: MemoryPhoto,
    variant: "display" | "thumbnail",
    forceRefresh?: boolean,
  ) => Promise<string>;
  theme?: JournalTheme;
  brandMark?: DailyStampExportBrandMark;
  journalTitle?: string;
};

type ComposerState =
  | {
      status: "idle" | "generating";
      blob?: undefined;
      previewUrl?: undefined;
      message?: string;
    }
  | {
      status: "ready";
      blob: Blob;
      previewUrl: string;
      message?: string;
    }
  | {
      status: "error";
      blob?: undefined;
      previewUrl?: undefined;
      message: string;
    };

const exportErrorMessage = "Couldn’t create the image. Please try again.";

const brand = {
  deepBurgundy: "#421819",
  champagnePeach: "#E4B48F",
  warmIvory: "#E8DBCC",
  cocoaTaupe: "#62453A",
};

const displayFont =
  '"Cormorant Garamond", "Bodoni Moda", "DM Serif Display", Georgia, serif';
const utilityFont = 'Inter, Aptos, "Source Sans 3", system-ui, sans-serif';

function rgbaFromHex(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function isLightTheme(theme: JournalTheme) {
  return theme.logoVariant === "dark";
}

function artifactShellStyle(theme: JournalTheme) {
  const textureLayer = theme.textureUrl ? `, url("${theme.textureUrl}")` : "";

  return {
    backgroundColor: theme.journalBackground,
    backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(0,0,0,0.14))${textureLayer}`,
    backgroundPosition: "center",
    backgroundSize: "cover",
    color: theme.textOnJournal,
  } satisfies CSSProperties;
}

function modalSurfaceStyle() {
  return {
    backgroundColor: rgbaFromHex(brand.warmIvory, 0.9),
    backgroundImage: `linear-gradient(180deg, ${rgbaFromHex(
      brand.champagnePeach,
      0.12,
    )}, ${rgbaFromHex(brand.cocoaTaupe, 0.06)})`,
    border: `1px solid ${rgbaFromHex(brand.deepBurgundy, 0.12)}`,
    boxShadow: `0 16px 38px ${rgbaFromHex(brand.deepBurgundy, 0.22)}`,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    color: brand.deepBurgundy,
  } satisfies CSSProperties;
}

function modalOverlayStyle() {
  return {
    height: "100dvh",
    minHeight: "100svh",
    overscrollBehavior: "contain",
    paddingTop: "max(0.75rem, env(safe-area-inset-top))",
    paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
  } satisfies CSSProperties;
}

function modalDialogStyle() {
  return {
    ...modalSurfaceStyle(),
    maxHeight: "calc(100dvh - 1.5rem)",
  } satisfies CSSProperties;
}

function loadingTextStyle(theme: JournalTheme) {
  return {
    color: isLightTheme(theme)
      ? brand.deepBurgundy
      : rgbaFromHex(brand.champagnePeach, 0.86),
    fontFamily: displayFont,
  } satisfies CSSProperties;
}

function modalPrimaryActionStyle(theme: JournalTheme) {
  return {
    backgroundColor: theme.journalBackground,
    color: theme.textOnJournal,
    fontFamily: utilityFont,
  } satisfies CSSProperties;
}

function modalSecondaryActionStyle(theme: JournalTheme) {
  return {
    backgroundColor: isLightTheme(theme)
      ? brand.deepBurgundy
      : rgbaFromHex(brand.warmIvory, 0.9),
    color: isLightTheme(theme) ? brand.warmIvory : brand.deepBurgundy,
    fontFamily: utilityFont,
  } satisfies CSSProperties;
}

export function DailyStampExportComposer({
  open,
  memory,
  onClose,
  resolvePhotoUrl,
  theme,
  brandMark,
  journalTitle,
}: DailyStampExportComposerProps) {
  const [composerState, setComposerState] = useState<ComposerState>({
    status: "idle",
  });
  const previewUrlRef = useRef<string | undefined>(undefined);
  const resolvedTheme = useMemo(() => resolveJournalTheme(theme), [theme]);
  const titleId = "daily-stamp-export-title";
  const filename = dailyStampExportFilename(memory);
  const model = dailyStampExportArtifactModel({ memory, brandMark, journalTitle });
  const isBusy = composerState.status === "generating";

  const revokePreview = () => {
    if (!previewUrlRef.current) return;
    URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = undefined;
  };

  useEffect(() => () => revokePreview(), []);

  useEffect(() => {
    if (!open) return;

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;
    const previousDocumentOverflow = documentElement.style.overflow;
    const previousDocumentOverscroll =
      documentElement.style.overscrollBehavior;

    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "contain";
    documentElement.style.overflow = "hidden";
    documentElement.style.overscrollBehavior = "contain";

    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
      documentElement.style.overflow = previousDocumentOverflow;
      documentElement.style.overscrollBehavior = previousDocumentOverscroll;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let active = true;

    const createPreview = async () => {
      revokePreview();
      setComposerState({ status: "generating", message: "Creating image..." });
      try {
        const blob = await renderDailyMemoryStampExport({
          memory,
          resolvePhotoUrl,
          theme: resolvedTheme,
          brandMark,
          journalTitle,
        });
        if (!active) return;
        const previewUrl = URL.createObjectURL(blob);
        previewUrlRef.current = previewUrl;
        setComposerState({
          status: "ready",
          blob,
          previewUrl,
        });
      } catch (error) {
        if (!active) return;
        console.error("Daily stamp export failed.", error);
        revokePreview();
        setComposerState({
          status: "error",
          message: exportErrorMessage,
        });
      }
    };

    void createPreview();

    return () => {
      active = false;
    };
  }, [brandMark, journalTitle, memory, open, resolvePhotoUrl, resolvedTheme]);

  if (!open) return null;

  const closeComposer = () => {
    revokePreview();
    setComposerState({ status: "idle" });
    onClose();
  };

  const ensureExportBlob = async () => {
    if (composerState.status === "ready") return composerState.blob;
    setComposerState({ status: "generating", message: "Creating image..." });
    try {
      const blob = await renderDailyMemoryStampExport({
        memory,
        resolvePhotoUrl,
        theme: resolvedTheme,
        brandMark,
        journalTitle,
      });
      revokePreview();
      const previewUrl = URL.createObjectURL(blob);
      previewUrlRef.current = previewUrl;
      setComposerState({
        status: "ready",
        blob,
        previewUrl,
      });
      return blob;
    } catch (error) {
      console.error("Daily stamp export failed.", error);
      revokePreview();
      setComposerState({
        status: "error",
        message: exportErrorMessage,
      });
      return undefined;
    }
  };

  const saveImage = async () => {
    const blob = await ensureExportBlob();
    if (!blob) return;
    saveDailyStampExportBlob(blob, filename);
  };

  const shareImage = async () => {
    const blob = await ensureExportBlob();
    if (!blob) return;
    try {
      const result = await shareDailyStampExportBlob(
        blob,
        filename,
        model.title,
      );
      if (!result.shared) {
        setComposerState((current) =>
          current.status === "ready"
            ? {
                ...current,
                message:
                  "Sharing isn’t supported here. You can save the image instead.",
              }
            : current,
        );
        return;
      }
      setComposerState((current) =>
        current.status === "ready"
          ? { ...current, message: "Shared." }
          : current,
      );
    } catch (error) {
      const name =
        error && typeof error === "object" && "name" in error
          ? String(error.name)
          : "";
      setComposerState((current) =>
        current.status === "ready"
          ? {
              ...current,
              message:
                name === "AbortError"
                  ? "Share canceled."
                  : "Sharing isn’t supported here. You can save the image instead.",
            }
          : current,
      );
    }
  };

  const statusMessage =
    composerState.message && composerState.status !== "generating"
      ? composerState.message
      : "";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto overscroll-contain bg-black/30 px-3"
      role="presentation"
      data-daily-stamp-export-composer="true"
      data-save-share-modal-chrome="utility-action-surface"
      data-save-share-modal-position="fixed-viewport-centered"
      data-save-share-modal-production-wiring="enabled"
      data-save-share-modal-state={composerState.status}
      style={modalOverlayStyle()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-[19.125rem] overflow-y-auto overscroll-contain rounded-md p-3"
        data-save-share-modal-surface="edit-stamp-beige-overlay"
        style={modalDialogStyle()}
      >
        <header className="flex items-center justify-between gap-3">
          <h2
            id={titleId}
            className="text-[1.18rem] leading-tight"
            data-save-share-modal-title="simple"
            style={{ fontFamily: displayFont }}
          >
            Save or share
          </h2>
          <button
            type="button"
            onClick={closeComposer}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: rgbaFromHex(brand.deepBurgundy, 0.08),
            }}
            aria-label="Close save and share preview"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>

        <div
          className="mx-auto mt-3 w-full max-w-[9.5rem]"
          data-save-share-modal-preview="daily-export-artifact"
        >
          {composerState.status === "ready" ? (
            <div
              className="relative mx-auto aspect-[9/16] w-[9.5rem] max-w-full overflow-hidden"
              data-save-share-modal-preview-scale="proportional-artifact"
              data-save-share-modal-preview-scale-source="full-artifact"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={composerState.previewUrl}
                alt="9:16 preview of the saved Daily Memory Stamp export"
                className="h-full w-full object-contain"
                data-daily-stamp-export-preview="ready"
              />
            </div>
          ) : (
            <div
              className="grid aspect-[9/16] place-items-center overflow-hidden p-4 text-center"
              aria-busy={isBusy}
              data-daily-stamp-export-preview={composerState.status}
              data-export-artifact-loading-state="creating-image"
              data-export-artifact-loading-treatment="quiet-leather-only"
              style={artifactShellStyle(resolvedTheme)}
            >
              <p
                className="whitespace-nowrap text-[0.78rem] leading-none"
                style={loadingTextStyle(resolvedTheme)}
              >
                {composerState.status === "error"
                  ? exportErrorMessage
                  : "Creating image..."}
              </p>
            </div>
          )}
        </div>

        {statusMessage ? (
          <p
            className="sr-only"
            role={composerState.status === "error" ? "alert" : "status"}
          >
            {statusMessage}
          </p>
        ) : null}

        <div className="mt-3 grid gap-2">
          <button
            type="button"
            onClick={() => void saveImage()}
            disabled={isBusy}
            className="flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-xs font-semibold disabled:cursor-wait"
            data-save-share-modal-primary-color="journal-theme"
            data-save-share-modal-primary-action="save-image"
            style={modalPrimaryActionStyle(resolvedTheme)}
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            Save Image
          </button>
          <button
            type="button"
            onClick={() => void shareImage()}
            disabled={isBusy}
            className="flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-xs font-semibold disabled:cursor-wait"
            data-save-share-modal-secondary-color="previous-primary-control"
            data-save-share-modal-secondary-action="share"
            style={modalSecondaryActionStyle(resolvedTheme)}
          >
            <ShareIcon className="h-3.5 w-3.5" />
            Share
          </button>
        </div>
      </section>
    </div>
  );
}
