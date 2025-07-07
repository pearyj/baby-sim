import { supabase } from '../lib/supabase';

/**
 * A single gallery item representing another player's ending image.
 */
export interface GalleryItem {
  id: string;
  /** Publicly accessible URL to the PNG in the `ending-cards` bucket */
  imageUrl: string;
  /** Short text snippet (child status at 18). Use as alt / caption. */
  childStatusAt18: string;
}

/**
 * Fetch a list of gallery items.
 *
 * @param limit  Number of rows to return. Use `Infinity` (or a large number) to fetch all.
 * @param offset Offset for pagination.
 */
export async function getGalleryItems(limit = 20, offset = 0): Promise<GalleryItem[]> {
  const { data, error } = await supabase
    .from('ending_cards')
    .select('id, child_status_at_18, image_path, child_name')
    .eq('share_ok', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + (limit === Infinity ? 99999 : limit) - 1);

  if (error) throw error;
  if (!data) return [];

  if (import.meta.env.DEV) {
    console.info('[galleryService] Fetched', data.length, 'rows');
    if (data.length > 0) {
      console.debug('[galleryService] Sample row', data[0]);
      console.debug('[galleryService] Available columns:', Object.keys(data[0]));
    }
  }

  return data.map((row) => {
    const {
      data: { publicUrl }
    } = supabase.storage
      .from('ending-cards')
      .getPublicUrl(row.image_path);

    if (import.meta.env.DEV) {
      console.debug('[galleryService] Generated URL for', row.image_path, ':', publicUrl);
      console.debug('[galleryService] Row data:', { 
        id: row.id, 
        child_name: row.child_name, 
        child_status_preview: row.child_status_at_18?.substring(0, 100) 
      });
    }

    const displayName = row.child_name || extractChildName(row.child_status_at_18 || '');
    
    if (import.meta.env.DEV) {
      console.debug('[galleryService] Extracted name:', displayName);
    }

    return {
      id: row.id,
      childStatusAt18: displayName,
      imageUrl: publicUrl,
    } as GalleryItem;
  });
}

/**
 * Extract child name from status text as fallback
 */
function extractChildName(statusText: string): string {
  if (!statusText || statusText.trim() === '') {
    return 'Child';
  }

  // Clean up the text first
  const cleanText = statusText.trim();
  
  if (import.meta.env.DEV) {
    console.debug('[extractChildName] Input text:', cleanText.substring(0, 100));
  }

  // Try to extract name from various patterns
  const patterns = [
    /^([A-Za-z\u4e00-\u9fff]+)\s+(?:has|已经|是|成为|变成)/i,  // "Emma has grown" or "小明已经"
    /^([A-Za-z\u4e00-\u9fff]+)\s+(?:is|was|将|会)/i,          // "Emma is" or "小明将"
    /^([A-Za-z\u4e00-\u9fff]+)[，,。]/,                      // "Emma," or "小明，"
    /^([A-Za-z\u4e00-\u9fff]+)\s/,                          // First word before space
  ];
  
  for (const pattern of patterns) {
    const nameMatch = cleanText.match(pattern);
    if (nameMatch && nameMatch[1]) {
      const name = nameMatch[1].trim();
      if (name.length > 0 && name.length < 20) {
        if (import.meta.env.DEV) {
          console.debug('[extractChildName] Extracted name:', name);
        }
        return name;
      }
    }
  }
  
  // Fallback to first word
  const firstWord = cleanText.split(/\s+/)[0];
  const cleanFirstWord = firstWord.replace(/[^\w\u4e00-\u9fff]/g, ''); // Remove punctuation
  
  if (import.meta.env.DEV) {
    console.debug('[extractChildName] Fallback first word:', cleanFirstWord);
  }
  
  return (cleanFirstWord.length > 0 && cleanFirstWord.length < 20) ? cleanFirstWord : 'Child';
}

/**
 * Fetch a curated subset of **featured** gallery items for the welcome-screen carousel.
 * Defaults to first 12 by `featured_rank`.
 */
export async function getFeaturedGalleryItems(count = 12): Promise<GalleryItem[]> {
  const { data, error } = await supabase
    .from('ending_cards')
    .select('id, child_status_at_18, image_path')
    .eq('share_ok', true)
    .eq('is_featured', true)
    .order('featured_rank', { ascending: true })
    .limit(count);

  if (error) throw error;
  if (!data) return [];

  return data.map((row) => {
    const {
      data: { publicUrl }
    } = supabase.storage
      .from('ending-cards')
      .getPublicUrl(row.image_path);
    return {
      id: row.id,
      childStatusAt18: row.child_status_at_18,
      imageUrl: publicUrl,
    } as GalleryItem;
  });
} 