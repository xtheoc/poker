# Handoff

A personal poker study platform for one user (Theo), playing **6-max No-Limit
Hold'em cash at NL2 on PokerStars**. Not a product; a single-tenant tool.

Written 2026-09-09. Verified against the working tree at that date: **384 tests
pass, `tsc --noEmit` clean, `eslint` clean.**

---

## 0. Read this first

### The entire application is uncommitted

```
$ git log --oneline
7fb9a22 Initial commit from Create Next App

$ git status --short
 M app/layout.tsx  M app/page.tsx  M next.config.ts  M package.json  ...
?? app/(app)/  ?? app/api/  ?? components/  ?? lib/  ?? supabase/  ?? docs/
```

Roughly 120 source files and every migration are **untracked**. There is no
branch history, no PR trail, and nothing meaningful to `git diff` against.
Deploys have been going straight to Vercel from the working folder via
`npx vercel --prod`.

**Recommended first action: commit everything.** Confirm `.env.local` is ignored
first — `.gitignore` covers `.env*`, and that file must never be committed or
uploaded. Until this is done, any mistake is unrecoverable.

### Live URL

`https://poker-kappa-eight.vercel.app`, deployed with `npx vercel --prod` from
the project folder. See `docs/deploy.md`.

---

## 1. Stack and environment

| | |
|---|---|
| Framework | Next.js **16.3.3**, App Router, React 19.2.8 |
| Language | TypeScript, strict |
| Styling | Tailwind 4 (`@tailwindcss/postcss`) |
| Database / auth | Supabase (Postgres + RLS + magic link), `@supabase/ssr` |
| Scheduler | `ts-fsrs` 5.4.2 (FSRS-6) |
| Model calls | `@anthropic-ai/sdk`, server-side only |
| PDF | `pdfjs-dist` 6 |
| Tests | Vitest 4 |

**Next.js 16 is not the Next.js in your training data.** `AGENTS.md`
(auto-written by `next dev`) says so and is right. `params` and `searchParams`
are Promises and must be awaited. Read `node_modules/next/dist/docs/` before
writing routing code.

### Environment variables

Three, in `.env.local` (git-ignored) and mirrored into Vercel:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
ANTHROPIC_API_KEY
```

**Security constraint, enforced in code.** `lib/supabase/env.ts` throws at
startup if `NEXT_PUBLIC_SUPABASE_ANON_KEY` contains `sb_secret_` or
`service_role`. `NEXT_PUBLIC_` values are compiled into the client bundle, so a
privileged key there would be published to every visitor while the app carried
on working perfectly. Use the publishable (`sb_publishable_…`) key only.

The user has asked repeatedly that **keys are never echoed back into chat.**

### Commands

```bash
npm run dev      # next dev
npm run build    # next build
npm test         # vitest run
npm run lint     # eslint
npx tsc --noEmit # typecheck (no npm script for this)
```

There is no combined `check` script; run the three separately.

---

## 2. What the app does

Three pillars sharing one scheduler:

1. **Drill** — preflop spots, graded against a versioned chart set.
2. **Hands** — import PokerStars hand histories, grade every preflop decision,
   rank the resulting leaks.
3. **Library / Reader** — ingest poker books as PDFs, segment them, generate
   recall questions.

The unifying idea: a chart node, a leak and a book concept are all **cards with
a due date** in one FSRS deck.

### Routes

```
/                       landing
/login                  magic link
/hands                  accuracy trend, per-position results, sessions, leaks, import
/hands/session/[id]     one session
/hands/hand/[id]        one hand
/hands/search           hand search
/drill                  the drill — four modes (below)
/drill/charts           chart reference + slow per-node drill
/playstyle              the conditions cheat sheet + HUD shortlist
/library                books, reading-now, librarian
/reader/[id]            read a book
/reader/[id]/summary    a book's extracted rules
/settings               profile, chart info, re-grade, playstyle links
/today /preflop /books /reader   → redirects to their new homes
```

Those four redirects are **intentional** — the URLs are in browser history.
Don't delete them.

### Drill modes (`app/(app)/drill/page.tsx`)

`mine | random | players | ranges`

- **mine** — spots cycled from your own diagnosed leaks
- **random** — uniform over the whole chart set
- **players** — classify an opponent from a synthetic HM3 HUD badge
- **ranges** — paint a 13×13 grid from memory, against a clock

`mine` and `random` share `components/quickfire-drill.tsx` (streak format —
converted to a timed sprint at one point, then converted back at the user's
request). `ranges` and `players` have their own components and their own timing.

---

## 3. Architecture

### The spine: `ChartNode`

Everything downstream — drill sampler, 13×13 grid, grader, leak engine, FSRS
scheduler — consumes `ChartNode` from `lib/poker/charts.ts` and knows nothing
else. That seam is what lets strategy sources change without touching the app.

```
NodeKey { scenario, position, villain?, stackBb, treeId }
   → nodeId()   e.g. "6max-2.5x/100bb/vs-rfi/BB-vs-CO"
