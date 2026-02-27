import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    
    // Protect setup-admin page - only allow in development or with secret key
    if (pathname.startsWith('/setup-admin')) {
        const isDevelopment = process.env.NODE_ENV === 'development';
        const secretKey = request.nextUrl.searchParams.get('key');
        const expectedKey = process.env.ADMIN_SETUP_KEY || 'setup-secret-2024';
        
        // Allow in development or with correct secret key
        if (!isDevelopment && secretKey !== expectedKey) {
            return NextResponse.redirect(new URL('/404', request.url));
        }
    }
    
    return NextResponse.next();
}

export const config = {
    matcher: ['/setup-admin/:path*'],
};
