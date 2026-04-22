import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentCoachScope } from '@/lib/auth/coach-scope';

export async function listProgramTemplates(): Promise<Array<{ id: string; name: string; presetKey: string | null }>> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('programs')
    .select('id, name, preset_key')
    .eq('is_template', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, presetKey: row.preset_key ?? null }));
}

export async function listCoachRosterAssignments(): Promise<any[]> {
  const supabase = getSupabaseServerClient();
  const scope = await getCurrentCoachScope();

  if (!scope.scoped || !scope.coachId) {
    return [];
  }

  const { data, error } = await supabase
    .from('athlete_program_assignments')
    .select('*')
    .eq('coach_id', scope.coachId)
    .order('starts_on', { ascending: false });
  if (error) throw error;

  const activeRows = (data ?? []).filter((row: any) => row.is_active === true || row.status === 'active');
  const athleteIds = [...new Set(activeRows.map((row: any) => row.athlete_id).filter(Boolean))];
  const programIds = [...new Set(activeRows.map((row: any) => row.program_id).filter(Boolean))];

  const [{ data: profilesData, error: profilesError }, { data: programsData, error: programsError }] = await Promise.all([
    athleteIds.length > 0 ? supabase.from('profiles').select('*').in('id', athleteIds) : Promise.resolve({ data: [], error: null }),
    programIds.length > 0 ? supabase.from('programs').select('id, name').in('id', programIds) : Promise.resolve({ data: [], error: null }),
  ] as const);

  if (profilesError) throw profilesError;
  if (programsError) throw programsError;

  const profilesById = new Map((profilesData ?? []).map((row: any) => [row.id, row]));
  const programsById = new Map((programsData ?? []).map((row: any) => [row.id, row]));

  return activeRows.map((row: any) => {
    const profile = profilesById.get(row.athlete_id) ?? null;
    const program = programsById.get(row.program_id) ?? null;
    return {
      id: row.id,
      athleteId: row.athlete_id,
      athleteName: profile?.full_name ?? profile?.name ?? profile?.display_name ?? profile?.email ?? row.athlete_id,
      athleteEmail: profile?.email ?? null,
      programId: row.program_id ?? null,
      programName: program?.name ?? null,
      coachId: row.coach_id ?? null,
      startsOn: row.starts_on ?? null,
      currentWeekIndex: row.current_week_index ?? null,
      currentDayIndex: row.current_day_index ?? null,
      status: row.status ?? null,
      scope,
    };
  });
}

export async function getAthleteAssignmentDetail(athleteId: string): Promise<any | null> {
  const rows = await listCoachRosterAssignments();
  return rows.find((row) => row.athleteId === athleteId) ?? null;
}

export async function updateActiveAssignmentProgram(args: {
  athleteId: string;
  programId: string;
  resetToStart?: boolean;
}): Promise<void> {
  const supabase = getSupabaseServerClient();
  const scope = await getCurrentCoachScope();
  if (!scope.scoped || !scope.coachId) {
    throw new Error('Coach scope is required to update athlete assignment.');
  }

  const { data: existing, error: existingError } = await supabase
    .from('athlete_program_assignments')
    .select('id, athlete_id, current_week_index, current_day_index, coach_id')
    .eq('athlete_id', args.athleteId)
    .eq('is_active', true)
    .eq('coach_id', scope.coachId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing?.id) throw new Error('Active athlete assignment not found in the current coach scope.');

  const updatePayload: Record<string, unknown> = {
    program_id: args.programId,
    coach_id: scope.coachId,
  };

  if (args.resetToStart !== false) {
    updatePayload.current_week_index = 1;
    updatePayload.current_day_index = 1;
  }

  const { error } = await supabase
    .from('athlete_program_assignments')
    .update(updatePayload)
    .eq('id', existing.id)
    .eq('coach_id', scope.coachId);
  if (error) throw error;
}
