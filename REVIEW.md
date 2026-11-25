# Review of my own project: LabBookingBg

The examiner dropped the peer review, so this reviews my own project with two agent passes.
Commit reviewed: `2491703` (pass A), `<hash>` (pass B).

ID: R1
Title: Real Neon password and session secret in `.env.example`
Severity: high
Location: `.env.example:7`, `.env.example:9`, committed in `c4152ad`
Source: A
Verdict: confirmed
Evidence: `git log --oneline -S npg_ -- .env.example` shows `c4152ad` (20 Nov) put the real `DATABASE_URL` with the `neondb_owner` password and the real `SESSION_SECRET` into the public repository; Render used the same database. The `neondb_owner` password was reset in Neon on 25 Nov. The old value stays in git history, so the reset is what makes it useless.

ID: R2
Title: Google sign-in keeps the password of whoever registered the address first
Severity: high
Location: `src/services/auth.js:66-69`
Source: A
Verdict: confirmed, fixed
Evidence: the first Google sign-in joined the account that already had the address and kept its password and sessions, although a local sign-up never proves the address. Test "R2 stops working once the owner signs in with Google, and its old sessions end" failed before the fix (expected 401 "Unauthorized", got 200 "OK"). Test `<hash>` (CI red), fix `<hash>` (CI green): joining now drops the unproven password and ends the account's sessions; AC-9 still passes. Live, <date>: a password set before the Google sign-in now gets "Wrong email or password".

ID: R3
Title: No limit on wrong passwords
Severity: medium
Location: `src/services/auth.js:32-40`
Source: A
Verdict: confirmed, fixed
Evidence: nothing in `src/` counted failed sign-ins. Tests "R3 after 5 wrong passwords even the right one is refused with 429, and no session is added" and "R3 the lock ends after 15 minutes, and a right password starts the count again" failed before the fix. Test `<hash>` (CI red), fix `<hash>` (CI green). Not repeated on the live site, where password guessing is off limits; the tests are the evidence.

ID: R4
Title: Two bookings at the same moment pass the 3-booking limit
Severity: low
Location: `src/services/bookings.js:34-39`
Source: A
Verdict: confirmed, fixed
Evidence: the count and the insert were separate queries. Test "R4 cannot take a user past 3 upcoming bookings" failed before the fix (expected [ 'fulfilled', 'fulfilled' ] to deeply equal [ 'fulfilled', 'rejected' ]), and so did "R4 runs on one connection, commits, and rolls back when a step fails" (db.transaction is not a function). Test `<hash>` (CI red), fix `<hash>` (CI green): the count and the insert now run in one transaction that locks the user's row. Not repeated on the live site; the tests are the evidence.

ID: R5
Title: A malformed session cookie gives 500
Severity: low
Location: `src/routes/http.js:24`, `src/routes/http.js:34`
Source: A
Verdict: confirmed, fixed
Evidence: `decodeURIComponent` threw a URIError for `lb_session=%E0%A4%A`, and `timingSafeEqual` threw a RangeError for 64 characters of "é", so every request with such a cookie answered 500. Test "R5 counts as signed out instead of failing with 500" failed before the fix (expected 500 to be 401). Test `<hash>` (CI red), fix `<hash>` (CI green). Live, <date>: `curl -H 'Cookie: lb_session=%E0%A4%A' https://webdev-121326008.onrender.com/api/auth/me` answers 401.

ID: R6
Title: A failing page shows a raw JSON body, though the UI checklist says never
Severity: low
Location: `src/app.js:52`
Source: A
Verdict: confirmed, fixed
Evidence: the error handler answered JSON on every path; READINESS §3 item 5 recorded `{"error":"Something went wrong. Please try again."}` on `/labs` with the database down. Test "R6 answers one sentence as plain text, never a JSON body" failed before the fix (expected 'application/json; charset=utf-8' to match /^text\/plain/). The existing health test now calls `/api/bookings/mine`, with its assertions unchanged. Test `<hash>` (CI red), fix `<hash>` (CI green). Local copy with the database stopped, <date>: `Content-Type: text/plain` and one sentence.

