import { notFound } from 'next/navigation';
import { TrainingSessionRuntime } from '@/features/training/components/TrainingSessionRuntime';
import { getCurrentAthleteProfileId } from '@/lib/auth/current-athlete-profile';
import { getSessionPageData } from '@/features/training/server/get-session-page-data';
import { logSetAction } from '@/features/training/server/actions/log-set-action';
import { completeExerciseAction } from '@/features/training/server/actions/complete-exercise-action';
import { completeSessionAction } from '@/features/training/server/actions/complete-session-action';
import {
  getTrainingSessionForPage,
  getTrainingSessionExercisesForPage,
  getSetsForTrainingSessionExercise,
} from '@/lib/db/training';

type SessionPageData = {
  sessionId: string;
  title: string;
  exercises: any[];
};

async function getSessionPageDataForPage(sessionId: string): Promise<SessionPageData | null> {
  return getSessionPageData({
    sessionId,
    deps: {
      getTrainingSession: getTrainingSessionForPage,
      getTrainingSessionExercises: getTrainingSessionExercisesForPage,
      getSetsForTrainingSessionExercise,
    },
  });
}

export default async function TrainingSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const athleteId = getCurrentAthleteProfileId();
  if (!athleteId) {
    return <main className="mx-auto max-w-4xl p-4 md:p-6"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 shadow-sm">Set <code>IRONHQ_ATHLETE_PROFILE_ID</code> to use the active session runtime in this slice.</div></main>;
  }

  const { sessionId } = await params;
  const data = await getSessionPageDataForPage(sessionId);

  if (!data) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl p-4 md:p-6">
      <TrainingSessionRuntime
        data={data}
        onLogSet={logSetAction}
        onCompleteExercise={completeExerciseAction}
        onCompleteSession={completeSessionAction}
      />
    </main>
  );
}
