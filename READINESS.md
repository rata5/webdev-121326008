# Readiness report: LabBookingBg

## 1. Live URL and how to verify it
- Live site: https://webdev-121326008.onrender.com
- Sign in: https://webdev-121326008.onrender.com/signin. The site's main address sends you here too.
- Lab list and My bookings: https://webdev-121326008.onrender.com/labs. This opens after you sign in.

# how I checked:
- curl -i https://webdev-121326008.onrender.com/health It shows {"status":"ok","db":"ok"}.

## 2. Environment variables
- DATABASE_URL
Purpose: the PostgreSQL connection string, which carries the app to Neon.
From: Neon's Connect dialog, with sslmode=verify-full. The same value goes in .env and in Render's Environment.

- SESSION_SECRET
Purpose: signs the session cookie so nobody can forge one. The app refuses the placeholder change-me.
From: openssl rand -hex 32 in the codespace. On Render it was made with Render's Generate button, so the two environments differ.

- PORT
Purpose: the port the server listens on.
From: 3000 in .env. Render sets its own (10000), so it isn't in Render's dashboard.

- NODE_ENV
Purpose: production makes the session cookie Secure, so it's only sent over HTTPS.
From: development in the codespace, production on Render.

- PUBLIC_BASE_URL
Purpose: the address people open. The Google redirect URI is built from it.
From: the codespace address for port 3000, and https://webdev-121326008.onrender.com on Render.

- GOOGLE_CLIENT_ID
Purpose: tells Google which app is asking.
From: Google Auth Platform → Clients → LabBookingBg.

- GOOGLE_CLIENT_SECRET
Purpose: proves to Google that the code exchange comes from your server.
From: the same client. It's shown only once; a new one can be made with Add secret.

- GEMINI_API_KEY
Purpose: the key for "Find me a slot". Without it, the assistant shows its fallback slots.
From: Google AI Studio. It's currently not set on Render.

- MODEL_NAME
Purpose: which Gemini model is called.
From: gemini-2.5-flash, the same in both places.

- MCP_TOKEN
Purpose: the session the MCP tools act as. It's needed only for npm run mcp in the codespace, not on Render.
From: the part of your lb_session cookie before the dot, or the curl sign-in from step 3k.

# how I checked:
- grep -rhoE "env\.[A-Z][A-Z_]+" src mcp-server | sort -u and grep -E '^[A-Z_]+=' .env.example | cut -d= -f1 list the same names.
- checked if .env-example and Render use the same API keys
- grep -o "sslmode=[a-z-]*" .env prints sslmode=verify-full
- grep -oE "^SESSION_SECRET=.{6}" .env shows the first 6 characters of the secret
- grep "^PORT=" .env print PORT=3000 and after npm start it prints lab-booking listening on http://localhost:3000
- grep "^NODE_ENV=" .env prints NODE_ENV=development. On Render it shows production
- grep "^PUBLIC_BASE_URL=" .env returns the codespace address PUBLIC_BASE_URL=https://infamous-seance-jjjw76x6qgp2pq97-3000.app.github.dev
and Render shows the onrender.com one.
- curl -sI https://webdev-121326008.onrender.com/api/auth/google | grep -i '^location' prints google address containing a callback
- grep -n client_secret src/google/client.js returns only line 22. This is the servers own request to google. The secret never reaches the browser.
-

## 3. What happens when things fail
- The database is down:
1. On start: the server starts anyway and logs "database: not reachable yet (…reason…)."
2. /health: answers 503 with {"status":"error","db":"down"} and logs "health: the database cannot be reached (…)."
3. Sign-in page: still opens, because a guest needs nothing from the database.
4. Signing in or signing up: the form shows "Something went wrong. Please try again." (500). The real error goes only to the log.
5. A page opened while signed in, such as /labs: answers 500 with that same sentence as a bare JSON line.
6. Timing: a refused connection fails at once. A host that doesn't answer makes requests wait up to 10 seconds "(connectionTimeoutMillis: 10_000 in src/data/db.js)."
7. Recovery: when the database is back, the next request works without a restart. The migrations are retried on the next /health, because ready() resets after a failure.

- The server can't be reached:
1. the lab list shows "Could not reach the server. Check your connection and try again."

