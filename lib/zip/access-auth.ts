export type AccessIdentity = { email: string; displayName: string };
export type AccessVerifyOptions = { issuer: string; audience: string; fetch: typeof fetch; now?: number };

type AccessClaims = { iss?: unknown; aud?: unknown; exp?: unknown; nbf?: unknown; email?: unknown; name?: unknown };
type Jwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(base64, 'base64'));
  const binary = atob(base64); return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function decodeJson<T>(value: string): T {
  const text = new TextDecoder().decode(decodeBase64Url(value));
  return JSON.parse(text) as T;
}
function normalizedIssuer(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('invalid_access_issuer');
  return url.origin;
}
function audienceIncludes(value: unknown, expected: string): boolean {
  return typeof value === 'string' ? value === expected : Array.isArray(value) && value.some((item) => item === expected);
}
export function validateAccessClaims(claims: AccessClaims, options: { issuer: string; audience: string; now?: number }): AccessIdentity {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const issuer = normalizedIssuer(options.issuer);
  if (claims.iss !== issuer) throw new Error('invalid_access_issuer');
  if (!audienceIncludes(claims.aud, options.audience)) throw new Error('invalid_access_audience');
  if (typeof claims.exp !== 'number' || claims.exp <= now) throw new Error('expired_access_token');
  if (typeof claims.nbf === 'number' && claims.nbf > now + 30) throw new Error('access_token_not_yet_valid');
  if (typeof claims.email !== 'string' || !claims.email.includes('@') || claims.email.length > 320) throw new Error('invalid_access_email');
  const email = claims.email.trim().toLowerCase();
  const displayName = typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim().slice(0, 200) : email;
  return { email, displayName };
}

export async function verifyCloudflareAccessJwt(token: string, options: AccessVerifyOptions): Promise<AccessIdentity> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) throw new Error('invalid_access_jwt');
  const header = decodeJson<{ alg?: unknown; kid?: unknown }>(parts[0]);
  const claims = decodeJson<AccessClaims>(parts[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) throw new Error('invalid_access_jwt_header');
  const issuer = normalizedIssuer(options.issuer);
  const response = await options.fetch(`${issuer}/cdn-cgi/access/certs`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('access_jwks_unavailable');
  const jwks = await response.json() as { keys?: Jwk[] };
  const jwk = jwks.keys?.find((key) => key.kid === header.kid && (!key.alg || key.alg === 'RS256'));
  if (!jwk) throw new Error('access_key_not_found');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = decodeBase64Url(parts[2]);
  const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed);
  if (!verified) throw new Error('invalid_access_signature');
  return validateAccessClaims(claims, { issuer, audience: options.audience, now: options.now });
}
