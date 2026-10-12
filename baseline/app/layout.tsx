import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Digital Memory Vault – Behavioral Decision Intelligence',
  description: 'Log decisions, compare expected vs actual outcomes, detect behavioral bias, and measure risk calibration. Built for founders and operators.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
