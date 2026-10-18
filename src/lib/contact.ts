export interface ContactPayload {
  name: string;
  email: string;
  message: string;
  website: string;
  startedAt: number;
}

export async function sendContact(endpoint: string | undefined, payload: ContactPayload): Promise<void> {
  if (!endpoint) throw new Error('configuration');
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
      throw new Error('configuration');
    }
  } catch { throw new Error('configuration'); }
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error('delivery'); }
  if (response.status === 429) throw new Error('rateLimit');
  if (response.status === 400) throw new Error('validation');
  if (!response.ok) throw new Error('delivery');
  try {
    const result = await response.json() as { ok?: boolean };
    if (result.ok !== true) throw new Error();
  } catch { throw new Error('delivery'); }
}
