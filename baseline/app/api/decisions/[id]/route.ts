import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { decisions, outcomes } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const updateDecisionSchema = z.object({
    title: z.string().min(3).max(500).optional(),
    category: z.enum(['career', 'finance', 'health', 'product', 'personal']).optional(),
    description: z.string().min(10).optional(),
    expectedOutcome: z.string().min(10).optional(),
    confidenceLevel: z.number().int().min(1).max(10).optional(),
    emotionalState: z.enum(['calm', 'stressed', 'excited', 'pressured', 'uncertain']).optional(),
    riskLevel: z.enum(['low', 'medium', 'high']).optional(),
    decisionDate: z.string().optional(),
});

async function getDecisionOrForbid(id: string, userId: string) {
    const [decision] = await db.select().from(decisions)
        .where(and(eq(decisions.id, id), eq(decisions.userId, userId)))
        .limit(1);
    return decision ?? null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const userId = request.headers.get('x-user-id')!;
    const decision = await getDecisionOrForbid(id, userId);
    if (!decision) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [outcome] = await db.select().from(outcomes).where(eq(outcomes.decisionId, id)).limit(1);
    return NextResponse.json({ decision, outcome: outcome ?? null });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = request.headers.get('x-user-id')!;
        const existing = await getDecisionOrForbid(id, userId);
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const body = await request.json();
        const parsed = updateDecisionSchema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

        const updateData: any = { ...parsed.data };
        if (parsed.data.decisionDate) updateData.decisionDate = new Date(parsed.data.decisionDate);

        const [updated] = await db.update(decisions)
            .set({ ...updateData, updatedAt: new Date() } as any)
            .where(eq(decisions.id, id))
            .returning();

        return NextResponse.json({ decision: updated });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const userId = request.headers.get('x-user-id')!;
    const existing = await getDecisionOrForbid(id, userId);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.delete(decisions).where(eq(decisions.id, id));
    return NextResponse.json({ message: 'Decision deleted' });
}
