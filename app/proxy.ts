import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth/jwt';

const PROTECTED_ROUTES = ['/dashboard', '/api/decisions', '/api/analytics', '/api/export'];
const AUTH_ROUTES = ['/auth/login', '/auth/register'];

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get('auth_token')?.value;

    const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
    const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

    if (isProtected) {
        if (!token) {
            return NextResponse.redirect(new URL('/auth/login', request.url));
        }
        const payload = await verifyJWT(token);
        if (!payload) {
            const response = NextResponse.redirect(new URL('/auth/login', request.url));
            response.cookies.delete('auth_token');
            return response;
        }
        // Attach user info to request headers
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-user-id', payload.userId);
        requestHeaders.set('x-user-email', payload.email);
        return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // Redirect logged-in users away from auth pages
    if (isAuthRoute && token) {
        const payload = await verifyJWT(token);
        if (payload) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