- Garbage input:
1. Broken JSON: 400, "The request body is not valid JSON."
2. A booking without a lab, a real date or an hour: 400, "Choose a lab, a date (YYYY-MM-DD) and an hour".
3. A lab that doesn't exist: 404, "Lab not found".
4. A weekend or out-of-hours slot: 422, "Labs can be booked Monday to Friday, 08:00 to 20:00".
5. A past slot: 422, "You cannot book a past slot".
6. A write without a session: 401, "Please sign in first". A tampered cookie counts as signed out.
7. An unknown page: 404, "Page not found". An unknown API path gets {"error":"Not found"}.
8. Anything unexpected: 500, "Something went wrong. Please try again." The details go only to the log; there's never a stack trace.

- The rollback is Render, not in the code. It redeploys the previous build, and the data stays because it lives in Neon. Rolling back from the dashboard switches Auto-Deploy off.

- The deploy gate is CI plus Render. When a check fails on GitHub, Render skips that auto-deploy and records it under Events, and the live site keeps running the previous commit.

# how I checked:.
- the database is down
- get a cookie while the database is still up using read -s -p "Password: " PW; echo
curl -s -c /tmp/local.txt -o /dev/null -w '%{http_code}\n' -H 'Content-Type: application/json' -d "{\"email\":\"YOUR-EMAIL\",\"password\":\"$PW\"}" localhost:3000/api/auth/signin
1. start the container docker run --rm -it --init -p 3000:3000 --env-file .env -e DATABASE_URL=postgresql://user:wrong@localhost:5432/none labbooking
it prints database: not reachable yet ()
2. curl -s -w '  → %{http_code}\n' localhost:3000/health prints {"status":"error","db":"down"} 503
3. curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/signin prints 200
4. curl -s -w '  → %{http_code}\n' -H 'Content-Type: application/json' -d '{"email":"a@tu-sofia.bg","password":"whatever-123"}' localhost:3000/api/auth/signin prints {"error":"Something went wrong. Please try again."}  500
5. curl -s -b /tmp/local.txt -w '  → %{http_code}\n' localhost:3000/labs prints {"error":"Something went wrong. Please try again."} 500
6. time curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/health gives 503

- The server can't be reached
1. on live: devtools - network - offline and changing the date prints a red box with "Could not reach the server. Check your connection and try again." label

- garbage input
URL=https://webdev-121326008.onrender.com
curl -s -c /tmp/jar.txt -o /dev/null -w '%{http_code}\n' -H 'Content-Type: application/json' -d "{\"email\":\"YOUR-EMAIL\",\"password\":\"$PW\"}" $URL/api/auth/signin
post() { curl -s -b /tmp/jar.txt -w '  → %{http_code}\n' -H 'Content-Type: application/json' -d "$1" $URL/api/bookings; }
post '{"labId": 1'                                      prints 400
post '{}'                                               prints 401
post '{"labId":1,"date":"2026-02-30","hour":10}'        prints 401
post '{"labId":9999,"date":"2026-11-24","hour":10}'     prints 401
post '{"labId":1,"date":"2026-11-28","hour":10}'        prints 401
post '{"labId":1,"date":"2026-11-24","hour":21}'        prints 401
post '{"labId":1,"date":"2026-11-20","hour":10}'        prints 401
curl -s -w '  → %{http_code}\n' -H 'Content-Type: application/json' -d '{"labId":1,"date":"2026-11-24","hour":10}' $URL/api/bookings                                                prints 401
curl -s -b 'lb_session=forged.value' -w '  → %{http_code}\n' -H 'Content-Type: application/json' -d '{"labId":1,"date":"2026-11-24","hour":10}' $URL/api/bookings                                            prints 401
curl -s -w '  → %{http_code}\n' $URL/nope               prints 404
curl -s -w '  → %{http_code}\n' $URL/api/nope           prints 404

## 4. Four states of one screen
- Loading:
while GET /api/labs?date=… is on its way, the list shows "Loading labs…" and two grey placeholder cards. Each card keeps 160px of room, so the page doesn't jump when the labs arrive. My bookings shows "Loading your bookings…" at the same time. To see it, set Network throttling to a slow preset and reload.

