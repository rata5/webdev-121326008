# LabBookingBg

<!-- Exercise 2. Write the non-goals first. Every acceptance criterion must be checkable in under a minute.
     Keep these headings exactly as they are: the self-checks look for them by name.
     The full target is on the course site under Resources → The course project. -->

## Project option
Lab booking.

## Goals
- A user can see every lab and which time slots are free on a chosen date
- A signed-in user can book one free slot in one lab, and it then shows as taken for everyone
- A user can see their own upcoming bookings and cancel one, which frees the slot again
- Two users cannot book the same lab for the same slot; the second one gets a clear error
- An admin can add a lab with a name, room number and capacity

## Non-goals
- No equipment booking: Book the whole room only
- No recurring booking: Each booking is one slot on one date
- No payments: Booking a lab is free

## Constraints
- Bookings are stored in a database file and survive a server restart
- A slot is one hour, between 08:00 and 20:00, Monday to Friday
- A user cannot book a slot in the past; the API answers 400
- A user can hold at most 3 upcoming bookings; the 4th is refused
- Only the user who made a booking (or an admin) can cancel it; anyone else gets 403

## The model feature
<!-- Which model, which modality, and what it does for a user.
     Name three things or the check fails: the input it receives, the output it produces,
     and what happens when the model is slow, rate-limited or wrong. -->
- Model: Google Gemini `gemini-2.5-flash` (text in, text out) through the Gemini API; the key comes from the `GEMINI_API_KEY` environment variable and is never committed or logged. It powers "Find me a slot": a signed-in user describes in plain words when they need a lab, and gets suggested free slots.
- Input: the user's request as typed (e.g. "a lab with at least 20 seats on Thursday afternoon"), today's date, and the list of labs (name, room, capacity) with their free slots for the next 7 days, read from the database. No names, emails or other personal data are sent to the model.
- Output: JSON with up to 3 suggestions, each `{ labId, date, startHour, reason }`. The server re-checks every suggestion against the database (the lab exists, the slot is free, within 08:00–20:00 Monday to Friday, not in the past) and drops any that fail. The rest are shown as cards labelled "Suggestion" with a "Book" button; nothing is booked until the user clicks it.
- When it fails: while waiting, the button shows "Thinking…" and is disabled. Slow: after a 10-second timeout the user sees "The assistant is taking too long. Here are the free slots for the day you picked instead." Rate-limited (HTTP 429) or provider down: "The assistant is unavailable right now, you can still pick a slot from the list." Both cases use a fallback with no model: the first 3 free slots on the chosen date, from the database. Wrong: suggestions that fail the re-check are dropped; if none are left, "No matching free slot found, try another day." The lab list and manual booking keep working in every case.

## Auth
<!-- Local sign-in plus at least one provider. Say how an account signing in both ways stays one account. -->
- Local: e-mail and password, stored as a bcrypt hash.
- Provider: Sign in with Google, the authorization-code flow, on the server.
- Linking: matched on Google's account id. An address Google has not marked as verified is
  never linked to an existing account.
  
## MCP tools
<!-- At least three tools your own MCP server exposes over this project's data.
     Each tool calls the same service functions the HTTP API calls, so the same rules apply.
     A description shorter than 20 characters is not a description. -->
| Tool | What it does | Who may call it |
| --- | --- | --- |
| `list_labs` | List every lab with its name, room number and capacity. Use it when the user asks which labs exist or which lab is big enough for a group. | Any signed-in user |
| `find_free_slots` | Return the free one-hour slots (08:00–20:00, Monday to Friday) for one lab or all labs on a given date. Use it when the user asks when a lab is free or wants to book and has not picked a slot yet. | Any signed-in user |
| `book_slot` | Book one free slot in one lab for the user the server is signed in as. Refuses past slots, taken slots, and a 4th upcoming booking, with the same messages as the website. Use it only after the user has confirmed the lab, date and hour. | Any signed-in user, for themselves only |
| `list_my_bookings` | List the upcoming bookings of the user the server is signed in as, with lab, date and hour. Use it when the user asks what they have booked or wants to cancel something. | Any signed-in user, own bookings only |
| `cancel_booking` | Cancel one booking by its id, which frees the slot again. Refuses with "not allowed" if the booking belongs to someone else. Use it when the user asks to cancel a booking they own. | The booking's owner, or an admin |

## UI
<!-- Stack, and the three or more screens. The graded checklist lives in docs/UI.md. -->
- Stack: Node 22 with Express for the HTTP API and the MCP server (same service layer); SQLite through `better-sqlite3` as the database file; plain HTML, CSS and JavaScript pages served by Express (no frontend framework and no build step), with CSS design tokens; sessions in an HTTP-only cookie; Google sign-in through OpenID Connect; the model through the Gemini API; tests with Vitest and Supertest. Express serves the API and the pages on port 3000.
- Screens:
  1. Sign in / Sign up: email and password form, "Sign in with Google" button, link between the two forms.
  2. Lab list (Slice 1): a date picker and every lab with its free and taken one-hour slots for that day; a free slot has a "Book" button. The "Find me a slot" box sits at the top of this screen: the user types a request and sees up to 3 suggestions labelled "Suggestion".
  3. My bookings: the user's upcoming bookings with lab, date and hour, each with a "Cancel" button; when empty it says "No bookings yet" with a link to the lab list.
  4. Profile: email, linked sign-in methods, "Link Google account" and "Set a password" buttons, sign out.
  5. Admin, labs: a form to add a lab (name, room number, capacity) and the list of labs; only visible to admins.
