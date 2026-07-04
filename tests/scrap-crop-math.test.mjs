import assert from "node:assert/strict";
import test from "node:test";

import {
  centerSquareCropMetadata,
  computeCoverCropMetadata,
  cropMetadataToImageStyle,
} from "../lib/scrap/crop-math.ts";

const approx = (actual, expected, message) => {
  assert.ok(
    Math.abs(actual - expected) < 0.000001,
    `${message}: expected ${expected}, received ${actual}`,
  );
};

const assertFiniteCrop = (crop) => {
  for (const key of ["x", "y", "width", "height", "imageWidth", "imageHeight"]) {
    assert.equal(Number.isFinite(crop[key]), true, `${key} should be finite`);
  }
  assert.equal(crop.kind, "cover-scrap");
  assert.equal(crop.aspectRatio, 1);
  assert.ok(crop.x >= 0);
  assert.ok(crop.y >= 0);
  assert.ok(crop.width > 0);
  assert.ok(crop.height > 0);
  assert.ok(crop.x + crop.width <= 1.000001);
  assert.ok(crop.y + crop.height <= 1.000001);
  approx(
    crop.width * crop.imageWidth,
    crop.height * crop.imageHeight,
    "crop should be square in image pixels",
  );
};

test("center square crop metadata crops the widest side for landscape photos", () => {
  const crop = centerSquareCropMetadata({
    imageWidth: 1400,
    imageHeight: 900,
    createdAt: "2026-07-03T12:00:00.000Z",
  });

  assertFiniteCrop(crop);
  approx(crop.x, 250 / 1400, "landscape x");
  approx(crop.y, 0, "landscape y");
  approx(crop.width, 900 / 1400, "landscape width");
  approx(crop.height, 1, "landscape height");
});

test("center square crop metadata crops the tallest side for portrait photos", () => {
  const crop = centerSquareCropMetadata({
    imageWidth: 900,
    imageHeight: 1300,
    createdAt: "2026-07-03T12:00:00.000Z",
  });

  assertFiniteCrop(crop);
  approx(crop.x, 0, "portrait x");
  approx(crop.y, 200 / 1300, "portrait y");
  approx(crop.width, 1, "portrait width");
  approx(crop.height, 900 / 1300, "portrait height");
});

test("center square crop metadata uses the whole square photo", () => {
  const crop = centerSquareCropMetadata({
    imageWidth: 1100,
    imageHeight: 1100,
    createdAt: "2026-07-03T12:00:00.000Z",
  });

  assertFiniteCrop(crop);
  assert.equal(crop.x, 0);
  assert.equal(crop.y, 0);
  assert.equal(crop.width, 1);
  assert.equal(crop.height, 1);
});

test("cover crop metadata normalizes zoom and pan relative to original image size", () => {
  const crop = computeCoverCropMetadata({
    imageWidth: 1200,
    imageHeight: 800,
    frameSize: 400,
    zoom: 2,
    offsetX: -100,
    offsetY: 40,
    createdAt: "2026-07-03T12:00:00.000Z",
  });

  assertFiniteCrop(crop);
  approx(crop.x, 500 / 1200, "panned x");
  approx(crop.y, 160 / 800, "panned y");
  approx(crop.width, 400 / 1200, "zoomed width");
  approx(crop.height, 400 / 800, "zoomed height");
});

test("cover crop metadata clamps blank-space panning to image bounds", () => {
  const crop = computeCoverCropMetadata({
    imageWidth: 800,
    imageHeight: 1200,
    frameSize: 400,
    zoom: 1,
    offsetX: 9999,
    offsetY: -9999,
    createdAt: "2026-07-03T12:00:00.000Z",
  });

  assertFiniteCrop(crop);
  assert.equal(crop.x, 0);
  approx(crop.y, 400 / 1200, "portrait bottom clamp");
  approx(crop.width, 1, "portrait clamp width");
  approx(crop.height, 800 / 1200, "portrait clamp height");
});

test("crop metadata produces stable frame image styles for rendered stamp crops", () => {
  const crop = centerSquareCropMetadata({
    imageWidth: 1400,
    imageHeight: 900,
    createdAt: "2026-07-03T12:00:00.000Z",
  });
  const style = cropMetadataToImageStyle(crop);

  assert.equal(style.position, "absolute");
  assert.equal(style.width, `${100 / crop.width}%`);
  assert.equal(style.height, `${100 / crop.height}%`);
  assert.equal(style.left, `${-(crop.x / crop.width) * 100}%`);
  assert.equal(style.top, `${-(crop.y / crop.height) * 100}%`);
});
