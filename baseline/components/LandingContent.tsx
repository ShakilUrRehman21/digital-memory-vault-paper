'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StackedScroll } from '@/components/LandingDynamics';
import BrandLogo from '@/components/BrandLogo';
import SiteFooter from '@/components/SiteFooter';
import Hero from '@/components/Hero';

// Decision simulation scenarios for Hero centerpiece
interface Scenario {
    id: string;
    label: string;
    title: string;
    category: string;
    risk: 'high' | 'medium' | 'low';
    emotionalState: string;
    confidence: number;
    expectedOutcome: string;
    actualOutcome: string;
    successRating: number;
    calibrationScore: number;
    biasAlert: string;
    lesson: string;
}

const SCENARIOS: Scenario[] = [
    {
        id: 'pivot',
        label: 'Enterprise AI Pivot',
        title: 'Deprecate Legacy Self-Serve & Shift to Enterprise AI Agents',
        category: 'product',
        risk: 'high',
        emotionalState: 'excited',
        confidence: 8,
        expectedOutcome: 'Close 3 enterprise pilots within 60 days with ACV > $60k; withstand 15% churn in legacy SMB tier.',
        actualOutcome: 'Closed 4 enterprise pilots ($280k ARR total); SMB churn was 12%. Transition executed cleanly.',
        successRating: 9,
        calibrationScore: 90,
        biasAlert: 'Slight optimism bias detected on timeline (took 74 days vs 60 planned), but downside risk well hedged.',
        lesson: 'Pre-mortem contracts with early lighthouse customers de-risked the high-stakes architectural shift.',
    },
    {
        id: 'hire',
        label: 'VP of Engineering Hire',
        title: 'Extend Aggressive Offer to Out-of-Industry Head of Platform',
        category: 'career',
        risk: 'medium',
        emotionalState: 'pressured',
        confidence: 7,
        expectedOutcome: 'Candidate scales team from 8 to 25 engineers in 9 months while reducing cycle time by 30%.',
        actualOutcome: 'Engineering cycle time decreased by 34%, but team friction caused 2 senior departures in month 3.',
        successRating: 7,
        calibrationScore: 100,
        biasAlert: 'Zero calibration gap (predicted 7, scored 7). Emotional pressure at offer time correctly discounted in model.',
        lesson: 'Technical competence was high; onboarding cultural alignment needed a dedicated buddy framework.',
    },
    {
        id: 'treasury',
        label: 'Treasury & Runaway Hedging',
        title: 'Lock 18 Months of Runway into Short-Term Yield & FX Hedge',
        category: 'finance',
        risk: 'low',
        emotionalState: 'calm',
        confidence: 9,
        expectedOutcome: 'Preserve capital with 5.1% annualized yield; protect against 8% USD/EUR currency volatility.',
        actualOutcome: 'Yield delivered exactly 5.12%; avoided $42k FX drag during Q2 transatlantic expansion.',
        successRating: 10,
        calibrationScore: 90,
        biasAlert: 'Calm baseline generated optimal risk asymmetry and preserved capital during market drawdown.',
        lesson: 'Conservative treasury operations eliminate cognitive bandwidth waste during expansion sprints.',
    },
];

const BENTO_FEATURES = [
    {
        icon: '◈',
        badge: 'Hindsight Immunity',
        title: 'Pre-Commitment Decision Logging',
        desc: 'Lock down your hypothesis, emotional state, risk assessment, and confidence level at T=0. Never fall victim to "I knew it all along" revisionism again.',
        highlight: 'Real-time contextual timestamping',
        accentColor: '#10b981',
    },
    {
        icon: '📐',
        badge: 'Mathematical Rigor',
        title: 'Calibration Scores',
        desc: 'Compare the confidence you stated with how each decision turned out, overall, at each confidence level and within each risk level, so errors in opposite directions cannot cancel out.',
        highlight: 'Binned and per-risk calibration error',
        accentColor: '#2563eb',
    },
    {
        icon: '🧠',
        badge: 'Behavioral Pattern Detection',
        title: 'Emotional Bias Detection Engine',
        desc: 'Record your emotional state (calm, stressed, excited, pressured, uncertain) at decision time and flag warning words in your reflections, ignoring negated ones such as “no regrets”.',
        highlight: 'Twelve-word list with negation handling',
        accentColor: '#9333ea',
    },
    {
        icon: '🎲',
        badge: 'Asymmetric Return',
        title: 'Risk-Adjusted Performance Profiler',
        desc: 'See whether your confidence matches your results separately for low-, medium- and high-risk decisions.',
        highlight: 'Calibration within each risk level',
        accentColor: '#b7791f',
    },
    {
        icon: '📓',
        badge: 'Wisdom Compounding',
        title: 'Codified Post-Mortems & Playbooks',
        desc: 'Turn wins and failures into permanent operational wisdom. Record lessons learned and build a personalized rulebook for high-leverage moments.',
        highlight: 'Continuous reflection loops',
        accentColor: '#10b981',
    },
    {
        icon: '📄',
        badge: 'Board & Investor Ready',
        title: 'Decision Reports',
        desc: 'Export any decision as a self-contained HTML report with the original prediction, the outcome and the calibration gap.',
        highlight: 'One-click HTML export',
        accentColor: '#0284c7',
    },
];