ChartNode { key, strategies: Record<Hand, Strategy> }   // sparse: absent = fold
Strategy  { fold?|call?|raise?|allin?: { freq, ev? } }
```

**Node identity deliberately excludes the chart version.** A node is a
*situation*; publishing better numbers for it must re-grade history rather than
orphan every card. `chart_version` is stamped on stored rows instead
(`srs_card`, `played_hand`, `hand_violation`), so a review recorded under older
numbers stays interpretable rather than being silently re-judged.

### Two ways nodes come into existence

The most important recent design decision.

**Authored** (`lib/poker/charts/beginner-6max.ts`) — opening ranges, written as
notation strings and expanded by `parseRange`. Right for opening ranges, which
are genuinely arbitrary lists.

**Generated** (`lib/poker/rules.ts` + `lib/poker/rules/preflop.ts`) — everything
facing action. A `Rule` is an id, a scenario, a condition over a `RuleSpot`, a
prescribed action, and a **citation**. `nodeFromRules()` asks all 169 hands and
builds a `ChartNode`.

Why: the source book does not have 45 answers for the 45 facing-action seat
pairs. It has about six sentences. Authoring them as grids would misrepresent
the source and invent a memorisation task that does not exist.

```
Rules are consulted in order; FIRST MATCH WINS.
An exception must be ordered ABOVE the rule it excepts, or it is dead code.
```

That bug was made and fixed during development — `vs-4bet/nit-cold-4bet` sat
below `vs-4bet/continue` and could never fire.

**`needsRead` rules are excluded from generated nodes** unless the caller passes
`{ useReads: true }`. A rule conditioned on an opponent read cannot apply to a
node, which has no opponent attached. Grading someone against a condition the
app cannot verify is the failure mode this project is built to avoid.

### Chart set: `BEGINNER_6MAX`, version 10

`treeId: "6max-2.5x"`, `stackBb: 100`, `openBb: 2.5`, `sbOpenBb: 3`.

**52 nodes:**

| Scenario | Nodes | Source |
|---|---|---|
| `rfi` | 6 | authored notation |
| `vs-limp` | 1 | authored (button behind 3+ limpers) |
| `vs-rfi` | 15 | generated from `VS_OPEN_RULES` |
| `vs-3bet` | 15 | generated from `VS_3BET_RULES` |
| `vs-4bet` | 15 | generated from `VS_4BET_RULES` |

`SCENARIOS` also declares `squeeze` and `bvb`, **deliberately unpopulated** — the
book states nothing usable about them, and a test asserts they stay uncovered.

**Seat direction differs by scenario, and this is easy to get wrong:**

- `vs-rfi` / `vs-3bet` — villain acts **after** hero (they raised into you; they
  3-bet your open).
- `vs-4bet` — villain acts **before** hero: the original opener re-raising your
  3-bet. Generating it the other way models only the rare *cold* 4-bet. This bug
  was made and fixed; see the comment on `VS_4BET_NODES`.

### The verdict seam

`lib/verdict.ts` defines `VerdictProvider` with sources
`chart | mdf | solver | heuristic | llm` and confidences
`exact | high | medium | low`. **Only `exact` and `high` may generate drill
cards.** The rule that matters: *a provider returns null when it does not know.*

`lib/poker/chart-provider.ts` is the only implementation today. Adding a rules
provider or a solver means adding to the list, not threading through callers.

### Hand-history pipeline

```
raw text → lib/hand-history/parse.ts     → ParsedHand
         → lib/hand-history/decisions.ts → HeroDecision[] (NodeKey where matched)
         → lib/hands-store.ts importHands() → played_hand + hand_violation rows
         → lib/leaks.ts findLeaks()          → ranked leaks
         → lib/poker/leak-drill.ts           → drill spots
