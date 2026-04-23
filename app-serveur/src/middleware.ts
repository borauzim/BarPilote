import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const token = request.cookies.get('pilot-token')?.value;
    const { pathname } = request.nextUrl;

    // Public routes (Auth, Join, Home)
    const isPublicPage = pathname === '/' || pathname.startsWith('/auth') || pathname.startsWith('/join');

    // Redirect to login if no token and not visiting a public page
    if (!token && !isPublicPage) {
        return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
