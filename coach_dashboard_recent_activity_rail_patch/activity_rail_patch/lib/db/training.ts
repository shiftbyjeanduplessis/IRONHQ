import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function insertTrainingSession(input: any): Promise<{ id: string }> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('training_sessions')
    .insert({
      athlete_id: input.athleteId,
      athlete_program_assignment_id: input.athleteProgramAssignmentId,
      program_id: input.programId,
      scheduled_date: input.scheduledDate,
      started_at: input.startedAt,
      runtime_state: input.runtimeState,
      outcome: input.outcome,
      readiness_energy: input.readinessEnergy,
      readiness_soreness: input.readinessSoreness,
      readiness_motivation: input.readinessMotivation,
      readiness_note: input.readinessNote,
      readiness_suggestion: input.readinessSuggestion,
      readiness_applied: input.readinessApplied,
      planned_snapshot: input.plannedSnapshot,
      override_snapshot: input.overrideSnapshot,
      execution_snapshot: input.executionSnapshot,
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id };
}

export async function insertTrainingSessionExercises(rows: any[]): Promise<void> {
  const supabase = getSupabaseServerClient();
  const payload = rows.map((row) => ({
    training_session_id: row.trainingSessionId,
    original_day_exercise_id: row.originalDayExerciseId,
    planned_exercise_id: row.plannedExerciseId,
    actual_exercise_id: row.actualExerciseId,
    display_order: row.displayOrder,
    runtime_state: row.runtimeState,
    planned_snapshot: row.plannedSnapshot,
    actual_summary: row.actualSummary,
    was_substituted: row.wasSubstituted,
    substitution_reason: row.substitutionReason,
    substitution_impact: row.substitutionImpact,
    skipped_reason: row.skippedReason,
    athlete_note: row.athleteNote,
    prescribed_weight: row.prescribedWeight,
    prescribed_reps_text: row.prescribedRepsText,
  }));
  const { error } = await supabase.from('training_session_exercises').insert(payload);
  if (error) throw error;
}

export async function getTrainingSession(sessionId: string): Promise<any | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('training_sessions').select('*').eq('id', sessionId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTrainingSessionForPage(sessionId: string): Promise<any | null> {
  return getTrainingSession(sessionId);
}

export async function getTrainingSessionForCompletion(sessionId: string): Promise<any | null> {
  const row = await getTrainingSession(sessionId);
  if (!row) return null;
  return {
    id: row.id,
    athleteId: row.athlete_id ?? null,
    runtimeState: row.runtime_state,
    plannedSnapshot: row.planned_snapshot ?? {},
  };
}

export async function getTrainingSessionExercisesForPage(sessionId: string): Promise<any[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('training_session_exercises')
    .select('id, actual_exercise_id, display_order, runtime_state, planned_snapshot, prescribed_weight, prescribed_reps_text, progression_outcome, progression_note, manual_progression_outcome, manual_progression_note, was_substituted, substitution_reason, substitution_impact')
    .eq('training_session_id', sessionId)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    actualExerciseId: row.actual_exercise_id,
    displayOrder: row.display_order,
    runtimeState: row.runtime_state,
    plannedSnapshot: row.planned_snapshot ?? {},
    prescribedWeight: row.prescribed_weight == null ? null : Number(row.prescribed_weight),
    prescribedRepsText: row.prescribed_reps_text ?? null,
    progressionOutcome: row.manual_progression_outcome ?? row.progression_outcome ?? null,
    progressionNote: row.manual_progression_note ?? row.progression_note ?? null,
    wasSubstituted: Boolean(row.was_substituted),
    substitutionReason: row.substitution_reason ?? null,
    substitutionImpact: row.substitution_impact ?? null,
  }));
}

export async function getSessionExercisesForCompletion(sessionId: string): Promise<any[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('training_session_exercises').select('id, runtime_state').eq('training_session_id', sessionId);
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, runtimeState: row.runtime_state }));
}

export async function getSessionExerciseIdsForProgression(sessionId: string): Promise<string[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('training_session_exercises').select('id').eq('training_session_id', sessionId).order('display_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

export async function finalizeTrainingSession(args: { trainingSessionId: string; runtimeState: 'completed'; outcome: string; endedAt: string; athleteNote: string | null; }): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('training_sessions')
    .update({ runtime_state: args.runtimeState, outcome: args.outcome, ended_at: args.endedAt, athlete_note: args.athleteNote })
    .eq('id', args.trainingSessionId);
  if (error) throw error;
}

export async function getTrainingSessionExercise(trainingSessionExerciseId: string): Promise<any | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('training_session_exercises').select('id, training_session_id, runtime_state').eq('id', trainingSessionExerciseId).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, trainingSessionId: data.training_session_id, runtimeState: data.runtime_state } : null;
}

