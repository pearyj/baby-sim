import { supabase } from '../lib/supabase';
import logger from '../utils/logger';

export interface ParsedEndingSummary {
  childStatusAt18: string;
  parentReview: string;
  futureOutlook: string;
}

/**
 * Extract the three sections we care about from the markdown ending summary.
 * Supports both English and Chinese templates that look like:
 * **Child's Status at 18:**
 * ...text...
 *
 * **How You Are as a Parent:**
 * ...text...
 *
 * **Future Outlook:**
 * ...text...
 */
export const parseEndingSummary = (raw: string): ParsedEndingSummary => {
  // Normalise Windows line breaks first.
  const text = raw.replace(/\r\n/g, '\n');

  // Helper to run first successful regex.
  const firstMatch = (patterns: RegExp[]): string => {
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1]) {
        return m[1].trim();
      }
    }
    return '';
  };

  const childStatusAt18 = firstMatch([
    /\*\*Child'?s Status at 18:?\*\*[\s\n]*([\s\S]*?)(?=\n\n|\*\*|$)/i,
    /\*\*孩子18岁时的状况：?\*\*[\s\n]*([\s\S]*?)(?=\n\n|\*\*|$)/
  ]);

  const parentReview = firstMatch([
    /\*\*How You Are as a Parent:?\*\*[\s\n]*([\s\S]*?)(?=\n\n|\*\*|$)/i,
    /\*\*对你养育方式的评价：?\*\*[\s\n]*([\s\S]*?)(?=\n\n|\*\*|$)/
  ]);

  const futureOutlook = firstMatch([
    /\*\*Future Outlook:?\*\*[\s\n]*([\s\S]*?)(?=\n\n|\*\*|$)/i,
    /\*\*未来展望：?\*\*[\s\n]*([\s\S]*?)(?=\n\n|\*\*|$)/
  ]);

  return { childStatusAt18, parentReview, futureOutlook };
};

export interface SaveEndingCardOptions {
  endingSummaryMarkdown: string;
  imageBase64?: string; // If the API returned base64 string.
  imageUrl?: string;    // If already uploaded elsewhere.
  shareOk?: boolean;
  childName?: string;   // Child's name to store in the database
}

/**
 * Upload the image to Supabase Storage and create a metadata row in `ending_cards`.
 * Returns the new record's id on success.
 */
export const saveEndingCard = async ({
  endingSummaryMarkdown,
  imageBase64,
  imageUrl,
  shareOk = false,
  childName,
}: SaveEndingCardOptions): Promise<{ success: boolean; id?: string; error?: string }> => {
  try {
    // 1. Parse summary sections.
    const { childStatusAt18, parentReview, futureOutlook } = parseEndingSummary(endingSummaryMarkdown);

    // 2. Prepare the image data as Blob.
    let imageBlob: Blob | null = null;
    if (imageBase64) {
      // Strip any data URI prefix if present.
      const base64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, '');
      const binary = atob(base64);
      const len = binary.length;
      const buffer = new Uint8Array(len);
      for (let i = 0; i < len; i++) buffer[i] = binary.charCodeAt(i);
      imageBlob = new Blob([buffer], { type: 'image/png' });
    } else if (imageUrl) {
      const resp = await fetch(imageUrl);
      if (!resp.ok) throw new Error(`Failed to fetch image from ${imageUrl}`);
      imageBlob = await resp.blob();
    } else {
      throw new Error('No image data provided');
    }

    // 3. Generate UUID for record & storage key.
    const id = crypto.randomUUID();
    const storageKey = `${id}.png`;

    // 4. Upload to storage bucket.
    const { error: uploadErr } = await supabase.storage
      .from('ending-cards')
      .upload(storageKey, imageBlob, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadErr) throw uploadErr;

    // 5. Insert metadata row.
    const { error: insertErr } = await supabase.from('ending_cards').insert({
      id,
      child_status_at_18: childStatusAt18,
      parent_review: parentReview,
      outlook: futureOutlook,
      image_path: storageKey,
      share_ok: shareOk,
      child_name: childName,
    });

    if (insertErr) throw insertErr;

    return { success: true, id };
  } catch (err) {
    logger.error('Failed to save ending card:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}; 