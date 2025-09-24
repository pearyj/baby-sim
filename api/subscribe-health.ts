import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin.js';

/**
 * GET /api/subscribe-health
 * Health check endpoint to verify Supabase connection and subscribers table
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const healthCheck = {
    timestamp: new Date().toISOString(),
    supabaseConfigured: false,
    subscribersTableExists: false,
    canInsert: false,
    error: null as string | null
  };

  try {
    // Check if supabaseAdmin is configured
    if (!supabaseAdmin) {
      healthCheck.error = 'supabaseAdmin not initialized';
      return res.status(500).json(healthCheck);
    }
    
    healthCheck.supabaseConfigured = true;
    console.log('✅ Supabase admin client is configured');

    // Test if subscribers table exists by trying to select from it
    const { data, error: selectError } = await supabaseAdmin
      .from('subscribers')
      .select('email')
      .limit(1);

    if (selectError) {
      console.error('❌ Error checking subscribers table:', selectError);
      healthCheck.error = `Table check failed: ${selectError.message}`;
      
      if (selectError.code === '42P01') {
        healthCheck.error = 'subscribers table does not exist';
      }
      
      return res.status(500).json(healthCheck);
    }

    healthCheck.subscribersTableExists = true;
    console.log('✅ subscribers table exists and is accessible');

    // Test if we can insert (using a test email that we'll immediately delete)
    const testEmail = `health-check-${Date.now()}@test.com`;
    
    const { error: insertError } = await supabaseAdmin
      .from('subscribers')
      .insert([{ email: testEmail }]);

    if (insertError) {
      console.error('❌ Error testing insert:', insertError);
      healthCheck.error = `Insert test failed: ${insertError.message}`;
      return res.status(500).json(healthCheck);
    }

    // Clean up the test record
    await supabaseAdmin
      .from('subscribers')
      .delete()
      .eq('email', testEmail);

    healthCheck.canInsert = true;
    console.log('✅ Insert/delete test successful');

    return res.status(200).json(healthCheck);

  } catch (e) {
    console.error('❌ Health check failed with exception:', e);
    healthCheck.error = e instanceof Error ? e.message : String(e);
    return res.status(500).json(healthCheck);
  }
} 