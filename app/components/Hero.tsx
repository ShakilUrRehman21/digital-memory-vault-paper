'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';

const ROTATING_WORDS = ['Calibrated.', 'Measured.', 'Remembered.', 'Sharpened.'];

// Morphing SVG paths for organic ambient blobs
const BLOB_A = [
    'M421,305Q389,360,337,392Q285,424,224,410Q163,396,122,350Q81,304,88,240Q95,176,140,130Q185,84,250,80Q315,76,367,118Q419,160,436,230Q453,300,421,305Z',
    'M437,318Q395,386,330,410Q265,434,200,413Q135,392,104,331Q73,270,96,205Q119,140,179,105Q239,70,305,92Q371,114,418,170Q465,226,451,272Q437,318,437,318Z',
    'M404,329Q378,408,300,421Q222,434,160,390Q98,346,92,273Q86,200,130,143Q174,86,248,74Q322,62,376,117Q430,172,430,211Q430,250,404,329Z',
];

const BLOB_B = [
    'M398,296Q370,342,322,372Q274,402,214,392Q154,382,124,331Q94,280,104,222Q114,164,163,128Q212,92,270,98Q328,104,375,144Q422,184,424,240Q426,296,398,296Z',
    'M415,330Q366,410,286,418Q206,426,150,370Q94,314,104,244Q114,174,170,124Q226,74,300,92Q374,110,410,180Q446,250,415,330Z',
    'M390,318Q344,386,270,402Q196,418,140,360Q84,302,100,228Q116,154,180,118Q244,82,316,104Q388,126,412,188Q436,250,390,318Z',
];

// Facts about the software itself (not usage claims).
const STATS = [
    { value: 4, suffix: '', decimals: 0, label: 'Scores per history' },
    { value: 46, suffix: '', decimals: 0, label: 'Automated end-to-end tests' },
    { value: 100, suffix: '%', decimals: 0, label: 'Open source (MIT)' },
];

