import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyJWT } from '@/lib/auth/jwt';
import { db } from '@/lib/db';
import { decisions, outcomes, users } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import DashboardClient from '@/components/dashboard/DashboardClient';

export default async function DashboardPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) redirect('/auth/login');
    const payload = await verifyJWT(token);
    if (!payload) redirect('/auth/login');

    // SSR data fetch
    const [user] = await db.select({ id: users.id, email: users.email, fullName: users.fullName })
        .from(users).where(eq(users.id, payload.userId)).limit(1);

    if (!user) redirect('/auth/login');

    const allDecisions = await db.select().from(decisions)
        .where(eq(decisions.userId, payload.userId))
        .orderBy(desc(decisions.decisionDate));

    const decisionIds = allDecisions.map((d) => d.id);
    let allOutcomes: any[] = [];
    if (decisionIds.length > 0) {
        const outcomeResults = await Promise.all(
            decisionIds.map((id) => db.select().from(outcomes).where(eq(outcomes.decisionId, id)))
        );
        allOutcomes = outcomeResults.flat();
    }

    return (
        <DashboardClient
            user={user}
            initialDecisions={allDecisions}
            initialOutcomes={allOutcomes}
        />
    );
}
