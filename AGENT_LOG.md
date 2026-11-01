# Agent log

One entry per agent session, newest at the bottom. Be honest: what went wrong is the useful part.

<!-- Copy this block for each session:

## YYYY-MM-DD · <short title>
- Goal:
- Delegated:
- Checkpoints:
- Went wrong:
- Changed by hand:

-->

## 2026-11-01 · Spec review and slice 1
- Goal: finish SPEC.md and AGENTS.md, then build slice 1 (sign-in and the lab list) from SPEC.md
- Delegated: criticism of the spec sections, the plan, the database migrations, password sign-in, the lab list screen and its tests. Agent: Claude (Cowork), not Gemini CLI.
- Checkpoints: chose SQLite and password-only sign-in for the slice before any code was written; opened the `labs` table with sqlite3; requested `/labs` and `/api/labs` without a session (302 and 401); deleted a lab row and reloaded the list
- Went wrong: the agent built plain HTML instead of the React and Vite named in SPEC.md; on today's date, hours that had already started showed as "Free"; AGENTS.md pointed at `routes/` while the code uses `src/routes/`
- Changed after review: added AC-16 and the "Past" slots, corrected the UI stack in SPEC.md and the folder names in AGENTS.md
