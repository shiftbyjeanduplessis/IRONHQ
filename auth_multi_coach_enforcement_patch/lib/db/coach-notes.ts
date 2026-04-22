import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentCoachScope } from '@/lib/auth/coach-scope';

export type CoachAthleteNote = {
  id: string;
  athleteId: string;
  coachId: string | null;
  noteKind: 'note' | 'follow_up' | 'behind_plan';
  body: string;
  isOpen: boolean;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: any): CoachAthleteNote {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    coachId: row.coach_id ?? null,
    noteKind: row.note_kind,
    body: row.body,
    isOpen: Boolean(row.is_open),
    resolvedAt: row.resolved_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCoachNotesForAthlete(athleteId: string, limit = 20): Promise<CoachAthleteNote[]> {
  const supabase = getSupabaseServerClient();
  const scope = await getCurrentCoachScope();
  if (!scope.scoped || !scope.coachId) return [];

  const { data, error } = await supabase
    .from('coach_athlete_notes')
    .select('id, athlete_id, coach_id, note_kind, body, is_open, resolved_at, created_at, updated_at')
    .eq('athlete_id', athleteId)
    .eq('coach_id', scope.coachId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function countOpenCoachNotesForAthlete(athleteId: string): Promise<number> {
  const supabase = getSupabaseServerClient();
  const scope = await getCurrentCoachScope();
  if (!scope.scoped || !scope.coachId) return 0;

  const { count, error } = await supabase
    .from('coach_athlete_notes')
    .select('id', { head: true, count: 'exact' })
    .eq('athlete_id', athleteId)
    .eq('coach_id', scope.coachId)
    .eq('is_open', true);
  if (error) throw error;
  return count ?? 0;
}

export async function createCoachNote(args: {
  athleteId: string;
  noteKind: 'note' | 'follow_up' | 'behind_plan';
  body: string;
  coachId?: string | null;
}): Promise<void> {
  const supabase = getSupabaseServerClient();
  const scope = await getCurrentCoachScope();
  const coachId = args.coachId ?? scope.coachId ?? null;
  if (!coachId) {
    throw new Error('Coach scope is required to create a coach note.');
  }

  const { error } = await supabase.from('coach_athlete_notes').insert({
    athlete_id: args.athleteId,
    coach_id: coachId,
    note_kind: args.noteKind,
    body: args.body,
    is_open: true,
  });
  if (error) throw error;
}

export async function resolveCoachNote(noteId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const scope = await getCurrentCoachScope();
  if (!scope.scoped || !scope.coachId) {
    throw new Error('Coach scope is required to resolve a coach note.');
  }

  const { error } = await supabase
    .from('coach_athlete_notes')
    .update({ is_open: false, resolved_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('coach_id', scope.coachId);
  if (error) throw error;
}
