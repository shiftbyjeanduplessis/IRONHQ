'use server';

import { revalidatePath } from 'next/cache';
import { createCoachNote } from '@/lib/db/coach-notes';

export async function createCoachNoteAction(formData: FormData) {
  const athleteId = String(formData.get('athleteId') ?? '');
  const noteKind = String(formData.get('noteKind') ?? 'note') as 'note' | 'follow_up' | 'behind_plan';
  const body = String(formData.get('body') ?? '').trim();

  if (!athleteId || !body) {
    throw new Error('Athlete and note body are required.');
  }

  await createCoachNote({ athleteId, noteKind, body });
  revalidatePath('/coach/roster');
  revalidatePath(`/coach/athletes/${athleteId}`);
}
