import path from "node:path";
import sharp from "sharp";

const root = path.resolve(process.argv[2] ?? "product pics");
const outputRoot = path.join(root, "_audit");
const products = [
  { name: "Amber", folder: "卡其色", tilted: "4.jpg", straight: "3.jpg" },
  { name: "Royale", folder: "棕色", tilted: "4.jpg", straight: "5.jpg" },
  { name: "Midnight", folder: "深蓝色", tilted: "4.jpg", straight: "4.jpg" },
  { name: "Bloom", folder: "玫红色", tilted: "4.jpg", straight: "4.jpg" },
  { name: "Porcelain", folder: "白色", tilted: "11.jpg", straight: "3.jpg" },
  { name: "Blush", folder: "粉色", tilted: "3.jpg", straight: "3.jpg" },
  { name: "Flame", folder: "红色", tilted: "3.jpg", straight: "4.jpg" },
  { name: "Eden", folder: "绿色", tilted: "4.jpg", straight: "3.jpg" },
  { name: "Aurora", folder: "蒂芙尼蓝", tilted: "5.jpg", straight: "3.jpg" },
  { name: "Eclipse", folder: "黑色", tilted: "4.jpg", straight: "3.jpg" },
];

const gridSvg = Buffer.from(
  `<svg width="400" height="400">` +
    Array.from({ length: 9 }, (_, index) => {
      const value = index * 50;
      return (
        `<line x1="${value}" y1="0" x2="${value}" y2="400" stroke="#d9e44a" stroke-width="1" opacity="0.7"/>` +
        `<line x1="0" y1="${value}" x2="400" y2="${value}" stroke="#d9e44a" stroke-width="1" opacity="0.7"/>` +
        `<text x="${value + 4}" y="15" fill="#f2fa55" font-size="10" font-family="Arial">${value}</text>` +
        `<text x="4" y="${value + 14}" fill="#f2fa55" font-size="10" font-family="Arial">${value}</text>`
      );
    }).join("") +
    `</svg>`,
);

for (const kind of ["tilted", "straight"]) {
  const tiles = [];
  for (const product of products) {
    const image = await sharp(
      path.join(root, product.folder, product[kind]),
    )
      .rotate()
      .resize(400, 400, {
        fit: "contain",
        background: { r: 3, g: 4, b: 6 },
      })
      .composite([{ input: gridSvg, left: 0, top: 0 }])
      .jpeg({ quality: 88 })
      .toBuffer();
    const label = Buffer.from(
      `<svg width="400" height="430"><text x="8" y="420" font-family="Arial" font-size="17" fill="#111">${product.name} ${product[kind]}</text></svg>`,
    );
    tiles.push(
      await sharp({
        create: {
          width: 400,
          height: 430,
          channels: 3,
          background: "#eeeeee",
        },
      })
        .composite([
          { input: image, left: 0, top: 0 },
          { input: label, left: 0, top: 0 },
        ])
        .jpeg({ quality: 87 })
        .toBuffer(),
    );
  }
  const output = path.join(outputRoot, `${kind}-source-grid.jpg`);
  await sharp({
    create: {
      width: 2000,
      height: 860,
      channels: 3,
      background: "#c8c8c8",
    },
  })
    .composite(
      tiles.map((input, index) => ({
        input,
        left: (index % 5) * 400,
        top: Math.floor(index / 5) * 430,
      })),
    )
    .jpeg({ quality: 90 })
    .toFile(output);
  console.log(output);
}
