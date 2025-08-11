import { z } from 'zod';

// Base client with JSON parsing, error normalization, and retry (simple one-shot retry on network error)
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

export async function request<TSchema extends z.ZodTypeAny>(
  url: string,
  schema: TSchema,
  options: RequestOptions = {}
): Promise<z.infer<TSchema>> {
  const { method = 'GET', headers, body, signal } = options;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers || {}),
  };

  const makeFetch = async () => {
    const res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });

    const text = await res.text();
    if (!res.ok) {
      // Best-effort JSON extraction
      let json: any = undefined;
      try { json = JSON.parse(text); } catch (_) {}
      const message = json?.error || json?.message || res.statusText || 'Request failed';
      throw new Error(message);
    }

    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error('Invalid JSON response');
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new Error('Response validation failed');
    }
    return parsed.data;
  };

  // Simple retry on network failure once
  try {
    return await makeFetch();
  } catch (err: any) {
    if (err?.name === 'TypeError') {
      return await makeFetch();
    }
    throw err;
  }
}

// Schemas
export const CreditInfoSchema = z.object({
  credits: z.number(),
  bypass: z.boolean().optional(),
});
export type CreditInfoDTO = z.infer<typeof CreditInfoSchema>;

export const ConsumeCreditSchema = z.object({
  ok: z.boolean().optional(),
  remaining: z.number().optional(),
  error: z.string().optional(),
});
export type ConsumeCreditDTO = z.infer<typeof ConsumeCreditSchema>;

export const CheckoutSessionResponseSchema = z.object({
  success: z.boolean(),
  sessionId: z.string().optional(),
  url: z.union([z.string(), z.null()]).optional(),
  clientSecret: z.union([z.string(), z.null()]).optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});
export type CheckoutSessionResponseDTO = z.infer<typeof CheckoutSessionResponseSchema>;


