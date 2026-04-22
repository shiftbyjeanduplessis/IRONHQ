export function getCurrentAthleteProfileId(): string | null {
  const value = process.env.IRONHQ_ATHLETE_PROFILE_ID?.trim();
  if (!value) return null;
  if (value.startsWith('REPLACE_')) return null;
  if (value.toLowerCase() === 'null' || value.toLowerCase() === 'undefined') return null;
  return value;
}
