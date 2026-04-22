import Link from 'next/link';
import { StatusChip, getSessionStatusMeta } from '@/features/ui/status-badges';
import { listCoachRosterAssignments } from '@/lib/db/programs';
import { getRecentMissedCountForAthlete, getLastCompletedAtForAthlete } from '@/lib/db/training';
import { getNextTrainingSessionStateForAthlete } from '@/features/training/server/get-next-training-session-state-for-athlete';
import { countOpenCoachNotesForAthlete } from '@/lib/db/coach-notes';

function formatDate(value: string | null) {
  if (!value) return 'No recent completion';
  return `Last completed ${new Date(value).toLocaleDateString()}`;
}

function GuardCard({ message }: { message: string }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 shadow-sm">
      <h1 className="text-lg font-semibold">Coach access needs setup</h1>
      <p className="mt-2">{message}</p>
      <p className="mt-2">Set a signed-in coach auth user or <code>IRONHQ_COACH_PROFILE_ID</code> for this slice. You can temporarily allow shared reads with <code>IRONHQ_ALLOW_UNSCOPED_COACH_READS=1</code>.</p>
    </section>
  );
}

export default async function CoachDashboardPage() {
  const assignments = await listCoachRosterAssignments();
  const scope = assignments[0]?.scope ?? { scoped: false, allowUnscopedReads: false, warning: 'Coach access is not configured yet.' };

  if (!scope.scoped && !scope.allowUnscopedReads) {
    return <main className="mx-auto max-w-6xl p-4 md:p-6"><GuardCard message={scope.warning ?? 'Coach access is not configured yet.'} /></main>;
  }

  const rows = await Promise.all(assignments.map(async (assignment) => {
    const [continuity, missedCount, openNotes, lastCompletedAt] = await Promise.all([
      getNextTrainingSessionStateForAthlete(assignment.athleteId).catch(() => ({ kind: 'none' as const, title: 'No session ready', helperText: 'No workout is ready yet.' })),
      getRecentMissedCountForAthlete(assignment.athleteId).catch(() => 0),
      countOpenCoachNotesForAthlete(assignment.athleteId).catch(() => 0),
      getLastCompletedAtForAthlete(assignment.athleteId).catch(() => null),
    ]);
    return { assignment, continuity, missedCount, openNotes, lastCompletedAt };
  }));

  const needsAttention = rows.filter((row) => row.missedCount > 0 || row.openNotes > 0 || !row.assignment.programName);

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Coach Dashboard</p>
          <h1 className="text-2xl font-semibold">Needs attention now</h1>
          <p className="mt-1 text-sm text-neutral-600">A compact queue of athletes, missed work, and next actions.</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/coach/roster" className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-800">Open roster</Link>
          <Link href="/coach/sessions" className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-800">Review sessions</Link>
        </div>
      </div>

      {scope.warning ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{scope.warning}</div> : null}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-neutral-500">Athletes</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{rows.length}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-neutral-500">Need attention</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{needsAttention.length}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-neutral-500">Missed recently</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{rows.filter((row) => row.missedCount > 0).length}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-neutral-500">Open follow-ups</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{rows.filter((row) => row.openNotes > 0).length}</p></div>
      </section>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-neutral-600 shadow-sm">No athletes are visible in this coach scope yet.</div>
        ) : rows.map(({ assignment, continuity, missedCount, openNotes, lastCompletedAt }) => (
          <section key={assignment.id} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-neutral-900">{assignment.athleteName}</p>
                <p className="text-sm text-neutral-600">{assignment.programName ?? 'No Program'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusChip {...getSessionStatusMeta(continuity.kind === 'none' ? 'none' : continuity.kind)} />
                  {missedCount > 0 ? <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">{missedCount} missed recently</span> : null}
                  {openNotes > 0 ? <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800">{openNotes} follow-up open</span> : null}
                </div>
              </div>
              <div className="text-right text-sm text-neutral-600">
                <p className="font-medium text-neutral-800">{continuity.title}</p>
                <p>{formatDate(lastCompletedAt)}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link href={`/coach/athletes/${assignment.athleteId}`} className="rounded-xl bg-black px-3 py-2 font-medium text-white">Open athlete</Link>
              <Link href={`/coach/sessions?q=${encodeURIComponent(assignment.athleteName)}`} className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-800">Review sessions</Link>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
