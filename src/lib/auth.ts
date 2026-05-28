// Use Web Crypto so this works in both Node and Edge (middleware) runtimes.

const COOKIE_NAME = 'wg_admin';

function secret(): string {
  return process.env.AUTH_SECRET || 'dev-secret-change-me';
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function sign(value: string): Promise<string> {
  const key = await importKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return toHex(sig);
}

export async function makeAuthCookieValue(): Promise<string> {
  const issued = Date.now().toString();
  const sig = await sign(issued);
  return `${issued}.${sig}`;
}

export async function isValidCookieValue(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 2) return false;
  const [issued, sig] = parts;
  const expected = await sign(issued);
  return timingSafeEqualStr(sig, expected);
}

export const AUTH_COOKIE = COOKIE_NAME;
