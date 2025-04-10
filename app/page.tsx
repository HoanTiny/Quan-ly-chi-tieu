import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AuthForm from '@/components/auth-form';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const cookieStore = cookies();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.log('user:', user);
  // Check if user is authenticated
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Log session for debugging
  console.log('Home session:', session ? 'Authenticated' : 'Not authenticated');

  // If authenticated, redirect to dashboard
  if (session) {
    redirect('/dashboard');
  }

  return <AuthForm />;
}
