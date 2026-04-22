import Link from 'next/link';
import { listCoachRosterAssignments } from '@/lib/db/programs';
import { getLatestTrainingSessionsForAthlete } from '@/lib/db/training';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type RuntimeFilter = 'all' | 'completed' | 'missed' | 'in_progress' | 'pending';

function labelForRuntimeState(value: string | null) {
  if (value === 'completed') return 'Completed';
  if (value === 'missed') return 'Missed';
  if (value === 'in_progress') return 'In Progress';
  return 'Pending';
}

function chipClasses(value: string | null) {
  if (value === 'completed') return 'border-green-200 bg-green-50 text-green-800';
  if (value === 'missed') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (value === 'in_progress') return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-neutral-200 bg-neutral-50 text-neutral-700';
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No date';
  return new Date(value).toLocaleDateString();
}

export default async function CoachSessionsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = (firstParam(params.q) ?? '').trim().toLowerCase();
  const status = ((firstParam(params.status) ?? 'all') as RuntimeFilter);

  const assignments = await listCoachRosterAssignments();
  const athleteMeta = new Map(assignments.map((row) => [row.athleteId, row]));
  const athleteIds = [...new Set(assignments.map((row) => row.athleteId))];
  const sessionsNested = await Promise.all(athleteIds.map((athleteId) => getLatestTrainingSessionsForAthlete(athleteId, 8).catch(() => [])));
  const sessions = sessionsNested
    .flat()
    .map((session) => ({
      ...session,
      athleteName: athleteMeta.get(session.athlete_id ?? '')?.athleteName ?? 'Athlete',
      programName: athleteMeta.get(session.athlete_id ?? '')?.programName ?? null,
    }))
    .filter((session) => {
      const haystack = [session.athleteName, session.programName ?? '', session.planned_snapshot?.sessionTitle ?? 'Training Session'].join(' ').toLowerCase();
      const runtime = (session.runtime_state ?? 'pending') as RuntimeFilter;
      return (!q || haystack.includes(q)) && (status === 'all' || runtime === status);
    })
    .sort((a, b) => new Date(b.started_at ?? b.scheduled_date ?? 0).getTime() - new Date(a.started_at ?? a.scheduled_date ?? 0).getTime())
    .slice(0, 50);

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Coach Sessions</p>
          <h1 className="text-2xl font-semibold">Recent training status</h1>
          <p className="text-sm text-neutral-600">Filter recent sessions by athlete and status to move through the coaching queue faster.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/coach" className="font-medium text-neutral-700 underline underline-offset-4">Coach dashboard</Link>
          <Link href="/coach/roster" className="font-medium text-neutral-700 underline underline-offset-4">Open coach roster</Link>
        </div>
      </div>

      <section className="mb-5 rounded-2xl border bg-white p-4 shadow-sm">
        <form className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end" method="get">
          <label className="space-y-2">
            <span className="text-sm font-medium text-neutral-800">Search athlete or session</span>
            <input name="q" defaultValue={q} placeholder="Search athlete, program, session title" className="w-full rounded-xl border px-3 py-2 text-sm" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-neutral-800">Status</span>
            <select name="status" defaultValue={status} className="rounded-xl border px-3 py-2 text-sm">
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="missed">Missed</option>
              <option value="in_progress">In Progress</option>
              <option value="pending">Pending</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">Apply</button>
            <Link href="/coach/sessions" className="rounded-xl border border-neutral-300 px-4 py-2 text-sm text-neutral-800">Clear</Link>
          </div>
        </form>
        <p className="mt-3 text-xs text-neutral-500">Showing {sessions.length} recent sessions in the current coach scope.</p>
      </section>

      <div className="space-y-3">
        {sessions.length === 0 ? <div className="rounded-2xl border bg-white p-4 text-sm text-neutral-600 shadow-sm">No recent sessions match the current filters.</div> : sessions.map((session) => (
          <Link key={session.id} href={`/coach/sessions/${session.id}`} className="block rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-medium text-neutral-900">{session.planned_snapshot?.sessionTitle ?? 'Training Session'}</p>
                <p className="text-sm text-neutral-600">{session.athleteName} • {session.programName ?? 'No Program'}</p>
                <p className="text-sm text-neutral-600">{formatDate(session.scheduled_date ?? session.started_at)} • {labelForRuntimeState(session.runtime_state ?? null)}</p>
              </div>
              <span className={`rounded-full border px-2 py-1 text-xs font-medium ${chipClasses(session.runtime_state ?? null)}`}>{labelForRuntimeState(session.runtime_state ?? null)}</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
