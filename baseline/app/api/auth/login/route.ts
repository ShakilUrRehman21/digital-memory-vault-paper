import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { comparePassword } from '@/lib/auth/password';
import { signJWT } from '@/lib/auth/jwt';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { eq } from 'drizzle-orm';

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
    try {
        // Rate limiting
        const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
        if (!checkRateLimit(ip)) {
            return NextResponse.json({ error: 'Too many login attempts. Try again in 1 minute.' }, { status: 429 });
        }

        const body = await request.json();
        const parsed = loginSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }

        const { email, password } = parsed.data;

        // Find user
        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        // Verify password
        const isValid = await comparePassword(password, user.passwordHash);
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        // Sign JWT and set cookie
        const token = await signJWT({ userId: user.id, email: user.email });
        const response = NextResponse.json({
            message: 'Login successful',
            user: { id: user.id, email: user.email, fullName: user.fullName },
        });

        response.cookies.set('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
