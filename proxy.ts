import { NextRequest, NextResponse } from 'next/server';
import { zipCorsHeaders } from '@/lib/zip/cors.ts';

export function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();
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
