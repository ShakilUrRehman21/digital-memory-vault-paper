import Link from 'next/link';

/** Simple, clean, consistent footer across landing, auth, and dashboard. */
export default function SiteFooter() {
    const year = new Date().getFullYear();
    return (
        <footer className="site-footer">
            <div className="site-footer-inner">
                <Link href="/" className="site-footer-brand" style={{ textDecoration: 'none' }}>
                    <span className="brand-mark" aria-hidden="true">DV</span>
                    <span>Digital Memory Vault</span>
                </Link>
                <nav className="site-footer-links" aria-label="Footer Navigation">
                    <Link href="/#features">Features</Link>
                    <Link href="/#pricing">Pricing</Link>
                    <Link href="/#faq">FAQ</Link>
                    <Link href="/auth/login">Sign In</Link>
                    <Link href="/auth/register">Register</Link>
                </nav>
                <span className="site-footer-copy">© {year} Digital Memory Vault. All rights reserved.</span>
            </div>
        </footer>
    );
}