- Every screen has a loading, empty, error and success state, and works at 380, 768 and 1280 px wide; the full checklist is in `docs/UI.md`.

## Architecture
<!-- Exercise 3. One request traced through every layer, naming the file for each one,
     plus one place where your own code does not match this layering. -->

## Acceptance criteria
<!-- Every criterion carries an id. A test proves it by naming that id in its title.
     Say who acts, what they see, and what must be true in the database. -->
- [AC-1] A signed-in user who books a free slot sees "Booking confirmed", and one new row appears in `bookings` with their user id, the lab id, the date and the hour.
- [AC-2] A second user who tries to book the same lab for the same slot sees "This slot is already taken" (HTTP 409), and no new row appears in `bookings`.
- [AC-3] A signed-in user who tries to book a slot in the past sees "You cannot book a past slot" (HTTP 400), and no new row appears in `bookings`.
- [AC-4] A user who already has 3 upcoming bookings and tries to book a 4th sees "You can have at most 3 upcoming bookings", and no new row appears in `bookings`.
- [AC-5] A user who cancels their own booking sees it disappear from "My bookings", the slot shows as free again, and the row is removed from `bookings`.
- [AC-6] A user who tries to cancel another user's booking gets HTTP 403, and the row in `bookings` is unchanged.
- [AC-7] An admin who adds a lab with a name, room number and capacity sees it in the lab list, and one new row appears in `labs` with those values.
- [AC-8] A non-admin user who tries to add a lab gets HTTP 403, and no new row appears in `labs`.
- [AC-9] A user with a password account who signs in with Google using the same address, which Google marks as verified, lands in that same account: no new row appears in `users`, and one `google` row appears in `identities`.
- [AC-10] With no `GEMINI_API_KEY` set, a user who asks "Find me a slot" sees "The assistant is unavailable right now, you can still pick a slot from the list." and up to 3 free slots for the chosen date, read from the database.
- [AC-11] The MCP tool `book_slot`, asked to book a slot that is already taken, refuses with "This slot is already taken", the same message the API returns, and no new row appears in `bookings`.

### Slice 1: sign-in and the lab list
- [AC-12] A visitor who opens `/labs` without signing in is redirected to `/signin` (302), `GET /api/labs` answers 401, and no row is added or changed in any table.
- [AC-13] A user who signs in and opens `/labs` for a weekday sees every lab from the `labs` table with its 12 one-hour slots from 08:00 to 20:00, each marked "Free" or "Taken" to match the rows in `bookings` for that date.
- [AC-14] Deleting one row from `labs` in the database and reloading `/labs` removes that lab from the screen.
- [AC-15] A user who signs in with a wrong password sees "Wrong email or password", and no row is added to `sessions`.
- [AC-16] On today's date, slots whose start time has already passed are shown as "Past", not "Free".

## Traceability
<!-- Filled in from Exercise 3 onward: each AC id, and the test that names it. -->
| Criterion | Test |
| --- | --- |
| AC-1 to AC-11 | (from Exercise 3) |
| AC-12 | `test/slice1.test.js`: "AC-12 a guest who opens the lab list is redirected…" |
| AC-13 | `test/slice1.test.js`: "AC-13 the lab list for a weekday shows every lab…" |
| AC-14 | `test/slice1.test.js`: "AC-14 deleting a row from labs and reloading…" |
| AC-15 | `test/auth.test.js`: "AC-15 a wrong password or an unknown email…" |
| AC-16 | `test/slice1.test.js`: "AC-16 on today's date the slots up to the current hour are past…" |

## Spec vs result
<!-- After the agent builds the slice: which criteria passed, which it missed or reinterpreted, and what you changed in this spec because of it. -->
- Passed: AC-12 (`curl -i localhost:3000/labs` gives 302 to `/signin`, `/api/labs` gives 401 without a session), AC-13 (the three seeded labs, 12 slots each, read from the `labs` table), AC-14 (deleted "Networks Lab" from `labs` with sqlite3, it disappeared from the list, then put it back), AC-15 (the same message for a wrong password and an unknown email, no new session row).
- Reinterpreted: the UI section said React with Vite, but the slice was built with plain HTML, CSS and JavaScript served by Express, to keep slice 1 small. There are no seeded user accounts: a user creates one on the sign-up form.
- Missed: on today's date, slots whose hour had already started were shown as "Free", because only the booking rule (AC-3) mentioned the past and no list criterion did.
- Changed: added AC-16 (slots that have started are shown as "Past") and fixed the list to match; the UI section now names plain HTML, CSS and JavaScript instead of React with Vite.
