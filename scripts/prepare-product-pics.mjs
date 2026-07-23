import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { rebuildDisplayAssets } from "./rebuild-display-from-amber.mjs";

const PRODUCT_ROOT = path.resolve(process.argv[2] ?? "product pics");
const AUDIT_DATE = "2026-07-20";
const STRICT_MAX_BYTES = 300_000;
const JPEG_TARGET_BYTES = 295_000;

const PRODUCTS = [
  {
    folder: "卡其色",
    name: "Amber",
    tilted: { source: "4.jpg", center: [0.5, 0.533], zoom: 1.0, rotate: 3.5 },
    straight: { source: "3.jpg", center: [0.5, 0.511], zoom: 0.94, rotate: 0 },
  },
  {
    folder: "棕色",
    name: "Royale",
    tilted: { source: "4.jpg", center: [0.528, 0.511], zoom: 0.945, rotate: 2.5 },
    straight: { source: "5.jpg", center: [0.508, 0.508], zoom: 0.95, rotate: 0 },
  },
  {
    folder: "深蓝色",
    name: "Midnight",
    tilted: { source: "4.jpg", center: [0.511, 0.5], zoom: 0.947, rotate: 5.5 },
    straight: { source: "4.jpg", center: [0.511, 0.5], zoom: 0.947, rotate: 0 },
  },
  {
    folder: "玫红色",
    name: "Bloom",
    tilted: { source: "4.jpg", center: [0.5, 0.533], zoom: 0.87, rotate: 3.5 },
    straight: { source: "4.jpg", center: [0.5, 0.533], zoom: 0.87, rotate: -2 },
  },
  {
    folder: "白色",
    name: "Porcelain",
    tilted: { source: "11.jpg", center: [0.5, 0.556], zoom: 1.04, rotate: 2 },
    straight: { source: "3.jpg", center: [0.5, 0.522], zoom: 0.957, rotate: -3.5 },
  },
  {
    folder: "粉色",
    name: "Blush",
    tilted: { source: "3.jpg", center: [0.486, 0.536], zoom: 1.19, rotate: 8.5 },
    straight: { source: "3.jpg", center: [0.486, 0.536], zoom: 1.19, rotate: 3 },
  },
  {
    folder: "红色",
    name: "Flame",
    tilted: { source: "3.jpg", center: [0.5, 0.522], zoom: 0.965, rotate: 2 },
    straight: { source: "4.jpg", center: [0.5, 0.514], zoom: 1.023, rotate: 0 },
  },
  {
    folder: "绿色",
    name: "Eden",
    tilted: { source: "4.jpg", center: [0.508, 0.511], zoom: 0.965, rotate: 9 },
    straight: { source: "3.jpg", center: [0.511, 0.511], zoom: 0.99, rotate: 0 },
  },
  {
    folder: "蒂芙尼蓝",
    name: "Aurora",
    tilted: { source: "5.jpg", center: [0.5, 0.528], zoom: 0.94, rotate: 10 },
    straight: { source: "3.jpg", center: [0.5, 0.511], zoom: 0.954, rotate: 0 },
  },
  {
    folder: "黑色",
    name: "Eclipse",
    tilted: { source: "3.jpg", center: [0.514, 0.514], zoom: 0.93, rotate: 7.5 },
    straight: { source: "4.jpg", center: [0.5, 0.514], zoom: 0.93, rotate: 1 },
  },
];

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function effectiveDimensions(metadata) {
  const orientation = metadata.orientation ?? 1;
  if ([5, 6, 7, 8].includes(orientation)) {
    return { width: metadata.height, height: metadata.width };
  }
  return { width: metadata.width, height: metadata.height };
}

async function listOriginalJpegs(product) {
  const folderPath = path.join(PRODUCT_ROOT, product.folder);
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.jpe?g$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => {
      const an = Number.parseInt(a, 10);
      const bn = Number.parseInt(b, 10);
      return Number.isFinite(an) && Number.isFinite(bn)
        ? an - bn || a.localeCompare(b)
        : a.localeCompare(b);
    });
}