export async function getTrainingSessionExerciseForCompletion(trainingSessionExerciseId: string): Promise<any | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('training_session_exercises').select('id, runtime_state, planned_snapshot').eq('id', trainingSessionExerciseId).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, runtimeState: data.runtime_state, plannedSnapshot: data.planned_snapshot ?? {} } : null;
}

export async function insertTrainingSessionSet(input: any): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('training_session_sets').insert({
    training_session_exercise_id: input.trainingSessionExerciseId,
    set_order: input.setOrder,
    set_kind: input.setKind,
    planned_reps: input.plannedReps,
    planned_load: input.plannedLoad,
    actual_reps: input.actualReps,
    actual_load: input.actualLoad,
    completed: input.completed,
    rest_seconds_target: input.restSecondsTarget,
    rpe: input.rpe,
  });
  if (error) throw error;
}

export async function updateTrainingSessionExerciseRuntimeState(args: { trainingSessionExerciseId: string; runtimeState: string }): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('training_session_exercises').update({ runtime_state: args.runtimeState }).eq('id', args.trainingSessionExerciseId);
  if (error) throw error;
}

export async function getSetsForTrainingSessionExercise(trainingSessionExerciseId: string): Promise<any[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('training_session_sets').select('*').eq('training_session_exercise_id', trainingSessionExerciseId).order('set_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    trainingSessionExerciseId: row.training_session_exercise_id,
    setOrder: row.set_order,
    setKind: row.set_kind,
    plannedReps: row.planned_reps ?? null,
    plannedLoad: row.planned_load == null ? null : Number(row.planned_load),
    actualReps: row.actual_reps ?? null,
    actualLoad: row.actual_load == null ? null : Number(row.actual_load),
    completed: Boolean(row.completed),
    restSecondsTarget: row.rest_seconds_target ?? null,
    rpe: row.rpe ?? null,
  }));
}

export async function updateTrainingSessionExerciseCompletion(args: { trainingSessionExerciseId: string; runtimeState: 'completed' | 'partial'; actualSummary: Record<string, unknown>; athleteNote: string | null; }): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('training_session_exercises').update({ runtime_state: args.runtimeState, actual_summary: args.actualSummary, athlete_note: args.athleteNote }).eq('id', args.trainingSessionExerciseId);
  if (error) throw error;
}

export type ContinuityState =
  | { kind: 'in_progress'; sessionId: string; title: string; statusLabel: 'In Progress'; helperText: string; scheduledDate: string | null }
  | { kind: 'missed'; sessionId: string; title: string; statusLabel: 'Missed'; helperText: string; scheduledDate: string | null }
  | { kind: 'ready'; title: string; statusLabel: 'Pending'; helperText: string }
  | { kind: 'none'; title: string; statusLabel: 'Pending'; helperText: string };

