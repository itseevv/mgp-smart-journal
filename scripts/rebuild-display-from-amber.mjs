import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUTPUT_SIZE = 1000;
const ANALYSIS_SIZE = 400;
const STAGE_SIZE = 2400;
const STRICT_MAX_BYTES = 300_000;
const JPEG_TARGET_BYTES = 295_000;
const EDGE_FEATHER = 48;

const edgeFeatherAlpha = Buffer.alloc(OUTPUT_SIZE * OUTPUT_SIZE);
for (let y = 0; y < OUTPUT_SIZE; y += 1) {
  for (let x = 0; x < OUTPUT_SIZE; x += 1) {
    const distance = Math.min(
      x,
      y,
      OUTPUT_SIZE - 1 - x,
      OUTPUT_SIZE - 1 - y,
    );
    edgeFeatherAlpha[y * OUTPUT_SIZE + x] = Math.max(
      0,
      Math.min(255, Math.round((distance / EDGE_FEATHER) * 255)),
    );
  }
}

// Quads are measurement guides only. They never crop, mask, warp, or reshape
// the image. Every output uses one similarity transform: one uniform scale,
// one whole-frame rotation, and one translation.
const PRODUCTS = [
  {
    name: "Amber",
    folder: "卡其色",
    tilted: {
      source: "4.jpg",
      quad: [[88, 75], [245, 65], [295, 300], [120, 340]],
    },
    straight: {
      source: "3 (1).jpg",
      quad: [[103, 39], [304, 39], [310, 341], [102, 341]],
    },
  },
  {
    name: "Royale",
    folder: "棕色",
    tilted: {
      source: "4.jpg",
      quad: [[108, 60], [250, 45], [335, 315], [155, 355]],
    },
    straight: {
      source: "5.jpg",
      quad: [[108, 58], [292, 64], [307, 340], [105, 345]],
    },
  },
  {
    name: "Midnight",
    folder: "深蓝色",
    tilted: {
      source: "4.jpg",
      quad: [[95, 50], [295, 50], [315, 335], [95, 335]],
    },
    straight: {
      source: "4.jpg",
      quad: [[95, 50], [295, 50], [315, 335], [95, 335]],
    },
  },
  {
    name: "Bloom",
    folder: "玫红色",
    tilted: {
      source: "4.jpg",
      quad: [[103, 55], [291, 40], [335, 325], [115, 355]],
    },
    straight: {
      // Use the new naturally front-on real photograph for the hover image.
      source: "12.jpg",
      quad: [[112, 66], [308, 68], [303, 355], [110, 355]],
    },
  },
  {
    name: "Porcelain",
    folder: "白色",
    tilted: {
      source: "11.jpg",
      quad: [[100, 105], [260, 90], [320, 340], [130, 365]],
      offset: [0, -5],
    },
    straight: {
      // Use the new naturally straight, complete real photograph.
      source: "14 (1).jpg",
      quad: [[111, 77], [289, 77], [289, 333], [111, 333]],
      rotationOverride: 0,
      offset: [0, -5],
    },
  },
  {
    name: "Blush",
    folder: "粉色",
    tilted: {
      source: "3.jpg",
      quad: [[80, 95], [225, 55], [296, 286], [110, 320]],
    },
    straight: {
      // Use the naturally front-on real photograph instead of rotating the
      // tilted hero shot into an artificial straight pose. Preserve the new
      // source's natural photographed proportions and framing exactly.
      source: "11.jpg",
      quad: [[98, 76], [270, 75], [272, 319], [99, 319]],
      scaleOverride: 1,
      rotationOverride: 0,
      offset: [-50, 18],
    },
  },
  {
    name: "Flame",
    folder: "红色",
    tilted: {
      source: "3.jpg",
      quad: [[95, 65], [245, 45], [310, 300], [115, 335]],
    },
    straight: {
      source: "4.jpg",
      quad: [[95, 50], [280, 50], [282, 320], [95, 320]],
    },
  },
  {
    name: "Eden",
    folder: "绿色",
    tilted: {
      source: "4.jpg",
      quad: [[100, 80], [250, 45], [315, 300], [95, 345]],
    },
    straight: {
      source: "3.jpg",
      quad: [[100, 55], [276, 55], [301, 335], [90, 335]],
    },
  },
  {
    name: "Aurora",
    folder: "蒂芙尼蓝",
    tilted: {
      source: "5.jpg",
      quad: [[80, 80], [255, 45], [325, 300], [115, 350]],
      // Aurora only needs a small clockwise correction. Size still follows
      // the same shared product-height target as every other asset.
      rotationOverride: 5,
    },
    straight: {
      source: "3.jpg",
      quad: [[80, 75], [290, 80], [301, 320], [80, 320]],
    },
  },
  {
    name: "Eclipse",
    folder: "黑色",
    tilted: {
      source: "4.jpg",
      quad: [[80, 50], [251, 35], [301, 300], [114, 340]],
    },
    straight: {
      // Use the naturally front-on real photograph. The previous source was
      // shot obliquely, so rotation alone could never make it look both
      // straight and natural without changing the product's perspective.
      source: "11.jpg",
      quad: [[95, 43], [279, 43], [282, 314], [95, 314]],
    },
  },
];

