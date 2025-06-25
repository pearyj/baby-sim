import { API_CONFIG } from '../config/api';

const BASE_URL = API_CONFIG.SERVERLESS_API_URL?.replace(/\/[^/]*$/, '') || '/api';

export interface EventPayload { [key: string]: unknown }

export const initSession = async (
  anonId: string,
  kidId: string,
  style: string,
  customInstruction: string | null = null,
  meta: any = null
): Promise<void> => {
  try {
    const res = await fetch(`${BASE_URL}/session-init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonId, kidId, style, customInstruction, meta }),
    });
    if (!res.ok && import.meta.env.DEV) {
      const txt = await res.text();
      console.error('[initSession] server responded', res.status, txt.slice(0,200));
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('initSession failed', err);
    }
  }
};

export const logEvent = async (
  anonId: string,
  kidId: string,
  type: string,
  payload: EventPayload | null = null
): Promise<void> => {
  if (import.meta.env.DEV) {
    console.debug(`[logEvent] ➡️ sending`, { anonId: anonId.slice(-8), kidId: kidId.slice(-8), type, payload });
  }

  try {
    const res = await fetch(`${BASE_URL}/log-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonId, kidId, type, payload }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (import.meta.env.DEV) {
        console.error('[logEvent] ⛔ server responded', res.status, txt.slice(0, 200));
      }
    } else if (import.meta.env.DEV) {
      console.debug('[logEvent] ✅ ok');
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[logEvent] 💥 fetch crashed', err);
    }
  }
};

export const updateSessionFlags = async (
  anonId: string,
  kidId: string,
  flags: { checkoutInitiated?: boolean; checkoutCompleted?: boolean; imageGenerated?: boolean }
): Promise<void> => {
  if (import.meta.env.DEV) {
    console.debug('[updateSessionFlags] ➡️ sending', { anonId: anonId.slice(-8), kidId: kidId.slice(-8), flags });
  }

  try {
    const res = await fetch(`${BASE_URL}/session-flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonId, kidId, flags }),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (import.meta.env.DEV) {
        console.error('[updateSessionFlags] ⛔ server responded', res.status, txt.slice(0,200));
      }
    } else if (import.meta.env.DEV) {
      console.debug('[updateSessionFlags] ✅ ok');
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('updateSessionFlags failed', err);
    }
  }
}; 