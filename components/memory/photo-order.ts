import type { MemoryPhoto } from "@/data/memory-demo";

export function movePhoto(
  photos: MemoryPhoto[],
  fromIndex: number,
  toIndex: number,
) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= photos.length ||
    toIndex >= photos.length
  ) {
    return photos;
  }

  const reordered = [...photos];
  const [movedPhoto] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, movedPhoto);
  return reordered;
}
