# IronHQ Closed Beta Hardening Patch

This patch is a best-effort hardening pass against the partial IronHQ repo slice.

## Focus
- safer coach scoping defaults
- explicit coach-access setup states
- athlete runtime setup guards for this slice
- calmer empty/error states on coach and athlete routes
- reduced risk of accidentally showing global coach data in beta mode

## Notes
- coach pages now prefer real scoped access and only allow shared reads when `IRONHQ_ALLOW_UNSCOPED_COACH_READS=1`
- athlete training/history/session pages now require `IRONHQ_ATHLETE_PROFILE_ID` in this slice instead of relying on hardcoded placeholder IDs
- this does not replace the full auth/session layer from the complete repo
