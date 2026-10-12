'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const CARDS = [
    {
        number: '01',
        title: 'Decision Accuracy',
        subtitle: 'Calibration Engine',
        description: 'Measure the gap between your confidence and actual outcomes. Every prediction you make is scored, and your calibration accuracy compound over time.',
        metric: 'Confidence Gap Analysis',
        detail: 'confidence_score = 100 − (|confidence − outcome| × 10)',
    },
    {
        number: '02',
        title: 'Risk Calibration',
        subtitle: 'Risk Intelligence Layer',
        description: 'Track how your high-risk versus low-risk decisions actually perform. Understand whether your risk tolerance aligns with reality.',
        metric: 'Risk vs Return Matrix',
        detail: 'Normalised across high / medium / low risk categories',
    },
    {
        number: '03',
        title: 'Emotional Bias Map',
        subtitle: 'Behavioral Pattern Detection',
        description: 'Detect emotional patterns driving decisions. Inputs from your emotional state at decision time and keyword analysis of post-outcome reflections.',
        metric: 'Instability Score',
        detail: 'Stress state + keyword scan: rushed · pressured · anxious · reactive',
    },
    {
        number: '04',
        title: 'Confidence Accuracy',
        subtitle: 'Overconfidence Detection',
        description: 'Plot your average confidence against average outcomes to detect systematic overconfidence or underconfidence patterns across decision domains.',
        metric: 'Calibration Index',
        detail: 'Scatter plot: predicted confidence vs realised outcome rating',
    },
];

export default function StackedScroll() {
    const sectionRef = useRef<HTMLElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const section = sectionRef.current;
        const container = containerRef.current;
        if (!section || !container) return;

        const cards = gsap.utils.toArray('.stacked-card') as HTMLElement[];
        const ctx = gsap.context(() => {
            // Initial positioning
            gsap.set(cards, {
                yPercent: (i) => (i === 0 ? 0 : 150),
                scale: 1,
                opacity: 1,
                zIndex: (i) => i
            });

            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: section,
                    start: 'top top',
                    end: `+=${cards.length * 100}%`,
                    pin: true,
                    scrub: 1,
                    anticipatePin: 1,
                    snap: {
                        snapTo: 1 / cards.length,
                        duration: 0.4,
                        ease: "power2.inOut"
                    }
                }
            });

            // Master timeline construction
            cards.forEach((card, i) => {
                if (i === 0) return;

                // Move current card in
                tl.to(card, {
                    yPercent: 0,
                    duration: 1,
                    ease: "none"
                }, i);

                // Scale down all previous cards
                for (let j = 0; j < i; j++) {
                    const depth = i - j;
                    tl.to(cards[j], {
                        scale: 1 - (depth * 0.04),
                        yPercent: -depth * 5,
                        opacity: 1, // Keep fully solid to avoid bleed
                        duration: 1,
                        ease: "none"
                    }, i);
                }
            });

            // Final hold for the last card
            tl.to({}, { duration: 1 });

        }, section);

        return () => ctx.revert();
    }, []);

    return (
        <section ref={sectionRef} style={{ height: '100vh', overflow: 'hidden', position: 'relative', background: 'var(--bg-secondary)' }}>
            {/* Title Header */}
            <div style={{
                position: 'absolute',
                top: 'clamp(32px, 8vh, 80px)',
                left: 'clamp(24px, 6vw, 100px)',
                zIndex: 50,
                maxWidth: '500px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: 600 }}>Analytics Engine</span>
                </div>
                <h2 style={{ fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                    Four Layers of<br />
                    <span style={{ color: 'var(--text-muted)' }}>Behavioral Intelligence</span>
                </h2>
            </div>

            <div
                ref={containerRef}
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {CARDS.map((card, i) => (
                    <div
                        key={i}
                        className="stacked-card"
                        style={{
                            position: 'absolute',
                            width: 'calc(100% - clamp(40px, 12vw, 200px))',
                            maxWidth: '820px',
                            height: 'min(520px, 65vh)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: '24px',
                            padding: 'clamp(32px, 6vw, 64px)',
                            boxShadow: '0 40px 80px -24px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(15, 23, 42, 0.03)',
                            transformOrigin: 'top center',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            top: 'clamp(180px, 32vh, 300px)',
                            zIndex: i,
                        }}
                    >
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-secondary)', fontWeight: 600 }}>{card.subtitle}</div>
                                <div style={{ fontSize: 'clamp(40px, 6vw, 60px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, fontFamily: 'JetBrains Mono, monospace', background: 'linear-gradient(135deg, #10b981, #0284c7)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{card.number}</div>
                            </div>
                            <h3 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '20px' }}>{card.title}</h3>
                            <p style={{ fontSize: 'clamp(15px, 2vw, 17px)', lineHeight: 1.7, color: 'var(--text-secondary)', maxWidth: '600px' }}>{card.description}</p>
                        </div>

                        <div>
                            <div style={{ padding: '20px 24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '12px', marginBottom: '32px' }}>
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '8px' }}>{card.metric}</div>
                                <code style={{ fontSize: '13px', color: '#047857', fontFamily: 'JetBrains Mono, monospace', opacity: 1, wordBreak: 'break-all' }}>{card.detail}</code>
                            </div>

                            <div style={{ display: 'flex', gap: '14px' }}>
                                {CARDS.map((_, dotIndex) => (
                                    <div key={dotIndex} style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: dotIndex <= i ? '#10b981' : 'var(--border-secondary)',
                                        boxShadow: dotIndex <= i ? '0 0 8px rgba(16, 185, 129, 0.6)' : 'none',
                                        transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)'
                                    }} />
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
