"use client";

import Image from "next/image";
import type { CSSProperties, RefObject } from "react";

import {
  PrivatePhoto,
  type PhotoCollectionProps,
} from "@/components/memory/photo-collection";
import type { MemoryPhoto, PhotoCropMetadata } from "@/data/memory-demo";
import {
  centerSquareCropMetadata,
  cropMetadataToImageStyle,
  isPhotoCropMetadata,
} from "@/lib/scrap/crop-math";

type StampCropInput = {
  cropMetadata?: PhotoCropMetadata;
  width?: number;
  height?: number;
  createdAt?: string;
};

type StampCropRender = {
  mode?: "metadata" | "center";
  cropMetadata?: PhotoCropMetadata;
  imageStyle?: CSSProperties;
};

function finitePositive(value?: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

export function stampCropRender(input: StampCropInput): StampCropRender {
  if (isPhotoCropMetadata(input.cropMetadata)) {
    return {
      mode: "metadata",
      cropMetadata: input.cropMetadata,
      imageStyle: cropMetadataToImageStyle(input.cropMetadata),
    };
  }

  const width = finitePositive(input.width);
  const height = finitePositive(input.height);
  if (!width || !height) return {};

  const fallbackCrop = centerSquareCropMetadata({
    imageWidth: width,
    imageHeight: height,
    createdAt: input.createdAt,
  });

  return {
    mode: "center",
    cropMetadata: fallbackCrop,
    imageStyle: cropMetadataToImageStyle(fallbackCrop),
  };
}

type CroppedStampImageProps = StampCropInput & {
  src?: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
  className?: string;
};

export function CroppedStampImage({
  src,
  alt,
  sizes,
  priority = false,
  loading = "lazy",
  className = "",
  ...cropInput
}: CroppedStampImageProps) {
  if (!src) return null;

  const crop = stampCropRender(cropInput);
  const imageClassName = [className, crop.imageStyle ? "max-w-none" : "object-cover"]
    .filter(Boolean)
    .join(" ");

  if (crop.imageStyle) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : loading}
        className={imageClassName}
        sizes={sizes}
        style={crop.imageStyle}
        data-stamp-cropped-image={crop.mode}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      loading={priority ? undefined : loading}
      unoptimized
      sizes={sizes}
      className={imageClassName}
      data-stamp-cropped-image="object-cover"
    />
  );
}

type CroppedPrivateStampImageProps = {
  photo: MemoryPhoto;
  variant: "display" | "thumbnail";
  priority?: boolean;
  sizes: string;
  className?: string;
  resolvePhotoUrl?: PhotoCollectionProps["resolvePhotoUrl"];
  deferUntilVisible?: boolean;
  visibilityRootRef?: RefObject<HTMLDivElement | null>;
};

export function CroppedPrivateStampImage({
  photo,
  className = "",
  ...props
}: CroppedPrivateStampImageProps) {
  const crop = stampCropRender({
    cropMetadata: photo.cropMetadata,
    width: photo.width ?? photo.thumbnailWidth,
    height: photo.height ?? photo.thumbnailHeight,
  });
  const imageClassName = [className, crop.imageStyle ? "max-w-none" : "object-cover"]
    .filter(Boolean)
    .join(" ");

  return (
    <PrivatePhoto
      photo={photo}
      className={imageClassName}
      imageStyle={crop.imageStyle}
      {...props}
    />
  );
}
