import Link from 'next/link';
import { listCoachRosterAssignments } from '@/lib/db/programs';
import { getLatestTrainingSessionsForAthlete } from '@/lib/db/training';

function labelForRuntimeState(value: string | null) {
  if (value === 'completed') return 'Completed';
  if (value === 'missed') return 'Missed';
  if (value === 'in_progress') return 'In Progress';
  return 'Pending';
}

export default async function CoachSessionsPage() {
  const assignments = await listCoachRosterAssignments();
  const athleteIds = [...new Set(assignments.map((row) => row.athleteId))];
  const sessionsNested = await Promise.all(athleteIds.map((athleteId) => getLatestTrainingSessionsForAthlete(athleteId, 8).catch(() => [])));
  const sessions = sessionsNested.flat().sort((a, b) => new Date(b.started_at ?? b.scheduled_date ?? 0).getTime() - new Date(a.started_at ?? a.scheduled_date ?? 0).getTime()).slice(0, 30);

  return (
    <main className="mx-auto max-w-4xl p-4 md:p-6">
      <div className="mb-6">
        <p className="text-sm text-neutral-500">Coach Sessions</p>
        <h1 className="text-2xl font-semibold">Recent training status</h1>
        <p className="text-sm text-neutral-600">Inspect what athletes should resume, what was missed, and what was completed in your current scope.</p>
        <p className="mt-2 text-sm"><Link href="/coach/roster" className="text-neutral-700 underline underline-offset-4">Open coach roster</Link></p>
      </div>
      <div className="space-y-3">
        {sessions.length === 0 ? <div className="rounded-2xl border bg-white p-4 text-sm text-neutral-600 shadow-sm">No recent sessions in the current coach scope.</div> : sessions.map((session) => (
          <Link key={session.id} href={`/coach/sessions/${session.id}`} className="block rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-medium text-neutral-900">{session.planned_snapshot?.sessionTitle ?? 'Training Session'}</p>
                <p className="text-sm text-neutral-600">{session.scheduled_date ?? 'No date'} • {labelForRuntimeState(session.runtime_state ?? null)}</p>
              </div>
              <span className="rounded-full border px-2 py-1 text-xs font-medium text-neutral-700">{labelForRuntimeState(session.runtime_state ?? null)}</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