async function collectAudit() {
  const rows = [];
  const incomplete = [];

  for (const product of PRODUCTS) {
    const folderPath = path.join(PRODUCT_ROOT, product.folder);
    const entries = await fs.readdir(folderPath, { withFileTypes: true });

    for (const entry of entries) {
      if (
        entry.isFile() &&
        entry.name.includes(".downloading")
      ) {
        const filePath = path.join(folderPath, entry.name);
        const stats = await fs.stat(filePath);
        incomplete.push({
          product: product.name,
          folder: product.folder,
          file: entry.name,
          bytes: stats.size,
        });
      }
    }

    for (const file of await listOriginalJpegs(product)) {
      const filePath = path.join(folderPath, file);
      const [stats, metadata] = await Promise.all([
        fs.stat(filePath),
        sharp(filePath).metadata(),
      ]);
      const dimensions = effectiveDimensions(metadata);
      const under300k = stats.size < STRICT_MAX_BYTES;
      const approvedSquare =
        dimensions.width === dimensions.height &&
        [800, 1000].includes(dimensions.width);

      rows.push({
        product: product.name,
        folder: product.folder,
        file,
        width: dimensions.width,
        height: dimensions.height,
        bytes: stats.size,
        kilobytes: stats.size / 1000,
        under300k,
        approvedSquare,
        compliant: under300k && approvedSquare,
      });
    }
  }

  return { rows, incomplete };
}

async function medianBorderColor(input) {
  const { data, info } = await sharp(input)
    .rotate()
    .resize(64, 64, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels;
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
      const offset = (y * info.width + x) * channels;
      for (let channel = 0; channel < 3; channel += 1) {
        samples[channel].push(data[offset + channel]);
      }
    }
  }

  const medians = samples.map((sample) => {
    sample.sort((a, b) => a - b);
    return sample[Math.floor(sample.length / 2)];
  });

  // Keep padding neutral and dark even if a bright subject approaches one edge.
  return {
    r: Math.min(medians[0], 18),
    g: Math.min(medians[1], 18),
    b: Math.min(medians[2], 22),
    alpha: 1,
  };
}

async function encodeJpegUnderLimit(pipeline, startingQuality = 86) {
  for (let quality = startingQuality; quality >= 46; quality -= 2) {
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
      quality: 42,
      chromaSubsampling: "4:2:0",
      progressive: true,
      mozjpeg: true,
      optimiseScans: true,
    })
    .toBuffer();
  return { buffer, quality: 42 };
}

async function createSquareAsset(input, output, size, startingQuality) {
  const background = await medianBorderColor(input);
  const pipeline = sharp(input)
    .rotate()
    .resize(size, size, {
      fit: "contain",
      background,
      kernel: sharp.kernel.lanczos3,
    })
    .flatten({ background });
  const { buffer, quality } = await encodeJpegUnderLimit(
    pipeline,
    startingQuality,
  );
  await fs.writeFile(output, buffer);
  return { output, size, quality, bytes: buffer.length };
}

async function createAmberAssets() {
  const amber = PRODUCTS.find((product) => product.name === "Amber");
  const sourceFolder = path.join(PRODUCT_ROOT, amber.folder);
  const desktopFolder = path.join(
    sourceFolder,
    "Desktop Creative Assets",
  );
  const mobileFolder = path.join(sourceFolder, "Mobile Assets");
  await Promise.all([
    fs.mkdir(desktopFolder, { recursive: true }),
    fs.mkdir(mobileFolder, { recursive: true }),
  ]);

  const results = [];
  for (const file of await listOriginalJpegs(amber)) {
    const input = path.join(sourceFolder, file);
    const [desktop, mobile] = await Promise.all([
      createSquareAsset(
        input,
        path.join(desktopFolder, file),
        1000,
        86,
      ),
      createSquareAsset(input, path.join(mobileFolder, file), 800, 84),
    ]);
    results.push({ file, desktop, mobile });
  }
  return results;
}

