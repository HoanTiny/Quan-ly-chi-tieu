// components/ClientExpenseTracker.tsx
'use client';

import ExpenseTracker from './expense-tracker';

export default function ClientExpenseTracker({ userId }: { userId: string }) {
  return <ExpenseTracker userId={userId} />;
}
