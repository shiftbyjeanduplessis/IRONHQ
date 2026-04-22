'use server';

import { revalidatePath } from 'next/cache';
import { resolveCoachNote } from '@/lib/db/coach-notes';

export async function resolveCoachNoteAction(formData: FormData) {
  const noteId = String(formData.get('noteId') ?? '');
  const athleteId = String(formData.get('athleteId') ?? '');
  if (!noteId || !athleteId) {
    throw new Error('Note and athlete are required.');
  }

  await resolveCoachNote(noteId);
  revalidatePath('/coach/roster');
  revalidatePath(`/coach/athletes/${athleteId}`);
}
