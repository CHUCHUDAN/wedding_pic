import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, isValidCookieValue } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApi = pathname.startsWith('/api/admin/');

  // 登入/登出 API 不要擋
  if (pathname === '/api/admin/login' || pathname === '/api/admin/logout') {
    return NextResponse.next();
  }
  // /admin/login 頁不需登入
  if (pathname === '/admin/login') return NextResponse.next();

  if (!isAdminPage && !isAdminApi) return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (await isValidCookieValue(cookie)) return NextResponse.next();

  if (isAdminApi) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
