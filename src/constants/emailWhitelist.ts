const EMAIL_VERIFICATION_WHITELIST = ['freecredits@babysim.fun'] as const;

export const isEmailWhitelisted = (email?: string | null): boolean => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return EMAIL_VERIFICATION_WHITELIST.includes(normalized as (typeof EMAIL_VERIFICATION_WHITELIST)[number]);
};

export { EMAIL_VERIFICATION_WHITELIST };
