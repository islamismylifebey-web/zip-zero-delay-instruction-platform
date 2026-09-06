function normalizedBackendOrigin(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('invalid_zip_api_origin'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('invalid_zip_api_origin');
  return url.origin;
}

export function zipApiUrl(path: string, configuredOrigin = process.env.NEXT_PUBLIC_ZIP_API_ORIGIN ?? ''): string {
  if (!path.startsWith('/api/')) return path;
  const origin = normalizedBackendOrigin(configuredOrigin);
  return origin ? `${origin}${path}` : path;
}

export function createZipFetch(baseFetch: typeof fetch = fetch, configuredOrigin = process.env.NEXT_PUBLIC_ZIP_API_ORIGIN ?? ''): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return baseFetch(zipApiUrl(input, configuredOrigin), { ...init, credentials: init?.credentials ?? 'include' });
    }
    return baseFetch(input, init);
  }) as typeof fetch;
}

let installed = false;
export function installZipApiFetch(configuredOrigin = process.env.NEXT_PUBLIC_ZIP_API_ORIGIN ?? ''): void {
  if (installed || typeof window === 'undefined') return;
  const origin = normalizedBackendOrigin(configuredOrigin);
  if (!origin) return;
  const original = window.fetch.bind(window);
  window.fetch = createZipFetch(original, origin);
  installed = true;
}
