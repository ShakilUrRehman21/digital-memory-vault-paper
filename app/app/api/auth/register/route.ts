import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { signJWT } from '@/lib/auth/jwt';
import { eq } from 'drizzle-orm';

const registerSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = registerSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0].message },
                { status: 400 }
            );
        }

        const { email, password, fullName } = parsed.data;

        // Check if user already exists
        const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (existing.length > 0) {
            return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create user
        const [user] = await db.insert(users).values({ email, passwordHash, fullName }).returning();

        // Sign JWT and set cookie
        const token = await signJWT({ userId: user.id, email: user.email });
        const response = NextResponse.json(
            { message: 'Account created successfully', user: { id: user.id, email: user.email, fullName: user.fullName } },
            { status: 201 }
        );

        response.cookies.set('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Register error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