export async function getLatestTrainingSessionsForAthlete(athleteId: string, limit = 10): Promise<any[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('training_sessions')
    .select('id, athlete_id, program_id, athlete_program_assignment_id, scheduled_date, started_at, ended_at, runtime_state, outcome, planned_snapshot, missed_at')
    .eq('athlete_id', athleteId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getOpenTrainingSessionForAthlete(athleteId: string): Promise<any | null> {
  const sessions = await getLatestTrainingSessionsForAthlete(athleteId, 20);
  return sessions.find((row) => row.runtime_state === 'in_progress' || row.runtime_state === 'paused') ?? null;
}

export async function markTrainingSessionMissed(args: { trainingSessionId: string }): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('training_sessions')
    .update({ runtime_state: 'missed', outcome: 'missed', missed_at: new Date().toISOString() })
    .eq('id', args.trainingSessionId);
  if (error) throw error;
}

export async function getRecentTrainingSessionsForAthlete(args: { athleteId: string; limit?: number }): Promise<any[]> {
  return getLatestTrainingSessionsForAthlete(args.athleteId, args.limit ?? 12);
}

export async function getTrainingSessionExercisesForHistory(sessionId: string): Promise<any[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('training_session_exercises')
    .select('id, planned_exercise_id, actual_exercise_id, prescribed_weight, prescribed_reps_text, progression_outcome, progression_note, manual_progression_outcome, manual_progression_note, was_substituted, substitution_reason')
    .eq('training_session_id', sessionId)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getRecentMissedCountForAthlete(athleteId: string, limit = 14): Promise<number> {
  const sessions = await getLatestTrainingSessionsForAthlete(athleteId, limit);
  return sessions.filter((row) => row.runtime_state === 'missed').length;
}

export async function getLastCompletedAtForAthlete(athleteId: string): Promise<string | null> {
  const sessions = await getLatestTrainingSessionsForAthlete(athleteId, 20);
  const completed = sessions.find((row) => row.runtime_state === 'completed');
  return completed?.ended_at ?? completed?.started_at ?? null;
}

export type CoachRecentActivityItem = {
  kind: 'session_completed' | 'session_missed' | 'progression_override';
  athleteId: string;
  athleteName: string;
  programName: string | null;
  title: string;
  detail: string;
  happenedAt: string;
  href: string;
};

export async function listRecentCoachTrainingActivity(args: { athleteIds: string[]; limit?: number }): Promise<CoachRecentActivityItem[]> {
  const athleteIds = Array.from(new Set(args.athleteIds.filter(Boolean)));
  if (athleteIds.length === 0) return [];

  const supabase = getSupabaseServerClient();
  const limit = args.limit ?? 10;

  const [{ data: sessions, error: sessionsError }, { data: overrides, error: overridesError }] = await Promise.all([
    supabase
      .from('training_sessions')
      .select('id, athlete_id, runtime_state, started_at, ended_at, missed_at, planned_snapshot')
      .in('athlete_id', athleteIds)
      .in('runtime_state', ['completed', 'missed'])
      .order('ended_at', { ascending: false, nullsFirst: false })
      .limit(limit * 3),
    supabase
      .from('training_session_exercises')
      .select('id, training_session_id, manual_progression_outcome, manual_progression_note, progression_override_applied_at, planned_snapshot')
      .not('progression_override_applied_at', 'is', null)
      .order('progression_override_applied_at', { ascending: false })
      .limit(limit * 3),
  ]);

  if (sessionsError) throw sessionsError;
  if (overridesError) throw overridesError;

  const athleteNameMap = new Map<string, { athleteName: string; programName: string | null }>();
  const { data: assignments } = await supabase
    .from('athlete_program_assignments')
    .select('athlete_id, athlete_name, program_name')
    .in('athlete_id', athleteIds);

  for (const row of assignments ?? []) {
    athleteNameMap.set(row.athlete_id, {
      athleteName: row.athlete_name ?? 'Athlete',
      programName: row.program_name ?? null,
    });
  }

  const sessionMap = new Map<string, any>();
  for (const session of sessions ?? []) sessionMap.set(session.id, session);

  const activity: CoachRecentActivityItem[] = [];

  for (const session of sessions ?? []) {
    const meta = athleteNameMap.get(session.athlete_id) ?? { athleteName: 'Athlete', programName: null };
    const plannedTitle = session.planned_snapshot?.dayName ?? session.planned_snapshot?.title ?? 'Training session';
    const happenedAt = session.ended_at ?? session.missed_at ?? session.started_at ?? new Date().toISOString();
    activity.push({
      kind: session.runtime_state === 'missed' ? 'session_missed' : 'session_completed',
      athleteId: session.athlete_id,
      athleteName: meta.athleteName,
      programName: meta.programName,
      title: session.runtime_state === 'missed' ? 'Session marked missed' : 'Session completed',
      detail: plannedTitle,
      happenedAt,
      href: `/coach/sessions/${session.id}`,
    });
  }

  for (const override of overrides ?? []) {
    const session = sessionMap.get(override.training_session_id);
    if (!session || !athleteIds.includes(session.athlete_id)) continue;
    const meta = athleteNameMap.get(session.athlete_id) ?? { athleteName: 'Athlete', programName: null };
    const plannedTitle = override.planned_snapshot?.exerciseName ?? override.planned_snapshot?.title ?? 'Exercise override';
    activity.push({
      kind: 'progression_override',
      athleteId: session.athlete_id,
      athleteName: meta.athleteName,
      programName: meta.programName,
      title: `Override: ${override.manual_progression_outcome ?? 'updated'}`,
      detail: plannedTitle,
      happenedAt: override.progression_override_applied_at,
      href: `/coach/sessions/${override.training_session_id}`,
    });
  }

  return activity
    .sort((a, b) => new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime())
    .slice(0, limit);
}
