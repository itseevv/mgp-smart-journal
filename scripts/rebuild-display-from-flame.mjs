import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const STRICT_MAX_BYTES = 300_000;
const JPEG_TARGET_BYTES = 295_000;
const ANALYSIS_GRID = 400;
const WORK_SIZE = 1600;
const OUTPUT_SIZE = 1000;

// Flame is the only composition reference.
const TARGET = {
  straight: {
    centre: [490, 457],
    majorLength: 690,
    minorLength: 490,
    rotation: 0,
    erase: {
      left: 200,
      top: 78,
      right: 780,
      bottom: 840,
      extras: [{ left: 125, top: 85, right: 310, bottom: 275 }],
    },
  },
  tilted: {
    centre: [500, 475],
    majorLength: 690,
    minorLength: 490,
    // Sharp uses positive values for counter-clockwise visual rotation.
    // Flame tilted is 11.1 degrees clockwise from Flame straight.
    rotation: -11.1,
    erase: {
      left: 188,
      top: 82,
      right: 812,
      bottom: 875,
      extras: [{ left: 125, top: 165, right: 315, bottom: 355 }],
    },
  },
};

// Each quad is the journal's four physical outer corners on the 400×400
// "contain" analysis canvas, ordered TL, TR, BR, BL. A projective transform
// maps every quad to exactly the same Amber-sized output rectangle.
//
// The alpha mask is deliberately expanded beyond the quad. The quad controls
// geometry only; it must never double as a clipping boundary.
const PRODUCTS = [
  {
    folder: "卡其色",
    name: "Amber",
    source: "3.jpg",
    quad: [[103, 39], [304, 39], [310, 341], [102, 341]],
    extras: [[88, 40, 112, 335]],
  },
  {
    folder: "棕色",
    name: "Royale",
    source: "5.jpg",
    quad: [[108, 57], [292, 63], [307, 345], [105, 345]],
    extras: [[92, 50, 115, 350]],
  },
  {
    folder: "深蓝色",
    name: "Midnight",
    source: "4.jpg",
    quad: [[95, 50], [295, 50], [315, 335], [95, 335]],
    extras: [[85, 45, 105, 340]],
  },
  {
    folder: "玫红色",
    name: "Bloom",
    source: "4.jpg",
    quad: [[103, 54], [291, 39], [335, 326], [115, 356]],
    maskScale: 1.14,
    extras: [[85, 22, 320, 72], [85, 65, 115, 132]],
  },
  {
    folder: "白色",
    name: "Porcelain",
    source: "3.jpg",
    quad: [[98, 65], [286, 49], [315, 340], [114, 360]],
    extras: [[48, 82, 84, 138]],
  },
  {
    folder: "粉色",
    name: "Blush",
    source: "3.jpg",
    quad: [[80, 95], [225, 55], [296, 286], [110, 320]],
    maskScale: 1.16,
    extras: [[58, 160, 370, 232], [68, 88, 112, 330]],
  },
  {
    folder: "红色",
    name: "Flame",
    source: "4.jpg",
    quad: [[95, 50], [280, 50], [282, 320], [95, 320]],
    extras: [[72, 45, 105, 95]],
  },
  {
    folder: "绿色",
    name: "Eden",
    source: "3.jpg",
    quad: [[100, 55], [276, 55], [301, 335], [90, 335]],
    extras: [[80, 42, 112, 105]],
  },
  {
    folder: "蒂芙尼蓝",
    name: "Aurora",
    source: "3.jpg",
    quad: [[96, 76], [290, 80], [301, 320], [80, 320]],
    extras: [],
  },
  {
    folder: "黑色",
    name: "Eclipse",
    source: "4.jpg",
    quad: [[80, 50], [251, 35], [301, 300], [114, 340]],
    extras: [[62, 35, 112, 155], [235, 35, 325, 155]],
  },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function expandPolygon(polygon, scale) {
  const centre = polygon
    .reduce(
      (sum, [x, y]) => [sum[0] + x / polygon.length, sum[1] + y / polygon.length],
      [0, 0],
    );
  return polygon.map(([x, y]) => [
    centre[0] + (x - centre[0]) * scale,
    centre[1] + (y - centre[1]) * scale,
  ]);
}

function targetQuad(target) {
  const halfWidth = target.minorLength / 2;
  const halfHeight = target.majorLength / 2;
  const radians = (target.rotation * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
  ].map(([x, y]) => [
    target.centre[0] + x * cosine - y * sine,
    target.centre[1] + x * sine + y * cosine,
  ]);
}

function solveLinearSystem(matrix, values) {
  const size = values.length;
  const augmented = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) {
        pivot = row;
      }
    }
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    if (Math.abs(divisor) < 1e-10) {
      throw new Error("Degenerate product corner geometry");
    }
    for (let entry = column; entry <= size; entry += 1) {
      augmented[column][entry] /= divisor;
    }
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let entry = column; entry <= size; entry += 1) {
        augmented[row][entry] -= factor * augmented[column][entry];
      }
    }
  }
  return augmented.map((row) => row[size]);
}

