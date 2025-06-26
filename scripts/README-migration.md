# Subscribers Table Migration

This directory contains scripts to add unique email constraints to the `subscribers` table to prevent duplicate email entries.

## Problem
The current subscribers table allows duplicate email entries, which can lead to data integrity issues.

## Solution
1. **API Update**: Modified `api/subscribe.ts` to use `upsert` instead of `insert`
2. **Database Migration**: Scripts to add unique constraint and remove existing duplicates
3. **Frontend Update**: Better error handling for duplicate email scenarios

## Files

### `add_unique_email_constraint.sql`
Raw SQL migration script that:
- Removes existing duplicate emails (keeping the first occurrence)
- Adds unique constraint to the email column
- Creates an index for better performance

### `migrate-subscribers-unique-email.ts`
TypeScript migration script that:
- Analyzes current subscribers table
- Identifies and removes duplicates
- Attempts to add unique constraint
- Provides fallback instructions if automated constraint addition fails

## Running the Migration

### Option 1: Using TypeScript Script (Recommended)
```bash
# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run the migration script
npx ts-node scripts/migrate-subscribers-unique-email.ts
```

### Option 2: Manual SQL Execution
1. Copy the contents of `add_unique_email_constraint.sql`
2. Run it in your Supabase SQL Editor
3. Verify the constraint was added successfully

## Verification

After running the migration:

1. Check that duplicate emails have been removed:
```sql
SELECT email, COUNT(*) as count 
FROM subscribers 
GROUP BY email 
HAVING COUNT(*) > 1;
```

2. Verify the unique constraint exists:
```sql
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'subscribers' 
AND constraint_type = 'UNIQUE';
```

3. Test the API endpoint to ensure it handles duplicates gracefully

## API Changes

The `api/subscribe.ts` endpoint now:
- Uses `upsert` with `onConflict: 'email'` to handle duplicates
- Returns appropriate response for already subscribed emails
- Maintains backward compatibility

## Frontend Changes

The subscription form now:
- Displays "This email is already subscribed" message for duplicates
- Handles the new API response format
- Supports both English and Chinese translations

## Rollback

If you need to rollback the constraint:
```sql
ALTER TABLE subscribers DROP CONSTRAINT IF EXISTS subscribers_email_unique;
DROP INDEX IF EXISTS idx_subscribers_email;
```

Note: This will allow duplicates again, so only do this if absolutely necessary. 