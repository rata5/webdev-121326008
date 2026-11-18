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

## 2026-11-19 · Exercise 3: booking a slot and cancelling it
- Goal: build Slice 2 of SPEC.md (AC-1 to AC-6, AC-17 to AC-20) through every layer: migration, service, routes, authorization, UI, tests.
- Agent: Claude (chat) wrote a step-by-step guide with the code. It could read the public repository but not change it. Gemini CLI was not used. I made every edit by hand.
- Autonomy: none inside the repository. Every edit, test run and commit is mine.
- Checkpoints:
  1. Plan: I review it before writing any code.
  2. Migration: I apply it to an empty database before committing.
  3. Each build step: npm test, then I read git diff --staged and commit.
- Kept: the criteria, the plan review, the always-ask list, every commit, what the failure tests assert, the architecture note.
- Changed in review:
- Went wrong:
- Changed by hand: