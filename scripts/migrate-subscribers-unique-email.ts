import { createClient } from '@supabase/supabase-js';

/**
 * Migration script to add unique constraint to subscribers.email column
 * 
 * This script:
 * 1. Removes duplicate email entries (keeping the first occurrence)
 * 2. Adds a unique constraint to the email column
 * 3. Creates an index for better performance
 * 
 * Requirements:
 *   • Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 *   • Run with: npx ts-node scripts/migrate-subscribers-unique-email.ts
 */

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Please export SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
  console.log('🚀 Starting subscribers table migration...');

  try {
    // Step 1: Check current state
    console.log('📊 Checking current subscribers...');
    const { data: allSubscribers, error: selectError } = await supabase
      .from('subscribers')
      .select('id, email, created_at')
      .order('created_at', { ascending: true });

    if (selectError) {
      console.error('❌ Failed to fetch subscribers:', selectError);
      return;
    }

    console.log(`📈 Found ${allSubscribers?.length || 0} total subscribers`);

    // Step 2: Identify duplicates
    const emailCounts = new Map<string, number>();
    const duplicateEmails = new Set<string>();
    
    allSubscribers?.forEach(sub => {
      const count = emailCounts.get(sub.email) || 0;
      emailCounts.set(sub.email, count + 1);
      if (count > 0) {
        duplicateEmails.add(sub.email);
      }
    });

    console.log(`🔍 Found ${duplicateEmails.size} duplicate email addresses`);

    if (duplicateEmails.size > 0) {
      console.log('📝 Duplicate emails:', Array.from(duplicateEmails));
      
      // Step 3: Remove duplicates (keeping the first occurrence by created_at)
      for (const email of duplicateEmails) {
        const duplicates = allSubscribers?.filter(sub => sub.email === email) || [];
        if (duplicates.length > 1) {
          // Sort by created_at and keep the first one
          duplicates.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          const toDelete = duplicates.slice(1); // Remove all except the first
          
          console.log(`🗑️  Removing ${toDelete.length} duplicate entries for ${email}`);
          
          for (const duplicate of toDelete) {
            const { error: deleteError } = await supabase
              .from('subscribers')
              .delete()
              .eq('id', duplicate.id);
            
            if (deleteError) {
              console.error(`❌ Failed to delete duplicate ${duplicate.id}:`, deleteError);
            }
          }
        }
      }
    }

    // Step 4: Add unique constraint using raw SQL
    console.log('🔒 Adding unique constraint to email column...');
    
    const { error: constraintError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE subscribers 
        ADD CONSTRAINT IF NOT EXISTS subscribers_email_unique UNIQUE (email);
        
        CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
      `
    });

    if (constraintError) {
      // If rpc method doesn't exist, try direct SQL execution
      console.log('⚠️  RPC method not available, constraint must be added manually in Supabase dashboard');
      console.log('📋 Run this SQL in your Supabase SQL editor:');
      console.log(`
ALTER TABLE subscribers 
ADD CONSTRAINT IF NOT EXISTS subscribers_email_unique UNIQUE (email);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
      `);
    } else {
      console.log('✅ Unique constraint added successfully');
    }

    // Step 5: Verify final state
    const { data: finalSubscribers, error: finalError } = await supabase
      .from('subscribers')
      .select('email')
      .order('created_at');

    if (!finalError) {
      const finalEmailCounts = new Map<string, number>();
      finalSubscribers?.forEach(sub => {
        const count = finalEmailCounts.get(sub.email) || 0;
        finalEmailCounts.set(sub.email, count + 1);
      });

      const remainingDuplicates = Array.from(finalEmailCounts.entries()).filter(([_, count]) => count > 1);
      
      if (remainingDuplicates.length === 0) {
        console.log('✅ Migration completed successfully - no duplicate emails remain');
        console.log(`📊 Final count: ${finalSubscribers?.length || 0} unique subscribers`);
      } else {
        console.log('⚠️  Some duplicates may still exist:', remainingDuplicates);
      }
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run the migration
runMigration().then(() => {
  console.log('🏁 Migration script completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Migration script failed:', error);
  process.exit(1);
}); 