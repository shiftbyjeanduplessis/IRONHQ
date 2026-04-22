import Link from 'next/link';
import { getCurrentCoachScope } from '@/lib/auth/coach-scope';

export default async function CoachDashboardPage() {
  const scope = await getCurrentCoachScope();

  if (!scope.scoped) {
    return (
      <main className="mx-auto max-w-3xl p-4 md:p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm text-amber-700">Coach access required</p>
          <h1 className="mt-1 text-2xl font-semibold text-amber-950">Coach dashboard is not available yet for this request.</h1>
          <p className="mt-3 text-sm text-amber-900">
            This repo slice now expects a real coach identity. Provide <code>x-ironhq-auth-user-id</code> or set <code>IRONHQ_AUTH_USER_ID</code>,
            and map that auth user to a coach profile via <code>profiles.auth_user_id</code>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-4 md:p-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-neutral-500">Coach Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold">Coach scope active</h1>
        <p className="mt-2 text-sm text-neutral-600">Continue into the scoped coach workspace.</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/coach/roster" className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-800">Open roster</Link>
          <Link href="/coach/sessions" className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-800">Open sessions</Link>
        </div>
      </div>
    </main>
  );
}
