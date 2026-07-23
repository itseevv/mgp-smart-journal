import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(process.argv[2] ?? "product pics");
const outputRoot = path.join(root, "_audit", "source-contacts");
await fs.mkdir(outputRoot, { recursive: true });

const folders = (await fs.readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b, "zh-CN"));

for (const folder of folders) {
  const sourceFolder = path.join(root, folder);
  const files = (await fs.readdir(sourceFolder))
    .filter((file) => /^\d+\s*\.jpe?g$/i.test(file))
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
  const tiles = [];
  for (const file of files) {
    const thumbnail = await sharp(path.join(sourceFolder, file))
      .rotate()
      .resize(260, 260, {
        fit: "contain",
        background: "#111318",
      })
      .jpeg({ quality: 82 })
      .toBuffer();
    const label = Buffer.from(
      `<svg width="280" height="300">` +
        `<text x="10" y="288" font-family="Arial, sans-serif" font-size="20" fill="#111">${file}</text>` +
        `</svg>`,
    );
    tiles.push(
      await sharp({
        create: {
          width: 280,
          height: 300,
          channels: 3,
          background: "#eeeeee",
        },
      })
        .composite([
          { input: thumbnail, left: 10, top: 0 },
          { input: label, left: 0, top: 0 },
        ])
        .jpeg({ quality: 84 })
        .toBuffer(),
    );
  }
  const columns = 4;
  const rows = Math.ceil(tiles.length / columns);
  const output = path.join(outputRoot, `${folder}.jpg`);
  await sharp({
    create: {
      width: columns * 280,
      height: rows * 300,
      channels: 3,
      background: "#c8c8c8",
    },
  })
    .composite(
      tiles.map((input, index) => ({
        input,
        left: (index % columns) * 280,
        top: Math.floor(index / columns) * 300,
      })),
    )
    .jpeg({ quality: 86 })
    .toFile(output);
  console.log(output);
}
