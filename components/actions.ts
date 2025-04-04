'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function login(data) {
  const supabase = await createClient();

  const { email, password } = data;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('Login error:', error.message);
    return { error: error.message }; // Trả về lỗi để hiển thị trên client
  }

  return { success: true }; // Trả về thành công
}

export async function signup(data) {
  const supabase = createClient();

  const { email, password } = data;

  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    console.error('Signup error:', error.message);
    return { error: error.message }; // Trả về lỗi để hiển thị trên client
  }

  return { success: true }; // Trả về thành công
}

