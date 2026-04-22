import Link from 'next/link';
import { listCoachRosterAssignments } from '@/lib/db/programs';
import { getRecentMissedCountForAthlete, getLastCompletedAtForAthlete } from '@/lib/db/training';
import { getNextTrainingSessionStateForAthlete } from '@/features/training/server/get-next-training-session-state-for-athlete';
import { countOpenCoachNotesForAthlete } from '@/lib/db/coach-notes';

type ContinuityKind = 'in_progress' | 'missed' | 'ready' | 'none';

type DashboardRow = {
  athleteId: string;
  athleteName: string;
  programName: string | null;
  continuity: { kind: ContinuityKind; title: string; helperText?: string | null };
  missedCount: number;
  openNotes: number;
  lastCompletedAt: string | null;
  priority: number;
};

function chipClasses(kind: ContinuityKind) {
  switch (kind) {
    case 'in_progress': return 'border-blue-200 bg-blue-50 text-blue-800';
    case 'missed': return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'ready': return 'border-green-200 bg-green-50 text-green-800';
    default: return 'border-neutral-200 bg-neutral-50 text-neutral-700';
  }
}

function labelForState(kind: ContinuityKind) {
  switch (kind) {
    case 'in_progress': return 'In Progress';
    case 'missed': return 'Missed';
    case 'ready': return 'Ready';
    default: return 'No Program';
  }
}

function formatLastCompleted(value: string | null) {
  if (!value) return 'No recent completion';
  return `Last completed ${new Date(value).toLocaleDateString()}`;
}

function getPriority(args: { continuity: ContinuityKind; missedCount: number; openNotes: number; programName: string | null }) {
  if (args.openNotes > 0 || args.missedCount > 0 || args.continuity === 'missed') return 0;
  if (args.continuity === 'in_progress') return 1;
  if (!args.programName) return 2;
  return 3;
}

export default async function CoachDashboardPage() {
  const assignments = await listCoachRosterAssignments();
  const scope = assignments[0]?.scope ?? { scoped: false };

  const rows: DashboardRow[] = await Promise.all(assignments.map(async (assignment) => {
    const [continuity, missedCount, openNotes, lastCompletedAt] = await Promise.all([
      getNextTrainingSessionStateForAthlete(assignment.athleteId).catch(() => ({ kind: 'none' as ContinuityKind, title: 'No session ready', helperText: 'No workout is ready yet.' })),
      getRecentMissedCountForAthlete(assignment.athleteId).catch(() => 0),
      countOpenCoachNotesForAthlete(assignment.athleteId).catch(() => 0),
      getLastCompletedAtForAthlete(assignment.athleteId).catch(() => null),
    ]);
    return {
      athleteId: assignment.athleteId,
      athleteName: assignment.athleteName,
      programName: assignment.programName ?? null,
      continuity: continuity as DashboardRow['continuity'],
      missedCount,
      openNotes,
      lastCompletedAt,
      priority: getPriority({ continuity: continuity.kind as ContinuityKind, missedCount, openNotes, programName: assignment.programName ?? null }),
    };
  }));

  rows.sort((a, b) => a.priority - b.priority || b.missedCount - a.missedCount || b.openNotes - a.openNotes || a.athleteName.localeCompare(b.athleteName));

  const counts = {
    total: rows.length,
    missed: rows.filter((row) => row.continuity.kind === 'missed' || row.missedCount > 0).length,
    inProgress: rows.filter((row) => row.continuity.kind === 'in_progress').length,
    ready: rows.filter((row) => row.continuity.kind === 'ready').length,
    needsFollowUp: rows.filter((row) => row.openNotes > 0 || row.missedCount > 0 || row.continuity.kind === 'missed').length,
    noProgram: rows.filter((row) => !row.programName).length,
  };

  const needsAttention = rows.filter((row) => row.priority === 0 || row.priority === 2);
  const steadyState = rows.filter((row) => row.priority === 1 || row.priority === 3);

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Coach Dashboard</p>
          <h1 className="text-2xl font-semibold">Needs attention now</h1>
          <p className="mt-1 text-sm text-neutral-600">See who is behind, who has open follow-ups, and what each athlete should do next.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/coach/roster?attention=1" className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-800">Open roster</Link>
          <Link href="/coach/sessions?status=missed" className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-800">Review sessions</Link>
        </div>
      </div>

      {!scope.scoped ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Coach filtering is running in unscoped mode for this repo slice. Set <code>IRONHQ_COACH_PROFILE_ID</code> to scope the dashboard to one coach.
        </div>
      ) : null}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-neutral-500">Athletes</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{counts.total}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-neutral-500">Needs attention</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{counts.needsFollowUp}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-neutral-500">Missed / behind</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{counts.missed}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-neutral-500">In progress</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{counts.inProgress}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-neutral-500">Ready now</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{counts.ready}</p></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">Needs attention</h2>
            <p className="text-sm text-neutral-500">Missed sessions, open follow-ups, or no active program.</p>
          </div>
          <div className="space-y-3">
            {needsAttention.length === 0 ? (
              <div className="rounded-2xl border bg-white p-4 text-sm text-neutral-600 shadow-sm">No urgent triage items right now.</div>
            ) : needsAttention.map((row) => (
              <section key={row.athleteId} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-neutral-900">{row.athleteName}</p>
                    <p className="text-sm text-neutral-600">{row.programName ?? 'No Program assigned'}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${chipClasses(row.continuity.kind)}`}>{labelForState(row.continuity.kind)}</span>
                      {row.missedCount > 0 ? <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">{row.missedCount} missed recently</span> : null}
                      {row.openNotes > 0 ? <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800">{row.openNotes} open follow-up</span> : null}
                    </div>
                  </div>
                  <div className="text-right text-sm text-neutral-600">
                    <p className="font-medium text-neutral-800">{row.continuity.title}</p>
                    <p>{formatLastCompleted(row.lastCompletedAt)}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-neutral-600">{row.continuity.helperText ?? 'Review athlete status and take the next coaching action.'}</p>
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <Link href={`/coach/athletes/${row.athleteId}`} className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-800">Open athlete</Link>
                  <Link href={`/coach/sessions?q=${encodeURIComponent(row.athleteName)}`} className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-800">Review sessions</Link>
                  {row.openNotes > 0 ? <Link href={`/coach/athletes/${row.athleteId}#coach-notes`} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-800">View open follow-ups</Link> : <Link href={`/coach/athletes/${row.athleteId}#assignment`} className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-800">Assign program</Link>}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">Steady state</h2>
            <p className="text-sm text-neutral-500">Athletes already moving.</p>
          </div>
          <div className="space-y-3">
            {steadyState.length === 0 ? (
              <div className="rounded-2xl border bg-white p-4 text-sm text-neutral-600 shadow-sm">No athletes in a steady state yet.</div>
            ) : steadyState.slice(0, 8).map((row) => (
              <section key={row.athleteId} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-neutral-900">{row.athleteName}</p>
                    <p className="text-sm text-neutral-600">{row.programName ?? 'No Program'}</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${chipClasses(row.continuity.kind)}`}>{labelForState(row.continuity.kind)}</span>
                </div>
                <p className="mt-2 text-sm text-neutral-600">{row.continuity.title}</p>
                <p className="mt-1 text-xs text-neutral-500">{formatLastCompleted(row.lastCompletedAt)}</p>
              </section>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
