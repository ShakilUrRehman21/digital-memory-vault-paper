// Scoring rules for Digital Memory Vault.
//
// This module is pure: it has no imports and no I/O, so the same code runs in the API route, in the unit,
// property-based and metamorphic tests, and in the offline simulation and replay scripts of the evaluation kit.
// It uses only type annotations that Node.js can strip, so `node file.ts` runs it directly (Node >= 22.18).
//
// Differences from the baseline rules (evaluation/baseline-rules/baseline-scores.ts):
//  - Confidence calibration is computed per confidence level (a binned calibration error, as in a reliability
//    diagram) instead of comparing the overall mean confidence with the overall mean success rating, so errors
//    in opposite directions no longer cancel.
//  - Risk calibration compares confidence with success within each risk level (low, medium and high) instead
//    of averaging success ratings, so it now depends on confidence and includes medium-risk decisions.
//  - Emotional bias matches whole words and simple inflections, ignores warning words preceded by a negation
//    ("no regrets", "not anxious"), no longer matches inside longer words ("fearless"), and counts an excited
//    state like the other non-calm states.
//  - The result reports whether the history is long enough for the calibration scores to be informative.
//  Decision accuracy and the over- and underconfidence rates are unchanged.

export type RiskLevel = 'low' | 'medium' | 'high';
export type EmotionalState = 'calm' | 'stressed' | 'excited' | 'pressured' | 'uncertain';

export interface ScoredDecision {
    confidence: number; // 1-10, recorded before the outcome
    success: number | null; // 1-10 success rating, or null while the outcome is pending
    risk: RiskLevel;
    emotionalState: EmotionalState;
    reflection?: string | null;
}

export interface GroupCalibration {
    n: number;
    meanConfidence: number;
    meanSuccess: number;
    gap: number; // mean confidence minus mean success, in steps
}

export interface Scores {
    decisionAccuracyScore: number;
    confidenceCalibrationScore: number;
    riskCalibrationScore: number;
    emotionalBiasScore: number;
    overconfidenceRate: number;
    underconfidenceRate: number;
    highRiskSuccessRate: number;
    lowRiskSuccessRate: number;
    meanConfidenceGap: number; // signed: positive = overconfident on average
    calibrationError: number; // binned calibration error in steps (0 = perfectly calibrated)
    riskCalibrationError: number; // within-risk-level calibration error in steps
    calibrationByRisk: Record<RiskLevel, GroupCalibration | null>;
    resolvedDecisions: number;
    minimumHistory: number;
    sufficientHistory: boolean;
}

// Shortest history at which every two-step miscalibration (uniform over- or underconfidence, risk-dependent
// inconsistency, case-to-case noise with SD 2) is flagged with at least 80% sensitivity at 95% specificity by at
// least one of the two calibration scores, in the simulation study (evaluation/scores/power.mjs).
export const MINIMUM_HISTORY = 20;

export const WARNING_WORDS = [
    'rushed', 'pressured', 'anxious', 'overconfident', 'doubt', 'reactive',
    'panic', 'fear', 'desperate', 'impulsive', 'hasty', 'regret',
];
const INFLECTIONS = ['', 's', 'es', 'ed', 'd', 'ing', 'ly', 'ful', 'fully', 'fulness', 'ted', 'ting', 'ked', 'king', 'ness'];
const NEGATIONS = ['no', 'not', 'never', 'without', 'zero', 'nor', "didn't", "don't", "wasn't", "isn't", "weren't", 'didnt', 'dont', 'wasnt', 'isnt'];
const NEGATION_WINDOW = 3;
export const AFFECTIVE_STATES: EmotionalState[] = ['stressed', 'pressured', 'uncertain', 'excited'];
const STATE_POINTS = 40;
const WORD_POINTS = 10;
const POINTS_PER_STEP = 10;

const round = (x: number) => Math.round(x);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const toScore = (errorInSteps: number) => Math.max(0, round(100 - POINTS_PER_STEP * errorInSteps));

