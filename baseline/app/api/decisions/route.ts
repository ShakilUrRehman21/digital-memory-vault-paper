import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { decisions } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

const createDecisionSchema = z.object({
    title: z.string().min(3).max(500),
    category: z.enum(['career', 'finance', 'health', 'product', 'personal']),
    description: z.string().min(10),
    expectedOutcome: z.string().min(10),
    confidenceLevel: z.number().int().min(1).max(10),
    emotionalState: z.enum(['calm', 'stressed', 'excited', 'pressured', 'uncertain']),
    riskLevel: z.enum(['low', 'medium', 'high']),
    decisionDate: z.string(),
});

export async function GET(request: NextRequest) {
    const userId = request.headers.get('x-user-id')!;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let query = db.select().from(decisions).where(eq(decisions.userId, userId));

    const allDecisions = await db
        .select()
        .from(decisions)
        .where(category ? and(eq(decisions.userId, userId), eq(decisions.category, category as any)) : eq(decisions.userId, userId))
        .orderBy(desc(decisions.decisionDate));

    return NextResponse.json({ decisions: allDecisions });
}

export async function POST(request: NextRequest) {
    try {
        const userId = request.headers.get('x-user-id')!;
        const body = await request.json();
        const parsed = createDecisionSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }

        const data = parsed.data;
        const [decision] = await db.insert(decisions).values({
            userId,
            title: data.title,
            category: data.category,
            description: data.description,
            expectedOutcome: data.expectedOutcome,
            confidenceLevel: data.confidenceLevel,
            emotionalState: data.emotionalState,
            riskLevel: data.riskLevel,
            decisionDate: new Date(data.decisionDate),
        }).returning();

        return NextResponse.json({ decision }, { status: 201 });
    } catch (error) {
        console.error('Create decision error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
