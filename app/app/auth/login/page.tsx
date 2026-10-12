'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import SiteFooter from '@/components/SiteFooter';

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({ email: '', password: '' });

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, email: form.email.trim().toLowerCase() }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error || 'Sign in failed. Please check your credentials.');
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
                    <Link href="/auth/register" className="btn btn-ghost btn-sm" style={{ borderRadius: '999px' }}>
                        Create Account
                    </Link>
                </div>
            </header>

            <main className="auth-main">
                <div className="auth-card">
                    <h1 className="auth-title">Welcome back</h1>
                    <p className="auth-sub">Sign in to your decision intelligence dashboard.</p>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
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
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="label" htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                className="input"
                                placeholder="••••••••"
                                autoComplete="current-password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                required
                            />
                        </div>

                        {error && <div className="auth-error" role="alert">{error}</div>}

                        <button
                            id="login-submit"
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '13px', marginTop: '6px', borderRadius: '12px', fontSize: '14px' }}
                            disabled={loading}
                        >
                            {loading ? <div className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff' }} /> : 'Sign In →'}
                        </button>
                    </form>

                    <p className="auth-switch">
                        Don&apos;t have an account? <Link href="/auth/register">Create one free</Link>
                    </p>
                </div>
            </main>

            <SiteFooter />
        </div>
    );
}
