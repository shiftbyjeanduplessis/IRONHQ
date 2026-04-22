import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/auth/current-auth-user';

export type CoachScope = {
  coachId: string | null;
  scoped: boolean;
  allowUnscopedReads: boolean;
  source: 'auth_user' | 'legacy_env_profile' | 'no_auth' | 'no_matching_coach_profile';
  authUserId: string | null;
  warning: string | null;
};

function allowUnscopedReads(): boolean {
  return process.env.IRONHQ_ALLOW_UNSCOPED_COACH_READS === '1';
}

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
  const unscoped = allowUnscopedReads();

  if (forcedCoachProfileId) {
    return {
      coachId: forcedCoachProfileId,
      scoped: true,
      allowUnscopedReads: unscoped,
      source: 'legacy_env_profile',
      authUserId: null,
      warning: null,
    };
  }

  const currentAuthUser = await getCurrentAuthUser();
  if (!currentAuthUser.authUserId) {
    return {
      coachId: null,
      scoped: false,
      allowUnscopedReads: unscoped,
      source: 'no_auth',
      authUserId: null,
      warning: unscoped
        ? 'Coach scope is running in temporary unscoped mode for this slice.'
        : 'Coach access is not configured yet. Set a signed-in coach user or IRONHQ_COACH_PROFILE_ID.',
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
      allowUnscopedReads: unscoped,
      source: 'no_matching_coach_profile',
      authUserId: currentAuthUser.authUserId,
      warning: unscoped
        ? 'No matching coach profile was found. Temporary unscoped mode is enabled for this slice.'
        : 'No matching coach profile was found for the signed-in user.',
    };
  }

  return {
    coachId: data.id,
    scoped: true,
    allowUnscopedReads: unscoped,
    source: 'auth_user',
    authUserId: currentAuthUser.authUserId,
    warning: null,
  };
}
