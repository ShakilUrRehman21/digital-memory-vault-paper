// Simple in-memory rate limiter (per IP, per minute)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const window = 60 * 1000; // 1 minute
    const maxAttempts = 5;

    const entry = loginAttempts.get(ip);
    if (!entry || now > entry.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + window });
        return true;
    }
    if (entry.count >= maxAttempts) {
        return false;
    }
    entry.count++;
    return true;
}