function geometry(quad) {
  const [topLeft, topRight, bottomRight, bottomLeft] = quad;
  const top = [
    (topLeft[0] + topRight[0]) / 2,
    (topLeft[1] + topRight[1]) / 2,
  ];
  const bottom = [
    (bottomLeft[0] + bottomRight[0]) / 2,
    (bottomLeft[1] + bottomRight[1]) / 2,
  ];
  const dx = bottom[0] - top[0];
  const dy = bottom[1] - top[1];
  return {
    centre: [
      ((top[0] + bottom[0]) / 2) * (OUTPUT_SIZE / ANALYSIS_SIZE),
      ((top[1] + bottom[1]) / 2) * (OUTPUT_SIZE / ANALYSIS_SIZE),
    ],
    majorLength: Math.hypot(dx, dy) * (OUTPUT_SIZE / ANALYSIS_SIZE),
    angle: (Math.atan2(dx, dy) * 180) / Math.PI,
  };
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
    return Math.min(sample[Math.floor(sample.length / 2)], 18);
  });
}

async function encodeUnderLimit(pipeline) {
  for (let quality = 90; quality >= 48; quality -= 2) {
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
  throw new Error("Unable to encode below 300K");
}

async function transformWholePhoto({
  input,
  sourceGeometry,
  targetGeometry,
  scale,
  rotation,
  offset,
}) {
  const border = await medianBorderColor(input);
  const background = {
    r: border[0],
    g: border[1],
    b: border[2],
    alpha: 1,
  };
  const normalizedRgb = await sharp(input)
    .rotate()
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
      fit: "contain",
      background,
      kernel: sharp.kernel.lanczos3,
    })
    .removeAlpha()
    .raw()
    .toBuffer();
  const normalized = await sharp(normalizedRgb, {
    raw: {
      width: OUTPUT_SIZE,
      height: OUTPUT_SIZE,
      channels: 3,
    },
  })
    .joinChannel(edgeFeatherAlpha, {
      raw: {
        width: OUTPUT_SIZE,
        height: OUTPUT_SIZE,
        channels: 1,
      },
    })
    .png()
    .toBuffer();

  const staged = await sharp({
    create: {
      width: STAGE_SIZE,
      height: STAGE_SIZE,
      channels: 3,
      background,
    },
  })
    .composite([
      {
        input: normalized,
        left: Math.round(STAGE_SIZE / 2 - sourceGeometry.centre[0]),
        top: Math.round(STAGE_SIZE / 2 - sourceGeometry.centre[1]),
      },
    ])
    .png()
    .toBuffer();

  let rotated = staged;
  if (Math.abs(rotation) > 0.01) {
    const expanded = await sharp(staged)
      .rotate(rotation, { background })
      .png()
      .toBuffer();
    const metadata = await sharp(expanded).metadata();
    rotated = await sharp(expanded)
      .extract({
        left: Math.floor((metadata.width - STAGE_SIZE) / 2),
        top: Math.floor((metadata.height - STAGE_SIZE) / 2),
        width: STAGE_SIZE,
        height: STAGE_SIZE,
      })
      .png()
      .toBuffer();
  }

  const scaledSize = Math.round(STAGE_SIZE * scale);
  const scaled = await sharp(rotated)
    .resize(scaledSize, scaledSize, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
  const targetCentre = [
    targetGeometry.centre[0] + offset[0],
    targetGeometry.centre[1] + offset[1],
  ];
  return sharp(scaled)
    .extract({
      left: Math.round(scaledSize / 2 - targetCentre[0]),
      top: Math.round(scaledSize / 2 - targetCentre[1]),
      width: OUTPUT_SIZE,
      height: OUTPUT_SIZE,
    })
    .png()
    .toBuffer();
}

