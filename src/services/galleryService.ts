import { supabase } from '../lib/supabase';
import i18n from '../i18n';

/**
 * A single gallery item representing another player's ending image.
 */
export interface GalleryItem {
  id: string;
  /** Publicly accessible URL to the PNG in the `ending-cards` bucket */
  imageUrl: string;
  /** Short text snippet (child status at 18). Use as alt / caption. */
  childStatusAt18: string;
  hearts: number;
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
    .select('id, child_status_at_18, image_path')
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
        child_status_preview: row.child_status_at_18?.substring(0, 100) 
      });
    }

    const displayName = extractChildName(row.child_status_at_18 || '');
    
    // For English users, use empty alt text to avoid showing Chinese names
    const altText = i18n.language === 'en' ? '' : displayName;
    
    if (import.meta.env.DEV) {
      console.debug('[galleryService] Extracted name:', displayName, 'Alt text:', altText);
    }

    return {
      id: row.id,
      childStatusAt18: altText,
      imageUrl: publicUrl,
      hearts: 0, // Default to 0 since hearts field doesn't exist yet
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
      hearts: 0, // Default to 0 since hearts field doesn't exist yet
    } as GalleryItem;
  });
}

/**
 * Atomically increment hearts for a card and return new hearts count.
 * Relies on SQL function `increment_heart(card_id uuid)`.
 */
export async function incrementHeart(cardId: string): Promise<number> {
  const { data, error } = await supabase.rpc('increment_heart', { card_id: cardId });
  if (error) throw error;

  if (import.meta.env.DEV) {
    console.debug('[incrementHeart] RPC raw data:', data);
  }

  // Possible return shapes:
  // 1) scalar number
  if (typeof data === 'number') return data;

  // 2) array with scalar number
  if (Array.isArray(data) && data.length === 1 && typeof data[0] === 'number') {
    return data[0] as number;
  }

  // 3) object or array element with field hearts or new_hearts
  const maybeObj = Array.isArray(data) ? data[0] : data;
  if (maybeObj && typeof maybeObj === 'object') {
    if ('new_hearts' in maybeObj) return (maybeObj as any).new_hearts as number;
    if ('hearts' in maybeObj) return (maybeObj as any).hearts as number;
    // fallback: return first numeric property
    const numProp = Object.values(maybeObj).find((v) => typeof v === 'number');
    if (typeof numProp === 'number') return numProp;
  }
  throw new Error('Unexpected response from increment_heart');
} 

/**
 * Decrement hearts (unlike) for a card. Returns new heart count.
 */
export async function decrementHeart(cardId: string): Promise<number> {
  const { data, error } = await supabase.rpc('decrement_heart', { card_id: cardId });
  if (error) throw error;
  if (import.meta.env.DEV) console.debug('[decrementHeart] RPC raw data:', data);

  if (typeof data === 'number') return data;
  if (Array.isArray(data) && data.length === 1 && typeof data[0] === 'number') return data[0] as number;
  const maybeObj = Array.isArray(data) ? data[0] : data;
  if (maybeObj && typeof maybeObj === 'object') {
    if ('new_hearts' in maybeObj) return (maybeObj as any).new_hearts as number;
    if ('hearts' in maybeObj) return (maybeObj as any).hearts as number;
    const numProp = Object.values(maybeObj).find((v) => typeof v === 'number');
    if (typeof numProp === 'number') return numProp;
  }
  throw new Error('Unexpected response from decrement_heart');
} 

/**
 * Get total number of shared ending cards.
 */
export async function getSharedCardsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('ending_cards')
    .select('id', { count: 'exact', head: true })
    .eq('share_ok', true);
  if (error) throw error;
  return count ?? 0;
}