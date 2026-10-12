// Baseline scoring rules, extracted verbatim (as pure functions) from baseline/lib/analytics/index.ts, so that
// the offline experiments can compare the baseline and revised rules on identical inputs.
// The differential check in evaluation/scores/differential.mjs confirms that these functions reproduce the
// scores returned by the running baseline API.

export type RiskLevel = 'low' | 'medium' | 'high';
export type EmotionalState = 'calm' | 'stressed' | 'excited' | 'pressured' | 'uncertain';
export interface ScoredDecision {
    confidence: number;
    success: number | null;
    risk: RiskLevel;
    emotionalState: EmotionalState;
    reflection?: string | null;
}

const KEYWORDS = ['rushed', 'pressured', 'anxious', 'overconfident', 'doubt', 'reactive', 'panic', 'fear', 'desperate', 'impulsive', 'hasty', 'regret'];

export function computeBaselineScores(all: ScoredDecision[]) {
    const done = all.filter((d) => d.success !== null && d.success !== undefined).map((d) => ({ ...d, s: d.success as number }));
    let decisionAccuracyScore = 0;
    if (done.length > 0) {
        const scores = done.map((d) => Math.max(0, 100 - Math.abs(d.confidence - d.s) * 10));
        decisionAccuracyScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }
    let riskCalibrationScore = 0, highRiskSuccessRate = 0, lowRiskSuccessRate = 0;
    const high = done.filter((d) => d.risk === 'high');
    const low = done.filter((d) => d.risk === 'low');
    if (high.length > 0) highRiskSuccessRate = Math.round((high.reduce((a, d) => a + d.s, 0) / high.length / 10) * 100);
    if (low.length > 0) lowRiskSuccessRate = Math.round((low.reduce((a, d) => a + d.s, 0) / low.length / 10) * 100);
    if (high.length > 0 && low.length > 0) riskCalibrationScore = Math.round((highRiskSuccessRate + lowRiskSuccessRate) / 2);
    else if (high.length > 0) riskCalibrationScore = highRiskSuccessRate;
    else if (low.length > 0) riskCalibrationScore = lowRiskSuccessRate;
    let confidenceCalibrationScore = 0, overconfidenceRate = 0, underconfidenceRate = 0;
    if (done.length > 0) {
        overconfidenceRate = Math.round((done.filter((d) => d.confidence > d.s + 1).length / done.length) * 100);
        underconfidenceRate = Math.round((done.filter((d) => d.confidence < d.s - 1).length / done.length) * 100);
        const avgConf = done.reduce((a, d) => a + d.confidence, 0) / done.length;
        const avgOut = done.reduce((a, d) => a + d.s, 0) / done.length;
        confidenceCalibrationScore = Math.max(0, Math.round(100 - Math.abs(avgConf - avgOut) * 10));
    }
    let emotionalBiasScore = 0;
    if (all.length > 0) {
        let total = 0;
        for (const d of all) {
            let bias = ['stressed', 'pressured', 'uncertain'].includes(d.emotionalState) ? 40 : 0;
            if (d.success !== null && d.success !== undefined && d.reflection) {
                const r = d.reflection.toLowerCase();
                for (const kw of KEYWORDS) if (r.includes(kw)) bias += 10;
            }
            total += Math.min(100, bias);
        }
        emotionalBiasScore = Math.round(total / all.length);
    }
    return { decisionAccuracyScore, confidenceCalibrationScore, riskCalibrationScore, emotionalBiasScore, overconfidenceRate, underconfidenceRate, highRiskSuccessRate, lowRiskSuccessRate };
}
