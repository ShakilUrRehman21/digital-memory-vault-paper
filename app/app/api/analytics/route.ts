import { NextRequest, NextResponse } from 'next/server';
import { computeAnalytics } from '@/lib/analytics';

export async function GET(request: NextRequest) {
    try {
        const userId = request.headers.get('x-user-id')!;
        const analytics = await computeAnalytics(userId);
        return NextResponse.json(analytics);
    } catch (error) {
        console.error('Analytics error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
