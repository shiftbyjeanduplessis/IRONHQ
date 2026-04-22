import Link from 'next/link';
import { getCurrentCoachScope } from '@/lib/auth/coach-scope';
import { listCoachRosterAssignments } from '@/lib/db/programs';
import { getRecentMissedCountForAthlete, getLastCompletedAtForAthlete } from '@/lib/db/training';
import { getNextTrainingSessionStateForAthlete } from '@/features/training/server/get-next-training-session-state-for-athlete';
import { countOpenCoachNotesForAthlete } from '@/lib/db/coach-notes';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type ContinuityKind = 'in_progress' | 'missed' | 'ready' | 'none';
type StatusFilter = 'all' | ContinuityKind;

function chipClasses(kind: ContinuityKind) {
  switch (kind) {
    case 'in_progress': return 'border-blue-200 bg-blue-50 text-blue-800';
    case 'missed': return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'ready': return 'border-green-200 bg-green-50 text-green-800';
    default: return 'border-neutral-200 bg-neutral-50 text-neutral-700';
  }
}

function labelForState(kind: ContinuityKind) {
  switch (kind) {
    case 'in_progress': return 'In Progress';
    case 'missed': return 'Missed';
    case 'ready': return 'Ready';
    default: return 'No Program';
  }
}

function formatDate(value: string | null) {
  if (!value) return 'No recent completion';
  return `Last completed ${new Date(value).toLocaleDateString()}`;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function matchesStatus(kind: ContinuityKind, filter: StatusFilter) {
  return filter === 'all' ? true : kind === filter;
}

export default async function CoachRosterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const scope = await getCurrentCoachScope();
  const q = (firstParam(params.q) ?? '').trim().toLowerCase();
  const status = ((firstParam(params.status) ?? 'all') as StatusFilter);
  const onlyNeedsAttention = firstParam(params.attention) === '1';

  if (!scope.scoped) {
    return (
      <main className="mx-auto max-w-4xl p-4 md:p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm text-amber-700">Coach access required</p>
          <h1 className="mt-1 text-2xl font-semibold text-amber-950">Roster is hidden until a coach is identified.</h1>
          <p className="mt-3 text-sm text-amber-900">Provide <code>x-ironhq-auth-user-id</code> or set <code>IRONHQ_AUTH_USER_ID</code>, then link that auth user to a coach profile in <code>profiles.auth_user_id</code>.</p>
        </div>
      </main>
    );
  }

  const assignments = await listCoachRosterAssignments();
  const hydratedRows = await Promise.all(assignments.map(async (assignment) => {
    const [continuity, missedCount, lastCompletedAt, openNotes] = await Promise.all([
      getNextTrainingSessionStateForAthlete(assignment.athleteId).catch(() => ({ kind: 'none', title: 'No session ready', statusLabel: 'Pending', helperText: 'No workout is ready yet.' })),
      getRecentMissedCountForAthlete(assignment.athleteId).catch(() => 0),
      getLastCompletedAtForAthlete(assignment.athleteId).catch(() => null),
      countOpenCoachNotesForAthlete(assignment.athleteId).catch(() => 0),
    ]);
    const nextSessionTitle = continuity.kind === 'none' ? 'No session ready' : continuity.title;
    return { ...assignment, continuity, missedCount, lastCompletedAt, nextSessionTitle, openNotes };
  }));

  const rows = hydratedRows.filter((row) => {
    const haystack = [row.athleteName, row.programName ?? '', row.nextSessionTitle].join(' ').toLowerCase();
    const attention = row.missedCount > 0 || row.openNotes > 0 || row.continuity.kind === 'missed' || !row.programName;
    return (!q || haystack.includes(q)) && matchesStatus(row.continuity.kind as ContinuityKind, status) && (!onlyNeedsAttention || attention);
  });

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Coach Roster</p>
          <h1 className="text-2xl font-semibold">Assigned athletes</h1>
          <p className="mt-1 text-sm text-neutral-600">Coach-scoped roster visibility is active.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm"><Link href="/coach" className="font-medium text-neutral-700 underline underline-offset-4">Coach dashboard</Link><Link href="/coach/sessions" className="font-medium text-neutral-700 underline underline-offset-4">Review sessions</Link></div>
      </div>
      <section className="mb-5 rounded-2xl border bg-white p-4 shadow-sm">
        <form className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end" method="get">
          <label className="space-y-2"><span className="text-sm font-medium text-neutral-800">Search athlete or program</span><input name="q" defaultValue={q} placeholder="Search athlete, program, next session" className="w-full rounded-xl border px-3 py-2 text-sm" /></label>
          <label className="space-y-2"><span className="text-sm font-medium text-neutral-800">Status</span><select name="status" defaultValue={status} className="rounded-xl border px-3 py-2 text-sm"><option value="all">All statuses</option><option value="in_progress">In Progress</option><option value="missed">Missed</option><option value="ready">Ready</option><option value="none">No Program</option></select></label>
          <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-neutral-700"><input type="checkbox" name="attention" value="1" defaultChecked={onlyNeedsAttention} />Needs attention only</label>
          <div className="flex gap-2"><button type="submit" className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">Apply</button><Link href="/coach/roster" className="rounded-xl border border-neutral-300 px-4 py-2 text-sm text-neutral-800">Clear</Link></div>
        </form>
      </section>
      <div className="space-y-3">
        {rows.length === 0 ? <div className="rounded-2xl border bg-white p-6 text-sm text-neutral-600 shadow-sm">No coach-scoped athletes match the current filters.</div> : rows.map((row) => (
          <section key={row.id} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-neutral-900">{row.athleteName}</p>
                <p className="text-sm text-neutral-600">{row.programName ?? 'No Program'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${chipClasses(row.continuity.kind as ContinuityKind)}`}>{labelForState(row.continuity.kind as ContinuityKind)}</span>
                  {row.missedCount > 0 ? <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">{row.missedCount} missed recently</span> : null}
                  {row.openNotes > 0 ? <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800">{row.openNotes} follow-up open</span> : null}
                </div>
              </div>
              <div className="text-right text-sm text-neutral-600">
                <p className="font-medium text-neutral-800">{row.nextSessionTitle}</p>
                <p>{formatDate(row.lastCompletedAt)}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link href={`/coach/athletes/${row.athleteId}`} className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-800">View athlete</Link>
              <Link href={`/coach/sessions?q=${encodeURIComponent(row.athleteName)}`} className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-800">Review sessions</Link>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
