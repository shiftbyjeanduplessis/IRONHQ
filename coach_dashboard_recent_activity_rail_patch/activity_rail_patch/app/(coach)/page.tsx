import Link from 'next/link';
import { listCoachRosterAssignments } from '@/lib/db/programs';
import { getRecentMissedCountForAthlete, getLastCompletedAtForAthlete, listRecentCoachTrainingActivity } from '@/lib/db/training';
import { getNextTrainingSessionStateForAthlete } from '@/features/training/server/get-next-training-session-state-for-athlete';
import { countOpenCoachNotesForAthlete, listRecentCoachNoteActivity } from '@/lib/db/coach-notes';

type ContinuityKind = 'in_progress' | 'missed' | 'ready' | 'none';
type TriageBucket = 'missed_or_behind' | 'open_followups' | 'unassigned' | 'steady';

type DashboardRow = {
  athleteId: string;
  athleteName: string;
  programName: string | null;
  continuity: { kind: ContinuityKind; title: string; helperText?: string | null };
  missedCount: number;
  openNotes: number;
  lastCompletedAt: string | null;
  bucket: TriageBucket;
  actionHref: string;
  actionLabel: string;
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

function formatActivityTime(value: string) {
  return new Date(value).toLocaleString();
}

function getBucket(args: { continuity: ContinuityKind; missedCount: number; openNotes: number; programName: string | null }): TriageBucket {
  if (args.missedCount > 0 || args.continuity === 'missed') return 'missed_or_behind';
  if (args.openNotes > 0) return 'open_followups';
  if (!args.programName) return 'unassigned';
  return 'steady';
}

function getPrimaryAction(row: Omit<DashboardRow, 'actionHref' | 'actionLabel'>) {
  if (row.missedCount > 0 || row.continuity.kind === 'missed') {
    return {
      actionHref: `/coach/sessions?status=missed&q=${encodeURIComponent(row.athleteName)}`,
      actionLabel: 'Review missed sessions',
    };
  }

  if (row.openNotes > 0) {
    return {
      actionHref: `/coach/athletes/${row.athleteId}#coach-notes`,
      actionLabel: 'View open follow-ups',
    };
  }

  if (!row.programName) {
    return {
      actionHref: `/coach/athletes/${row.athleteId}#assignment`,
      actionLabel: 'Assign program',
    };
  }

  return {
    actionHref: `/coach/athletes/${row.athleteId}`,
    actionLabel: 'Open athlete',
  };
}

function sortTriageRows(a: DashboardRow, b: DashboardRow) {
  return b.missedCount - a.missedCount || b.openNotes - a.openNotes || a.athleteName.localeCompare(b.athleteName);
}

function SectionHeader({ title, helper, actionHref, actionLabel }: { title: string; helper: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <p className="text-sm text-neutral-500">{helper}</p>
      </div>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="text-sm font-medium text-neutral-700 underline underline-offset-4">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function TriageCard({ row }: { row: DashboardRow }) {
  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm">
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
        <Link href={row.actionHref} className="rounded-xl bg-black px-3 py-2 font-medium text-white">{row.actionLabel}</Link>
        <Link href={`/coach/athletes/${row.athleteId}`} className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-800">Open athlete</Link>
        <Link href={`/coach/sessions?q=${encodeURIComponent(row.athleteName)}`} className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-800">Review sessions</Link>
      </div>
    </section>
  );
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

    const baseRow = {
      athleteId: assignment.athleteId,
      athleteName: assignment.athleteName,
      programName: assignment.programName ?? null,
      continuity: continuity as DashboardRow['continuity'],
      missedCount,
      openNotes,
      lastCompletedAt,
      bucket: getBucket({ continuity: continuity.kind as ContinuityKind, missedCount, openNotes, programName: assignment.programName ?? null }),
    };

    return {
      ...baseRow,
      ...getPrimaryAction(baseRow),
    };
  }));

  const athleteIds = rows.map((row) => row.athleteId);
  const [trainingActivity, noteActivity] = await Promise.all([
    listRecentCoachTrainingActivity({ athleteIds, limit: 8 }).catch(() => []),
    listRecentCoachNoteActivity({ athleteIds, limit: 8 }).catch(() => []),
  ]);

  const recentActivity = [...trainingActivity, ...noteActivity]
    .sort((a, b) => new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime())
    .slice(0, 10);

  const counts = {
    total: rows.length,
    missed: rows.filter((row) => row.bucket === 'missed_or_behind').length,
    inProgress: rows.filter((row) => row.continuity.kind === 'in_progress').length,
    ready: rows.filter((row) => row.continuity.kind === 'ready').length,
    needsFollowUp: rows.filter((row) => row.bucket !== 'steady').length,
    openFollowUps: rows.filter((row) => row.bucket === 'open_followups').length,
    unassigned: rows.filter((row) => row.bucket === 'unassigned').length,
  };

  const missedOrBehind = rows.filter((row) => row.bucket === 'missed_or_behind').sort(sortTriageRows);
  const openFollowUps = rows.filter((row) => row.bucket === 'open_followups').sort(sortTriageRows);
  const unassigned = rows.filter((row) => row.bucket === 'unassigned').sort(sortTriageRows);
  const steadyState = rows.filter((row) => row.bucket === 'steady').sort((a, b) => a.athleteName.localeCompare(b.athleteName));

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Coach Dashboard</p>
          <h1 className="text-2xl font-semibold">Needs attention now</h1>
          <p className="mt-1 text-sm text-neutral-600">Work the queue in order: missed and behind first, follow-ups next, then unassigned athletes.</p>
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

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-neutral-500">Athletes</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{counts.total}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-neutral-500">Needs attention</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{counts.needsFollowUp}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-neutral-500">Missed / behind</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{counts.missed}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-neutral-500">Open follow-ups</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{counts.openFollowUps}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-neutral-500">Unassigned</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{counts.unassigned}</p></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-neutral-500">Ready / moving</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{counts.ready + counts.inProgress}</p></div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="space-y-8">
          <section>
            <SectionHeader title="Missed / behind" helper="Athletes with missed work or unresolved missed-session continuity should be handled first." actionHref="/coach/roster?attention=1&status=missed" actionLabel="Open missed queue" />
            <div className="space-y-3">
              {missedOrBehind.length === 0 ? (
                <div className="rounded-2xl border bg-white p-4 text-sm text-neutral-600 shadow-sm">No athletes are currently behind plan.</div>
              ) : missedOrBehind.map((row) => <TriageCard key={row.athleteId} row={row} />)}
            </div>
          </section>

          <section>
            <SectionHeader title="Open follow-ups" helper="Athletes with unresolved coach notes but no missed-session pressure." actionHref="/coach/roster?notes=1" actionLabel="Open follow-up queue" />
            <div className="space-y-3">
              {openFollowUps.length === 0 ? (
                <div className="rounded-2xl border bg-white p-4 text-sm text-neutral-600 shadow-sm">No open follow-up items right now.</div>
              ) : openFollowUps.map((row) => <TriageCard key={row.athleteId} row={row} />)}
            </div>
          </section>

          <section>
            <SectionHeader title="Unassigned athletes" helper="Athletes without an active program need assignment before they can move cleanly through the training loop." actionHref="/coach/roster?status=none" actionLabel="Open assignment queue" />
            <div className="space-y-3">
              {unassigned.length === 0 ? (
                <div className="rounded-2xl border bg-white p-4 text-sm text-neutral-600 shadow-sm">No unassigned athletes in the current scope.</div>
              ) : unassigned.map((row) => <TriageCard key={row.athleteId} row={row} />)}
            </div>
          </section>

          <section>
            <SectionHeader title="Steady state" helper="Athletes already moving well. Keep this light and only spot-check as needed." actionHref="/coach/roster" actionLabel="Open full roster" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {steadyState.length === 0 ? (
                <div className="rounded-2xl border bg-white p-4 text-sm text-neutral-600 shadow-sm">No athletes in a steady state yet.</div>
              ) : steadyState.slice(0, 9).map((row) => (
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
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    <Link href={`/coach/athletes/${row.athleteId}`} className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-800">Open athlete</Link>
                  </div>
                </section>
              ))}
            </div>
          </section>
        </div>

        <aside>
          <SectionHeader title="Recent activity" helper="Latest completions, missed-session changes, overrides, and follow-up activity." actionHref="/coach/sessions" actionLabel="Open sessions" />
          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <div className="rounded-2xl border bg-white p-4 text-sm text-neutral-600 shadow-sm">No recent coach activity yet.</div>
            ) : recentActivity.map((item, index) => (
              <section key={`${item.kind}-${item.athleteId}-${item.happenedAt}-${index}`} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                    <p className="text-sm text-neutral-600">{item.athleteName}</p>
                    {'programName' in item && item.programName ? <p className="text-xs text-neutral-500">{item.programName}</p> : null}
                  </div>
                  <p className="text-xs text-neutral-500">{formatActivityTime(item.happenedAt)}</p>
                </div>
                <p className="mt-2 text-sm text-neutral-700">{'detail' in item ? item.detail : item.body}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <Link href={item.href} className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-800">Open</Link>
                  <Link href={`/coach/athletes/${item.athleteId}`} className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-800">Athlete</Link>
                </div>
              </section>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
