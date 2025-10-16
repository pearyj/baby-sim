import type { GalleryItem } from '../services/galleryService';

export interface AspectRatioFilterOptions {
  /**
   * Minimum acceptable aspect ratio (width / height). Defaults to 0 (no lower bound).
   */
  minAspectRatio?: number;
  /**
   * Maximum acceptable aspect ratio (width / height). Defaults to Infinity (no upper bound).
   */
  maxAspectRatio?: number;
}

interface MeasuredGalleryItem {
  item: GalleryItem;
  aspectRatio: number;
}

/**
 * Measure the intrinsic size of an image by creating an off-DOM Image element.
 * Resolves with its aspect ratio or rejects on load failure.
 */
const measureImageAspect = (url: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Image constructor unavailable in this environment'));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (img.naturalHeight === 0) {
        reject(new Error('Zero height image'));
        return;
      }
      resolve(img.naturalWidth / img.naturalHeight);
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
};

/**
 * Filter gallery items to those whose aspect ratio falls within the desired range.
 * Any items that fail to load are treated as non-matching and removed.
 */
export const filterGalleryItemsByAspect = async (
  items: GalleryItem[],
  { minAspectRatio = 0, maxAspectRatio = Number.POSITIVE_INFINITY }: AspectRatioFilterOptions = {}
): Promise<GalleryItem[]> => {
  if (items.length === 0) return [];

  if (typeof window === 'undefined') {
    // In non-browser environments (e.g., SSR), skip filtering to avoid relying on Image().
    return items;
  }

  const settled = await Promise.allSettled(
    items.map(async (item): Promise<MeasuredGalleryItem> => {
      const aspectRatio = await measureImageAspect(item.imageUrl);
      return { item, aspectRatio };
    })
  );

  return settled
    .filter((result): result is PromiseFulfilledResult<MeasuredGalleryItem> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter(({ aspectRatio }) => aspectRatio >= minAspectRatio && aspectRatio <= maxAspectRatio)
    .map(({ item }) => item);
};