const FAQS = [
    {
        q: 'How does Digital Memory Vault differ from normal journaling or Notion?',
        a: 'Traditional tools rely on retrospective writing after events unfold, which is heavily contaminated by hindsight and recency biases. Digital Memory Vault enforces pre-commitment: you log your confidence score, expected outcome, and emotional state BEFORE knowing the result. It then mathematically calculates your calibration gap once the outcome occurs.',
    },
    {
        q: 'What is a Calibration Score and how is it mathematically calculated?',
        a: 'Calibration measures how well your stated confidence matches how things turn out. Decisions are grouped by the confidence you gave (1-10); within each group the average success rating is compared with that confidence, and the average gap in steps is converted to a score (100 minus 10 points per step). Risk calibration does the same within each risk level. With fewer than 20 resolved decisions the scores are marked as provisional.',
    },
    {
        q: 'How does the Emotional Bias Detection Engine work?',
        a: 'When logging a decision, you record your emotional state (calm, stressed, excited, pressured, uncertain). When the outcome is scored, DMV looks for twelve warning words in your reflections (such as rushed, panic, reactive, overconfident), ignoring words preceded by a negation. It is a simple indicator, not a psychological assessment.',
    },
    {
        q: 'How much time does it take each week?',
        a: 'Less than 5 minutes. You only log high-leverage strategic decisions—typically 2 to 5 per week—not trivial daily tasks. Capturing a decision takes 60 seconds; reviewing an outcome takes 90 seconds.',
    },
    {
        q: 'Is my proprietary company and investment data secure?',
        a: 'Every query is scoped to your account, passwords are hashed with bcrypt, sessions use signed JSON Web Tokens in HttpOnly cookies, and predictions are locked once an outcome is recorded. The code is open source, so you can audit or self-host it.',
    },
    {
        q: 'Can I export my decision logs for co-founders or board members?',
        a: 'Yes. Each decision can be exported as an HTML report with your original prediction, confidence, risk level, actual outcome, calibration gap and lessons learned.',
    },
];

