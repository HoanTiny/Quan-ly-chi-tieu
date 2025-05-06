import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ClientExpenseTracker from '@/components/clientExpenseTracker';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect('/');

  // If not authenticated, redirect to login
  if (!session) {
    redirect('/');
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-4">Bảng điều khiển</h1>
      <ClientExpenseTracker userId={session.user.id} />
    </div>
  );
}