export default function Hero() {
    const rootRef = useRef<HTMLDivElement>(null);
    const wordRef = useRef<HTMLSpanElement>(null);
    const spotlightRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const cleanups: Array<() => void> = [];

        const ctx = gsap.context(() => {
            if (reduceMotion) {
                gsap.set('[data-hero-reveal], .hero-word, .hero-rotating-text', { opacity: 1, y: 0 });
                return;
            }

            // 1. Staggered Entrance Timeline for static elements
            const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
            tl.from('[data-hero-pill]', { y: -20, opacity: 0, duration: 0.7 })
                .from('.hero-word', {
                    yPercent: 110,
                    opacity: 0,
                    duration: 0.9,
                    stagger: 0.08,
                }, '-=0.3')
                .from('.hero-rotating-text', {
                    yPercent: 110,
                    opacity: 0,
                    duration: 0.9,
                }, '-=0.6')
                .from('[data-hero-sub]', { y: 20, opacity: 0, duration: 0.7 }, '-=0.5')
                .from('[data-hero-cta] > *', { y: 18, scale: 0.96, opacity: 0, duration: 0.5, stagger: 0.1 }, '-=0.4')
                .from('[data-hero-stat]', { y: 22, opacity: 0, duration: 0.6, stagger: 0.08 }, '-=0.3')
                .from('.hero-blob', { scale: 0.7, opacity: 0, duration: 1.4, stagger: 0.2, ease: 'power2.out' }, 0);

            // 2. Animated Stats Counter
            root.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
                const target = Number(el.dataset.count);
                const decimals = Number(el.dataset.decimals ?? 0);
                const obj = { v: 0 };
                gsap.to(obj, {
                    v: target,
                    duration: 2.2,
                    delay: 0.8,
                    ease: 'power2.out',
                    onUpdate: () => {
                        el.textContent = obj.v.toLocaleString(undefined, {
                            minimumFractionDigits: decimals,
                            maximumFractionDigits: decimals,
                        });
                    },
                });
            });

            // 3. Morphing Organic Ambient Blobs
            const morph = (selector: string, shapes: string[], duration: number) => {
                const t = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: 'sine.inOut', duration } });
                shapes.slice(1).forEach((d) => t.to(selector, { attr: { d } }));
            };
            morph('#hero-blob-a path', BLOB_A, 6);
            morph('#hero-blob-b path', BLOB_B, 7.5);
            gsap.to('#hero-blob-a', { rotation: 360, duration: 60, repeat: -1, ease: 'none', transformOrigin: '50% 50%' });
            gsap.to('#hero-blob-b', { rotation: -360, duration: 80, repeat: -1, ease: 'none', transformOrigin: '50% 50%' });

            // 4. Smooth, Glitch-Free Keyword Rotation
            const wordEl = wordRef.current;
            if (wordEl) {
                let idx = 0;
                let isAnimating = false;

                const cycle = () => {
                    if (isAnimating) return;
                    isAnimating = true;

                    gsap.to(wordEl, {
                        yPercent: -115,
                        opacity: 0,
                        duration: 0.45,
                        ease: 'power2.in',
                        onComplete: () => {
                            idx = (idx + 1) % ROTATING_WORDS.length;
                            wordEl.textContent = ROTATING_WORDS[idx];
                            gsap.fromTo(
                                wordEl,
                                { yPercent: 115, opacity: 0 },
                                {
                                    yPercent: 0,
                                    opacity: 1,
                                    duration: 0.55,
                                    ease: 'power2.out',
                                    onComplete: () => {
                                        isAnimating = false;
                                    },
                                }
                            );
                        },
                    });
                };

                // Start cycling after intro timeline finishes
                const timeoutId = window.setTimeout(() => {
                    const intervalId = window.setInterval(cycle, 2800);
                    cleanups.push(() => window.clearInterval(intervalId));
                }, 1200);
                cleanups.push(() => window.clearTimeout(timeoutId));
            }

            // 5. Interactive Cursor Spotlight & Parallax
            const spot = spotlightRef.current;
            if (spot) {
                const xTo = gsap.quickTo(spot, 'x', { duration: 0.6, ease: 'power3.out' });
                const yTo = gsap.quickTo(spot, 'y', { duration: 0.6, ease: 'power3.out' });
                const blobX = gsap.quickTo('.hero-blobs', 'x', { duration: 1.2, ease: 'power3.out' });
                const blobY = gsap.quickTo('.hero-blobs', 'y', { duration: 1.2, ease: 'power3.out' });

                const onMove = (e: PointerEvent) => {
                    const rect = root.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    xTo(x - 250);
                    yTo(y - 250);
                    blobX((x / rect.width - 0.5) * -30);
                    blobY((y / rect.height - 0.5) * -30);
                };

                root.addEventListener('pointermove', onMove);
                cleanups.push(() => root.removeEventListener('pointermove', onMove));
            }

            // 6. Magnetic Buttons
            root.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((btn) => {
                const mx = gsap.quickTo(btn, 'x', { duration: 0.35, ease: 'power3.out' });
                const my = gsap.quickTo(btn, 'y', { duration: 0.35, ease: 'power3.out' });

                const move = (e: PointerEvent) => {
                    const rect = btn.getBoundingClientRect();
                    mx((e.clientX - (rect.left + rect.width / 2)) * 0.25);
                    my((e.clientY - (rect.top + rect.height / 2)) * 0.32);
                };

                const leave = () => { mx(0); my(0); };

                btn.addEventListener('pointermove', move);
                btn.addEventListener('pointerleave', leave);
                cleanups.push(() => {
                    btn.removeEventListener('pointermove', move);
                    btn.removeEventListener('pointerleave', leave);
                });
            });
        }, root);

        return () => {
            cleanups.forEach((fn) => fn());
            ctx.revert();
        };
    }, []);

    const headlineWords = ['Every', 'High-Stakes', 'Decision.'];

    return (
        <div ref={rootRef} className="hero-root">
            {/* Morphing Organic SVG Blobs */}
            <div className="hero-blobs" aria-hidden="true">
                <svg id="hero-blob-a" className="hero-blob hero-blob-a" viewBox="0 0 500 500">
                    <defs>
                        <linearGradient id="heroGradA" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#0284c7" />
                        </linearGradient>
                    </defs>
                    <path d={BLOB_A[0]} fill="url(#heroGradA)" />
                </svg>
                <svg id="hero-blob-b" className="hero-blob hero-blob-b" viewBox="0 0 500 500">
                    <defs>
                        <linearGradient id="heroGradB" x1="1" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                    </defs>
                    <path d={BLOB_B[0]} fill="url(#heroGradB)" />
                </svg>
            </div>

            {/* Interactive Cursor Spotlight */}
            <div ref={spotlightRef} className="hero-spotlight" aria-hidden="true" />

            <div className="hero-content">
                {/* Pill Badge */}
                <div className="glass-pill hero-pill" data-hero-pill>
                    <span className="pulsing-dot" />
                    <span>Behavioral Intelligence Platform</span>
                    <span className="hero-pill-sep">·</span>
                    <span className="hero-pill-accent">Quantify Intuition</span>
                </div>

                {/* Kinetic Headline */}
                <h1 className="hero-title">
                    <span className="hero-line">
                        {headlineWords.map((word) => (
                            <span key={word} className="hero-word-mask">
                                <span className="hero-word">{word}</span>
                            </span>
                        ))}
                    </span>
                    <span className="hero-line">
                        <span className="hero-word-mask">
                            <span className="hero-word">Intelligently</span>
                        </span>
                        <span className="hero-rotating-mask">
                            <span ref={wordRef} className="hero-rotating-text">
                                {ROTATING_WORDS[0]}
                            </span>
                        </span>
                    </span>
                </h1>

                {/* Subtitle */}
                <p className="hero-sub" data-hero-sub>
                    Not a journal. Not therapy. A precision behavioral analytics engine for founders,
                    quants, and operators who need empirical data on their strategic judgment.
                </p>

                {/* CTAs with Magnetic Physics */}
                <div className="hero-cta" data-hero-cta>
                    <Link href="/auth/register" className="hero-btn hero-btn-primary" data-magnetic id="hero-cta-primary">
                        <span>Start Tracking Free</span>
                        <span className="hero-btn-arrow">→</span>
                    </Link>
                    <a href="#demo" className="hero-btn hero-btn-ghost" data-magnetic id="hero-cta-demo">
                        Explore Live Console ↓
                    </a>
                </div>

                {/* Interactive Animated Counter Stats */}
                <div className="hero-stats">
                    {STATS.map((s) => (
                        <div key={s.label} className="hero-stat" data-hero-stat>
                            <div className="hero-stat-value">
                                <span data-count={s.value} data-decimals={s.decimals}>0</span>
                                {s.suffix}
                            </div>
                            <div className="hero-stat-label">{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
