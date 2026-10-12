// Generative models of synthetic decision histories, shared by the score experiments.
//
// Every decision has an underlying quality q drawn uniformly from a range that depends on its risk level
// (low 6-9, medium 4-7, high 2-6). The success rating is q plus normal noise
// (SD 1.5), rounded and kept within 1-10. Profiles differ only in the confidence they report.
//
// Two families of reporters are used:
//  * NOISY_PROFILES (used through the API): confidence = q + bias + N(0, 1).
//    Because of the added noise, the "Calibrated" profile there is calibrated on average only.
//  * makeProfile/history (used offline) define a calibrated reporter as one whose stated confidence equals the
//    rounded quality, so that the mean success rating at each confidence level equals that confidence
//    (apart from clamping at 1 and 10). Biased, inconsistent and noisy reporters are defined relative to it.
import { mulberry32, normal, clamp10 } from '../lib/common.mjs';

export const RISKS = ['low', 'medium', 'high'];
export const QUALITY = { low: [6, 9], medium: [4, 7], high: [2, 6] };

export const NOISY_PROFILES = [
  { name: 'Calibrated', bias: { low: 0, medium: 0, high: 0 } },
  { name: 'Overconfident', bias: { low: 2, medium: 2, high: 2 } },
  { name: 'Underconfident', bias: { low: -2, medium: -2, high: -2 } },
  { name: 'Inconsistent', bias: { low: -3, medium: 0, high: 3 } },
];

// Noisy-reporter generator: one RNG stream per user, risk cycles low/medium/high.
export function noisyHistory(profile, seed, n = 40) {
  const rng = mulberry32(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const risk = RISKS[i % 3];
    const [lo, hi] = QUALITY[risk];
    const q = lo + (hi - lo) * rng();
    const success = clamp10(q + 1.5 * normal(rng));
    const confidence = clamp10(q + profile.bias[risk] + 1.0 * normal(rng));
    out.push({ confidence, success, risk, emotionalState: 'calm', reflection: 'Outcome noted.' });
  }
  return out;
}

// Revised profiles. `shift` is added to the rounded quality per risk level; `noise` is the SD of extra
// case-to-case noise in the reported confidence.
export function makeProfile(kind, size) {
  switch (kind) {
    case 'calibrated': return { kind, size: 0, label: 'Calibrated', shift: { low: 0, medium: 0, high: 0 }, noise: 0 };
    case 'over': return { kind, size, label: `Overconfident (+${size})`, shift: { low: size, medium: size, high: size }, noise: 0 };
    case 'under': return { kind, size, label: `Underconfident (-${size})`, shift: { low: -size, medium: -size, high: -size }, noise: 0 };
    case 'inconsistent': return { kind, size, label: `Inconsistent (+/-${size})`, shift: { low: -size, medium: 0, high: size }, noise: 0 };
    case 'noisy': return { kind, size, label: `Noisy (SD ${size})`, shift: { low: 0, medium: 0, high: 0 }, noise: size };
    default: throw new Error(kind);
  }
}

// Outcomes depend only on (seed, n), so every profile with the same seed shares identical outcomes;
// confidence noise uses a separate stream so that it does not disturb the outcomes.
export function history(profile, seed, n) {
  const rngOutcome = mulberry32(seed);
  const rngConf = mulberry32(seed ^ 0x5bd1e995);
  const out = [];
  for (let i = 0; i < n; i++) {
    const risk = RISKS[i % 3];
    const [lo, hi] = QUALITY[risk];
    const q = lo + (hi - lo) * rngOutcome();
    const success = clamp10(q + 1.5 * normal(rngOutcome));
    const extra = profile.noise > 0 ? profile.noise * normal(rngConf) : 0;
    const confidence = clamp10(Math.round(q) + profile.shift[risk] + extra);
    out.push({ confidence, success, risk, emotionalState: 'calm', reflection: 'Outcome noted.' });
  }
  return out;
}
