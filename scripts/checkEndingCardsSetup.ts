import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

/**
 * Simple sanity-check for the `ending-cards` storage bucket and
 * `ending_cards` metadata table.
 *
 * Requirements:
 *   • Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 *   • Run with ts-node or compile with tsc.
 *
 * The script tries to upload a tiny text file and insert a dummy row.
 * On success it cleans up (deletes the object & row).
 */

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Please export SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const bucket = 'ending-cards';
  const id = randomUUID();
  const objectKey = `${id}.txt`;

  console.log('🚀 Testing upload to bucket', bucket, '…');
  const { error: uploadErr } = await supabase.storage
    .from(bucket)
    .upload(objectKey, 'supabase-permission-test', {
      contentType: 'text/plain',
    });
  if (uploadErr) {
    console.error('❌ Upload failed:', uploadErr);
    process.exit(1);
  }
  console.log('✅ Upload succeeded.');

  console.log('🚀 Testing insert into table ending_cards …');
  const { error: insertErr } = await supabase.from('ending_cards').insert({
    id,
    child_status_at_18: 'test',
    parent_review: 'test',
    outlook: 'test',
    image_path: objectKey,
    share_ok: false,
  });
  if (insertErr) {
    console.error('❌ Insert failed:', insertErr);
    // clean up uploaded object before exit
    await supabase.storage.from(bucket).remove([objectKey]);
    process.exit(1);
  }
  console.log('✅ Insert succeeded.');

  // clean up
  await supabase.storage.from(bucket).remove([objectKey]);
  await supabase.from('ending_cards').delete().eq('id', id);
  console.log('🧹 Clean-up done. Your setup looks correct!');
})(); 