function homography(source, destination) {
  const matrix = [];
  const values = [];
  for (let index = 0; index < 4; index += 1) {
    const [u, v] = source[index];
    const [x, y] = destination[index];
    matrix.push([u, v, 1, 0, 0, 0, -x * u, -x * v]);
    values.push(x);
    matrix.push([0, 0, 0, u, v, 1, -y * u, -y * v]);
    values.push(y);
  }
  const h = solveLinearSystem(matrix, values);
  return [
    h[0], h[1], h[2],
    h[3], h[4], h[5],
    h[6], h[7], 1,
  ];
}

function invert3x3(matrix) {
  const [a, b, c, d, e, f, g, h, i] = matrix;
  const A = e * i - f * h;
  const B = c * h - b * i;
  const C = b * f - c * e;
  const D = f * g - d * i;
  const E = a * i - c * g;
  const F = c * d - a * f;
  const G = d * h - e * g;
  const H = b * g - a * h;
  const I = a * e - b * d;
  const determinant = a * A + b * D + c * G;
  if (Math.abs(determinant) < 1e-10) {
    throw new Error("Non-invertible product transform");
  }
  return [A, B, C, D, E, F, G, H, I].map(
    (value) => value / determinant,
  );
}

async function medianBorderColor(input) {
  const { data, info } = await sharp(input)
    .rotate()
    .resize(64, 64, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const samples = [[], [], []];
  const border = 5;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (
        x >= border &&
        x < info.width - border &&
        y >= border &&
        y < info.height - border
      ) {
        continue;
      }
      const offset = (y * info.width + x) * info.channels;
      for (let channel = 0; channel < 3; channel += 1) {
        samples[channel].push(data[offset + channel]);
      }
    }
  }
  return samples.map((sample) => {
    sample.sort((a, b) => a - b);
    return sample[Math.floor(sample.length / 2)];
  });
}

async function encodeUnderLimit(pipeline, startingQuality = 90) {
  for (let quality = startingQuality; quality >= 48; quality -= 2) {
    const buffer = await pipeline
      .clone()
      .jpeg({
        quality,
        chromaSubsampling: "4:2:0",
        progressive: true,
        mozjpeg: true,
        optimiseScans: true,
      })
      .toBuffer();
    if (buffer.length < JPEG_TARGET_BYTES) {
      return { buffer, quality };
    }
  }
  const buffer = await pipeline
    .clone()
    .jpeg({
      quality: 44,
      chromaSubsampling: "4:2:0",
      progressive: true,
      mozjpeg: true,
      optimiseScans: true,
    })
    .toBuffer();
  return { buffer, quality: 44 };
}

