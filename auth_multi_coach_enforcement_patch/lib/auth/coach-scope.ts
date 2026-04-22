import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/auth/current-auth-user';

export type CoachScope = {
  coachId: string | null;
  scoped: boolean;
  source: 'auth_user' | 'legacy_env_profile' | 'no_auth' | 'no_matching_coach_profile';
  authUserId: string | null;
};

/**
 * Auth-ready coach scoping helper.
 *
 * Preferred path:
 * - resolve the signed-in auth user id
 * - map that auth user to a coach profile via profiles.auth_user_id
 *
 * Temporary legacy fallback:
 * - IRONHQ_COACH_PROFILE_ID can still force a scoped coach profile in this partial slice
 */
export async function getCurrentCoachScope(): Promise<CoachScope> {
  const forcedCoachProfileId = process.env.IRONHQ_COACH_PROFILE_ID?.trim();
  if (forcedCoachProfileId) {
    return {
      coachId: forcedCoachProfileId,
      scoped: true,
      source: 'legacy_env_profile',
      authUserId: null,
    };
  }

  const currentAuthUser = await getCurrentAuthUser();
  if (!currentAuthUser.authUserId) {
    return {
      coachId: null,
      scoped: false,
      source: 'no_auth',
      authUserId: null,
    };
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, auth_user_id')
    .eq('auth_user_id', currentAuthUser.authUserId)
    .eq('role', 'coach')
    .maybeSingle();

  if (error || !data?.id) {
    return {
      coachId: null,
      scoped: false,
      source: 'no_matching_coach_profile',
      authUserId: currentAuthUser.authUserId,
    };
  }

  return {
    coachId: data.id,
    scoped: true,
    source: 'auth_user',
    authUserId: currentAuthUser.authUserId,
  };
}
