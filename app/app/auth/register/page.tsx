'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import SiteFooter from '@/components/SiteFooter';

export default function RegisterPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({ fullName: '', email: '', password: '' });

    const strength = Math.min(4,
        (form.password.length >= 8 ? 1 : 0) +
        (/[A-Z]/.test(form.password) ? 1 : 0) +
        (/[0-9]/.test(form.password) ? 1 : 0) +
        (/[^A-Za-z0-9]/.test(form.password) ? 1 : 0));
    const strengthColors = ['#e2e8f0', '#dc2626', '#d97706', '#10b981', '#059669'];

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: form.fullName.trim(),
                    email: form.email.trim().toLowerCase(),
                    password: form.password,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error || 'Could not create account. Please try again.');
                return;
            }
            router.push('/dashboard');
            router.refresh();
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-shell">
            <header className="glass-nav" style={{ padding: '16px 32px' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <BrandLogo />
                    <Link href="/auth/login" className="btn btn-ghost btn-sm" style={{ borderRadius: '999px' }}>
                        Sign In
                    </Link>
                </div>
            </header>

            <main className="auth-main">
                <div className="auth-card">
                    <h1 className="auth-title">Create your vault</h1>
                    <p className="auth-sub">Start tracking decisions with precision. Free forever tier.</p>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        <div className="form-group">
                            <label className="label" htmlFor="fullName">Full Name</label>
                            <input
                                id="fullName"
                                type="text"
                                className="input"
                                placeholder="Alex Thompson"
                                autoComplete="name"
                                value={form.fullName}
                                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                                required
                                autoFocus
                                maxLength={100}
                            />
                        </div>

                        <div className="form-group">
                            <label className="label" htmlFor="email">Email Address</label>
                            <input
                                id="email"
                                type="email"
                                className="input"
                                placeholder="you@company.com"
                                autoComplete="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="label" htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                className="input"
                                placeholder="Min. 8 characters"
                                autoComplete="new-password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                required
                                minLength={8}
                            />
                            {/* Visual password strength meter */}
                            <div style={{ display: 'flex', gap: '5px', marginTop: '6px' }} aria-hidden="true">
                                {[1, 2, 3, 4].map((i) => (
                                    <span
                                        key={i}
                                        style={{
                                            flex: 1,
                                            height: '4px',
                                            borderRadius: '2px',
                                            transition: 'background .25s ease',
                                            background: form.password && strength >= i ? strengthColors[strength] : 'var(--border-primary)',
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        {error && <div className="auth-error" role="alert">{error}</div>}

                        <button
                            id="register-submit"
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '13px', marginTop: '6px', borderRadius: '12px', fontSize: '14px' }}
                            disabled={loading}
                        >
                            {loading ? <div className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff' }} /> : 'Create Account →'}
                        </button>
                    </form>

                    <p className="auth-switch">
                        Already have an account? <Link href="/auth/login">Sign in</Link>
                    </p>
                </div>
            </main>

            <SiteFooter />
        </div>
    );
}