async function buildSharedBackground(referenceBuffer, erase) {
  const { data, info } = await sharp(referenceBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = Buffer.from(data);
  const feather = 28;

  const regions = [
    {
      left: erase.left,
      top: erase.top,
      right: erase.right,
      bottom: erase.bottom,
    },
    ...(erase.extras ?? []),
  ];

  for (const region of regions) {
    for (let y = region.top; y <= region.bottom; y += 1) {
      for (let x = region.left; x <= region.right; x += 1) {
      const edgeDistance = Math.min(
          x - region.left,
          region.right - x,
          y - region.top,
          region.bottom - y,
      );
      const mix = clamp(edgeDistance / feather, 0, 1);
      if (mix <= 0) continue;

      // Both donor strips are untouched Flame fabric. Sampling the same row
      // keeps the cloth's lighting gradient while removing the red journal.
      const span = 108;
      const phase = Math.abs((x + y * 3) % span);
      const leftX = 24 + phase;
      const rightX = 868 + phase;
        const t = (x - region.left) / (region.right - region.left);
      const targetOffset = (y * info.width + x) * info.channels;
      const leftOffset = (y * info.width + leftX) * info.channels;
      const rightOffset = (y * info.width + rightX) * info.channels;

      for (let channel = 0; channel < 3; channel += 1) {
        const donor =
          data[leftOffset + channel] * (1 - t) +
          data[rightOffset + channel] * t;
        output[targetOffset + channel] = Math.round(
          output[targetOffset + channel] * (1 - mix) + donor * mix,
        );
      }
      }
    }
  }

  return sharp(output, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();
}

async function makeSourceLayer(productRoot, product) {
  const input = path.join(productRoot, product.folder, product.source);
  const background = await medianBorderColor(input);
  const { data, info } = await sharp(input)
    .rotate()
    .resize(WORK_SIZE, WORK_SIZE, {
      fit: "contain",
      background: {
        r: Math.min(background[0], 18),
        g: Math.min(background[1], 18),
        b: Math.min(background[2], 22),
      },
      kernel: sharp.kernel.lanczos3,
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const scale = WORK_SIZE / ANALYSIS_GRID;
  const sourceQuad = product.quad.map(([x, y]) => [x * scale, y * scale]);
  const maskPolygon = expandPolygon(
    sourceQuad,
    product.maskScale ?? 1.1,
  );
  const protectedCore = expandPolygon(sourceQuad, 0.8);
  const extraRegions = (product.extras ?? []).map(
    ([left, top, right, bottom]) => ({
      left: left * scale,
      top: top * scale,
      right: right * scale,
      bottom: bottom * scale,
    }),
  );
  const alpha = Buffer.alloc(WORK_SIZE * WORK_SIZE);
  const bgLum =
    0.2126 * background[0] +
    0.7152 * background[1] +
    0.0722 * background[2];

  for (let y = 0; y < WORK_SIZE; y += 1) {
    for (let x = 0; x < WORK_SIZE; x += 1) {
      const alphaOffset = y * WORK_SIZE + x;
      const inProtectedCore = pointInPolygon(x, y, protectedCore);
      const inMainMask = pointInPolygon(x, y, maskPolygon);
      const inExtraRegion = extraRegions.some(
        (region) =>
          x >= region.left &&
          x <= region.right &&
          y >= region.top &&
          y <= region.bottom,
      );
      if (!inMainMask && !inExtraRegion) {
        continue;
      }
      const offset = (y * WORK_SIZE + x) * info.channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);
      const distance = Math.hypot(
        r - background[0],
        g - background[1],
        b - background[2],
      );
      if (inProtectedCore) {
        alpha[alphaOffset] = 255;
        continue;
      }
      const accessoryScore = Math.max(
        (lum - bgLum - 9) * 20,
        (distance - 19) * 18,
        (saturation - 36) * 8,
      );
      if (accessoryScore > 0) {
        alpha[alphaOffset] = clamp(Math.round(accessoryScore), 0, 255);
      }
    }
  }

  const softenedAlpha = await sharp(alpha, {
    raw: { width: WORK_SIZE, height: WORK_SIZE, channels: 1 },
  })
    .blur(1.1)
    .extractChannel(0)
    .raw()
    .toBuffer();
  return {
    data,
    channels: info.channels,
    alpha: softenedAlpha,
    sourceQuad,
  };
}

async function warpSourceLayer(layer, target) {
  const transform = homography(layer.sourceQuad, targetQuad(target));
  const inverse = invert3x3(transform);
  const output = Buffer.alloc(OUTPUT_SIZE * OUTPUT_SIZE * 4);
  const sourceWidth = WORK_SIZE;
  const sourceHeight = WORK_SIZE;

  for (let y = 0; y < OUTPUT_SIZE; y += 1) {
    for (let x = 0; x < OUTPUT_SIZE; x += 1) {
      const denominator =
        inverse[6] * (x + 0.5) +
        inverse[7] * (y + 0.5) +
        inverse[8];
      if (Math.abs(denominator) < 1e-10) continue;
      const sourceX =
        (inverse[0] * (x + 0.5) +
          inverse[1] * (y + 0.5) +
          inverse[2]) /
          denominator -
        0.5;
      const sourceY =
        (inverse[3] * (x + 0.5) +
          inverse[4] * (y + 0.5) +
          inverse[5]) /
          denominator -
        0.5;
      const x0 = Math.floor(sourceX);
      const y0 = Math.floor(sourceY);
      if (
        x0 < 0 ||
        y0 < 0 ||
        x0 >= sourceWidth - 1 ||
        y0 >= sourceHeight - 1
      ) {
        continue;
      }
      const xWeight = sourceX - x0;
      const yWeight = sourceY - y0;
      const weights = [
        (1 - xWeight) * (1 - yWeight),
        xWeight * (1 - yWeight),
        (1 - xWeight) * yWeight,
        xWeight * yWeight,
      ];
      const sourcePixels = [
        y0 * sourceWidth + x0,
        y0 * sourceWidth + x0 + 1,
        (y0 + 1) * sourceWidth + x0,
        (y0 + 1) * sourceWidth + x0 + 1,
      ];
      const outputOffset = (y * OUTPUT_SIZE + x) * 4;
      let sampledAlpha = 0;
      for (let sample = 0; sample < 4; sample += 1) {
        sampledAlpha += layer.alpha[sourcePixels[sample]] * weights[sample];
      }
      if (sampledAlpha < 0.5) continue;
      for (let channel = 0; channel < 3; channel += 1) {
        let value = 0;
        for (let sample = 0; sample < 4; sample += 1) {
          value +=
            layer.data[
              sourcePixels[sample] * layer.channels + channel
            ] * weights[sample];
        }
        output[outputOffset + channel] = clamp(Math.round(value), 0, 255);
      }
      output[outputOffset + 3] = clamp(Math.round(sampledAlpha), 0, 255);
    }
  }

  return sharp(output, {
    raw: {
      width: OUTPUT_SIZE,
      height: OUTPUT_SIZE,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

async function compositeProduct(background, cutout) {
  const alpha = await sharp(cutout)
    .ensureAlpha()
    .extractChannel(3)
    .blur(13)
    .linear(0.42)
    .png()
    .toBuffer();
  const shadow = await sharp({
    create: {
      width: OUTPUT_SIZE,
      height: OUTPUT_SIZE,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .joinChannel(alpha)
    .png()
    .toBuffer();
  return sharp(background)
    .composite([
      { input: shadow, left: 7, top: 9 },
      { input: cutout, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

export async function rebuildDisplayAssets(productRootInput = "product pics") {
  const productRoot = path.resolve(productRootInput);
  const flameFolder = path.join(productRoot, "红色", "display adjusted");
  const flameTiltedPath = path.join(flameFolder, "01-tilted.jpg");
  const flameStraightPath = path.join(flameFolder, "02-straight.jpg");
  const [flameTilted, flameStraight] = await Promise.all([
    fs.readFile(flameTiltedPath),
    fs.readFile(flameStraightPath),
  ]);
  const [tiltedBackground, straightBackground] = await Promise.all([
    buildSharedBackground(flameTilted, TARGET.tilted.erase),
    buildSharedBackground(flameStraight, TARGET.straight.erase),
  ]);

  const auditFolder = path.join(productRoot, "_audit");
  await fs.mkdir(auditFolder, { recursive: true });
  await Promise.all([
    sharp(tiltedBackground).jpeg({ quality: 90 }).toFile(
      path.join(auditFolder, "flame-tilted-clean-background.jpg"),
    ),
    sharp(straightBackground).jpeg({ quality: 90 }).toFile(
      path.join(auditFolder, "flame-straight-clean-background.jpg"),
    ),
  ]);

  const results = [];
  for (const product of PRODUCTS) {
    const outputFolder = path.join(
      productRoot,
      product.folder,
      "display adjusted",
    );
    await fs.mkdir(outputFolder, { recursive: true });

    const sourceLayer = await makeSourceLayer(productRoot, product);
    const cutoutAuditFolder = path.join(auditFolder, "flame-template-cutouts");
    await fs.mkdir(cutoutAuditFolder, { recursive: true });
    for (const [kind, target, background] of [
      ["tilted", TARGET.tilted, tiltedBackground],
      ["straight", TARGET.straight, straightBackground],
    ]) {
      const positioned = await warpSourceLayer(sourceLayer, target);
      if (kind === "straight") {
        await fs.writeFile(
          path.join(cutoutAuditFolder, `${product.name}-straight.png`),
          positioned,
        );
      }
      const composited = await compositeProduct(background, positioned);
      const { buffer, quality } = await encodeUnderLimit(
        sharp(composited),
        90,
      );
      if (buffer.length >= STRICT_MAX_BYTES) {
        throw new Error(`${product.name} ${kind} exceeds 300K`);
      }
      const output = path.join(
        outputFolder,
        kind === "tilted" ? "01-tilted.jpg" : "02-straight.jpg",
      );
      await fs.writeFile(output, buffer);
      results.push({
        product: product.name,
        folder: product.folder,
        kind,
        source: product.source,
        output,
        quality,
        bytes: buffer.length,
        template:
          kind === "tilted"
            ? "Flame tilted background + Amber geometry"
            : "Flame straight background + Amber geometry",
      });
    }
  }
  return results;
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const results = await rebuildDisplayAssets(process.argv[2] ?? "product pics");
  console.log(
    JSON.stringify(
      {
        assets: results.length,
        under300k: results.filter((item) => item.bytes < STRICT_MAX_BYTES).length,
        results,
      },
      null,
      2,
    ),
  );
}
