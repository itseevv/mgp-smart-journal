import {
  DAILY_MEMORY_STAMP_MAX_PHOTOS,
  JOURNAL_VOICE_MEMOS_ENABLED,
} from "./journal-product.ts";
import { memoryMediaConfig } from "./memory-demo.ts";

export type MemoryFormProductMode = "memory" | "journal";

export type MemoryFormProductCopy = {
  newTitle: string;
  editTitle: string;
  createAriaLabel: string;
  editAriaLabel: string;
  titleLabel: string;
  titlePlaceholder: string;
  titleRequiredError: string;
  photosRequiredError: string;
  photoSectionTitle: string;
  photoCounterUnit: string;
  photoHelper?: string;
  photoChooseAriaLabel: string;
  addEmptyPhotos: string;
  addMorePhotos: string;
  photoLimitReached: string;
  photoLimitMessage: (limit: number) => string;
  photoAddedMessage: (count: number) => string;
  photoPartialLimitMessage: (addedCount: number, rejectedCount: number, limit: number) => string;
  photoOverLimitMessage: (rejectedCount: number, limit: number) => string;
  photoOversizedMessage: (count: number) => string;
  failedPhotoRetry: string;
  reorderHelp: string;
  coverLabel: string;
  sortableItemLabel: string;
  preparing: string;
  savingMedia: string;
  savingDetails: string;
  saveNew: string;
  saveEdit: string;
};

export type MemoryFormProductRules = {
  mode: MemoryFormProductMode;
  maxPhotosPerEntry: number;
  voiceMemosEnabled: boolean;
  copy: MemoryFormProductCopy;
};

function plural(value: number, singular: string, pluralValue: string) {
  return value === 1 ? singular : pluralValue;
}

const memoryFormRules: MemoryFormProductRules = {
  mode: "memory",
  maxPhotosPerEntry: memoryMediaConfig.maxPhotosPerMemory,
  voiceMemosEnabled: true,
  copy: {
    newTitle: "New memory",
    editTitle: "Edit memory",
    createAriaLabel: "Create a memory",
    editAriaLabel: "Edit memory",
    titleLabel: "Memory title",
    titlePlaceholder: "Name this memory",
    titleRequiredError: "Give this memory a title.",
    photosRequiredError: "Add at least one photograph before saving.",
    photoSectionTitle: "Photographs",
    photoCounterUnit: "photos",
    photoChooseAriaLabel: "Choose photographs",
    addEmptyPhotos: "Add photos",
    addMorePhotos: "Add more photos",
    photoLimitReached: "Photo limit reached",
    photoLimitMessage: (limit) =>
      `This memory has reached its ${limit}-photo limit. Remove a photo to add another.`,
    photoAddedMessage: (count) =>
      `${count} ${plural(count, "photo", "photos")} added.`,
    photoPartialLimitMessage: (addedCount, rejectedCount, limit) =>
      `${addedCount} ${plural(addedCount, "photo was", "photos were")} added. ${rejectedCount} ${plural(rejectedCount, "was", "were")} not added because this memory allows up to ${limit} photos.`,
    photoOverLimitMessage: (rejectedCount, limit) =>
      `${rejectedCount} ${plural(rejectedCount, "photo was", "photos were")} not added because this memory allows up to ${limit} photos.`,
    photoOversizedMessage: (count) =>
      `${count} ${plural(count, "photo was", "photos were")} not added because each source file must be 25MB or smaller.`,
    failedPhotoRetry:
      "Retry Save after correcting the issue, or remove the affected photo.",
    reorderHelp: "Press and drag to reorder. The first photo appears largest.",
    coverLabel: "First photo",
    sortableItemLabel: "Photo",
    preparing: "Preparing photos…",
    savingMedia: "Uploading media…",
    savingDetails: "Saving memory…",
    saveNew: "Save memory",
    saveEdit: "Save changes",
  },
};

const journalFormRules: MemoryFormProductRules = {
  mode: "journal",
  maxPhotosPerEntry: DAILY_MEMORY_STAMP_MAX_PHOTOS,
  voiceMemosEnabled: JOURNAL_VOICE_MEMOS_ENABLED,
  copy: {
    newTitle: "New Memory Stamp",
    editTitle: "Edit Memory Stamp",
    createAriaLabel: "Create Daily Memory Stamp",
    editAriaLabel: "Edit Memory Stamp",
    titleLabel: "One line to keep",
    titlePlaceholder: "What would you call today?",
    titleRequiredError: "Add one line to keep.",
    photosRequiredError: "Choose at least one cover scrap before sealing.",
    photoSectionTitle: "Moments",
    photoCounterUnit: "moments",
    photoHelper: "Up to 9 moments.",
    photoChooseAriaLabel: "Choose moments",
    addEmptyPhotos: "Add moments",
    addMorePhotos: "Add more moments",
    photoLimitReached: "Stamp is full",
    photoLimitMessage: (limit) =>
      `This stamp holds up to ${limit} moments. Remove one to add another.`,
    photoAddedMessage: (count) =>
      `${count} ${plural(count, "moment", "moments")} added.`,
    photoPartialLimitMessage: (addedCount, rejectedCount, limit) =>
      `${addedCount} ${plural(addedCount, "moment was", "moments were")} added. ${rejectedCount} ${plural(rejectedCount, "was", "were")} not added because this stamp holds up to ${limit} moments.`,
    photoOverLimitMessage: (rejectedCount, limit) =>
      `${rejectedCount} ${plural(rejectedCount, "moment was", "moments were")} not added because this stamp holds up to ${limit} moments.`,
    photoOversizedMessage: (count) =>
      `${count} ${plural(count, "moment was", "moments were")} not added because each image must be 25MB or smaller.`,
    failedPhotoRetry:
      "Retry Seal this day after correcting the issue, or remove the affected moment.",
    reorderHelp:
      "Press and drag to reorder. The first image is the Cover Scrap.",
    coverLabel: "Cover scrap",
    sortableItemLabel: "Moment",
    preparing: "Preparing moments…",
    savingMedia: "Adding moments…",
    savingDetails: "Sealing day…",
    saveNew: "Seal this day",
    saveEdit: "Save changes",
  },
};

export function getMemoryFormProductRules(
  productMode: MemoryFormProductMode,
) {
  return productMode === "journal" ? journalFormRules : memoryFormRules;
}