- Content:
The status line reads "3 labs. Green slots are free; slots that have started are shown as Past."
Each lab is a card with its name and "Room … · … seats", followed by the slots from 08:00 to 20:00.
Each slot is marked Free (with a Book button), Taken or Past.
On a Saturday or Sunday, the cards appear without slots under "Labs are closed at the weekend. Pick a day from Monday to Friday."

- Nothing to show:
The lab list's own empty message, "There are no labs yet. An admin can add the first one.", appears only when the labs table is empty. Don't empty your production database to see it.

- The request fails:
the lab list is cleared and a red alert box (role="alert") shows one sentence. Which sentence depends on the failure:
the server answered 500: "Something went wrong. Please try again."
the request never arrived (blocked in DevTools, offline): "Could not reach the server. Check your connection and try again."
any other error without a message: "Could not load the labs. Please try again."

# how I checked:
- loading
by seting network throthling to 3g and reloading "Loading labs…" with two grey cards, and "Loading your bookings…" appears.

- content
by picking a workday it reads "3 labs. Green slots are free; slots that have started are shown as Past."
free slots have green "Book" buttons, picked a past weekday and every slot shows Past, booking a slot in the future shows taken.

- nothing to show
docker run -d --name pgtest -e POSTGRES_PASSWORD=pw -p 5433:5432 postgres:16-alpine
sleep 5
DATABASE_URL=postgresql://postgres:pw@127.0.0.1:5433/postgres npm start     # terminal 1
docker exec pgtest psql -U postgres -c 'DELETE FROM labs'                   # terminal 2, once terminal 1 shows its database line
then open port 3000 and use a new account, /labs shows "There are no labs yet. An admin can add the first one." then clean with ctrl+c
and docker rm -f pgtest

## 5. Request waterfall
- The requests, in order:
1. GET /labs, the page itself. Before sending labs.html, the server checks the session with two database queries: find the session, then the user.
GET /assets/app.css and GET /assets/labs.js. Both start once the HTML arrives: the CSS link is in <head>, the script at the end of <body>. They're plain files served before the session check, so they cost no database queries.
Once labs.js runs, three API requests start at the same moment:
GET /api/auth/me shows your email in the header. It costs the 2 session queries.
GET /api/labs?date=… fetches the lab list: 2 session queries, then the taken slots and the labs, which is 4 queries one after another.
GET /api/bookings/mine fetches My bookings: 2 session queries plus 1 for your upcoming bookings.

2. What waits for what: it's a chain of three steps. The page comes first. The CSS and the script wait for the page. The three API calls wait for labs.js to download and run, then run side by side, and the lab list appears when /api/labs answers.

3. What drives the total time: each database query travels from Render in Frankfurt to Neon in Ohio and back, and /api/labs makes four of them in a row, so expect it to be the slowest. For the total, use Finish at the bottom of the Network tab, since it includes the API calls. Load fires before they're done. Measure with the service already awake: reload twice, and record a cold first visit separately if you like, since it can take about a minute.

# how I checked:

## 6. Security basics checked
- .gitignore keeps .env out of git, and .dockerignore keeps it out of the Docker image.

- Render serves the site over HTTPS with a valid certificate. If you try http://webdev-121326008.onrender.com Render redirects you to https://. In the code, NODE_ENV=production makes the session cookie Secure.


- POST /api/bookings           | 401 "Please sign in first" | can't happen, the booking's user comes from the session (user.id), never from the request body
- DELETE /api/bookings/:id     | 401 "Please sign in first" | 403 "You can only cancel your own bookings" (admins excepted); 404 if it doesn't exist
- POST /api/labs               | 401 "Please sign in first" | 403 "Only an admin can add a lab"
- POST /api/assistant/suggest  | 401 "Please sign in first" | not applicable: it writes nothing, but each call can cost money
- POST /api/auth/signup/signin | open by design             | not applicable
- POST /api/auth/signout       | 204, does nothing          | ends only the caller's own session

- The Google callback is protected by a one-time state cookie. A callback this browser didn't start signs nobody in.

- The lb_session cookie (set in src/routes/http.js):
1. HttpOnly: page JavaScript can't read it, so an injected script can't steal the session.
2. Secure: the browser sends it only over HTTPS, so it never crosses the network in plain text.
3. SameSite=Lax: it isn't sent on cross-site POST or DELETE requests, so another site can't make your browser book or cancel. It is still sent when you follow a link into the app.
4. Max-Age of 7 days, matching the session's expiry on the server.

