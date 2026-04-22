Auth + multi-coach enforcement patch.

What this patch does:
- adds profiles.auth_user_id as the preferred link from signed-in auth user -> coach profile
- replaces unscoped coach fallback with scoped-only access for coach surfaces
- keeps legacy IRONHQ_COACH_PROFILE_ID as a temporary escape hatch for the partial repo slice
- filters roster, athlete detail, sessions, and coach notes through one coach scope

Expected integration in the full repo:
- wire the real signed-in auth user id into x-ironhq-auth-user-id or replace the helper with the app's actual auth/session lookup
- backfill profiles.auth_user_id for coach profiles
