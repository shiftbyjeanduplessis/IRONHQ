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
  let query = supabase
    .from('coach_athlete_notes')
    .select('id, athlete_id, coach_id, note_kind, body, is_open, resolved_at, created_at, updated_at')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (scope.scoped && scope.coachId) {
    query = query.eq('coach_id', scope.coachId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function countOpenCoachNotesForAthlete(athleteId: string): Promise<number> {
  const supabase = getSupabaseServerClient();
  const scope = await getCurrentCoachScope();
  let query = supabase
    .from('coach_athlete_notes')
    .select('id', { head: true, count: 'exact' })
    .eq('athlete_id', athleteId)
    .eq('is_open', true);
  if (scope.scoped && scope.coachId) {
    query = query.eq('coach_id', scope.coachId);
  }
  const { count, error } = await query;
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
  let query = supabase
    .from('coach_athlete_notes')
    .update({ is_open: false, resolved_at: new Date().toISOString() })
    .eq('id', noteId);
  if (scope.scoped && scope.coachId) {
    query = query.eq('coach_id', scope.coachId);
  }
  const { error } = await query;
  if (error) throw error;
}

export type CoachRecentNoteActivityItem = {
  kind: 'follow_up_created' | 'follow_up_resolved';
  athleteId: string;
  athleteName: string;
  body: string;
  happenedAt: string;
  href: string;
};

export async function listRecentCoachNoteActivity(args: { athleteIds: string[]; limit?: number }): Promise<CoachRecentNoteActivityItem[]> {
  const athleteIds = Array.from(new Set(args.athleteIds.filter(Boolean)));
  if (athleteIds.length === 0) return [];

  const supabase = getSupabaseServerClient();
  const scope = await getCurrentCoachScope();
  let query = supabase
    .from('coach_athlete_notes')
    .select('id, athlete_id, body, note_kind, is_open, created_at, resolved_at')
    .in('athlete_id', athleteIds)
    .in('note_kind', ['follow_up', 'behind_plan'])
    .order('updated_at', { ascending: false })
    .limit(args.limit ?? 10);

  if (scope.scoped && scope.coachId) {
    query = query.eq('coach_id', scope.coachId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const { data: assignments } = await supabase
    .from('athlete_program_assignments')
    .select('athlete_id, athlete_name')
    .in('athlete_id', athleteIds);

  const athleteNameMap = new Map<string, string>();
  for (const row of assignments ?? []) {
    athleteNameMap.set(row.athlete_id, row.athlete_name ?? 'Athlete');
  }

  return (data ?? []).map((row) => ({
    kind: row.resolved_at ? 'follow_up_resolved' : 'follow_up_created',
    athleteId: row.athlete_id,
    athleteName: athleteNameMap.get(row.athlete_id) ?? 'Athlete',
    body: row.body,
    happenedAt: row.resolved_at ?? row.created_at,
    href: `/coach/athletes/${row.athlete_id}#coach-notes`,
  }))
    .sort((a, b) => new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime())
    .slice(0, args.limit ?? 10);
}
