import { supabaseAdmin } from './supabaseAdmin';

const EMAIL_VERIFICATION_WHITELIST = new Set(['freecredits@babysim.fun']);

export const isEmailVerificationWhitelisted = (email?: string | null): boolean => {
  if (!email) return false;
  return EMAIL_VERIFICATION_WHITELIST.has(email.trim().toLowerCase());
};

export const ensureSubscriberVerified = async (email: string): Promise<void> => {
  const sanitizedEmail = email.trim().toLowerCase();
  try {
    await supabaseAdmin
      .from('subscribers')
      .upsert([
        {
          email: sanitizedEmail,
          verified: true,
          verified_at: new Date().toISOString(),
        },
      ], {
        onConflict: 'email',
        ignoreDuplicates: false,
      });
  } catch (error) {
    console.error('Failed to upsert subscriber for whitelist email:', error);
  }
};
