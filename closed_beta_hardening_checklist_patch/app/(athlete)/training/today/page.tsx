import { redirect } from 'next/navigation';
import { SessionPreviewCard } from '@/features/training/components/SessionPreviewCard';
import { ResumeSessionBanner } from '@/features/training/components/ResumeSessionBanner';
import { TrainingContinuityCard } from '@/features/training/components/TrainingContinuityCard';
import { buildSessionPayload, type BuiltSessionPayload } from '@/features/training/server/build-session-payload';
import { getNextTrainingSessionState } from '@/features/training/server/get-next-training-session-state';
import { startSession } from '@/features/training/server/start-session';
import { markSessionMissedAction } from '@/features/training/server/actions/mark-session-missed-action';
import { getCurrentAthleteProfileId } from '@/lib/auth/current-athlete-profile';
import {
  getActiveAssignment,
  getProgramHeader,
  getCurrentProgramDay,
  getDayExercises,
  getExercisesByIds,
} from '@/lib/db/programs';
import { getOpenTrainingSessionForAthlete, getLatestTrainingSessionsForAthlete, insertTrainingSession, insertTrainingSessionExercises } from '@/lib/db/training';
import { getExerciseProgressionStatesForPayload, getProgressionRulesByIds } from '@/lib/db/progression';

async function buildSessionPayloadForPage(athleteId: string): Promise<BuiltSessionPayload> {
  return buildSessionPayload({
    athleteId,
    deps: {
      getActiveAssignment,
      getProgramHeader,
      getCurrentProgramDay,
      getDayExercises,
      getExercisesByIds,
      getProgressionStates: getExerciseProgressionStatesForPayload,
      getProgressionRulesByIds,
    },
  });
}

async function startSessionForPage(args: {
  athleteId: string;
  readiness?: { energy: number; soreness: number; motivation: number; note?: string | null };
}): Promise<{ sessionId: string }> {
  return startSession({
    athleteId: args.athleteId,
    readiness: args.readiness,
    deps: {
      async buildSessionPayload({ athleteId }) {
        return buildSessionPayloadForPage(athleteId);
      },
      insertTrainingSession,
      insertTrainingSessionExercises,
    },
  });
}

async function startWorkoutAction(formData: FormData) {
  'use server';
  const athleteId = getCurrentAthleteProfileId();
  if (!athleteId) {
    throw new Error('Athlete profile is not configured for this slice.');
  }

  const energy = Number(formData.get('energy') ?? 3);
  const soreness = Number(formData.get('soreness') ?? 3);
  const motivation = Number(formData.get('motivation') ?? 3);
  const noteRaw = formData.get('note');
  const note = typeof noteRaw === 'string' && noteRaw.trim() ? noteRaw.trim() : null;

  const result = await startSessionForPage({
    athleteId,
    readiness: { energy, soreness, motivation, note },
  });

  redirect(`/training/session/${result.sessionId}`);
}

export default async function TrainingTodayPage() {
  const athleteId = getCurrentAthleteProfileId();
  if (!athleteId) {
    return (
      <main className="mx-auto max-w-3xl p-4 md:p-6">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 shadow-sm">
          <h1 className="text-lg font-semibold">Athlete training is not configured yet</h1>
          <p className="mt-2">Set <code>IRONHQ_ATHLETE_PROFILE_ID</code> for this beta slice so the training runtime can load one athlete safely.</p>
        </section>
      </main>
    );
  }

  const continuity = await getNextTrainingSessionState({
    athleteId,
    deps: {
      getOpenTrainingSession: getOpenTrainingSessionForAthlete,
      buildSessionPayload: ({ athleteId }) => buildSessionPayloadForPage(athleteId),
    },
  });
  const recentSessions = await getLatestTrainingSessionsForAthlete(athleteId, 8);
  const completedThisMonth = recentSessions.filter((row) => row.runtime_state === 'completed').length;
  const missedThisWeek = recentSessions.filter((row) => row.runtime_state === 'missed').length;

  return (
    <main className="mx-auto max-w-3xl p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Today's Training</p>
          <h1 className="text-2xl font-semibold">Training</h1>
          <p className="text-sm text-neutral-600">{completedThisMonth} completed recently • {missedThisWeek} missed</p>
        </div>
        <a href="/training/history" className="text-sm font-medium text-neutral-700 underline underline-offset-4">Open history</a>
      </div>
      <ResumeSessionBanner />
      <TrainingContinuityCard state={continuity} onMarkMissed={markSessionMissedAction} />
      {continuity.kind === 'ready' && continuity.payload ? (
        <SessionPreviewCard payload={continuity.payload} action={startWorkoutAction} />
      ) : null}
    </main>
  );
}
