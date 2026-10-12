import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyJWT } from '@/lib/auth/jwt';
import LandingContent from '@/components/LandingContent';

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (token && await verifyJWT(token)) {
    redirect('/dashboard');
  }

  return <LandingContent />;
}
