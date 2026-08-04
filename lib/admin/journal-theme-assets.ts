export const JOURNAL_THEME_ASSET_BUCKET = "journal-theme-assets";
export const JOURNAL_THEME_TEXTURE_MAX_BYTES = 12 * 1024 * 1024;
export const JOURNAL_THEME_TEXTURE_RECOMMENDED_WIDTH = 1080;
export const JOURNAL_THEME_TEXTURE_RECOMMENDED_HEIGHT = 1920;
export const JOURNAL_THEME_TEXTURE_SMALL_FILE_BYTES = 300 * 1024;

export type JournalThemeTextureMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export type JournalThemeTextureValidationInput = {
  contentType: string;
  sizeBytes: number;
  bytes: Uint8Array;
};

export type JournalThemeTextureValidationResult =
  | {
      ok: true;
      mimeType: JournalThemeTextureMimeType;
      extension: "jpg" | "png" | "webp";
      width: number;
      height: number;
      warnings: string[];
    }
  | {
      ok: false;
      code:
        | "TEXTURE_EMPTY"
        | "TEXTURE_TOO_LARGE"
        | "TEXTURE_TYPE_UNSUPPORTED"
        | "TEXTURE_TYPE_MISMATCH"
        | "TEXTURE_DIMENSIONS_UNREADABLE";
    };

const allowedMimeTypes = new Set<JournalThemeTextureMimeType>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function readUint16BE(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint16LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32BE(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] * 2 ** 24 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function readUint32LE(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function normalizeContentType(value: string) {
  const normalized = value.toLowerCase().split(";")[0].trim();
  return normalized === "image/jpg" ? "image/jpeg" : normalized;
}

export function journalThemeTextureExtension(
  mimeType: JournalThemeTextureMimeType,
) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  return "webp";
}

export function journalThemeTextureStoragePath(
  themeId: string,
  mimeType: JournalThemeTextureMimeType,
) {
  return `journal-themes/${themeId}/texture-original.${journalThemeTextureExtension(mimeType)}`;
}

export function journalThemeTextureVersionedPublicUrl(
  publicUrl: string,
  version: string | number,
) {
  const url = new URL(publicUrl);
  url.searchParams.set("v", String(version));
  return url.toString();
}

function sniffMimeType(bytes: Uint8Array): JournalThemeTextureMimeType | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function pngDimensions(bytes: Uint8Array) {
  if (bytes.length < 24 || ascii(bytes, 12, 4) !== "IHDR") return undefined;
  return {
    width: readUint32BE(bytes, 16),
    height: readUint32BE(bytes, 20),
  };
}

function jpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return undefined;
  }

  let offset = 2;
  while (offset + 3 < bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > bytes.length) break;

    const segmentLength = readUint16BE(bytes, offset);
    if (segmentLength < 2) break;
    const segmentStart = offset + 2;
    const segmentEnd = offset + segmentLength;
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame && segmentStart + 5 <= bytes.length) {
      return {
        height: readUint16BE(bytes, segmentStart + 1),
        width: readUint16BE(bytes, segmentStart + 3),
      };
    }
    offset = segmentEnd;
  }

  return undefined;
}

function webpDimensions(bytes: Uint8Array) {
  if (bytes.length < 20) return undefined;

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = ascii(bytes, offset, 4);
    const chunkSize = readUint32LE(bytes, offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + chunkSize > bytes.length) return undefined;

    if (chunkType === "VP8X" && chunkSize >= 10) {
      return {
        width: readUint24LE(bytes, dataOffset + 4) + 1,
        height: readUint24LE(bytes, dataOffset + 7) + 1,
      };
    }
    if (chunkType === "VP8L" && chunkSize >= 5 && bytes[dataOffset] === 0x2f) {
      const b0 = bytes[dataOffset + 1];
      const b1 = bytes[dataOffset + 2];
      const b2 = bytes[dataOffset + 3];
      const b3 = bytes[dataOffset + 4];
      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      };
    }
    if (
      chunkType === "VP8 " &&
      chunkSize >= 10 &&
      bytes[dataOffset + 3] === 0x9d &&
      bytes[dataOffset + 4] === 0x01 &&
      bytes[dataOffset + 5] === 0x2a
    ) {
      return {
        width: readUint16LE(bytes, dataOffset + 6) & 0x3fff,
        height: readUint16LE(bytes, dataOffset + 8) & 0x3fff,
      };
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  return undefined;
}

function imageDimensions(
  bytes: Uint8Array,
  mimeType: JournalThemeTextureMimeType,
) {
  if (mimeType === "image/png") return pngDimensions(bytes);
  if (mimeType === "image/jpeg") return jpegDimensions(bytes);
  return webpDimensions(bytes);
}

function textureWarnings(width: number, height: number, sizeBytes: number) {
  const warnings: string[] = [];
  if (width < JOURNAL_THEME_TEXTURE_RECOMMENDED_WIDTH) {
    warnings.push("Texture is below the recommended 1080px width.");
  }
  if (height < JOURNAL_THEME_TEXTURE_RECOMMENDED_HEIGHT) {
    warnings.push("Texture is below the recommended 1920px height.");
  }
  const aspectRatio = width / height;
  if (aspectRatio < 0.42 || aspectRatio > 0.8) {
    warnings.push("Texture aspect ratio is far from 9:16; adjust focus and zoom before publishing.");
  }
  if (sizeBytes < JOURNAL_THEME_TEXTURE_SMALL_FILE_BYTES) {
    warnings.push("Texture is a small file and may look low-resolution on export.");
  }
  return warnings;
}

export function validateJournalThemeTextureUpload({
  contentType,
  sizeBytes,
  bytes,
}: JournalThemeTextureValidationInput): JournalThemeTextureValidationResult {
  if (sizeBytes <= 0 || bytes.length === 0) {
    return { ok: false, code: "TEXTURE_EMPTY" };
  }
  if (sizeBytes > JOURNAL_THEME_TEXTURE_MAX_BYTES) {
    return { ok: false, code: "TEXTURE_TOO_LARGE" };
  }

  const declaredType = normalizeContentType(contentType);
  const sniffedType = sniffMimeType(bytes);
  if (!sniffedType || !allowedMimeTypes.has(sniffedType)) {
    return { ok: false, code: "TEXTURE_TYPE_UNSUPPORTED" };
  }
  if (declaredType && declaredType !== sniffedType) {
    return { ok: false, code: "TEXTURE_TYPE_MISMATCH" };
  }

  const dimensions = imageDimensions(bytes, sniffedType);
  if (!dimensions?.width || !dimensions.height) {
    return { ok: false, code: "TEXTURE_DIMENSIONS_UNREADABLE" };
  }

  return {
    ok: true,
    mimeType: sniffedType,
    extension: journalThemeTextureExtension(sniffedType),
    width: dimensions.width,
    height: dimensions.height,
    warnings: textureWarnings(dimensions.width, dimensions.height, sizeBytes),
  };
}
