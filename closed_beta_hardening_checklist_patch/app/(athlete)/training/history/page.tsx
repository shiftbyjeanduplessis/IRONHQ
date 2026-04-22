import Link from 'next/link';
import { StatusChip, getSessionStatusMeta } from '@/features/ui/status-badges';
import { getCurrentAthleteProfileId } from '@/lib/auth/current-athlete-profile';
import { getRecentTrainingSessionsForAthlete, getTrainingSessionExercisesForHistory } from '@/lib/db/training';

function formatSessionDate(value: string | null | undefined) {
  if (!value) return 'Unknown date';
  return new Date(value).toLocaleDateString();
}

function deriveStatus(session: any): 'pending' | 'in_progress' | 'completed' | 'missed' {
  if (session.runtime_state === 'completed') return 'completed';
  if (session.runtime_state === 'missed') return 'missed';
  if (session.runtime_state === 'in_progress' || session.runtime_state === 'paused') return 'in_progress';
  return 'pending';
}

export default async function TrainingHistoryPage() {
  const athleteId = getCurrentAthleteProfileId();
  if (!athleteId) {
    return <main className="mx-auto max-w-4xl p-4 md:p-6"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 shadow-sm">Set <code>IRONHQ_ATHLETE_PROFILE_ID</code> to use athlete history in this slice.</div></main>;
  }

  const sessions = await getRecentTrainingSessionsForAthlete({ athleteId, limit: 24 });
  const summaries = await Promise.all(
    sessions.map(async (session) => {
      const status = deriveStatus(session);
      const exercises = status === 'completed' ? await getTrainingSessionExercisesForHistory(session.id) : [];
      const increased = exercises.filter((row) => (row.manual_progression_outcome ?? row.progression_outcome) === 'increase').length;
      const repeat = exercises.filter((row) => (row.manual_progression_outcome ?? row.progression_outcome) === 'repeat').length;
      const deload = exercises.filter((row) => (row.manual_progression_outcome ?? row.progression_outcome) === 'deload').length;
      return { session, status, exerciseCount: exercises.length, increased, repeat, deload };
    })
  );

  const completedCount = summaries.filter((item) => item.status === 'completed').length;
  const missedCount = summaries.filter((item) => item.status === 'missed').length;

  return (
    <main className="mx-auto max-w-4xl p-4 md:p-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Training History</p>
          <h1 className="text-2xl font-semibold">Recent sessions</h1>
          <p className="mt-1 text-sm text-neutral-600">{completedCount} completed • {missedCount} missed</p>
        </div>
        <Link href="/training/today" className="text-sm font-medium text-neutral-700 underline underline-offset-4">Back to today</Link>
      </div>

      <div className="space-y-3">
        {summaries.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-neutral-600 shadow-sm">No session history yet. Complete a workout and it will appear here.</div>
        ) : summaries.map(({ session, status, exerciseCount, increased, repeat, deload }) => (
          <Link key={session.id} href={status === 'in_progress' ? `/training/session/${session.id}` : `/training/history/${session.id}`} className="block rounded-2xl border bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:shadow">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-2"><StatusChip {...getSessionStatusMeta(status)} /></div>
                <h2 className="text-lg font-semibold text-neutral-900">{session.planned_snapshot?.sessionTitle ?? 'Training Session'}</h2>
                <p className="text-sm text-neutral-600">{formatSessionDate(session.ended_at ?? session.started_at ?? session.scheduled_date)}{status === 'completed' ? ` • ${session.outcome ?? 'completed'}` : ''}</p>
              </div>
              <div className="text-right text-sm text-neutral-600">
                {status === 'completed' ? (
                  <>
                    <div>{exerciseCount} exercises</div>
                    <div>{increased} increased • {repeat} repeat • {deload} deload</div>
                  </>
                ) : status === 'missed' ? (
                  <div>Session missed</div>
                ) : (
                  <div>Return to session</div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
