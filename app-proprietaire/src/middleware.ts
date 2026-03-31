import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const token = request.cookies.get('pilot-token')?.value;
    const { pathname } = request.nextUrl;

    // Définir les routes publiques (auth)
    const isAuthPage = pathname.startsWith('/auth');

    // Si on n'a pas de token et qu'on n'est pas sur une page d'auth -> redirect vers login
    if (!token && !isAuthPage) {
        return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // Si on a un token et qu'on essaie d'aller sur login -> redirect vers l'onboarding ou dashboard
    if (token && isAuthPage) {
        // Optionnel : rediriger vers le dashboard ou profil si déjà connecté
        // return NextResponse.redirect(new URL('/onboarding/profile', request.url));
    }

    return NextResponse.next();
}

// Configurer les paths à matcher
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - Fichiers statiques (images, etc.) via extensions
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
    ],
};
