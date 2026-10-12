'use client';

import { useEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';

const FOOTER_LINKS = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Login', href: '/auth/login' },
    { label: 'Register', href: '/auth/register' },
];

export default function ScratchFooter() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isInside = useRef(false);
    const hasStarted = useRef(false);
    const totalPixels = useRef(0);
    const revealed = useRef(false);
    const lastPos = useRef<{ x: number, y: number } | null>(null);
    const currentPos = useRef<{ x: number, y: number } | null>(null);
    const sparkles = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; size: number }>>([]);
    const animFrameRef = useRef<number>(0);

    const getPos = (e: PointerEvent | MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        if ('touches' in e) {
            const t = (e as TouchEvent).touches[0];
            return { x: t.clientX - rect.left, y: t.clientY - rect.top };
        }
        return { x: (e as MouseEvent | PointerEvent).clientX - rect.left, y: (e as MouseEvent | PointerEvent).clientY - rect.top };
    };

    const addSparkles = (x: number, y: number) => {
        if (Math.random() > 0.3) return; // Reduce sparkle density for subtle effect
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 0.5;
            sparkles.current.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                size: Math.random() * 2 + 1,
            });
        }
    };

    const drawBrush = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, lastX: number, lastY: number) => {
        ctx.globalCompositeOperation = 'destination-out';

        // Soft edge radial gradient brush
        const brushSize = 45;
        const dist = Math.hypot(x - lastX, y - lastY);
        const steps = Math.max(1, Math.floor(dist / 5)); // Interpolate for smooth continuous line

        for (let i = 0; i <= steps; i++) {
            const rx = lastX + (x - lastX) * (i / steps);
            const ry = lastY + (y - lastY) * (i / steps);

            const gradient = ctx.createRadialGradient(rx, ry, 0, rx, ry, brushSize);
            gradient.addColorStop(0, 'rgba(0,0,0,1)');
            gradient.addColorStop(0.5, 'rgba(0,0,0,0.8)');
            gradient.addColorStop(1, 'rgba(0,0,0,0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(rx, ry, brushSize, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalCompositeOperation = 'source-over';
        addSparkles(x, y);
    }, []);

    const checkReveal = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
        if (revealed.current) return;

        // Sub-sample pixels for performance (check every 32nd pixel)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let scratched = 0;
        let checked = 0;

        for (let i = 3; i < imageData.data.length; i += 128) {
            checked++;
            if (imageData.data[i] < 128) scratched++;
        }

        const percent = scratched / checked;
        if (percent > 0.45) {
            revealed.current = true;
            // Smooth fade out
            gsap.to(canvas, {
                opacity: 0,
                duration: 1.2,
                ease: 'power2.inOut',
                onComplete: () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    canvas.style.pointerEvents = 'none'; // Disable interactions post-reveal
                }
            });
        }
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

        const resize = () => {
            if (revealed.current) return;
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            totalPixels.current = canvas.width * canvas.height;

            // Draw noise overlay using createImageData for exact pixel control
            const imageData = ctx.createImageData(canvas.width, canvas.height);
            for (let i = 0; i < imageData.data.length; i += 4) {
                const noise = Math.random() * 25;
                imageData.data[i] = 12 + noise; // R
                imageData.data[i + 1] = 12 + noise; // G
                imageData.data[i + 2] = 12 + noise; // B
                imageData.data[i + 3] = 255; // Alpha
            }
            ctx.putImageData(imageData, 0, 0);

            // Overlay text hint
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.font = '13px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Move cursor to reveal', canvas.width / 2, canvas.height / 2);
        };

        resize();
        window.addEventListener('resize', resize);

        // Render loop
        let frameCount = 0;
        const render = () => {
            if (revealed.current && sparkles.current.length === 0) {
                return; // Stop loop entirely if revealed and particles dead
            }

            // Handle continuous drawing
            if (isInside.current && currentPos.current && !revealed.current) {
                if (!lastPos.current) {
                    lastPos.current = currentPos.current;
                }

                // Only draw if moved to save performance
                if (lastPos.current.x !== currentPos.current.x || lastPos.current.y !== currentPos.current.y) {
                    drawBrush(ctx, currentPos.current.x, currentPos.current.y, lastPos.current.x, lastPos.current.y);
                    lastPos.current = { ...currentPos.current };
                    hasStarted.current = true;
                }

                // Check reveal periodically (every 30 frames ~ 500ms)
                if (frameCount % 30 === 0 && hasStarted.current) {
                    checkReveal(ctx, canvas);
                }
            }

            // Draw sparkles on top
            if (sparkles.current.length > 0 && !revealed.current) {
                const ctx2 = canvas.getContext('2d')!;
                // Don't clear rect, just draw over
                sparkles.current = sparkles.current.filter((s) => s.life > 0);
                sparkles.current.forEach((s) => {
                    ctx2.globalCompositeOperation = 'source-over';
                    ctx2.globalAlpha = s.life * 0.5; // faint
                    ctx2.fillStyle = '#4a9eff';
                    ctx2.beginPath();
                    ctx2.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
                    ctx2.fill();

                    s.x += s.vx;
                    s.y += s.vy;
                    s.vy += 0.05; // gravity
                    s.life -= 0.04;
                });
                ctx2.globalAlpha = 1;
            }

            frameCount++;
            animFrameRef.current = requestAnimationFrame(render);
        };

        animFrameRef.current = requestAnimationFrame(render);

        const onPointerEnter = (e: PointerEvent) => {
            if (revealed.current) return;
            isInside.current = true;
            currentPos.current = getPos(e, canvas);
            lastPos.current = currentPos.current; // Reset last pos on enter to avoid long lines
        };

        const onPointerMove = (e: PointerEvent) => {
            if (revealed.current) return;
            isInside.current = true; // Ensure true for touch devices
            currentPos.current = getPos(e, canvas);
        };

        const onPointerLeave = () => {
            isInside.current = false;
            lastPos.current = null;
        };

        canvas.addEventListener('pointerenter', onPointerEnter);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerleave', onPointerLeave);
        canvas.addEventListener('pointercancel', onPointerLeave);

        return () => {
            cancelAnimationFrame(animFrameRef.current!);
            window.removeEventListener('resize', resize);
            canvas.removeEventListener('pointerenter', onPointerEnter);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerleave', onPointerLeave);
            canvas.removeEventListener('pointercancel', onPointerLeave);
        };
    }, [drawBrush, checkReveal]);

    return (
        <footer
            ref={containerRef}
            style={{
                position: 'relative',
                height: '340px',
                overflow: 'hidden',
                background: '#000',
                borderTop: '1px solid #111',
            }}
        >
            {/* Background content (revealed after scratching) */}
            <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '32px',
                padding: '40px',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#444', marginBottom: '12px' }}>Digital Memory Vault</div>
                    <div style={{ fontSize: '28px', fontWeight: 600, letterSpacing: '-0.02em', color: '#f0f0f0' }}>Behavioral Intelligence, <span style={{ color: '#4a9eff' }}>Quantified.</span></div>
                </div>

                <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                    {FOOTER_LINKS.map((link) => (
                        <a key={link.label} href={link.href} style={{ fontSize: '13px', color: '#555', textDecoration: 'none', letterSpacing: '0.02em', transition: 'color 0.2s' }}
                            onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#f0f0f0'; }}
                            onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#555'; }}>
                            {link.label}
                        </a>
                    ))}
                </div>

                <div style={{ fontSize: '11px', color: '#2a2a2a', letterSpacing: '0.06em' }}>
                    © 2026 Digital Memory Vault · All decisions tracked.
                </div>
            </div>

            {/* Scratch canvas overlay */}
            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute',
                    inset: 0,
                    cursor: 'crosshair',
                    touchAction: 'none',
                }}
            />
        </footer>
    );
}
