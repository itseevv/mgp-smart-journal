"use client";

import { useEffect, useRef, useState } from "react";

import { CompletedState } from "@/components/memory/completed-state";
import { MemoryForm } from "@/components/memory/memory-form";
import {
  createEmptyMemory,
  memoryMediaConfig,
  type MemoryDraft,
  type MemoryEntry,
  type MemoryPhoto,
  type MemoryVoiceMemo,
} from "@/data/memory-demo";

type FlowMode = "create" | "view" | "edit";

type MemoryFlowProps = {
  initialCapturedAt: string;
};

function mediaUrls(memory?: MemoryDraft) {
  if (!memory) return new Set<string>();
  return new Set([
    ...memory.photos.flatMap((photo) =>
      photo.objectUrl ? [photo.objectUrl] : [],
    ),
    ...memory.voiceMemos.flatMap((voiceMemo) =>
      voiceMemo.objectUrl ? [voiceMemo.objectUrl] : [],
    ),
  ]);
}

function copyMemory(memory: MemoryEntry): MemoryDraft {
  return {
    ...memory,
    photos: [...memory.photos],
    voiceMemos: memory.voiceMemos.map((voiceMemo) => ({ ...voiceMemo })),
  };
}

export function MemoryFlow({ initialCapturedAt }: MemoryFlowProps) {
  const objectUrlsRef = useRef(new Set<string>());
  const [mode, setMode] = useState<FlowMode>("create");
  const [savedMemory, setSavedMemory] = useState<MemoryEntry>();
  const [draft, setDraft] = useState<MemoryDraft>(() =>
    createEmptyMemory(initialCapturedAt),
  );

  const registerObjectUrl = (url: string) => {
    objectUrlsRef.current.add(url);
  };

  const revokeObjectUrl = (url: string) => {
    if (!objectUrlsRef.current.has(url)) return;
    URL.revokeObjectURL(url);
    objectUrlsRef.current.delete(url);
  };

  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const removePhoto = (photo: MemoryPhoto) => {
    setDraft((current) => ({
      ...current,
      photos: current.photos.filter((candidate) => candidate.id !== photo.id),
    }));
    const wasAlreadySaved = savedMemory?.photos.some(
      (candidate) => candidate.id === photo.id,
    );
    if (!wasAlreadySaved && photo.objectUrl) {
      revokeObjectUrl(photo.objectUrl);
    }
  };

  const changeVoiceMemos = (voiceMemos: MemoryVoiceMemo[]) => {
    const nextUrls = new Set(
      voiceMemos.flatMap((voiceMemo) =>
        voiceMemo.objectUrl ? [voiceMemo.objectUrl] : [],
      ),
    );
    draft.voiceMemos.forEach((voiceMemo) => {
      const objectUrl = voiceMemo.objectUrl;
      const remains =
        Boolean(objectUrl) && nextUrls.has(objectUrl!);
      const belongsToSavedMemory = savedMemory?.voiceMemos.some(
        (savedVoiceMemo) =>
          Boolean(objectUrl) &&
          savedVoiceMemo.objectUrl === objectUrl,
      );
      if (objectUrl && !remains && !belongsToSavedMemory) {
        revokeObjectUrl(objectUrl);
      }
    });
    setDraft((current) => ({ ...current, voiceMemos }));
  };

  const saveMemory = () => {
    const nextMemory: MemoryEntry = {
      ...draft,
      title: draft.title.trim(),
      photos: [...draft.photos],
      voiceMemos: draft.voiceMemos.map((voiceMemo, index) => ({
        ...voiceMemo,
        title:
          voiceMemo.title.trim() || `Voice memo ${index + 1}`,
        order: index,
      })),
    };

    if (savedMemory) {
      const nextUrls = mediaUrls(nextMemory);
      mediaUrls(savedMemory).forEach((url) => {
        if (!nextUrls.has(url)) revokeObjectUrl(url);
      });
    }

    setSavedMemory(nextMemory);
    setDraft(copyMemory(nextMemory));
    setMode("view");
  };

  const beginEditing = () => {
    if (!savedMemory) return;
    setDraft(copyMemory(savedMemory));
    setMode("edit");
  };

  const cancelEditing = () => {
    if (!savedMemory) return;
    const savedUrls = mediaUrls(savedMemory);
    mediaUrls(draft).forEach((url) => {
      if (!savedUrls.has(url)) revokeObjectUrl(url);
    });
    setDraft(copyMemory(savedMemory));
    setMode("view");
  };

  return (
    <main className="min-h-screen bg-leather px-3 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-[36rem]">
        {mode === "view" && savedMemory ? (
          <CompletedState memory={savedMemory} onEdit={beginEditing} />
        ) : (
          <MemoryForm
            config={memoryMediaConfig}
            draft={draft}
            isEditing={mode === "edit"}
            onDraftChange={setDraft}
            onRemovePhoto={removePhoto}
            onVoiceMemosChange={changeVoiceMemos}
            onSave={saveMemory}
            onCancel={cancelEditing}
            registerObjectUrl={registerObjectUrl}
          />
        )}
      </div>
    </main>
  );
}