```

`decisions.ts` attaches a `NodeKey` **only when the spot is genuinely the one the
chart describes**. Unmatched decisions still come back — they are real decisions
— but carry no node and the grader skips them. That is why the `charted` count
is the accuracy denominator, never "hands dealt".

### Leaks

`lib/leaks.ts`. Ranked by **frequency × cost**, not cost alone — the naive
alternative surfaces the dramatic 40bb disaster and buries the 0.2bb error made
200 times a week. Gates: `MIN_INSTANCES = 3`, `MIN_SESSIONS = 2`,
`CONFIRMED_INSTANCES = 8`, `CONFIRMED_SESSIONS = 3`.

### Scheduler

`lib/srs.ts` wraps `ts-fsrs`. **Never hardcode `w`** — call
`generatorParameters()`. `enable_fuzz` is on deliberately, or everything learned
on day one comes due together forever. Response latency feeds the grade
(`FAST_ANSWER_MS = 3000`, `SLOW_ANSWER_MS = 8000`) because FSRS has no latency
input and a hand answered correctly after eight seconds is not memorised.

### HUD module

`lib/hud/stats.ts` is the **single source of truth for colour bands**, consumed
by `hud-reference.tsx` (drill popup), `hud-shortlist.tsx` (playstyle page) and
`lib/hud/deal.ts` (synthetic opponent generation).

The cuts are a transcription of the user's own HM3 configuration. They changed
once (2026-09-08) when he reconfigured his tracker to the book's numbers.
`lib/hud/players.ts` sampling ranges are tuned to sit inside the band each
archetype's `pattern` claims, and a test enforces that — **if you change a cut,
you must retune the ranges.**

---

## 4. Conventions

Mirror what is there. It is consistent and deliberate.

- **Pure domain logic in `lib/*.ts`, colocated `lib/*.test.ts`.** Components are
  thin.
- **Comments explain *why*, not what.** Module headers carry the reasoning and
  the rejected alternatives. Several record a bug that was made and fixed —
  those are load-bearing; do not tidy them away.
- **Data separate from rendering.** `lib/playstyle.ts` is content;
  `components/playstyle-card.tsx` is a dumb renderer.
- **One source of truth, always.** Duplicated numbers are treated as a bug.
  Tests assert the playstyle sheet does *not* restate range notation or HUD
  bands.
- **Sample-size honesty.** Every stat carries a threshold, and below it may be
  displayed but may not generate a drill card. `lib/sessions.ts` gates *your*
  stats far harder (VPIP/PFR 300 hands, showdown family 8,000) than
  `lib/hud/stats.ts` gates *opponent* reads (20/100/500) — different questions,
  each right for its own.
- **Tests derive from constants where a constant exists.** Several were
  rewritten to read `STATS.vpip.cuts` rather than restate `22`, precisely
  because hardcoding made them fail for the wrong reason when the real number
  moved. The one exception is the test that *prints* the bands — that one spells
  them out, because it is where a typo in the real numbers gets caught.
- **React Compiler lint is on.** No setState in effects (use
  `useSyncExternalStore` for storage-backed values), no ref writes during render,
  no mutating a closure variable inside `.map`.
- **Model calls happen because a button was pressed**, never as a side effect,
  and only from `app/api/*`.

### A project hook enforces "fact-forcing"

Before every `Write`/`Edit` and the first `Bash` call, the harness demands you
state: importers/callers, public API affected, data fields with synthetic values,
and the verbatim user instruction. It is noisy but it catches real mistakes.
Expect it.

---

## 5. Known bugs and blocked items

### Blocked on the user, not on code

1. **Migration `0008_figures.sql` has never been run.** The reader throws
   `column passage.figure_pages does not exist` until it is applied in the
   Supabase SQL editor. The error path is handled well —
   `lib/reader/store.ts` maps the Postgres error to the exact migration filename
   and `components/migration-notice.tsx` displays it — but the feature is dead
   until he runs it.

2. **A re-grade is outstanding.** The chart set is at version 10; his stored
   hands were last graded under an earlier version. Settings → *Re-grade*
   applies the current set. Until then his accuracy understates coverage.

3. **Synthetic fixture hands are in production data.**
   `fixtures/sample-session.txt` holds hands `#900000001`–`#900000008`, imported
   during testing. They are indistinguishable from real hands in the UI. Worth
   deleting from the hands page.

### Real defects and gaps

4. **`ruleFor()` is built, tested, and wired to nothing.** `lib/poker/rules.ts`
   can return the rule — and its citation — behind any answer, which is the
   whole point of grading against a book rather than a solver. No UI surfaces
   it. A wrong answer still just says "fold".

5. **`vs-3bet` and `vs-4bet` nodes are unreachable from imported hands.**
   `decisions.ts` only attaches a node to the hero's *first* preflop decision
   (`heroPreflopDecisions === 0`), and facing a 3-bet is by definition the
   second. The nodes exist and the drill deals them; the analyser cannot see
   them.

6. **Bet sizing is completely ungraded.** Every open, 3-bet and 4-bet size is in
   the hand history and mechanically checkable against the ladder. Nothing
   checks it. The single largest measurable gap.

7. **The tree convention may be wrong.** The chart is `6max-2.5x` with
   `openBb: 2.5`, but the book — and the playstyle sheet — prescribe **4bb from
   EP/MP and 3bb from LP at NL2**. Fixing it properly means changing `treeId`,
   which would orphan every scheduler card keyed to it. The user was told and
   chose to leave it. Revisit deliberately, with a migration plan.

8. **No postflop anything.** No hand-versus-board evaluation exists. `lib/poker/`
   can name a hand class but cannot tell you whether it made top pair. Every
   postflop rule on the playstyle sheet is unmeasurable until that library
   exists.

9. **`lib/hud/stats.ts` turn stats are ours, not the book's.** `turnFoldCb` and
   `turnCb` cuts are estimates; every other cut is transcribed. The comment says
   so. Don't let them drift into looking authoritative.

### Not bugs — deliberate

- **All 15 `vs-rfi` nodes hold identical strategies.** The book's answer to
  "someone raised" does not depend on the seats at 100bb. A test asserts they
  stay identical; if it fails, a rule has started depending on position.
- **Fifteen identical nodes means fifteen SRS cards.** Accepted queue cost.
- **`squeeze` and `bvb` are declared and empty.**
- **The app works fully signed out** and simply forgets. `supabaseEnv()` returns
  null rather than throwing when unconfigured.

---

## 6. Unfinished work — the phased plan

The user and I agreed a seven-phase plan to make every in-game decision
drillable. **Phase 1 is complete.** Phase 2 is next.

| Phase | Scope | Status |
|---|---|---|
| 1 | Preflop facing action — rule engine, vs-open / vs-3bet / vs-4bet | **Done** (chart v9, v10) |
| 2 | **Sizing** — amounts on every node, a sizing drill, sizing verdicts | **Next** |
| 3 | Hand-strength library — hand vs board, draws, board texture | Not started |
| 4 | Flop — cbet or not, sizing ladder, facing raises and donks, multiway | Not started |
| 5 | Turn — the turn rule, pot control, the one legal bluff | Not started |
| 6 | River — value betting, the AF call ladder, folding to raises | Not started |
| 7 | Real opponent stats computed from his own hand histories | Not started |

Notes carried from the planning:

- **Phase 3 has nothing to show the user and cannot be skipped.** Every postflop
  rule is a sentence about a hand against a board. Phases 4–6 are fast only
  because 3 exists.
- **Phase 7 is safely last.** Drills can *show* a synthetic HUD badge, so
  conditional rules are drillable without real stats. Only the analyser needs
  them.
- **Phase 7 must stay inside PokerStars' policy** — his own hand histories only,
  analysed away from the table. See §8.

### The playstyle sheet is mid-edit

`lib/playstyle.ts` renders at `/playstyle`. The user is reviewing it section by
section and having each rewritten for brevity and clarity.

**Rewritten:** `types`, `sizing`, `exceptions`, `facing`, `flop`.
**Still in their original, too-long, jargon-heavy form:** `turn`, `river`,
`big`, `spots`, `self`, `aged`.

His stated preferences, applied so far and worth continuing:

- Cut anything he already knows.
- No jargon without a plain-English gloss — he did not know "donk bet", "no
  piece", "rags", "wet board".
- Order sections by the sequence the decision actually happens in.
- Shorter and straight to the point, without losing value.
- **6-max NL2 only.** Delete full-ring and NL5+ variants.

---

## 7. Next recommended tasks

In order.

1. **Commit the repository.** Everything above is at risk until this is done.
   Verify `.env.local` is ignored first.

2. **Finish the playstyle sheet** (turn, river, big, spots, self, aged). Cheap,
   the user is actively engaged with it, and it is the document the rest of the
   work is graded against. Follow §6.

3. **Phase 2 — sizing.** Highest value per unit effort of the remaining
   engineering:
   - amounts on nodes, plus a `sizing` drill mode;
   - grade sizes on imported hands — every size is already parsed;
   - resolve the `treeId` question (§5.7) before or as part of this.

4. **Wire `ruleFor()` into feedback** (§5.4). Small, and it turns "fold" into
   "fold — *set mining, properly*: you needed 50bb behind and had 40". The rules
   already carry citations.

5. **Fix `decisions.ts` to node later preflop decisions** (§5.5). Without it, a
   third of the generated chart is never tested against real play.

6. **Phase 3 — hand-strength library.** The gate on everything postflop.

---

## 8. Hard constraints — do not violate

**PokerStars Third Party Tools policy.** This app sits in *Category B*:
permitted, but **prohibited while the PokerStars client is running**.
Consequences that are not optional:

- No screen scraping, window hooking, OCR or memory reading. Ever.
- No HUD overlay on the table. The HUD content here is a *training* simulation
  of his own tracker, used away from the table.
- No pooled data, no opponent lookup, no cross-user stats, no datamining.
- Enforcement is account ban **plus confiscation of funds**.

The planned watcher (`watcher/`, not yet built) must detect a running PokerStars
client and hold off importing until it closes.

**Book content** is the user's own legally acquired copies, ingested for personal
study, never redistributed.

**Honest uncertainty is a product requirement.** Where the engine is not
confident an action was a mistake, it must say so rather than invent a
solver-grade verdict. Several tests exist purely to enforce this: the sheet may
not restate ranges, unmatched decisions may not be graded, low-confidence
verdicts may not generate cards.

---

## 9. Source material

The strategy is transcribed from **Nathan "BlackRain79" Williams, *Crushing the
Microstakes*** (2011, 2015 revision). Two derived documents live as Claude
artifacts the user owns: *The Micros Rules Card* (every actionable rule, stripped
of explanation) and *The Micros Playbook* (the same material with the reasoning).

`docs/research/` holds three deep research reports — hand histories and ToS,
ranges and FSRS, book curriculum — and `docs/PLAN.md` the original build plan.
`PLAN.md` is largely historical now, but its reasoning about card granularity,
sample-size gating and the verdict seam is still what the code does.

**Where the book contradicts itself**, decisions were made by evidence and are
recorded in comments in `lib/poker/charts/beginner-6max.ts`. Two examples: the
hijack range follows the prose over the chart at the user's direction; the button
was trimmed from 51% to 40% because the prose states 40% even though the chart
row computes to 49%. Read those comments before changing a range.
