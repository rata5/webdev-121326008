# Defence notes

<!-- Exercise 5 writes this, before the defence, while the project is fresh.
     These are your own answers, in your own words. The question bank is on the course
     site under Resources → The defence. The committee will not ask whether an agent
     wrote the code; everyone in the room knows it did, and the course required it.
     It will ask whether the system is yours. -->

## What it does

<!-- Two sentences, then the demo. Who uses it, and for what. -->
It lets users book a seat. It lets teachers book a room.

## The three files I will open

<!-- Pick them now, not on the day. One should show a rule being enforced,
     one should show a boundary between layers, one is yours to choose. -->

1. `src/services/bookings.js`, 3 booking limit inside one transaction
2. `mcp-server/server.js`, tools calling the same services as routes
3. `src/services/assistant.js`, every model suggestion rechecked against the database

## Decisions I can defend

<!-- One paragraph each: what I chose, what I rejected, and what would change my mind.
     "The agent chose it" is not an answer. -->

- Stack:Node 22 and Express 5; plain HTML, CSS and JavaScript instead of the React and Vite the first spec named;  PostgreSQL on Neon, after starting on SQLite; Vitest and Supertest, with PGlite in the tests.
- Where the rules live: in src/services/, with routes and MCP tools as two front doors.
- Authentication and authorization: bcrypt passwords, a signed HttpOnly cookie, only a SHA-256 hash of each session token in the database, Google sign-in with a state cookie, linking only on a verified address (and since R2, linking removes the unproven password), roles user and admin.
- The model, and why that one: gemini-2.5-flash, JSON output, a 10-second timeout, a fallback from the database.
- What the MCP server exposes, and what it deliberately does not: five project tools plus the two lecture tools; adding a lab is deliberately not exposed; no SQL in the server; the token is a full session (R17).
- The database shape: users, identities, sessions, labs, bookings; bookings is the many-to-many link between users and labs, with UNIQUE (lab_id, date, start_hour).

## How I know it works

<!-- Evidence, not claims. Which tests prove which acceptance criteria, what the
     coverage numbers are and what they do not tell you, what you checked by hand. -->
The traceability table in SPEC.md (every AC id has a test), coverage numbers from npm run coverage, and what was checked by hand in READINESS.md.

## What is wrong with it

<!-- List your gaps before the committee does. Ranked by risk, from READINESS.md. -->

## The thing in this repository I did not write and cannot explain

<!-- Answer this one honestly, in writing, before the defence. Everybody has one.
     Finding it now means you either learn it or say so plainly on the day, and both
     of those go better than being shown it by somebody else. -->