ID: R7
Title: UI: CLS 0.29 and 0.38 at 380 px, but "nothing jumps" is ticked
Severity: low
Location: `docs/UI.md:27-41`
Source: A
Verdict: confirmed, corrected in the docs
Evidence: `docs/UI.md` ticks "Nothing jumps while the page loads", but its own table gives a CLS of 0.29 (no bookings) and 0.38 (2 bookings) at 380 px, and calls anything above 0.25 poor. The box is unticked and the numbers are a known gap in READINESS §7 (`<hash>`). No code changed, so there is no test.

ID: R8
Title: UI: an inline style, but "sizes come from tokens" is ticked
Severity: low
Location: `src/pages/signin.html:19`
Source: A
Verdict: confirmed, fixed
Evidence: `grep -n 'style=' src/pages/*.html` printed `src/pages/signin.html:19`. Test "R8 no page or script sets a style inline" failed before the fix. Test `<hash>` (CI red), fix `<hash>` (CI green): the margin moved to an `.actions` class in `public/app.css`. Live, <date>: `curl -s https://webdev-121326008.onrender.com/signin | grep -c 'style='` prints 0.

ID: R9
Title: Accessibility: focus ring contrast 1.87:1 in light mode
Severity: low
Location: `public/app.css:9`
Source: A
Verdict: confirmed, fixed
Evidence: `--focus: #f2a900` is 1.87:1 on the page background `#f7f7f5` and 2.01:1 on the white cards, while a focus indicator needs 3:1. Test "R9 the focus colour has at least 3:1 against the page and the cards, in light and dark mode" failed before the fix. Test `<hash>` (CI red), fix `<hash>` (CI green): light mode now uses `#9a6700` (4.54:1 and 4.87:1), and dark mode keeps `#f2a900` (9.01:1 and 8.12:1). Live, <date>: the served `app.css` has `--focus: #9a6700`.

ID: R10
Title: Layering: the MCP tools repeat service rules
Severity: low
Location: `mcp-server/server.js:77`, `mcp-server/server.js:98`
Source: A
Verdict: confirmed, fixed
Evidence: `grep -n -e Europe/Sofia -e slot.free -e slot.past mcp-server/server.js` printed lines 77 and 98: the MCP server kept its own copy of the time zone and of the rule "free and not started". Test "R10 names no time zone and decides no slot rule of its own" failed before the fix. Test `<hash>` (CI red), fix `<hash>` (CI green): the lab service marks each slot `bookable` and provides `todayDate()`, and both the assistant and the MCP tools use them. The AC-11 tests still pass.

ID: R11
Title: Sign-up reveals which addresses have an account
Severity: low
Location: `src/services/auth.js:27`
Source: A
Verdict: confirmed, not fixed (by design)
Evidence: signing up again with an address that has an account answers 409 "An account with this email already exists". A sign-up form has to say that an address is taken, so the behaviour stays; READINESS §6 no longer claims the app hides who has an account (`<hash>`).

ID: R12
Title: Synchronous password hashing blocks the server
Severity: low
Location: `src/services/auth.js:28`, `src/services/auth.js:36`
Source: A
Verdict: confirmed, not fixed (known gap)
Evidence: `bcrypt.hashSync` and `bcrypt.compareSync` run on the event loop, so a burst of sign-ins slows every other request. At this app's size the risk is low, and R3 now caps repeated sign-ins per address. Listed in READINESS §7 and DEFENSE.md.

ID: R13
Title: No error listener on the database pool
Severity: low
Location: `src/data/db.js:51`
Source: A
Verdict: confirmed, not fixed (known gap)
Evidence: `grep -n "on('error'" src/data/db.js` prints nothing, so a failing idle connection ends the process until Render restarts it. Already listed in READINESS §7, and in DEFENSE.md.

