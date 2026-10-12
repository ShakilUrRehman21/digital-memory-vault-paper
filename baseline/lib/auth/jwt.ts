import { SignJWT, jwtVerify } from 'jose';

const JWT_EXPIRES_IN = '7d';

export interface JWTPayload {
    userId: string;
    email: string;
}

function getSecret() {
    const secret = process.env.JWT_SECRET!;
    return new TextEncoder().encode(secret);
}

export async function signJWT(payload: JWTPayload): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRES_IN)
        .sign(getSecret());
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getSecret());
        return { userId: payload.userId as string, email: payload.email as string };
    } catch {
        return null;
    }
}
