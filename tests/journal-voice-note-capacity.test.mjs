import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  JOURNAL_VOICE_NOTE_MAX_BYTES,
  JOURNAL_VOICE_NOTE_TARGET_BITS_PER_SECOND,
} from "../data/journal-product.ts";
import { memoryMediaConfig } from "../data/memory-demo.ts";

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Voice Note bitrate and per-note byte ceiling are deterministic", () => {
  assert.equal(JOURNAL_VOICE_NOTE_TARGET_BITS_PER_SECOND, 32_000);
  assert.equal(JOURNAL_VOICE_NOTE_MAX_BYTES, 6 * 1024 * 1024);
  assert.equal(memoryMediaConfig.maxVoiceMemoFileSizeBytes, 6 * 1024 * 1024);
});

test("recorder requests bitrate, keeps MP4 fallback, and rejects before attachment", () => {
  const source = readSource("components/memory/voice-recorder.tsx");

  assert.match(source, /"audio\/webm;codecs=opus"[\s\S]*"audio\/mp4"/);
  assert.match(
    source,
    /audioBitsPerSecond: JOURNAL_VOICE_NOTE_TARGET_BITS_PER_SECOND/,
  );
  assert.match(source, /Older Safari versions may reject the bitrate option/);
  assert.match(source, /recordedBytesRef\.current > config\.maxVoiceMemoFileSizeBytes/);
  assert.match(source, /blob\.size > config\.maxVoiceMemoFileSizeBytes/);
  assert.match(source, /was not attached\. Your existing voice memo is unchanged/);
  assert.match(
    source,
    /if \(blob\.size > config\.maxVoiceMemoFileSizeBytes\)[\s\S]*return;[\s\S]*URL\.createObjectURL\(blob\)/,
  );
});

test("recorder allows bounded auto-stop jitter and clamps stored duration", () => {
  const source = readSource("components/memory/voice-recorder.tsx");
  const grace = Number(
    source.match(/RECORDING_DURATION_GRACE_SECONDS = ([0-9.]+)/)?.[1],
  );
  const stopLead = Number(
    source.match(/RECORDING_AUTO_STOP_LEAD_SECONDS = ([0-9.]+)/)?.[1],
  );

  assert.equal(stopLead, 0.25);
  assert.equal(grace, 1);
  assert.equal(300.8 <= 300 + grace, true);
  assert.equal(Math.min(300, Math.ceil(300.8)), 300);
  assert.equal(301.01 > 300 + grace, true);
  assert.match(
    source,
    /recordingLimitRef\.current - RECORDING_AUTO_STOP_LEAD_SECONDS/,
  );
  assert.match(
    source,
    /observedDurationSeconds >[\s\S]*recordingLimitRef\.current \+ RECORDING_DURATION_GRACE_SECONDS/,
  );
  assert.match(
    source,
    /Math\.min\([\s\S]*recordingLimitRef\.current,[\s\S]*Math\.ceil\(observedDurationSeconds\)/,
  );
  assert.match(source, /blob\.size > config\.maxVoiceMemoFileSizeBytes/);
});

test("upload pipeline rejects oversized Voice Notes before media upload", () => {
  const source = readSource("lib/capsule/api.ts");
  const saveBody = source.slice(
    source.indexOf("export async function savePersistentMemory"),
  );

  assert.match(
    saveBody,
    /memo\.blob && memo\.blob\.size > config\.maxVoiceMemoFileSizeBytes/,
  );
  assert.match(saveBody, /Voice Note file-size validation failed/);
  assert.ok(
    saveBody.indexOf("const oversizedVoiceMemo") <
      saveBody.indexOf("const uploaded = await uploadDraftMedia"),
  );
});

test("Journal commit validates claimed and actual stored Voice Note bytes", () => {
  const source = readSource(
    "supabase/migrations/202608140001_archive_storage_admission_and_remove_lifecycle.sql",
  );
  const historical = readSource(
    "supabase/migrations/202607280001_journal_volume_lifecycle.sql",
  );
  const commitBody = source.slice(
    source.indexOf("create or replace function public.commit_memory_with_lifecycle"),
    source.indexOf("create or replace function public.update_journal_title"),
  );

  assert.match(historical, /function public\.journal_voice_note_max_bytes\(\)/);
  assert.match(historical, /select 6291456::bigint/);
  assert.match(
    commitBody,
    /\(item->>'sizeBytes'\)::bigint >\s+public\.journal_voice_note_max_bytes\(\)/,
  );
  assert.match(commitBody, /left join storage\.objects object/);
  assert.match(commitBody, /object\.bucket_id = 'memory-media'/);
  assert.match(commitBody, /object\.name = item->>'storagePath'/);
  assert.match(commitBody, /object\.id is null/);
  assert.match(
    commitBody,
    /\(object\.metadata->>'size'\)::bigint <>\s+\(item->>'sizeBytes'\)::bigint/,
  );
  assert.doesNotMatch(commitBody, /JOURNAL_COMPLETED|FULL_REVIEW|COMPLETED/);
});

test("Journal detail keeps playback and remains editable", () => {
  const flow = readSource("components/capsule/persistent-memory-flow.tsx");
  const completedState = readSource("components/memory/completed-state.tsx");
  const player = readSource("components/memory/journal-voice-note-player.tsx");
  const stamp = readSource("components/stamp/daily-memory-stamp.tsx");

  assert.doesNotMatch(flow, /readOnly/);
  assert.match(flow, /onEdit=\{\(\) => void beginEditing\(\)\}/);
  assert.match(flow, /Delete stamp/);
  assert.match(completedState, /onEdit=\{readOnly \? undefined : onEdit\}/);
  assert.match(player, /state = "viewer"/);
  assert.match(player, /aria-label=\{isPlaying \? "Pause voice note" : "Play voice note"\}/);
  assert.match(player, /state === "review"/);
  assert.match(player, /state === "saved"/);
  assert.match(stamp, /resolveUrl=\{resolveVoiceMemoUrl\}/);
  assert.match(stamp, /DailyStampExportComposer/);
});