- The cookie value is token.signature, where the signature is an HMAC-SHA256 made with SESSION_SECRET. A changed cookie counts as signed out; test AC-12 "a forged session cookie" proves it.

- The token is 32 random bytes. The sessions table stores only its SHA-256 hash, so a copy of the database contains no usable session.

- Passwords are stored as bcrypt hashes.

- Sign-in says "Wrong email or password" in every case, so it doesn't reveal who has an account.

- Every SQL query in src/data/ uses $1-style parameters, never text pasted into the query, which blocks SQL injection.

- The X-Powered-By header is turned off.

# how I checked:

## 7. Known gaps, ranked by risk
- Security:
Nothing limits repeated wrong passwords. POST /api/auth/signin answers every attempt; there's no rate limit and no lockout. Only bcrypt makes each guess a little slow. POST /api/auth/signup has no limit either.
No extra security headers. There's no Content-Security-Policy and no helmet.
MCP_TOKEN is a full session. Whoever holds it has all of that user's rights for 7 days, and an admin's token can cancel anyone's booking. There's no narrower, tool-only token.

- Reliability:
Database down means a bare JSON line on pages. When the session lookup fails, the error handler answers with JSON even for a page request like /labs, which the UI checklist rules out.
The database pool has no error listener. The pg documentation says an idle connection that breaks with no listener crashes the process. Render would then restart it.
The free instance sleeps after 15 minutes without visitors. Render's own banner says the first request can be delayed by 50 seconds or more.

- Cost:
No limit on "Find me a slot". Any signed-in user can call POST /api/assistant/suggest as often as they like. Once a Gemini key is set, every call costs money.

- Performance:
The database is in Ohio, the app in Frankfurt. Every query crosses the Atlantic: each request makes 2 session queries, and /api/labs makes 4 in a row.
No favicon. The browser's automatic /favicon.ico request goes through the session check (2 queries) to get a 404.
Expired sessions that are never used again stay in the sessions table forever. They're deleted only on sign-out or when someone uses them; nothing cleans up the rest.

# how I checked:

## 8. Model feature
- What leaves the app:
1. Destination: Google's Gemini API, at https://generativelanguage.googleapis.com/v1beta/models/<gemini-2.5-flash>:generateContent, over HTTPS. The key travels in the x-goog-api-key header.
2. Contents: the request exactly as the user typed it, up to 300 characters. Whatever someone types there goes to Google. Today's date. The free slots for the next 7 days: lab name, room, seats, date and hour.
3. Not sent: names, email addresses, user ids, or who booked what. Taken slots are simply left out.

- What one call costs:
MODEL_NAME is gemini-2.5-flash. The code asks for a JSON answer at temperature 0.2, and sets no cap on output and no limit on thinking. So besides the short visible answer, the model's thinking tokens are billed as output too.

- What the user sees:
1. While waiting: the button says "Thinking…" and the result area says "Looking for free slots…".
2. No key, rate-limited (429), provider error or network failure: "The assistant is unavailable right now, you can still pick a slot from the list." It then shows up to 3 free slots of the chosen day that haven't started, each marked "A free slot on the day you picked" and each with a Book button.
3. No answer within 10 seconds: "The assistant is taking too long. Here are the free slots for the day you picked instead.", with the same three slots.
4. An answer that isn't the JSON asked for, or holds no usable suggestion: "No matching free slot found, try another day."
5. Every suggestion from the model is checked against the database. Only real, free, future, open slots within the next 7 days survive, with no repeats and at most 3.

# how I checked:

## 9. MCP
- The tools:
list_lectures and find_lecture: the course lectures from mcp-server/lectures.json. They need neither the database nor a token.
list_labs, find_free_slots, book_slot, list_my_bookings and cancel_booking: these call the same services in src/services/ as the website. So they follow the same rules and give the same messages, which is AC-11, tested in test/mcp.test.js.

- Who can call them:
Whoever starts the server where DATABASE_URL and MCP_TOKEN are available. npm run mcp reads both from .env.
It talks over stdin and stdout and opens no network port, so nobody outside the codespace can reach it.
Without a valid token, the five project tools refuse with "MCP_TOKEN is missing or has expired…". Without DATABASE_URL, they refuse with "DATABASE_URL is not set…".

# how I checked:
