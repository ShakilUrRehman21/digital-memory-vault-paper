import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { decisions, outcomes } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const outcomeSchema = z.object({
    actualOutcome: z.string().min(10),
    successRating: z.number().int().min(1).max(10),
    lessonLearned: z.string().min(5),
    reflection: z.string().min(5),
    outcomeDate: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = request.headers.get('x-user-id')!;

        // Verify ownership
        const [decision] = await db.select().from(decisions)
            .where(and(eq(decisions.id, id), eq(decisions.userId, userId)))
            .limit(1);
        if (!decision) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        if (decision.status === 'outcome_recorded') {
            return NextResponse.json({ error: 'Outcome already recorded' }, { status: 409 });
        }

        const body = await request.json();
        const parsed = outcomeSchema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

        const [outcome] = await db.insert(outcomes).values({
            decisionId: id,
            actualOutcome: parsed.data.actualOutcome,
            successRating: parsed.data.successRating,
            lessonLearned: parsed.data.lessonLearned,
            reflection: parsed.data.reflection,
            outcomeDate: parsed.data.outcomeDate ? new Date(parsed.data.outcomeDate) : new Date(),
        }).returning();

        // Update decision status
        await db.update(decisions)
            .set({ status: 'outcome_recorded' } as any)
            .where(eq(decisions.id, id));

        return NextResponse.json({ outcome }, { status: 201 });
    } catch (error) {
        console.error('Outcome error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
