import Link from 'next/link';

/** Shared brand lockup so every page shows the exact same logo and styling. */
export default function BrandLogo({ href = '/' }: { href?: string }) {
    return (
        <Link href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <span className="brand-mark" aria-hidden="true">DV</span>
            <span style={{ fontFamily: 'var(--font-display, "Outfit", sans-serif)', fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Memory Vault
            </span>
        </Link>
    );
}
