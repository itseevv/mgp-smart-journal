import assert from "node:assert/strict";
import test from "node:test";

import {
  formatRecoveryCode,
  isCompleteRecoveryCode,
  normalizeRecoveryCode,
  recoveryCodeConfig,
} from "../lib/recovery/config.ts";

test("normalizes case, spaces, and formatting hyphens", () => {
  assert.equal(
    normalizeRecoveryCode("m7kp 4qxn-92hf w8tr"),
    "M7KP4QXN92HFW8TR",
  );
});

test("formats a normalized passcode into four groups", () => {
  assert.equal(
    formatRecoveryCode("M7KP4QXN92HFW8TR"),
    "M7KP-4QXN-92HF-W8TR",
  );
});

test("removes characters outside the configured alphabet", () => {
  assert.equal(normalizeRecoveryCode("O0I1-LM7K"), "LM7K");
});

test("accepts only a complete configured recovery passcode", () => {
  assert.equal(isCompleteRecoveryCode("M7KP-4QXN-92HF-W8TR"), true);
  assert.equal(isCompleteRecoveryCode("M7KP-4QXN-92HF"), false);
  assert.equal(
    recoveryCodeConfig.characterCount,
    recoveryCodeConfig.groupCount * recoveryCodeConfig.groupSize,
  );
});