export default function LandingContent() {
    const [selectedScenario, setSelectedScenario] = useState<Scenario>(SCENARIOS[0]);
    const [openFaq, setOpenFaq] = useState<number | null>(0);

    const toggleFaq = (index: number) => {
        setOpenFaq(openFaq === index ? null : index);
    };

    return (
        <main style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '100vh', overflowX: 'hidden' }}>
            {/* STICKY GLASS NAVIGATION BAR */}
            <nav className="glass-nav" style={{
                position: 'sticky', top: 0, left: 0, right: 0, zIndex: 100,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 40px',
            }}>
                <BrandLogo />

                <div style={{ display: 'none', alignItems: 'center', gap: '32px' }} className="nav-desktop-links">
                    <a href="#features" style={{ fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}>Features</a>
                    <a href="#demo" style={{ fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}>Live Console</a>
                    <a href="#faq" style={{ fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}>FAQ</a>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Link href="/auth/login" className="btn btn-ghost btn-sm" style={{ borderRadius: '999px' }}>
                        Sign In
                    </Link>
                    <Link href="/auth/register" className="btn btn-emerald btn-sm" style={{ borderRadius: '999px', padding: '8px 20px' }}>
                        Launch Vault →
                    </Link>
                    
                </div>
            </nav>

            {/* HERO SECTION */}
            <section className="bg-grid-subtle" style={{
                position: 'relative', paddingTop: '90px', paddingBottom: '90px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                paddingLeft: '24px', paddingRight: '24px',
            }}>
                <Hero />

                {/* HERO CENTERPIECE: INTERACTIVE DECISION VAULT CONSOLE (Inspired by Finora phone & Clara card cluster) */}
                <div id="demo" style={{ position: 'relative', marginTop: '64px', width: '100%', maxWidth: '1100px', zIndex: 10 }}>
                    {/* Central Device Window */}
                    <div className="glass-panel" style={{
                        borderRadius: '24px', padding: '32px', border: '1px solid var(--border-primary)',
                        boxShadow: '0 30px 60px -12px rgba(15, 23, 42, 0.160), 0 0 40px -10px rgba(16, 185, 129, 0.15)',
                        background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.06) 0%, #ffffff 40%)',
                    }}>
                        {/* Device Top Bar: Scenario Switcher */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-primary)',
                            paddingBottom: '20px', marginBottom: '24px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ca8a04' }} />
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
                                    ILLUSTRATIVE EXAMPLES · NOT REAL USER DATA
                                </span>
                            </div>

                            {/* Clickable scenario buttons */}
                            <div style={{ display: 'flex', gap: '8px', background: 'rgba(15, 23, 42, 0.025)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-primary)' }}>
                                {SCENARIOS.map((sc) => (
                                    <button
                                        key={sc.id}
                                        onClick={() => setSelectedScenario(sc)}
                                        style={{
                                            padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
                                            border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                                            background: selectedScenario.id === sc.id ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                                            color: selectedScenario.id === sc.id ? '#10b981' : 'var(--text-secondary)',
                                        }}
                                    >
                                        {sc.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Interactive Scenario Card Content */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', textAlign: 'left' }}>
                            {/* Left Column: Decision & Prediction */}
                            <div style={{ background: 'rgba(15, 23, 42, 0.025)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-primary)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#10b981', fontWeight: 600 }}>
                                        Step 01 · Pre-Commitment
                                    </span>
                                    <span className="badge" style={{ textTransform: 'uppercase', fontSize: '10px' }}>
                                        {selectedScenario.category}
                                    </span>
                                </div>

                                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', lineHeight: 1.35 }}>
                                    {selectedScenario.title}
                                </h3>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                                    <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.032)', borderRadius: '10px', border: '1px solid var(--border-primary)' }}>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Confidence</div>
                                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb', fontFamily: 'JetBrains Mono, monospace', marginTop: '2px' }}>
                                            {selectedScenario.confidence}<span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/10</span>
                                        </div>
                                    </div>
                                    <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.032)', borderRadius: '10px', border: '1px solid var(--border-primary)' }}>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Emotional State</div>
                                        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize', marginTop: '4px' }}>
                                            {selectedScenario.emotionalState}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '6px' }}>
                                        Hypothesis / Expected Outcome:
                                    </div>
                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, background: 'rgba(15, 23, 42, 0.016)', padding: '12px', borderRadius: '8px' }}>
                                        {selectedScenario.expectedOutcome}
                                    </p>
                                </div>
                            </div>

                            {/* Right Column: Verified Outcome & Calibration */}
                            <div style={{ background: 'rgba(16, 185, 129, 0.03)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#059669', fontWeight: 600 }}>
                                        Step 02 · Outcome & Calibration
                                    </span>
                                    <span style={{
                                        fontSize: '11px', padding: '3px 8px', borderRadius: '6px',
                                        background: 'rgba(16, 185, 129, 0.15)', color: '#059669', fontWeight: 600
                                    }}>
                                        Calibration: {selectedScenario.calibrationScore}/100
                                    </span>
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '6px' }}>
                                        Reality / Actual Outcome:
                                    </div>
                                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5, background: 'rgba(15, 23, 42, 0.024)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                                        {selectedScenario.actualOutcome}
                                    </p>
                                </div>

                                <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.024)', borderRadius: '10px', marginBottom: '16px' }}>
                                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                                        Cognitive Pattern & Bias Audit
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                                        {selectedScenario.biasAlert}
                                    </div>
                                </div>

                                <div>
                                    <div style={{ fontSize: '10px', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                                        Codified Lesson:
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                        &ldquo;{selectedScenario.lesson}&rdquo;
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Console Footer */}
                        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                <span>Risk: <strong style={{ color: selectedScenario.risk === 'high' ? '#dc2626' : '#b7791f', textTransform: 'capitalize' }}>{selectedScenario.risk}</strong></span>
                                <span>Outcome Rating: <strong style={{ color: '#10b981' }}>{selectedScenario.successRating}/10</strong></span>
                            </div>
                            <Link href="/auth/register" style={{ fontSize: '12px', color: '#10b981', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                Create Your Private Vault →
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* SMART FEATURES BENTO GRID (Finora 2x2/3x2 & Clara style) */}
            <section id="features" style={{ padding: '80px 24px', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '56px' }}>
                    <div className="glass-pill" style={{ marginBottom: '16px' }}>
                        <span style={{ color: '#10b981', fontWeight: 600 }}>Precision Features</span>
                        <span style={{ color: 'var(--text-muted)' }}>·</span>
                        <span>Built for Cognitive Mastery</span>
                    </div>
                    <h2 style={{ fontSize: 'clamp(28px, 4.5vw, 50px)', fontWeight: 700, letterSpacing: '-0.03em' }}>
                        Transform Unconscious Instinct<br />
                        <span className="gradient-text-emerald">Into Empirical Performance</span>
                    </h2>
                    <p style={{ fontSize: '16px', color: 'var(--text-secondary)', maxWidth: '560px', margin: '16px auto 0' }}>
                        Every module is engineered to neutralize the cognitive pitfalls that plague even the smartest operators.
                    </p>
                </div>

                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                    gap: '20px'
                }}>
                    {BENTO_FEATURES.map((feat) => (
                        <div key={feat.title} className="glass-panel" style={{
                            padding: '32px', display: 'flex', flexDirection: 'column',
                            justifyContent: 'space-between', minHeight: '260px'
                        }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <div style={{
                                        width: '42px', height: '42px', borderRadius: '12px',
                                        background: 'rgba(15, 23, 42, 0.028)', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', fontSize: '20px', color: feat.accentColor,
                                        border: '1px solid var(--border-primary)'
                                    }}>
                                        {feat.icon}
                                    </div>
                                    <span style={{
                                        fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em',
                                        padding: '4px 10px', borderRadius: '999px', background: 'rgba(15, 23, 42, 0.025)',
                                        border: '1px solid var(--border-primary)', color: 'var(--text-secondary)'
                                    }}>
                                        {feat.badge}
                                    </span>
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                                    {feat.title}
                                </h3>
                                <p style={{ fontSize: '13.5px', lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                                    {feat.desc}
                                </p>
                            </div>
                            <div style={{
                                marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-primary)',
                                display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: feat.accentColor,
                                fontFamily: 'JetBrains Mono, monospace'
                            }}>
                                <span>❯</span>
                                <span>{feat.highlight}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* WORKFLOW COMPARISON: INTUITION TRAP VS THE VAULT PROTOCOL (Clara style) */}
            <section style={{
                padding: '80px 24px', maxWidth: '1100px', margin: '0 auto',
                borderTop: '1px solid var(--border-primary)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '12px' }}>
                        Methodological Advantage
                    </div>
                    <h2 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 700, letterSpacing: '-0.02em' }}>
                        Why Memory Alone Fails Founders
                    </h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                    {/* The Old Way */}
                    <div style={{
                        background: 'rgba(255, 50, 50, 0.03)', border: '1px solid rgba(255, 80, 80, 0.15)',
                        borderRadius: '20px', padding: '32px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <span style={{ color: '#dc2626', fontSize: '18px' }}>✕</span>
                            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#ef4444' }}>The Intuition &amp; Retro Trap</h3>
                        </div>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                            <li style={{ display: 'flex', gap: '10px' }}>
                                <span style={{ color: '#dc2626' }}>•</span>
                                <span><strong>Hindsight revisionism:</strong> Brain rewrites initial expectations once the final outcome is known.</span>
                            </li>
                            <li style={{ display: 'flex', gap: '10px' }}>
                                <span style={{ color: '#dc2626' }}>•</span>
                                <span><strong>Emotional amnesia:</strong> Forgetting how panic or euphoria hijacked strategic bets at execution time.</span>
                            </li>
                            <li style={{ display: 'flex', gap: '10px' }}>
                                <span style={{ color: '#dc2626' }}>•</span>
                                <span><strong>Zero calibration metrics:</strong> Inability to know whether you are chronically over or underconfident.</span>
                            </li>
                            <li style={{ display: 'flex', gap: '10px' }}>
                                <span style={{ color: '#dc2626' }}>•</span>
                                <span><strong>Repeated mistake patterns:</strong> Post-mortems live as forgotten Google Docs without actionable analytics.</span>
                            </li>
                        </ul>
                    </div>

                    {/* The Vault Protocol */}
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: '20px', padding: '32px', boxShadow: '0 0 30px -10px rgba(16, 185, 129, 0.15)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <span style={{ color: '#10b981', fontSize: '18px' }}>✓</span>
                            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#059669' }}>The Digital Memory Vault Protocol</h3>
                        </div>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                            <li style={{ display: 'flex', gap: '10px' }}>
                                <span style={{ color: '#10b981' }}>✓</span>
                                <span><strong>Pre-registered commitments:</strong> Confidence and criteria are locked at T=0 before reality unfolds.</span>
                            </li>
                            <li style={{ display: 'flex', gap: '10px' }}>
                                <span style={{ color: '#10b981' }}>✓</span>
                                <span><strong>State &amp; bias tracking:</strong> Algorithmic correlation between stress, excitement, and bet performance.</span>
                            </li>
                            <li style={{ display: 'flex', gap: '10px' }}>
                                <span style={{ color: '#10b981' }}>✓</span>
                                <span><strong>Empirical calibration score:</strong> Clear numerical score showing where your judgment is sharpest.</span>
                            </li>
                            <li style={{ display: 'flex', gap: '10px' }}>
                                <span style={{ color: '#10b981' }}>✓</span>
                                <span><strong>Codified rulebook:</strong> Extracted principles compound over months into your firm&apos;s decision advantage.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* GSAP STACKED SCROLL (Interactive card stack) */}
            <StackedScroll />

            {/* INTERACTIVE FAQ ACCORDION (Finora & Clara style) */}
            <section id="faq" style={{
                padding: '80px 24px', maxWidth: '880px', margin: '0 auto',
                borderTop: '1px solid var(--border-primary)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                    <div className="glass-pill" style={{ marginBottom: '16px' }}>
                        <span style={{ color: '#10b981', fontWeight: 600 }}>Clarity &amp; Questions</span>
                        <span style={{ color: 'var(--text-muted)' }}>·</span>
                        <span>Frequently Asked</span>
                    </div>
                    <h2 style={{ fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 700, letterSpacing: '-0.02em' }}>
                        Everything You Need to Know
                    </h2>
                </div>

                <div className="glass-panel" style={{ padding: '8px 24px', overflow: 'hidden' }}>
                    {FAQS.map((faq, index) => {
                        const isOpen = openFaq === index;
                        return (
                            <div key={faq.q} className="faq-accordion-item">
                                <button
                                    onClick={() => toggleFaq(index)}
                                    style={{
                                        width: '100%', padding: '20px 0', display: 'flex',
                                        alignItems: 'center', justifyContent: 'space-between',
                                        background: 'none', border: 'none', textAlign: 'left',
                                        cursor: 'pointer', color: isOpen ? '#10b981' : 'var(--text-primary)',
                                        fontSize: '15.5px', fontWeight: 600, transition: 'color 0.2s',
                                        gap: '16px'
                                    }}
                                >
                                    <span>{faq.q}</span>
                                    <span style={{
                                        fontSize: '20px', fontWeight: 300, color: isOpen ? '#10b981' : 'var(--text-muted)',
                                        transition: 'transform 0.2s', transform: isOpen ? 'rotate(45deg)' : 'none'
                                    }}>
                                        +
                                    </span>
                                </button>
                                {isOpen && (
                                    <div style={{
                                        paddingBottom: '20px', color: 'var(--text-secondary)', fontSize: '14px',
                                        lineHeight: 1.65, animation: 'fadeIn 0.25s ease'
                                    }}>
                                        {faq.a}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* RADIANT CTA BANNER (Finora & Clara style) */}
            <section style={{ padding: '80px 24px 100px', maxWidth: '1100px', margin: '0 auto' }}>
                <div style={{
                    position: 'relative', borderRadius: '28px', padding: '64px 32px',
                    textAlign: 'center', overflow: 'hidden',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
                    border: '1px solid var(--border-primary)',
                    boxShadow: '0 20px 60px -15px rgba(16, 185, 129, 0.25)'
                }}>
                    {/* Ambient light pulse */}
                    <div style={{
                        position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)',
                        width: '500px', height: '300px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%)',
                        filter: 'blur(50px)', pointerEvents: 'none'
                    }} />

                    <div style={{ position: 'relative', zIndex: 1, maxWidth: '640px', margin: '0 auto' }}>
                        <div className="glass-pill" style={{ marginBottom: '20px' }}>
                            <span className="pulsing-dot" />
                            <span>Stop Leaving Your Strategy to Chance</span>
                        </div>
                        <h2 style={{ fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: '20px' }}>
                            Ready to Master Your<br /><span className="gradient-text-emerald">Decision DNA?</span>
                        </h2>
                        <p style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '36px' }}>
                            Log your next decision before you know how it ends, and find out how well your confidence tracks your results.
                        </p>
                        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Link href="/auth/register" className="btn btn-emerald" style={{ padding: '15px 40px', fontSize: '15px', borderRadius: '999px' }}>
                                Create Your Vault Free →
                            </Link>
                            <Link href="/auth/login" className="btn btn-glass" style={{ padding: '15px 32px', fontSize: '15px', borderRadius: '999px' }}>
                                Operator Sign In
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            <SiteFooter />
        </main>
    );
}
