import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PRODUCT_ROOT = path.resolve(process.argv[2] ?? "product pics");
const OUTPUT_SIZE = 1000;
const STRICT_MAX_BYTES = 300_000;
const TARGET_BYTES = 295_000;

const PRODUCTS = [
  { name: "Royale", folder: "棕色" },
  { name: "Midnight", folder: "深蓝色" },
  { name: "Bloom", folder: "玫红色" },
  { name: "Porcelain", folder: "白色" },
  { name: "Blush", folder: "粉色" },
  { name: "Flame", folder: "红色" },
  { name: "Eden", folder: "绿色" },
  { name: "Aurora", folder: "蒂芙尼蓝" },
  { name: "Eclipse", folder: "黑色" },
];

async function listSourceJpegs(folderPath) {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.jpe?g$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => {
      const an = Number.parseInt(a, 10);
      const bn = Number.parseInt(b, 10);
      if (Number.isFinite(an) && Number.isFinite(bn)) {
        return an - bn || a.localeCompare(b);
      }
      return a.localeCompare(b);
    });
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

  const medians = samples.map((sample) => {
    sample.sort((a, b) => a - b);
    return sample[Math.floor(sample.length / 2)];
  });
  return {
    r: Math.min(medians[0], 18),
    g: Math.min(medians[1], 18),
    b: Math.min(medians[2], 22),
    alpha: 1,
  };
}

async function encodeUnderLimit(pipeline) {
  for (let quality = 88; quality >= 46; quality -= 2) {
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
    if (buffer.length < TARGET_BYTES) return { buffer, quality };
  }
  throw new Error("Unable to encode image below 300K");
}

async function resizeOne(product, file) {
  const sourceFolder = path.join(PRODUCT_ROOT, product.folder);
  const outputFolder = path.join(sourceFolder, "resized");
  const input = path.join(sourceFolder, file);
  const output = path.join(outputFolder, file);
  const background = await medianBorderColor(input);
  const pipeline = sharp(input)
    .rotate()
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
      fit: "contain",
      background,
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false,
    })
    .flatten({ background });
  const { buffer, quality } = await encodeUnderLimit(pipeline);
  await fs.writeFile(output, buffer);

  const metadata = await sharp(output).metadata();
  const stats = await fs.stat(output);
  if (
    metadata.width !== OUTPUT_SIZE ||
    metadata.height !== OUTPUT_SIZE ||
    stats.size >= STRICT_MAX_BYTES
  ) {
    throw new Error(`Validation failed: ${output}`);
  }

  return {
    product: product.name,
    folder: product.folder,
    source: input,
    output,
    file,
    width: metadata.width,
    height: metadata.height,
    bytes: stats.size,
    quality,
    resize: "contain",
    aspectRatioChanged: false,
  };
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let completed = 0;

  async function run() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
      completed += 1;
      if (completed % 10 === 0 || completed === items.length) {
        console.log(`Processed ${completed}/${items.length}`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run()),
  );
  return results;
}

async function main() {
  const jobs = [];
  const sourceCounts = {};
  const incomplete = [];

  for (const product of PRODUCTS) {
    const sourceFolder = path.join(PRODUCT_ROOT, product.folder);
    const outputFolder = path.join(sourceFolder, "resized");
    await fs.mkdir(outputFolder, { recursive: true });
    const files = await listSourceJpegs(sourceFolder);
    sourceCounts[product.name] = files.length;
    for (const file of files) jobs.push({ product, file });

    const entries = await fs.readdir(sourceFolder, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.includes(".downloading")) {
        incomplete.push(path.join(sourceFolder, entry.name));
      }
    }
  }

  const results = await mapWithConcurrency(jobs, 4, ({ product, file }) =>
    resizeOne(product, file),
  );
  const outputCounts = Object.fromEntries(
    PRODUCTS.map((product) => [
      product.name,
      results.filter((item) => item.product === product.name).length,
    ]),
  );
  const report = {
    generatedAt: new Date().toISOString(),
    rule: "1000x1000 JPEG, strictly below 300,000 bytes; contain fit with matched dark padding; no crop or non-uniform stretch",
    total: results.length,
    sourceCounts,
    outputCounts,
    incomplete,
    allValid: results.every(
      (item) =>
        item.width === OUTPUT_SIZE &&
        item.height === OUTPUT_SIZE &&
        item.bytes < STRICT_MAX_BYTES &&
        item.aspectRatioChanged === false,
    ),
    maxBytes: Math.max(...results.map((item) => item.bytes)),
    results,
  };

  const auditFolder = path.join(PRODUCT_ROOT, "_audit");
  await fs.mkdir(auditFolder, { recursive: true });
  const auditPath = path.join(auditFolder, "resized-nine-products-audit.json");
  await fs.writeFile(auditPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ ...report, results: undefined, auditPath }, null, 2));
}

await main();
