import { NextRequest, NextResponse } from 'next/server';
import { zipCorsHeaders } from '@/lib/zip/cors.ts';

export function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();
  if (process.env.VERCEL === '1' || process.env.ZIP_FRONTEND_ONLY === '1') return NextResponse.json({ error: 'ZIP backend is hosted on Cloudflare.' }, { status: 404 });
  const cors = zipCorsHeaders(request.headers.get('origin'));
  if (request.method === 'OPTIONS') {
    if (!cors['Access-Control-Allow-Origin']) return new NextResponse(null, { status: 403, headers: cors });
    return new NextResponse(null, { status: 204, headers: cors });
  }
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
  return response;
}

export const config = { matcher: '/api/:path*' };
