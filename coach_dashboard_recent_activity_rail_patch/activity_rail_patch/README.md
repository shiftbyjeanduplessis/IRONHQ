IronHQ coach dashboard recent activity rail patch

Includes:
- app/(coach)/page.tsx
- lib/db/training.ts
- lib/db/coach-notes.ts

Purpose:
- adds a compact recent activity rail to the coach dashboard
- surfaces latest completions, missed-session changes, progression overrides, and follow-up activity
- keeps the dashboard as a working queue plus activity feed

Notes:
- best-effort patch against the partial repo slice used in this chat
- assumes prior patches for coach dashboard, sessions, notes, and coach scope are already present