export async function rebuildDisplayAssets(productRootInput = "product pics") {
  const productRoot = path.resolve(productRootInput);
  const amber = PRODUCTS.find((product) => product.name === "Amber");
  const tiltedTarget = geometry(amber.tilted.quad);
  const straightReference = geometry(amber.straight.quad);
  const targets = {
    tilted: tiltedTarget,
    // Straight and tilted must read as the same A5 journal photographed from
    // one overhead height. Keep the straight pose's centre and angle, but use
    // exactly the tilted pose's product main-axis length.
    straight: {
      ...straightReference,
      majorLength: tiltedTarget.majorLength,
    },
  };
  const results = [];

  for (const product of PRODUCTS) {
    const outputFolder = path.join(
      productRoot,
      product.folder,
      "display adjusted",
    );
    await fs.mkdir(outputFolder, { recursive: true });
    for (const kind of ["tilted", "straight"]) {
      const config = product[kind];
      const sourceGeometry = geometry(config.quad);
      const targetGeometry = targets[kind];
      const calculatedScale =
        targetGeometry.majorLength / sourceGeometry.majorLength;
      const scale =
        config.scaleOverride ??
        calculatedScale * (config.scaleMultiplier ?? 1);
      // Sharp's positive rotation is clockwise. A clockwise image rotation
      // reduces the measured down-axis lean used by geometry().
      const calculatedRotation =
        sourceGeometry.angle - targetGeometry.angle;
      const rotation = config.rotationOverride ?? calculatedRotation;
      const input = path.join(productRoot, product.folder, config.source);
      const transformed = await transformWholePhoto({
        input,
        sourceGeometry,
        targetGeometry,
        scale,
        rotation,
        offset: config.offset ?? [0, 0],
      });
      const { buffer, quality } = await encodeUnderLimit(sharp(transformed));
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
        source: config.source,
        output,
        quality,
        bytes: buffer.length,
        uniformScale: Number(scale.toFixed(5)),
        outputGuideMajorLength: Number(
          (sourceGeometry.majorLength * scale).toFixed(5),
        ),
        rotation: Number(rotation.toFixed(3)),
        translation: config.offset ?? [0, 0],
        transform: "uniform scale + whole-frame rotation + translation",
        aspectRatioChanged: false,
      });
    }
  }

  const auditFolder = path.join(productRoot, "_audit");
  await fs.mkdir(auditFolder, { recursive: true });
  await fs.writeFile(
    path.join(auditFolder, "display-adjusted-transform-audit.json"),
    JSON.stringify(
      {
        invariant:
          "Every asset uses sx === sy. No perspective transform, no non-uniform scaling, no product mask.",
        targets,
        results,
      },
      null,
      2,
    ),
    "utf8",
  );
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
        allAspectRatiosPreserved: results.every(
          (item) => item.aspectRatioChanged === false,
        ),
        results,
      },
      null,
      2,
    ),
  );
}
