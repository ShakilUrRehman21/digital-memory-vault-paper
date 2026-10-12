import { db } from '@/lib/db';
import { decisions, outcomes, decisionMetrics } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const EMOTIONAL_BIAS_KEYWORDS = [
    'rushed', 'pressured', 'anxious', 'overconfident', 'doubt', 'reactive',
    'panic', 'fear', 'desperate', 'impulsive', 'hasty', 'regret',
];

export interface AnalyticsResult {
    decisionAccuracyScore: number;
    riskCalibrationScore: number;
    emotionalBiasScore: number;
    confidenceCalibrationScore: number;
    totalDecisions: number;
    pendingDecisions: number;
    completedDecisions: number;
    overconfidenceRate: number;
    underconfidenceRate: number;
    highRiskSuccessRate: number;
    lowRiskSuccessRate: number;
    decisionsByCategory: Record<string, number>;
    confidenceVsOutcome: Array<{ confidence: number; outcome: number; title: string; date: string }>;
    monthlyTrend: Array<{ month: string; count: number; avgScore: number }>;
    emotionalDistribution: Record<string, number>;
    riskDistribution: Record<string, number>;
}

export async function computeAnalytics(userId: string): Promise<AnalyticsResult> {
    // Fetch all decisions for user
    const allDecisions = await db.select().from(decisions).where(eq(decisions.userId, userId));
    const total = allDecisions.length;
    const pending = allDecisions.filter((d) => d.status === 'pending_outcome').length;
    const completed = allDecisions.filter((d) => d.status === 'outcome_recorded').length;

    // Fetch all outcomes for this user's decisions
    const decisionIds = allDecisions.map((d) => d.id);
    let allOutcomes: typeof outcomes.$inferSelect[] = [];
    if (decisionIds.length > 0) {
        const outcomeResults = await Promise.all(
            decisionIds.map((id) => db.select().from(outcomes).where(eq(outcomes.decisionId, id)))
        );
        allOutcomes = outcomeResults.flat();
    }

    // Join decisions with outcomes
    const completed_decisions = allDecisions
        .filter((d) => d.status === 'outcome_recorded')
        .map((d) => ({
            decision: d,
            outcome: allOutcomes.find((o) => o.decisionId === d.id),
        }))
        .filter((x) => x.outcome != null);

    // 1. Decision Accuracy Score
    let decisionAccuracyScore = 0;
    if (completed_decisions.length > 0) {
        const scores = completed_decisions.map(({ decision, outcome }) => {
            const gap = Math.abs(decision.confidenceLevel - outcome!.successRating);
            return Math.max(0, 100 - gap * 10);
        });
        decisionAccuracyScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    // 2. Risk Calibration Score
    let riskCalibrationScore = 0;
    let highRiskSuccessRate = 0;
    let lowRiskSuccessRate = 0;
    const highRisk = completed_decisions.filter((x) => x.decision.riskLevel === 'high');
    const lowRisk = completed_decisions.filter((x) => x.decision.riskLevel === 'low');

    if (highRisk.length > 0) {
        const avgHigh = highRisk.reduce((a, x) => a + x.outcome!.successRating, 0) / highRisk.length;
        highRiskSuccessRate = Math.round((avgHigh / 10) * 100);
    }
    if (lowRisk.length > 0) {
        const avgLow = lowRisk.reduce((a, x) => a + x.outcome!.successRating, 0) / lowRisk.length;
        lowRiskSuccessRate = Math.round((avgLow / 10) * 100);
    }

    if (highRisk.length > 0 && lowRisk.length > 0) {
        // Good calibration = high risk should have lower success OR similar gap that makes sense
        // Normalize: penalise if high risk worse than expected gap
        riskCalibrationScore = Math.round((highRiskSuccessRate + lowRiskSuccessRate) / 2);
    } else if (highRisk.length > 0) {
        riskCalibrationScore = highRiskSuccessRate;
    } else if (lowRisk.length > 0) {
        riskCalibrationScore = lowRiskSuccessRate;
    }

    // 3. Confidence Calibration
    let confidenceCalibrationScore = 0;
    let overconfidenceRate = 0;
    let underconfidenceRate = 0;
    if (completed_decisions.length > 0) {
        const overconfident = completed_decisions.filter(
            (x) => x.decision.confidenceLevel > x.outcome!.successRating + 1
        );
        const underconfident = completed_decisions.filter(
            (x) => x.decision.confidenceLevel < x.outcome!.successRating - 1
        );
        overconfidenceRate = Math.round((overconfident.length / completed_decisions.length) * 100);
        underconfidenceRate = Math.round((underconfident.length / completed_decisions.length) * 100);

        const avgConf = completed_decisions.reduce((a, x) => a + x.decision.confidenceLevel, 0) / completed_decisions.length;
        const avgOutcome = completed_decisions.reduce((a, x) => a + x.outcome!.successRating, 0) / completed_decisions.length;
        const gap = avgConf - avgOutcome;
        // Perfect calibration = 100, each unit gap reduces by 10
        confidenceCalibrationScore = Math.max(0, Math.round(100 - Math.abs(gap) * 10));
    }

    // 4. Emotional Bias Score
    let emotionalBiasScore = 0;
    if (allDecisions.length > 0) {
        const biasedStates = ['stressed', 'pressured', 'uncertain'];
        let totalBias = 0;
        allDecisions.forEach((d) => {
            let bias = 0;
            if (biasedStates.includes(d.emotionalState)) bias += 40;
            // Check completed decisions' reflections
            const outcome = allOutcomes.find((o) => o.decisionId === d.id);
            if (outcome) {
                const reflection = outcome.reflection.toLowerCase();
                EMOTIONAL_BIAS_KEYWORDS.forEach((kw) => {
                    if (reflection.includes(kw)) bias += 10;
                });
            }
            totalBias += Math.min(100, bias);
        });
        emotionalBiasScore = Math.round(totalBias / allDecisions.length);
    }

    // Category distribution
    const decisionsByCategory: Record<string, number> = {};
    allDecisions.forEach((d) => {
        decisionsByCategory[d.category] = (decisionsByCategory[d.category] || 0) + 1;
    });

    // Risk distribution
    const riskDistribution: Record<string, number> = { low: 0, medium: 0, high: 0 };
    allDecisions.forEach((d) => {
        riskDistribution[d.riskLevel]++;
    });

    // Emotional distribution
    const emotionalDistribution: Record<string, number> = {};
    allDecisions.forEach((d) => {
        emotionalDistribution[d.emotionalState] = (emotionalDistribution[d.emotionalState] || 0) + 1;
    });

    // Confidence vs Outcome scatter data
    const confidenceVsOutcome = completed_decisions.map(({ decision, outcome }) => ({
        confidence: decision.confidenceLevel,
        outcome: outcome!.successRating,
        title: decision.title,
        date: decision.decisionDate.toISOString(),
    }));

    // Monthly trend
    const monthlyMap = new Map<string, { count: number; totalScore: number }>();
    completed_decisions.forEach(({ decision, outcome }) => {
        const month = decision.decisionDate.toISOString().substring(0, 7);
        const entry = monthlyMap.get(month) || { count: 0, totalScore: 0 };
        entry.count++;
        entry.totalScore += outcome!.successRating;
        monthlyMap.set(month, entry);
    });
    const monthlyTrend = Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, { count, totalScore }]) => ({
            month,
            count,
            avgScore: Math.round(totalScore / count),
        }));

    // Save snapshot
    if (completed_decisions.length > 0) {
        await db.insert(decisionMetrics).values({
            userId,
            decisionAccuracyScore,
            riskCalibrationScore,
            emotionalBiasScore,
            confidenceCalibrationScore,
        });
    }

    return {
        decisionAccuracyScore,
        riskCalibrationScore,
        emotionalBiasScore,
        confidenceCalibrationScore,
        totalDecisions: total,
        pendingDecisions: pending,
        completedDecisions: completed,
        overconfidenceRate,
        underconfidenceRate,
        highRiskSuccessRate,
        lowRiskSuccessRate,
        decisionsByCategory,
        confidenceVsOutcome,
        monthlyTrend,
        emotionalDistribution,
        riskDistribution,
    };
}
