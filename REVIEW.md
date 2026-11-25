# Review of my own project: LabBookingBg

The examiner dropped the peer review, so this reviews my own project with two agent passes.
Commit reviewed: `2491703` (pass A), `<hash>` (pass B).

| ID | Title | Severity | Location | Source | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Real Neon password and session secret in `.env.example` | | `.env.example:7`, `:9` | A | | |
| R2 | Google sign-in keeps the password of whoever registered the address first | | `src/services/auth.js:66-69` | A | | |
| R3 | No limit on wrong passwords | | `src/services/auth.js:32-40` | A | | |
| R4 | Two bookings at the same moment pass the 3-booking limit | | `src/services/bookings.js:34-39` | A | | |
| R5 | A malformed session cookie gives 500 | | `src/routes/http.js:24`, `:34` | A | | |
| R6 | A failing page shows a raw JSON body, though the UI checklist says never | | `src/app.js:52` | A | | |
| R7 | UI: CLS 0.29 and 0.38 at 380 px, but "nothing jumps" is ticked | | `docs/UI.md:27-41` | A | | |
| R8 | UI: an inline style, but "sizes come from tokens" is ticked | | `src/pages/signin.html:19` | A | | |
| R9 | Accessibility: focus ring contrast 1.87:1 in light mode | | `public/app.css:9` | A | | |
| R10 | Layering: the MCP tools repeat service rules | | `mcp-server/server.js:77`, `:98` | A | | |
| R11 | Sign-up reveals which addresses have an account | | `src/services/auth.js:27` | A | | |
| R12 | Synchronous password hashing blocks the server | | `src/services/auth.js:28`, `:36` | A | | |
| R13 | No error listener on the database pool | | `src/data/db.js:51` | A | | |
| R14 | `/signin?error=` shows any text in the alert box | | `public/signin.js:19-20` | A | | |
| R15 | No per-user limit on "Find me a slot" | | `src/routes/assistant.js:10` | A | | |
| R16 | A stray `pkill` file in the repository root | | `pkill` | A | | |
| R17 | The MCP server acts with a full 7-day session token | | `mcp-server/server.js:62` | A | | |
| R18 | The request trace in SPEC.md names the wrong files and rules | | `SPEC.md:72-76` | A | | |
| R19 | (pass B's first new finding) | | | B | | |

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