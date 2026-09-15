// Autenticação simples por senha compartilhada, usando um cookie assinado
// (HMAC) em vez de sessão em banco — funciona no Edge Runtime do middleware
// sem depender de nenhum serviço externo além da própria SITE_PASSWORD.

const encoder = new TextEncoder();

export const COOKIE_NAME = "diario_auth";
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

async function hmacHex(data, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function createSessionCookieValue(secret) {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const sig = await hmacHex(String(expires), secret);
  return `${expires}.${sig}`;
}

export async function verifySessionCookieValue(value, secret) {
  if (!value) return false;
  const [expiresStr, sig] = value.split(".");
  if (!expiresStr || !sig) return false;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expectedSig = await hmacHex(expiresStr, secret);
  return timingSafeEqual(sig, expectedSig);
}
