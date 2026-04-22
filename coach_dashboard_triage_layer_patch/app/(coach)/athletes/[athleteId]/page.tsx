import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAthleteAssignmentDetail, listProgramTemplates } from '@/lib/db/programs';
import { getRecentTrainingSessionsForAthlete } from '@/lib/db/training';
import { getNextTrainingSessionStateForAthlete } from '@/features/training/server/get-next-training-session-state-for-athlete';
import { updateAthleteAssignmentAction } from '@/features/programs/server/actions/update-athlete-assignment-action';
import { listCoachNotesForAthlete } from '@/lib/db/coach-notes';

function formatDate(value: string | null) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleDateString();
}

function statusChip(kind: 'in_progress' | 'missed' | 'ready' | 'none') {
  const config = {
    in_progress: ['In Progress', 'border-blue-200 bg-blue-50 text-blue-800'],
    missed: ['Missed', 'border-amber-200 bg-amber-50 text-amber-800'],
    ready: ['Ready', 'border-green-200 bg-green-50 text-green-800'],
    none: ['No Program', 'border-neutral-200 bg-neutral-50 text-neutral-700'],
  } as const;
  const [label, classes] = config[kind];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}>{label}</span>;
}

export default async function CoachAthleteDetailPage({ params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = await params;
  const assignment = await getAthleteAssignmentDetail(athleteId);
  if (!assignment) notFound();

  const [continuity, recentSessions, programTemplates, notes] = await Promise.all([
    getNextTrainingSessionStateForAthlete(athleteId).catch(() => ({ kind: 'none', title: 'No session ready', statusLabel: 'Pending', helperText: 'No workout is ready yet.' })),
    getRecentTrainingSessionsForAthlete({ athleteId, limit: 8 }),
    listProgramTemplates(),
    listCoachNotesForAthlete(athleteId, 12).catch(() => []),
  ]);

  return (
    <main className="mx-auto max-w-4xl p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Coach Athlete Detail</p>
          <h1 className="text-2xl font-semibold">{assignment.athleteName}</h1>
          <p className="mt-1 text-sm text-neutral-600">Program: {assignment.programName ?? 'No Program'} • Assigned {formatDate(assignment.startsOn)}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm"><Link href="/coach" className="font-medium text-neutral-700 underline underline-offset-4">Coach dashboard</Link><Link href="/coach/roster" className="font-medium text-neutral-700 underline underline-offset-4">Back to roster</Link></div>
      </div>

      {!assignment.scope?.scoped ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Ownership filtering is not fully enabled in this repo slice. Set <code>IRONHQ_COACH_PROFILE_ID</code> to scope this athlete view and assignment actions to a single coach.
        </div>
      ) : null}

      <section className="mb-6 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Next session state</p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-900">{continuity.title}</h2>
            <div className="mt-2">{statusChip(continuity.kind as any)}</div>
            <p className="mt-3 text-sm text-neutral-600">{continuity.helperText}</p>
          </div>
          <div className="text-sm text-neutral-600">
            <p>Current cursor: Week {assignment.currentWeekIndex ?? '—'} • Day {assignment.currentDayIndex ?? '—'}</p>
            <p className="mt-1">Athlete ID: {assignment.athleteId}</p>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Program assignment</h2>
        <p className="mt-1 text-sm text-neutral-600">Update the athlete's active program without deleting completed session history.</p>
        <form action={updateAthleteAssignmentAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <input type="hidden" name="athleteId" value={assignment.athleteId} />
          <label className="space-y-2">
            <span className="text-sm font-medium">Assigned program</span>
            <select name="programId" defaultValue={assignment.programId ?? ''} className="w-full rounded-xl border px-3 py-2">
              {programTemplates.map((program) => (
                <option key={program.id} value={program.id}>{program.name}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" className="w-full rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">Update assignment</button>
          </div>
        </form>
      </section>

      <section className="mb-6 rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Coach notes in scope</h2>
        <div className="mt-4 space-y-2">
          {notes.length === 0 ? <p className="text-sm text-neutral-600">No notes for this athlete in the current coach scope.</p> : notes.map((note) => (
            <div key={note.id} className="rounded-xl border border-neutral-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium capitalize text-neutral-900">{note.noteKind.replace('_', ' ')}</p>
                <span className="text-xs text-neutral-500">{formatDate(note.createdAt)}</span>
              </div>
              <p className="mt-2 text-sm text-neutral-700">{note.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Recent sessions</h2>
        <div className="mt-4 space-y-3">
          {recentSessions.length === 0 ? (
            <p className="text-sm text-neutral-600">No sessions yet.</p>
          ) : recentSessions.map((session) => {
            const label = session.runtime_state === 'completed' ? 'Completed' : session.runtime_state === 'missed' ? 'Missed' : session.runtime_state === 'in_progress' ? 'In Progress' : 'Pending';
            return (
              <Link key={session.id} href={`/coach/sessions/${session.id}`} className="block rounded-xl border border-neutral-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-neutral-900">{session.planned_snapshot?.sessionTitle ?? 'Training Session'}</p>
                    <p className="text-sm text-neutral-600">{formatDate(session.ended_at ?? session.started_at ?? session.scheduled_date)}</p>
                  </div>
                  <span className="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium text-neutral-700">{label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