export function tokenize(text: string): string[] {
    return text.toLowerCase().replace(/[’`]/g, "'").split(/[^a-z']+/).filter((t) => t.length > 0);
}

export function matchesWarningWord(token: string, word: string): boolean {
    if (!token.startsWith(word)) return false;
    return INFLECTIONS.includes(token.slice(word.length));
}

// Warning words found in a reflection, each counted once, ignoring words preceded by a negation.
export function warningWordsIn(reflection: string): string[] {
    const tokens = tokenize(reflection);
    const found = new Set<string>();
    tokens.forEach((token, i) => {
        for (const word of WARNING_WORDS) {
            if (!matchesWarningWord(token, word)) continue;
            const window = tokens.slice(Math.max(0, i - NEGATION_WINDOW), i);
            if (window.some((w) => NEGATIONS.includes(w))) continue;
            found.add(word);
        }
    });
    return [...found];
}

export function emotionalBiasPoints(d: ScoredDecision): number {
    let points = AFFECTIVE_STATES.includes(d.emotionalState) ? STATE_POINTS : 0;
    if (d.reflection) points += WORD_POINTS * warningWordsIn(d.reflection).length;
    return Math.min(100, points);
}

// Group statistics are computed from integer sums, so results do not depend on the order of decisions
// (floating-point summation is not associative; property-based testing found this during development).
interface Group { n: number; sumC: number; sumS: number }

function summarise(pairs: { c: number; s: number }[]): Group {
    let sumC = 0, sumS = 0;
    for (const p of pairs) { sumC += p.c; sumS += p.s; }
    return { n: pairs.length, sumC, sumS };
}

function groupCalibration(g: Group): GroupCalibration | null {
    if (g.n === 0) return null;
    return { n: g.n, meanConfidence: g.sumC / g.n, meanSuccess: g.sumS / g.n, gap: (g.sumC - g.sumS) / g.n };
}

// Weighted mean absolute gap across groups, in steps: sum over groups of (n_g / N) * |gap_g| = sum |sumC - sumS| / N.
function weightedGroupError(groups: Group[], total: number): number {
    let numerator = 0;
    for (const g of groups) numerator += Math.abs(g.sumC - g.sumS);
    return numerator / total;
}

export function computeScores(all: ScoredDecision[]): Scores {
    const resolved = all
        .filter((d) => d.success !== null && d.success !== undefined)
        .map((d) => ({ c: d.confidence, s: d.success as number, risk: d.risk }));
    const n = resolved.length;

    const empty: Record<RiskLevel, GroupCalibration | null> = { low: null, medium: null, high: null };
    const result: Scores = {
        decisionAccuracyScore: 0, confidenceCalibrationScore: 0, riskCalibrationScore: 0, emotionalBiasScore: 0,
        overconfidenceRate: 0, underconfidenceRate: 0, highRiskSuccessRate: 0, lowRiskSuccessRate: 0,
        meanConfidenceGap: 0, calibrationError: 0, riskCalibrationError: 0, calibrationByRisk: empty,
        resolvedDecisions: n, minimumHistory: MINIMUM_HISTORY, sufficientHistory: n >= MINIMUM_HISTORY,
    };

    if (all.length > 0) {
        result.emotionalBiasScore = round(mean(all.map(emotionalBiasPoints)));
    }
    if (n === 0) return result;

    // Decision accuracy (unchanged): per-decision agreement between confidence and success.
    result.decisionAccuracyScore = round(mean(resolved.map((p) => Math.max(0, 100 - POINTS_PER_STEP * Math.abs(p.c - p.s)))));

    // Over- and underconfidence rates (unchanged).
    // Same arithmetic order as the baseline, so that rounding is identical.
    result.overconfidenceRate = round((resolved.filter((p) => p.c > p.s + 1).length / n) * 100);
    result.underconfidenceRate = round((resolved.filter((p) => p.c < p.s - 1).length / n) * 100);
    const overall = summarise(resolved);
    result.meanConfidenceGap = (overall.sumC - overall.sumS) / n;

    // Confidence calibration: group by stated confidence level, compare with the mean success in each group.
    const byLevel = new Map<number, { c: number; s: number }[]>();
    for (const p of resolved) {
        const g = byLevel.get(p.c) ?? [];
        g.push(p);
        byLevel.set(p.c, g);
    }
    result.calibrationError = weightedGroupError([...byLevel.values()].map(summarise), n);
    result.confidenceCalibrationScore = toScore(result.calibrationError);

    // Risk calibration: compare confidence with success within each risk level.
    const riskGroups = {
        low: summarise(resolved.filter((p) => p.risk === 'low')),
        medium: summarise(resolved.filter((p) => p.risk === 'medium')),
        high: summarise(resolved.filter((p) => p.risk === 'high')),
    };
    const byRisk: Record<RiskLevel, GroupCalibration | null> = {
        low: groupCalibration(riskGroups.low),
        medium: groupCalibration(riskGroups.medium),
        high: groupCalibration(riskGroups.high),
    };
    result.calibrationByRisk = byRisk;
    result.riskCalibrationError = weightedGroupError([riskGroups.low, riskGroups.medium, riskGroups.high], n);
    result.riskCalibrationScore = toScore(result.riskCalibrationError);

    // Success rates by risk (descriptive, unchanged).
    if (byRisk.high) result.highRiskSuccessRate = round((byRisk.high.meanSuccess / 10) * 100);
    if (byRisk.low) result.lowRiskSuccessRate = round((byRisk.low.meanSuccess / 10) * 100);

    return result;
}
