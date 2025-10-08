import { NextResponse } from 'next/server';

// Helper to extract client IP (Vercel sends "x-forwarded-for: client, proxy1, proxy2")
function getClientIp(req) {
  const xff = req.headers.get('x-forwarded-for') || '';
  const ip = xff.split(',')[0].trim();
  return ip || req.ip || '';
}

export function middleware(req) {
  const { pathname } = new URL(req.url);
  if (!pathname.startsWith('/api/')) return NextResponse.next();

  const allow = ['3.143.106.159']; // ✅ your approved IP

  const clientIp = getClientIp(req);
  if (!allow.includes(clientIp)) {
    const cors = process.env.CORS_ALLOW_ORIGIN || '*';
    return new NextResponse(JSON.stringify({ error: 'Forbidden', ip: clientIp }), {
      status: 403,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': cors,
        'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': 'GET,OPTIONS',
      },
    });
  }

  return NextResponse.next();
}

// Apply to all /api routes
export const config = {
  matcher: ['/api/:path*'],
};
