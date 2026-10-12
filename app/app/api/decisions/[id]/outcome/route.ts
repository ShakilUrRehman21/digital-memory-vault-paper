import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { decisions, outcomes } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const outcomeSchema = z.object({
    actualOutcome: z.string().min(10),
    successRating: z.number().int().min(1).max(10),
    decisionQuality: z.number().int().min(1).max(10).optional(),
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

        const outcomeDate = parsed.data.outcomeDate ? new Date(parsed.data.outcomeDate) : new Date();
        if (Number.isNaN(outcomeDate.getTime())) {
            return NextResponse.json({ error: 'Invalid outcome date' }, { status: 400 });
        }
        // An outcome cannot be known before the prediction was logged (compared by calendar day).
        if (outcomeDate.toISOString().slice(0, 10) < decision.createdAt.toISOString().slice(0, 10)) {
            return NextResponse.json({ error: 'The outcome date is earlier than the date the decision was logged' }, { status: 400 });
        }

        // Claim the decision atomically: only one request can move it from pending to resolved.
        const [claimed] = await db.update(decisions)
            .set({ status: 'outcome_recorded' })
            .where(and(eq(decisions.id, id), eq(decisions.status, 'pending_outcome')))
            .returning({ id: decisions.id });
        if (!claimed) {
            return NextResponse.json({ error: 'Outcome already recorded' }, { status: 409 });
        }

        let outcome;
        try {
            [outcome] = await db.insert(outcomes).values({
                decisionId: id,
                actualOutcome: parsed.data.actualOutcome,
                successRating: parsed.data.successRating,
                decisionQuality: parsed.data.decisionQuality ?? null,
                lessonLearned: parsed.data.lessonLearned,
                reflection: parsed.data.reflection,
                outcomeDate,
            }).returning();
        } catch (insertError) {
            // Release the claim so the user can try again; the unique index still guarantees one outcome.
            await db.update(decisions).set({ status: 'pending_outcome' }).where(eq(decisions.id, id));
            throw insertError;
        }

        return NextResponse.json({ outcome }, { status: 201 });
    } catch (error) {
        console.error('Outcome error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
