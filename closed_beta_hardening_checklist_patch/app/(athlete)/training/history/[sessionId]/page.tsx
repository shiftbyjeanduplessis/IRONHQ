import Link from 'next/link';
import { StatusChip, getSessionStatusMeta } from '@/features/ui/status-badges';
import { notFound } from 'next/navigation';
import { CompletedSessionExerciseCard } from '@/features/training/components/CompletedSessionExerciseCard';
import { getCurrentAthleteProfileId } from '@/lib/auth/current-athlete-profile';
import { getExercisesByIds } from '@/lib/db/programs';
import { getSetsForTrainingSessionExercise, getTrainingSessionExercisesForHistory, getTrainingSessionForAthleteHistory } from '@/lib/db/training';

function formatDate(value: string | null | undefined) {
  if (!value) return 'Unknown date';
  return new Date(value).toLocaleString();
}

function deriveStatus(session: any): 'pending' | 'in_progress' | 'completed' | 'missed' {
  if (session.runtime_state === 'completed') return 'completed';
  if (session.runtime_state === 'missed') return 'missed';
  if (session.runtime_state === 'in_progress' || session.runtime_state === 'paused') return 'in_progress';
  return 'pending';
}

export default async function AthleteSessionDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const athleteId = getCurrentAthleteProfileId();
  if (!athleteId) {
    return <main className="mx-auto max-w-4xl p-4 md:p-6"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 shadow-sm">Set <code>IRONHQ_ATHLETE_PROFILE_ID</code> to use session detail in this slice.</div></main>;
  }

  const { sessionId } = await params;
  const session = await getTrainingSessionForAthleteHistory({ sessionId, athleteId });
  if (!session) notFound();

  const status = deriveStatus(session);
  const exercises = await getTrainingSessionExercisesForHistory(sessionId);
  const exerciseIds = [...new Set(exercises.flatMap((row) => [row.actual_exercise_id, row.planned_exercise_id]).filter(Boolean))] as string[];
  const exerciseMap = await getExercisesByIds(exerciseIds);
  const exerciseCards = await Promise.all(exercises.map(async (row) => ({ row, sets: await getSetsForTrainingSessionExercise(row.id) })));

  return (
    <main className="mx-auto max-w-4xl p-4 md:p-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Session Detail</p>
          <h1 className="text-2xl font-semibold">{session.planned_snapshot?.sessionTitle ?? 'Training Session'}</h1>
          <div className="mt-2"><StatusChip {...getSessionStatusMeta(status)} /></div>
          <p className="mt-2 text-sm text-neutral-600">{status === 'missed' ? `Marked missed ${formatDate(session.missed_at ?? session.ended_at ?? session.scheduled_date)}` : `Completed ${formatDate(session.ended_at ?? session.started_at ?? session.scheduled_date)}`}</p>
        </div>
        <Link href="/training/history" className="text-sm font-medium text-neutral-700 underline underline-offset-4">All history</Link>
      </div>

      {status === 'missed' && exerciseCards.length === 0 ? (
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">Missed session</h2>
          <p className="mt-2 text-sm text-neutral-600">This planned workout was marked missed. No progression was applied and no performed sets were logged.</p>
        </section>
      ) : null}

      <div className="space-y-4">
        {exerciseCards.map(({ row, sets }) => {
          const actualName = exerciseMap.get(row.actual_exercise_id)?.name ?? row.actual_exercise_id ?? 'Exercise';
          const plannedName = exerciseMap.get(row.planned_exercise_id)?.name ?? row.planned_exercise_id ?? actualName;
          return (
            <CompletedSessionExerciseCard
              key={row.id}
              exerciseName={actualName}
              plannedExerciseName={plannedName}
              prescribedWeight={row.prescribed_weight == null ? null : Number(row.prescribed_weight)}
              prescribedRepsText={row.prescribed_reps_text ?? row.planned_snapshot?.prescribedRepsText ?? null}
              loggedSets={sets}
              progressionOutcome={row.manual_progression_outcome ?? row.progression_outcome ?? null}
              progressionNote={row.manual_progression_note ?? row.progression_note ?? null}
              wasSubstituted={Boolean(row.was_substituted)}
              substitutionReason={row.substitution_reason ?? null}
              manualOverrideApplied={Boolean(row.progression_override_applied_at)}
              manualOverrideNote={row.manual_progression_note ?? null}
              adherenceStatus={status}
            />
          );
        })}
      </div>
    </main>
  );
}