ID: R14
Title: `/signin?error=` shows any text in the alert box
Severity: low
Location: `public/signin.js:19-20`
Source: A
Verdict: confirmed, fixed
Evidence: the sign-in page put any `?error=` text into the red alert box, so a link could show "Your account is locked, call ..." on the real page. Test "R14 drops any other ?error= text and keeps the ones the Google callback sends" failed before the fix (expected 200 to be 302). Test `<hash>` (CI red), fix `<hash>` (CI green): `/signin` keeps only the four sentences the Google callback sends and redirects anything else to `/signin`. Live, <date>: `/signin?error=Your%20account%20is%20locked` answers 302 to `/signin`.

ID: R15
Title: No per-user limit on "Find me a slot"
Severity: low
Location: `src/routes/assistant.js:10`
Source: A
Verdict: confirmed, not fixed (known gap)
Evidence: nothing in `src/routes/assistant.js` or `src/services/assistant.js` counts calls per user, and each call is a paid model request once `GEMINI_API_KEY` is set. Listed in READINESS §7 and DEFENSE.md.

ID: R16
Title: A stray `pkill` file in the repository root
Severity: low
Location: `pkill`, added in `ce2cc7a`
Source: A
Verdict: confirmed, removed
Evidence: the file holds `pkill -9 -f src/server.js; sleep 1`, a command saved to a file by mistake. Removed in `<hash>`; it has no behaviour, so there is nothing to test.

ID: R17
Title: The MCP server acts with a full 7-day session token
Severity: low
Location: `mcp-server/server.js:62`
Source: A
Verdict: confirmed, not fixed (known gap)
Evidence: `MCP_TOKEN` is looked up as an ordinary session, so whoever holds it has every right of that user for 7 days, and an admin's token can cancel anyone's booking. The token lives only in the codespace's `.env`. Listed in READINESS §7 and DEFENSE.md.

ID: R18
Title: The request trace in SPEC.md names the wrong files and rules
Severity: low
Location: `SPEC.md:72-76`
Source: A
Verdict: confirmed, corrected in the docs
Evidence: the trace put the session check in `src/routes/bookings.js` (it is `src/routes/http.js:48-59`), gave `POST /api/bookings` an id in the URL (it has none), gave booking a 403 (its refusals are 400, 404, 422, 422, 409 and 409), and named the `labs` table where the `bookings` table and its `UNIQUE (lab_id, date, start_hour)` decide. Rewritten in `<hash>`.

ID: R19
Title: <pass B's finding>
Severity: <high, medium or low>
Location: <file:line>
Source: B
Verdict: <confirmed, false positive or unsure>
Evidence: <the line you read, the request you sent, or the test that failed>

## The model feature, the MCP server and authorization

- Model feature: <what goes to Google and what doesn't, what a user sees with no key or a slow answer, how the answer is checked, and R15>
- MCP server: <what the grep showed, how the tools reach the data, whose rights they use, R10 and R17>
- Authorization: <your step 5 requests and their answers, and the one write that didn't check who was asking, R2>

## Precision per pass

- Pass A: Claude (Opus 5.5) in a claude.ai chat, read-only on `2491703`. Prompt: asked to work through exercise 5; the findings were written up in the shape of the skeptical-reviewer prompt from the exercise page. Confirmed n, false positive n, unsure n. Precision n ÷ (n + n) = ...
- Pass B: GitHub Copilot Chat in Ask mode, <model>, on `<hash>`. Prompt: the pass B prompt, copied into AGENT_LOG.md. Confirmed n, false positive n, unsure n. Precision ...

## Confirmed issues no agent found

- <what you found yourself in steps 5 and 6; or "none", and what you checked>

## Replies to the review of my project

<step 10: every confirmed finding, fixed with its two commit hashes, or not fixed and why>