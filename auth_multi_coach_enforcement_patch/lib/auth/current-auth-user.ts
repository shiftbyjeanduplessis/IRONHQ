import { headers } from 'next/headers';

export type CurrentAuthUser = {
  authUserId: string | null;
  source: 'header' | 'env' | 'none';
};

/**
 * Partial-slice auth bridge.
 *
 * In the full app this should be replaced by the real signed-in Supabase auth user.
 * For this repo slice we support:
 * - request header x-ironhq-auth-user-id
 * - env fallback IRONHQ_AUTH_USER_ID
 */
export async function getCurrentAuthUser(): Promise<CurrentAuthUser> {
  try {
    const requestHeaders = await headers();
    const headerUserId = requestHeaders.get('x-ironhq-auth-user-id')?.trim();
    if (headerUserId) {
      return { authUserId: headerUserId, source: 'header' };
    }
  } catch {
    // ignore; fall through to env fallback
  }

  const envUserId = process.env.IRONHQ_AUTH_USER_ID?.trim();
  if (envUserId) {
    return { authUserId: envUserId, source: 'env' };
  }

  return { authUserId: null, source: 'none' };
}
