import { isAllowedZipOrigin } from './cors.ts';

export class ZipRequestError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.name = 'ZipRequestError'; this.status = status; }
}

/** Bound the streamed body before decoding it. Never include instruction text in errors. */
export async function readZipJson(request: Request, maxBytes = 16_384): Promise<Record<string, unknown>> {
  const origin = request.headers.get('origin');
  const requestOrigin = new URL(request.url).origin;
  const sameOrigin = origin === null || origin === requestOrigin;
  const approvedCrossOrigin = !sameOrigin && isAllowedZipOrigin(origin);
  if ((!sameOrigin && !approvedCrossOrigin) || (request.headers.get('sec-fetch-site') === 'cross-site' && !approvedCrossOrigin)) throw new ZipRequestError('Approved application origin required', 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ZipRequestError('JSON request required', 415);
  if (Number(request.headers.get('content-length')) > maxBytes) throw new ZipRequestError('Request body is too large', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ZipRequestError('Invalid request body', 400);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new ZipRequestError('Request body is too large', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let input: unknown;
  try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new ZipRequestError('Invalid request body', 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ZipRequestError('A JSON object is required', 400);
  return input as Record<string, unknown>;
}

export function zipRequestError(error: unknown): Response {
  return Response.json({ error: error instanceof ZipRequestError ? error.message : 'Invalid request body' }, { status: error instanceof ZipRequestError ? error.status : 400 });
}
