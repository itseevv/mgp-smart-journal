import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  dailyStampAdditionalMomentCapacity,
} from "../data/journal-product.ts";

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("daily stamp capacity reports the true optional-moment allowance", () => {
  assert.deepEqual(dailyStampAdditionalMomentCapacity(1), {
    remaining: 8,
  });
  assert.deepEqual(dailyStampAdditionalMomentCapacity(6), {
    remaining: 3,
  });
  assert.deepEqual(dailyStampAdditionalMomentCapacity(9), {
    remaining: 0,
  });
});

test("journal photo picker uses effective capacity for controls and copy", () => {
  const source = readSource("components/memory/journal-photo-picker.tsx");

  assert.match(source, /dailyStampAdditionalMomentCapacity/);
  assert.match(source, /additionalCapacity\.remaining/);
  assert.match(source, /Add up to \{additionalCapacity\.remaining\}/);
  assert.match(source, /This stamp already has its optional moments\./);
});