async function makeContactSheet(items, output, options = {}) {
  const columns = options.columns ?? 4;
  const tileWidth = options.tileWidth ?? 300;
  const imageSize = options.imageSize ?? 280;
  const labelHeight = options.labelHeight ?? 38;
  const tileHeight = imageSize + labelHeight;
  const tiles = [];

  for (const item of items) {
    const thumbnail = await sharp(item.input)
      .resize(imageSize, imageSize, {
        fit: "contain",
        background: "#d8d8d8",
      })
      .jpeg({ quality: 76 })
      .toBuffer();
    const safeLabel = item.label.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
    const label = Buffer.from(
      `<svg width="${tileWidth}" height="${tileHeight}">` +
        `<text x="10" y="${tileHeight - 12}" font-family="Arial, sans-serif" ` +
        `font-size="17" fill="#111">${safeLabel}</text></svg>`,
    );
    tiles.push(
      await sharp({
        create: {
          width: tileWidth,
          height: tileHeight,
          channels: 3,
          background: "#eeeeee",
        },
      })
        .composite([
          {
            input: thumbnail,
            left: Math.floor((tileWidth - imageSize) / 2),
            top: 0,
          },
          { input: label, left: 0, top: 0 },
        ])
        .jpeg({ quality: 80 })
        .toBuffer(),
    );
  }

  const rows = Math.ceil(tiles.length / columns);
  await sharp({
    create: {
      width: columns * tileWidth,
      height: rows * tileHeight,
      channels: 3,
      background: "#bdbdbd",
    },
  })
    .composite(
      tiles.map((input, index) => ({
        input,
        left: (index % columns) * tileWidth,
        top: Math.floor(index / columns) * tileHeight,
      })),
    )
    .jpeg({ quality: 84 })
    .toFile(output);
}

