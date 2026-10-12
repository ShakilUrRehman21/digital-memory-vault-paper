import { db } from '@/lib/db';
import { decisions, outcomes, decisionMetrics } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { computeScores, type GroupCalibration, type RiskLevel } from './scores';

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
    meanConfidenceGap: number;
    calibrationError: number;
    riskCalibrationError: number;
    calibrationByRisk: Record<RiskLevel, GroupCalibration | null>;
    minimumHistory: number;
    sufficientHistory: boolean;
    decisionsByCategory: Record<string, number>;
    confidenceVsOutcome: Array<{ confidence: number; outcome: number; title: string; date: string; risk: string }>;
    monthlyTrend: Array<{ month: string; count: number; avgScore: number }>;
    emotionalDistribution: Record<string, number>;
    riskDistribution: Record<string, number>;
}

export async function computeAnalytics(userId: string): Promise<AnalyticsResult> {
    // One query for decisions and their outcomes (the baseline issued one outcome query per decision).
    const rows = await db
        .select({ decision: decisions, outcome: outcomes })
        .from(decisions)
        .leftJoin(outcomes, eq(outcomes.decisionId, decisions.id))
        .where(eq(decisions.userId, userId));

    const allDecisions = rows.map((r) => r.decision);
    const completed = rows.filter((r) => r.decision.status === 'outcome_recorded' && r.outcome != null);
    const total = allDecisions.length;
    const pending = allDecisions.filter((d) => d.status === 'pending_outcome').length;

    const scores = computeScores(rows.map(({ decision, outcome }) => ({
        confidence: decision.confidenceLevel,
        success: decision.status === 'outcome_recorded' && outcome ? outcome.successRating : null,
        risk: decision.riskLevel,
        emotionalState: decision.emotionalState,
        reflection: outcome?.reflection ?? null,
    })));

    const decisionsByCategory: Record<string, number> = {};
    const riskDistribution: Record<string, number> = { low: 0, medium: 0, high: 0 };
    const emotionalDistribution: Record<string, number> = {};
    for (const d of allDecisions) {
        decisionsByCategory[d.category] = (decisionsByCategory[d.category] || 0) + 1;
        riskDistribution[d.riskLevel]++;
        emotionalDistribution[d.emotionalState] = (emotionalDistribution[d.emotionalState] || 0) + 1;
    }

    const confidenceVsOutcome = completed.map(({ decision, outcome }) => ({
        confidence: decision.confidenceLevel,
        outcome: outcome!.successRating,
        title: decision.title,
        date: decision.decisionDate.toISOString(),
        risk: decision.riskLevel,
    }));

    const monthlyMap = new Map<string, { count: number; totalScore: number }>();
    for (const { decision, outcome } of completed) {
        const month = decision.decisionDate.toISOString().substring(0, 7);
        const entry = monthlyMap.get(month) || { count: 0, totalScore: 0 };
        entry.count++;
        entry.totalScore += outcome!.successRating;
        monthlyMap.set(month, entry);
    }
    const monthlyTrend = Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, { count, totalScore }]) => ({ month, count, avgScore: Math.round(totalScore / count) }));

    // At most one snapshot per user per day: the latest scores of the day replace earlier ones.
    if (completed.length > 0) {
        const values = {
            userId,
            decisionAccuracyScore: scores.decisionAccuracyScore,
            riskCalibrationScore: scores.riskCalibrationScore,
            emotionalBiasScore: scores.emotionalBiasScore,
            confidenceCalibrationScore: scores.confidenceCalibrationScore,
        };
        await db.insert(decisionMetrics).values(values).onConflictDoUpdate({
            target: [decisionMetrics.userId, decisionMetrics.snapshotDay],
            set: { ...values, snapshotDate: sql`now()` },
        });
    }

    return {
        decisionAccuracyScore: scores.decisionAccuracyScore,
        riskCalibrationScore: scores.riskCalibrationScore,
        emotionalBiasScore: scores.emotionalBiasScore,
        confidenceCalibrationScore: scores.confidenceCalibrationScore,
        totalDecisions: total,
        pendingDecisions: pending,
        completedDecisions: completed.length,
        overconfidenceRate: scores.overconfidenceRate,
        underconfidenceRate: scores.underconfidenceRate,
        highRiskSuccessRate: scores.highRiskSuccessRate,
        lowRiskSuccessRate: scores.lowRiskSuccessRate,
        meanConfidenceGap: scores.meanConfidenceGap,
        calibrationError: scores.calibrationError,
        riskCalibrationError: scores.riskCalibrationError,
        calibrationByRisk: scores.calibrationByRisk,
        minimumHistory: scores.minimumHistory,
        sufficientHistory: scores.sufficientHistory,
        decisionsByCategory,
        confidenceVsOutcome,
        monthlyTrend,
        emotionalDistribution,
        riskDistribution,
    };
}
