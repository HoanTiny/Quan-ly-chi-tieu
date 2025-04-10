import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = cookies();
    const supabase = createClient();

    try {
      // Exchange the code for a session
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('Error exchanging code for session:', error);
        return NextResponse.redirect(
          new URL('/?error=auth_callback_error', request.url)
        );
      }

      // Kiểm tra xem phiên đăng nhập đã được tạo chưa
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        console.error('No session after code exchange');
        return NextResponse.redirect(
          new URL('/?error=no_session', request.url)
        );
      }

      // Redirect to the dashboard page
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } catch (error) {
      console.error('Unexpected error in auth callback:', error);
      return NextResponse.redirect(new URL('/?error=unexpected', request.url));
    }
  }

  // No code provided, redirect to home
  return NextResponse.redirect(new URL('/', request.url));
}
