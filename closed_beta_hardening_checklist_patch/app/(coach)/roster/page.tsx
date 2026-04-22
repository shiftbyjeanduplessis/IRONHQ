import Link from 'next/link';
import { StatusChip, getSessionStatusMeta } from '@/features/ui/status-badges';
import { listCoachRosterAssignments } from '@/lib/db/programs';
import { getRecentMissedCountForAthlete, getLastCompletedAtForAthlete } from '@/lib/db/training';
import { getNextTrainingSessionStateForAthlete } from '@/features/training/server/get-next-training-session-state-for-athlete';
import { countOpenCoachNotesForAthlete } from '@/lib/db/coach-notes';

function firstParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function formatDate(value: string | null) { return value ? `Last completed ${new Date(value).toLocaleDateString()}` : 'No recent completion'; }

export default async function CoachRosterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = (firstParam(params.q) ?? '').trim().toLowerCase();
  const status = firstParam(params.status) ?? 'all';
  const assignments = await listCoachRosterAssignments();
  const scope = assignments[0]?.scope ?? { scoped: false, allowUnscopedReads: false, warning: 'Coach access is not configured yet.' };

  if (!scope.scoped && !scope.allowUnscopedReads) {
    return <main className="mx-auto max-w-5xl p-4 md:p-6"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 shadow-sm">{scope.warning ?? 'Coach access is not configured yet.'}</div></main>;
  }

  const rows = await Promise.all(assignments.map(async (assignment) => {
    const [continuity, missedCount, openNotes, lastCompletedAt] = await Promise.all([
      getNextTrainingSessionStateForAthlete(assignment.athleteId).catch(() => ({ kind: 'none' as const, title: 'No session ready' })),
      getRecentMissedCountForAthlete(assignment.athleteId).catch(() => 0),
      countOpenCoachNotesForAthlete(assignment.athleteId).catch(() => 0),
      getLastCompletedAtForAthlete(assignment.athleteId).catch(() => null),
    ]);
    return { assignment, continuity, missedCount, openNotes, lastCompletedAt };
  }));

  const filtered = rows.filter((row) => {
    const haystack = `${row.assignment.athleteName} ${row.assignment.programName ?? ''} ${row.continuity.title ?? ''}`.toLowerCase();
    return (!q || haystack.includes(q)) && (status === 'all' || row.continuity.kind === status);
  });

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Coach Roster</p>
          <h1 className="text-2xl font-semibold">Athletes</h1>
          <p className="text-sm text-neutral-600">Current assignments, next session state, and missed-work clues.</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/coach" className="font-medium text-neutral-700 underline underline-offset-4">Coach dashboard</Link>
          <Link href="/coach/sessions" className="font-medium text-neutral-700 underline underline-offset-4">Sessions</Link>
        </div>
      </div>

      {scope.warning ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{scope.warning}</div> : null}

      <section className="mb-5 rounded-2xl border bg-white p-4 shadow-sm">
        <form className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end" method="get">
          <label className="space-y-2">
            <span className="text-sm font-medium text-neutral-800">Search athlete or program</span>
            <input name="q" defaultValue={q} placeholder="Search athlete, program, next session" className="w-full rounded-xl border px-3 py-2 text-sm" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-neutral-800">Status</span>
            <select name="status" defaultValue={status} className="rounded-xl border px-3 py-2 text-sm">
              <option value="all">All statuses</option>
              <option value="in_progress">In Progress</option>
              <option value="missed">Missed</option>
              <option value="ready">Ready</option>
              <option value="none">No Program</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">Apply</button>
            <Link href="/coach/roster" className="rounded-xl border border-neutral-300 px-4 py-2 text-sm text-neutral-800">Clear</Link>
          </div>
        </form>
      </section>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-neutral-600 shadow-sm">No roster results match the current filters.</div>
        ) : filtered.map(({ assignment, continuity, missedCount, openNotes, lastCompletedAt }) => (
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
