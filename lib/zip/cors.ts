function allowedOrigins(configured: string): Set<string> {
  const values = configured.split(',').map((value) => value.trim()).filter(Boolean);
  const origins = new Set<string>();
  for (const value of values) {
    let url: URL;
    try { url = new URL(value); } catch { continue; }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) continue;
    origins.add(url.origin);
  }
  return origins;
}

export function zipCorsHeaders(origin: string | null, configured = process.env.ZIP_FRONTEND_ORIGINS ?? ''): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' };
  if (!origin || !allowedOrigins(configured).has(origin)) return headers;
  headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Allow-Credentials'] = 'true';
  headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
  headers['Access-Control-Allow-Headers'] = 'Content-Type';
  return headers;
}

export function withZipCors(request: Request, response: Response, configured = process.env.ZIP_FRONTEND_ORIGINS ?? ''): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(zipCorsHeaders(request.headers.get('origin'), configured))) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function handleZipOptions(request: Request, configured = process.env.ZIP_FRONTEND_ORIGINS ?? ''): Response | null {
  if (request.method !== 'OPTIONS') return null;
  const headers = zipCorsHeaders(request.headers.get('origin'), configured);
  if (!headers['Access-Control-Allow-Origin']) return new Response(null, { status: 403, headers });
  return new Response(null, { status: 204, headers });
}