async function makeGeometryOverlay(input) {
  const overlay = Buffer.from(
    `<svg width="1000" height="1000">` +
      `<rect x="20" y="20" width="470" height="64" rx="14" fill="#000" opacity="0.72"/>` +
      `<text x="40" y="62" font-family="Arial" font-size="28" font-weight="700" fill="#7CFF00">sx = sy · no perspective warp</text>` +
      `</svg>`,
  );
  return sharp(input)
    .composite([{ input: overlay, left: 0, top: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function validateAsset(filePath, expectedSize) {
  const [stats, metadata] = await Promise.all([
    fs.stat(filePath),
    sharp(filePath).metadata(),
  ]);
  return {
    filePath,
    width: metadata.width,
    height: metadata.height,
    bytes: stats.size,
    valid:
      metadata.width === expectedSize &&
      metadata.height === expectedSize &&
      stats.size < STRICT_MAX_BYTES,
  };
}

function makeAuditCsv(rows) {
  const headers = [
    "product",
    "folder",
    "file",
    "width",
    "height",
    "size_bytes",
    "size_kb_decimal",
    "under_300k",
    "square_800_or_1000",
    "fully_compliant",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.product,
        row.folder,
        row.file,
        row.width,
        row.height,
        row.bytes,
        row.kilobytes.toFixed(1),
        row.under300k,
        row.approvedSquare,
        row.compliant,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function makeAuditMarkdown(audit, displayResults, amberResults) {
  const total = audit.rows.length;
  const under300k = audit.rows.filter((row) => row.under300k).length;
  const approvedSquare = audit.rows.filter((row) => row.approvedSquare).length;
  const compliant = audit.rows.filter((row) => row.compliant).length;
  const totalBytes = audit.rows.reduce((sum, row) => sum + row.bytes, 0);
  const smallest = audit.rows.reduce((a, b) => (a.bytes < b.bytes ? a : b));
  const largest = audit.rows.reduce((a, b) => (a.bytes > b.bytes ? a : b));
  const byProduct = PRODUCTS.map((product) => {
    const rows = audit.rows.filter((row) => row.product === product.name);
    return {
      ...product,
      count: rows.length,
      under300k: rows.filter((row) => row.under300k).length,
      square: rows.filter((row) => row.approvedSquare).length,
      compliant: rows.filter((row) => row.compliant).length,
    };
  });

  const productTable = byProduct
    .map(
      (row) =>
        `| ${row.name}（${row.folder}） | ${row.count} | ${row.under300k} | ${row.square} | ${row.compliant} |`,
    )
    .join("\n");
  const pendingLines = audit.incomplete
    .map(
      (item) =>
        `- ${item.product}（${item.folder}）/${item.file} — ${item.bytes.toLocaleString("en-US")} bytes，未下载完成，不能作为图片处理。`,
    )
    .join("\n");
  const displayLines = displayResults
    .map(
      (item) =>
        `- ${item.product} ${item.kind}: ${path.relative(PRODUCT_ROOT, item.output)} — 1000×1000, ${(item.bytes / 1000).toFixed(1)}K, JPEG quality ${item.quality}, source ${item.source}`,
    )
    .join("\n");
  const amberLines = amberResults
    .map(
      (item) =>
        `- ${item.file}: Desktop ${(item.desktop.bytes / 1000).toFixed(1)}K (Q${item.desktop.quality}); Mobile ${(item.mobile.bytes / 1000).toFixed(1)}K (Q${item.mobile.quality})`,
    )
    .join("\n");

  return `# 产品图片审计 — ${AUDIT_DATE}

## 审计范围

- 只审计 10 个颜色文件夹根目录下的原始 JPEG。
- 基线不包含生成的 \`display adjusted\`、\`Desktop Creative Assets\`、\`Mobile Assets\` 文件夹。
- 文件体积采用严格口径：小于 300,000 bytes。
- 合格方图尺寸：严格等于 800×800 或 1000×1000。

## 原图基线结果

- 有效原始 JPEG：**${total}**
- 小于 300K：**${under300k}/${total}**
- 严格等于 800×800 或 1000×1000：**${approvedSquare}/${total}**
- 同时符合两项规则：**${compliant}/${total}**
- 原图总大小：**${(totalBytes / 1_000_000).toFixed(1)} MB**
- 最小原图：**${smallest.product}/${smallest.file} — ${(smallest.bytes / 1_000_000).toFixed(2)} MB**
- 最大原图：**${largest.product}/${largest.file} — ${(largest.bytes / 1_000_000).toFixed(2)} MB**

| 产品 | 有效 JPG | <300K | 合格方图 | 两项均合格 |
|---|---:|---:|---:|---:|
${productTable}

## 本地未下载完成的文件

${pendingLines || "- None."}

## Shopify 建议

Shopify 会自动为不同店铺位置创建不同尺寸，CDN 也能交付合适的格式与大小。如果构图完全一样，通常不需要单独上传 Mobile 版本。在本次指定的 800/1000 规则内，建议将 1000×1000 作为主文件，让 Shopify 生成较小的交付版本。Amber 试做仍然按要求保留两套文件夹，方便对比。

Shopify 当前帮助页说明：高分辨率方形产品图通常以 2048×2048 显示效果最佳。该尺寸超出本次 800/1000 的要求；只有在 PDP 放大细节比当前体积限制更重要时，再考虑调整。

Amber 方图采用**完整容纳 + 与边缘匹配的深色补边**，没有拉伸，也没有破坏性居中裁切，因此横图和竖图的产品细节都能保留。

## 标准化展示图

- 输出：1000×1000 JPEG，全部小于 300K。
- 两组图片分别以 Amber tilted 和 Amber straight 的原始实拍构图为基准。
- 每张图片只允许整图等比例缩放、整图轻微旋转和画布内平移。
- 横向与纵向缩放值始终相同（sx = sy）；没有透视校正，也没有非等比例拉伸。
- 产品、配饰、阴影和原始黑色织物背景作为一个整体变换，没有抠图或重画。
- 产品原始宽高比与相机透视保持不变；构图差异只通过黑边留白、轻微角度和中心位置调整。
- 未使用生成式编辑；颜色、花纹、配饰与产品实物细节不变。

${displayLines}

有两张完整闭合实拍的产品分别使用主图和悬停图；只有一张完整闭合实拍的产品会从同一张原图生成两种构图。两种情况都只使用相似变换，没有改变产品本身。

## Amber 试做

${amberLines}
`;
}

async function main() {
  const audit = await collectAudit();
  const auditFolder = path.join(PRODUCT_ROOT, "_audit");
  await fs.mkdir(auditFolder, { recursive: true });

  const displayResults = await rebuildDisplayAssets(PRODUCT_ROOT);

  const amberResults = await createAmberAssets();

  const validation = [];
  for (const item of displayResults) {
    validation.push(await validateAsset(item.output, 1000));
  }
  for (const item of amberResults) {
    validation.push(await validateAsset(item.desktop.output, 1000));
    validation.push(await validateAsset(item.mobile.output, 800));
  }
  const failures = validation.filter((result) => !result.valid);
  if (failures.length > 0) {
    throw new Error(
      `Generated asset validation failed:\n${JSON.stringify(failures, null, 2)}`,
    );
  }

  const displayPreview = path.join(
    auditFolder,
    "display-adjusted-preview.jpg",
  );
  await makeContactSheet(
    displayResults.map((item) => ({
      input: item.output,
      label: `${item.product} ${item.kind}`,
    })),
    displayPreview,
    { columns: 4 },
  );

  const geometryPreview = path.join(
    auditFolder,
    "display-adjusted-geometry-check.jpg",
  );
  const geometryItems = [];
  for (const item of displayResults) {
    geometryItems.push({
      input: await makeGeometryOverlay(item.output),
      label: `${item.product} ${item.kind} — aspect ratio locked`,
    });
  }
  await makeContactSheet(geometryItems, geometryPreview, { columns: 4 });

  const amberDesktopPreview = path.join(
    auditFolder,
    "amber-desktop-preview.jpg",
  );
  const amberMobilePreview = path.join(
    auditFolder,
    "amber-mobile-preview.jpg",
  );
  await makeContactSheet(
    amberResults.map((item) => ({
      input: item.desktop.output,
      label: `Desktop ${item.file}`,
    })),
    amberDesktopPreview,
    { columns: 5, tileWidth: 240, imageSize: 220, labelHeight: 34 },
  );
  await makeContactSheet(
    amberResults.map((item) => ({
      input: item.mobile.output,
      label: `Mobile ${item.file}`,
    })),
    amberMobilePreview,
    { columns: 5, tileWidth: 240, imageSize: 220, labelHeight: 34 },
  );

  const csvPath = path.join(
    auditFolder,
    `product-image-audit-${AUDIT_DATE}.csv`,
  );
  const markdownPath = path.join(
    auditFolder,
    `product-image-audit-${AUDIT_DATE}.md`,
  );
  await fs.writeFile(csvPath, makeAuditCsv(audit.rows), "utf8");
  await fs.writeFile(
    markdownPath,
    makeAuditMarkdown(audit, displayResults, amberResults),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        originalJpegs: audit.rows.length,
        incompleteFiles: audit.incomplete.length,
        displayAssets: displayResults.length,
        amberDesktopAssets: amberResults.length,
        amberMobileAssets: amberResults.length,
        audit: markdownPath,
        csv: csvPath,
        displayPreview,
        geometryPreview,
        amberDesktopPreview,
        amberMobilePreview,
      },
      null,
      2,
    ),
  );
}

await main();
