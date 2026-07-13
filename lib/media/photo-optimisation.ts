import type { MemoryMediaConfig } from "@/data/memory-demo";

export type PhotoVariant = {
  file: File;
  mimeType: "image/webp" | "image/jpeg";
  width: number;
  height: number;
  size: number;
};

export type OptimisedPhoto = {
  display: PhotoVariant;
  thumbnail: PhotoVariant;
  originalSize: number;
};

export class PhotoPreparationError extends Error {
  constructor(
    message: string,
    readonly code: "unsupportedFormat" | "decodeFailed" | "encodeFailed",
  ) {
    super(message);
  }
}

function isHeic(file: File) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

function outputName(
  sourceName: string,
  variant: "display" | "thumb",
  mimeType: string,
) {
  const baseName = sourceName.replace(/\.[^.]+$/, "") || "photo";
  return `${baseName}-${variant}.${mimeType === "image/webp" ? "webp" : "jpg"}`;
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: "image/webp" | "image/jpeg",
  quality: number,
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });
}

let webpSupport: Promise<boolean> | undefined;

function canEncodeWebp() {
  webpSupport ??= (async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const blob = await canvasToBlob(canvas, "image/webp", 0.8);
    return blob?.type === "image/webp";
  })();
  return webpSupport;
}

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

async function decodeWithImageElement(file: File): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new PhotoPreparationError(
      "This photograph could not be read. Try another file or remove it.",
      "decodeFailed",
    );
  }
}

async function decodePhoto(file: File): Promise<DecodedImage> {
  if (isHeic(file)) {
    throw new PhotoPreparationError(
      "HEIC and HEIF photographs are not supported by this browser yet. The photo remains in your draft so you can remove it or retry in a compatible browser.",
      "unsupportedFormat",
    );
  }

  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      // Safari and older browsers can still decode through an image element.
    }
  }

  return decodeWithImageElement(file);
}

function fitWithin(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function createVariant(
  decoded: DecodedImage,
  sourceName: string,
  variant: "display" | "thumb",
  maxEdge: number,
  quality: number,
  preferredType: "image/webp" | "image/jpeg",
): Promise<PhotoVariant> {
  const dimensions = fitWithin(decoded.width, decoded.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new PhotoPreparationError(
      "This browser could not prepare the photograph. Try again or remove it.",
      "encodeFailed",
    );
  }
  context.drawImage(decoded.source, 0, 0, dimensions.width, dimensions.height);

  let mimeType = preferredType;
  let blob = await canvasToBlob(canvas, mimeType, quality);
  if (!blob && mimeType === "image/webp") {
    mimeType = "image/jpeg";
    blob = await canvasToBlob(canvas, mimeType, quality);
  }
  if (!blob) {
    throw new PhotoPreparationError(
      "This browser could not encode the photograph. Try again or remove it.",
      "encodeFailed",
    );
  }

  const processedFile = new File(
    [blob],
    outputName(sourceName, variant, mimeType),
    { type: mimeType, lastModified: Date.now() },
  );
  return {
    file: processedFile,
    mimeType,
    width: dimensions.width,
    height: dimensions.height,
    size: processedFile.size,
  };
}

export async function optimisePhotoForUpload(
  file: File,
  config: MemoryMediaConfig,
): Promise<OptimisedPhoto> {
  const decoded = await decodePhoto(file);
  try {
    const preferredType = (await canEncodeWebp())
      ? "image/webp"
      : "image/jpeg";
    const display = await createVariant(
      decoded,
      file.name,
      "display",
      config.maxDisplayPhotoEdgePixels,
      config.displayPhotoQuality,
      preferredType,
    );
    const thumbnail = await createVariant(
      decoded,
      file.name,
      "thumb",
      config.maxThumbnailPhotoEdgePixels,
      config.thumbnailPhotoQuality,
      preferredType,
    );
    return { display, thumbnail, originalSize: file.size };
  } finally {
    decoded.dispose();
  }
}

export async function createPhotoEditorPreview(
  file: File,
  config: MemoryMediaConfig,
): Promise<PhotoVariant> {
  const decoded = await decodePhoto(file);
  try {
    const preferredType = (await canEncodeWebp())
      ? "image/webp"
      : "image/jpeg";
    return createVariant(
      decoded,
      file.name,
      "thumb",
      config.maxThumbnailPhotoEdgePixels,
      config.thumbnailPhotoQuality,
      preferredType,
    );
  } finally {
    decoded.dispose();
  }
}
