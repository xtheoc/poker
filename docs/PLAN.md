# Poker Study Platform — Build Plan

Full research reports live alongside this file and are worth keeping:
`…-agent-a261f9bc5f9fa1695.md` (hand histories, PokerStars ToS, leak methodology,
solvers), `…-agent-a67a90ca2e61c9700.md` (range data, FSRS, retention science),
`…-agent-ad8a88e052d4c5ab5.md` (book curriculum).

## Context

Theo plays online 6-max NLHE cash at NL2, is a beginner, plays under 1,000 hands
a week, and wants "the thing that will get me most money." Right now there is no
study loop at all: hands get played, mistakes get made, and nothing captures or
re-tests them. Books get read and forgotten. Preflop ranges get half-memorised.

The platform closes that loop with three pillars that feed each other:

1. **Leak engine** — ingest PokerStars hand histories, find where money was
   actually lost, rank leaks by what they genuinely cost.
2. **Drill engine** — turn those leaks into a daily 5–10 minute quiz scheduled by
   a real spaced-repetition algorithm. Also drives a standalone preflop trainer.
3. **Study engine** — a researched book progression with an in-app reader that
   generates retrieval practice from what was actually read.

The unifying idea: **one scheduler, one card table.** A preflop node, a hand you
misplayed, and a concept from chapter 4 are all cards with a due date. That is
what makes this a platform instead of three tools competing for the same ten
minutes.

## Decisions made

| Question | Answer |
| --- | --- |
| Format / stakes | 6-max NLHE online cash, ~100bb, NL2 |
| Level | Beginner — knows the rules, losing or breakeven |
| Volume | Under 1,000 hands/week |
| Truth source | Charts + heuristics + LLM coach. No solver in v1; schema accepts one later |
| Hand ingest | Folder watcher that **pauses while the PokerStars client is running** |
| Books | EPUB/PDF, ingested; curriculum picks the order |
| Codebase | Standalone app in `C:\01_Projects\poker`, own Supabase project |
| Daily drill | 5–10 minutes |
| Tilt | Post-session rating + note, correlated against results |
| Bankroll tracking | Out of scope |

## The constraint that shapes everything: low volume

Under 1,000 hands/week invalidates the obvious design.

The conventional way to find leaks is **frequency statistics** — measure VPIP,
fold-to-3bet, turn c-bet by texture, compare to a baseline. The research put hard
numbers on what that needs: VPIP and PFR stabilise around 300 hands, 3-bet around
1,000, fold-to-3bet around 1,500, and **WWSF / WTSD / W$SD need roughly 8,000.**
At this volume the last group is about a year away. A tool that reports a "river
overfold leak" from forty samples is pointing at randomness and drilling a fake
mistake. **A leak detector that invents leaks is worse than no tool.**

So the engine does **per-decision classification, not frequency estimation:**

- **Preflop is deterministic.** Given position, prior action and the exact hand, a
  chart says fold / call / raise. A deviation is a verifiable fact about one
  decision, not a statistical inference. Twenty chart violations out of two
  hundred preflop decisions is real signal on day one.
- **Postflop is heuristic plus LLM.** Cheap rules flag hands worth a closer look
  (big pot lost, stack-off with a marginal holding, called a river raise); only
  those go to Claude. At a few hundred flop-seeing hands a week that is cheap.
- **MDF is the one rigorous postflop signal available without a solver.** With
  `Alpha = bet/(bet+pot)` and `MDF = 1 − Alpha`, a river fold frequency well above
  MDF is mathematically defensible. It holds **on the river only** — bluffs retain
  equity earlier, so applying it to flop and turn overstates required defence.

**Every stat carries its sample-size threshold, and below it can be displayed but
cannot generate a drill.** Most tools skip this. Doing it properly is the honest
differentiator.

## Priority order, given a beginner

Not the order the pillars were described in — the order that makes money.

1. **Preflop discipline.** Beginners lose more to playing too many hands from bad
   positions than to every postflop mistake combined, and it is the only part of
   the game where a chart gives a genuinely correct answer. The research confirms
   it independently: *at micro stakes, preflop errors dominate total EV loss.*
   This ships first and needs no hand history.
2. **Per-hand review of real hands.** Concrete, personal, motivating.
3. **Foundations reading.** Correctly sequenced, but a supporting actor.

GTO depth is deliberately deferred. Recommending *Modern Poker Theory* to someone
still learning preflop ranges is how study time gets wasted.

## On "the thing that will get me most money"

The format is not the lever at this stage. Stay at **micro-stakes 6-max cash, at
regular tables rather than Zoom.**

- **Cash over MTT** — tournament variance is so high a beginner cannot distinguish
  a winning strategy from a losing one for the better part of a year. Cash gives a
  readable feedback loop, which is the entire point right now.
- **Regular tables over Zoom** — Zoom deals more hands but removes table
  selection, and choosing to sit with bad players is the largest edge available to
  a beginner. Zoom also encourages auto-pilot.
- **The money is in not losing.** Stake discipline protects more EV at NL2 than
  any strategic refinement.

## Hard constraints

**The PokerStars policy governs the whole design.** Its Third Party Tools policy
has three tiers, and this platform sits squarely in the middle one — Category B,
*"Permitted, but Prohibited While PokerStars Software Is Running"*, which covers
reference material beyond a basic level, tools that ease referral to reference
material, and equity calculators. Category C, banned always, targets bots and
"real-time advice on what action to take through reading of the current game
state." Consequences that are not optional:

- **Legal away from the table, prohibited at it** — including the chart viewer,
  which exceeds the "basic starting-hand chart" Category A allows.
- **No screen scraping, window hooking, OCR, or memory reading. Ever.**
- **No HUD.** Permitted within sharp limits, but highest-risk and lowest-value,
  and it drags the product from "study tool" to "in-game tool."
- **No pooled data, no opponent lookup, no cross-user stats.** The policy bans
  datamining, *the use of* datamined hands, and mass sharing — three separate
  prohibitions. Moot anyway since May 2025, when PokerStars stopped exposing hands
  you were not dealt into.
- Enforcement is account ban **plus confiscation of funds**.

One honest caveat: no clause explicitly says "you may analyse your own hand
histories." Permission is inferred structurally — Category B restricts heavy
analysis *only while the client runs*, which presupposes it is fine otherwise, and
GTO Wizard runs a commercial analyser on that basis. Strong inference, not a
quotation.

Two more: **book text is Theo's own legally-acquired copies**, ingested for
personal study, never redistributed. And **honest uncertainty** — when the engine
is not confident an action was a mistake it says so rather than inventing a
solver-grade verdict.

## Stack

Inherited from `life-os`, which is proven on this machine and deployed on Vercel:
Next.js 16 App Router + React 19, TypeScript, Tailwind 4, Supabase (Postgres +
auth + RLS), `@anthropic-ai/sdk` called only from `app/api/*`, Vitest.

Conventions to mirror:

- Pure domain logic in `lib/*.ts` with a colocated `lib/*.test.ts`
- A `requireUser()` preamble for authenticated pages — see `life-os/lib/session.ts`
- Every table has `user_id`, RLS enabled, an owner policy — see
  `life-os/supabase/migrations/0011_tasks.sql` for the exact shape
- Model calls happen because a button was pressed, never as a side effect
- Migration and module headers explain *why*

New dependency: **`ts-fsrs`** (MIT, v5.4.2, implements FSRS-6, actively
maintained, needs Node ≥20).

## Architecture

### The spine: one card table, one scheduler

**Use FSRS-6 via `ts-fsrs`. Do not write an SM-2.** In the authoritative benchmark
over ~350M reviews, SM-2 ranks second-to-last — beaten only by a constant-
prediction baseline. FSRS also operationalises the Cepeda spacing ridgeline for
free, so intervals should never be hand-tuned. (Worth knowing and not overclaiming:
that same benchmark says neural models beat FSRS "by a very big margin." FSRS is
the best *deployable* choice, not the global optimum.)

Two tables, following the `ts-fsrs` types verbatim:

- **`srs_card`** — one row per (user, drillable item), carrying `due`, `stability`,
  `difficulty`, `elapsed_days`, `scheduled_days`, `learning_steps`, `reps`,
  `lapses`, `state`, `last_review`. Partial index on `(user_id, due) WHERE NOT
  suspended` — that is the hot query.
- **`srs_review_log`** — **append-only, never updated.** Not optional: it is the
  training set for per-user parameter fitting and what `reschedule()` replays.
  Carries the FSRS fields plus poker-specific columns FSRS knows nothing about:
  `ev_loss_bb`, `chosen_action`, `solver_freq`, `rng_roll`, `duration_ms`.
- **`srs_params`** — per-user weights. Retrain once past ~1,000 reviews; below
  that the defaults win. **Never hardcode `w`** — call `generatorParameters()`.
  **Turn `enable_fuzz` on**, against the library default, or everything learned on
  day one comes due together forever and the queue goes spiky.

**Card granularity is the schema decision that must be right now, because it
cannot be retrofitted.** A full 6-max 100bb tree is ~85 decision nodes; 169 hand
classes × 85 nodes ≈ **14,400 atomic facts.** One FSRS card per fact is
unlearnable and makes intervals meaningless. Instead:

- **One card ≈ one *node*** (position × scenario × villain). ~85 cards for a full
  tree; ~20 for the beginner core. A tractable deck.
- **One review = a short drill of N hands sampled from that node**, weighted by
  frequency and biased toward hands this user has previously got wrong and toward
  close decisions.
- **The FSRS grade comes from the session's aggregate EV loss**, mapped: wrong
  action past a blunder threshold → `Again`; correct-at-some-frequency but not
  best, or slow → `Hard`; best action at normal speed → `Good`; best, fast, and
  previously stable → `Easy`. Thresholds expressed as **% of pot**, not raw bb, so
  they compare across nodes. **Response latency must feed the grade** — FSRS has no
  latency input, and a hand you get right after eight seconds of arithmetic is not
  memorised.
- **Per-hand error stats live in the review log, outside FSRS state**, used purely
  for within-card sampling. Fine-grained leak-finding without exploding the queue.

The daily queue is due cards ordered by a blend of overdueness and the cost of the
leak behind them, capped for a 5–10 minute session. **A card whose leak has
stopped appearing in real hands gets retired rather than reviewed forever — the
hand history is the exit criterion**, which a generic SRS app can never do.

One separation to respect, borrowed from SuperMemo: **reading material does not go
through FSRS.** FSRS models recall probability, and re-reading an article is not a
recall event. Topics (things to read) get a separate priority-sorted, user-
controllable queue; Items (things to recall) get FSRS. Mixing them corrupts the
scheduler.

### Pillar 1 — Preflop trainer

Ships first, works with zero hand history.

**The chart-data problem, and the answer.** There is **no openly-licensed,
solver-accurate 6-max 100bb range dataset in machine-readable form.** Every
accurate set is paywalled, or is a community re-typing of a paywalled set
published under a license the re-typer had no right to grant — the most-starred
GitHub option literally headers its data "Extracted from GreenCharts2024_01.pdf."
**None of that gets vendored.**

So: **v1 ships a hand-authored chart set we own**, written from published aggregate
frequencies, using **pure strategies with no mixes.** This is not a compromise, it
is better pedagogy for NL2 — mixed strategies are unlearnable for a beginner and
irrelevant at these stakes, where opponents' errors dwarf equilibrium deviations.

But the **schema carries frequencies and per-action EV from day one** —
`hand → {action: {freq, ev}}` — so a solver-derived set drops in later without a
rewrite. Two things must exist from the start for the same reason:

- **The RNG die.** A 1–100 roll shown alongside mixed nodes, making the correct
  action deterministic given the roll. It is the only way to grade a 30%-raise
  hand at all, and retrofitting it means rewriting the grader.
- **The "close decisions only" filter** — restrict drills to hands where multiple
  actions have similar EV. It is both a difficulty dial and the thing that stops
  the queue being 60% trivial folds.

**Scope the tree to one and cover it completely.** A complete single tree beats a
patchy multi-tree library for a memorisation product. Pick **100bb, 2.5x opens all
positions, SB 3.0x** — the simplification, chosen because there is less to
memorise. The beginner core is **RFI (5 nodes) + vs-RFI (15 nodes) = 20**, which
is where the money is; squeeze, cold 4-bet, vs-3bet and blind-vs-blind expand it to
~85 later.

Grading follows GTO Wizard's synthesis, which is the right one: classify jointly
by (frequency, EV loss) into buckets — best / correct-but-not-best / inaccuracy /
wrong / blunder — score non-linearly, and report EV loss separately. Binary
right-wrong is incoherent at mixed nodes; raw EV loss is correctly weighted but
uncalibrated as feedback since most preflop errors sit between 0.02 and 0.3bb.
**Show the full frequency vector immediately after every answer** — immediate
feedback is one of the three moderators that strengthen the testing effect.

Pure logic in `lib/ranges.ts` with `lib/ranges.test.ts`. The range-notation grammar
is ~200 lines and every JS library is either dormant or weight-blind, so **write
it** with weights and action vectors as first-class, using
`@poker-apprentice/hand-range-notation` (MIT) as a test oracle only. No runtime
evaluator is needed — preflop equity is a lookup table precomputed once.

`PokerBench` (HuggingFace, **Apache-2.0**, 60k preflop rows) is the one cleanly
licensed dataset and makes a good independent eval bank — **but its provenance
(solver, stack depth, table size, rake) is not stated on the dataset card, so the
paper must be read before relying on it**, and its labels flatten mixed strategies
into point decisions.

### Pillar 2 — Hand ingest and leak engine

**Onboarding first, because nothing works without it.** PokerStars does not save
hand histories by default and the setting **is not retroactive**. First-run must
walk through: Settings → Playing History → Hand History → **Save My Hand History**
→ **Save in English** (non-English breaks every parser) → note the folder → Apply.
Flag the retention setting, which silently deletes old files. A second import path
— pasting the blob PokerStars emails via **Tools → History & Stats → Get Hand
History** — recovers hands played before setup.

The folder is `%LOCALAPPDATA%\PokerStars\HandHistory\<ScreenName>\` on current
Windows. PokerStars' own help page documents a stale `Program Files` path and
regional clients were unverifiable, so this is a **best-guess default in a folder
picker**, never hardcoded.

**The watcher** (`watcher/`) tails that folder and posts hands to the app.

- **It detects the running PokerStars client and holds off, importing when the
  client closes.** Keeps the zero-friction UX and stays clearly inside Category B.
- It uploads **raw text and does no parsing.** Parsing belongs in the app where a
  bug can be fixed and re-run against already-ingested hands. Reprocessing must
  never require the hands again.
- The PokerStars hand ID is a natural key with a unique constraint, so re-running
  over the same files is idempotent. The watcher will be restarted constantly.

**The parser** (`lib/hand-history/`) — **we write our own.** There is no
maintained, battle-tested PokerStars parser in JS or TS: the one real option
(`thlorenz/hhp`) is untouched since 2020, and `@poker-apprentice/hand-history-parser`
is widely mis-recommended but **does not support PokerStars at all.** The best
Python option warns its own PokerStars parser "is known to fail to parse certain
hands." The format is line-oriented; this is a day or two.

What we take from those projects is their **test data**: `hhp`'s fixtures are a
curated corpus of fourteen named edge cases, and `pokerdf` ships a 27 KB regex test
file that is the best record of what current PokerStars lines look like. **Mine
both; depend on neither.**

Design, learned from how they fail:

- A **line-by-line state machine** keyed on `*** SECTION ***` markers, not one
  mega-regex.
- Player names contain spaces, parentheses, colons and dots. **Anchor on the seat
  roster from the header** and match `^<name>: <verb>`, longest-name-first. This is
  the single biggest source of parser bugs.
- Cash carries `$`, tournaments are bare integers — two money lexers.
- **Assume drift.** The format changed in Oct 2025 and again in Jan 2026.
  Unparseable hands are stored and surfaced, never silently dropped.

Edge cases the fixtures prove real: missing `Dealt to` line (a 2022 client bug),
parentheses in names, mucked cards, uncalled bet returned, all-in preflop, side and
chopped pots, disconnects and timeouts, sitting-out players, run-it-twice
(`*** FIRST FLOP ***`), timezone suffixes.

**Ranking leaks — the core algorithm. Rank by frequency × cost per instance, not
cost alone.** This is the mistake every naive leak-finder makes: it surfaces the
dramatic 40bb disaster and buries the 0.2bb error made two hundred times a week.
BTN-vs-BB single-raised pots are ~23% of all postflop situations, so a small error
there outranks a large one in a rare 4-bet spot. Supporting rules:

- **Calling mistakes cost far more than betting mistakes** — a bad bet can still
  win the pot; a bad call cannot.
- **Later streets cost more.** The same sizing error measured 0.31bb on the flop
  and 0.87bb on the turn.
- **One mistake is not a leak.** Require a trend across sessions before flagging.

Leaks are patterns — *"calls 3-bets out of position with dominated broadways"*, not
*"fold-to-3bet is 42%"* — carrying accumulated cost, instance count, links to the
real hands, and a confidence label. Above a confidence threshold they spawn drill
cards that synthesise **fresh spots of the same shape**, so the pattern gets
drilled rather than the one hand whose answer is already known.

**No solver in v1**, by decision rather than shortcut. GTO Wizard has no solver API
— its public API is an AI benchmark that explicitly refuses solver requests, and
scraping breaches their terms. The only real commercial solver API starts near
$1,875/month plus setup and GPU hosting. The open-source solvers are all
**AGPL-3.0**, whose network clause is a genuine problem for a hosted service, and
TexasSolver's author additionally requires a paid licence to provide service over
the internet. The v2 path is to precompute a canonical spot library offline and
ship static lookups.

### Pillar 3 — Books and retention

**Curriculum as versioned data in the repo**, not the database — it is content that
gets edited and reviewed like code. Progress and choices are per-user in Postgres.

**The reading order, researched and specific.** At ~5 hrs/week, with the rule that
**at most 60% of study hours go to books** — the rest to hand review and drills, or
the reading does not convert:

| When | Book | Active hours |
| --- | --- | --- |
| Month 1 | **Crushing the Microstakes** (Williams) — prescriptive, no theory, written for exactly NL2–NL5 | 8–12 |
| Months 1–2 | **The Mental Game of Poker** (Tendler) — early, because it protects everything after | 10–14 |
| Months 2–5 | **The Grinder's Manual** (Clarke) — the complete 6-max online cash syllabus | 45–60 |
| Daily, all year | **Daily Dose of GTO** — free, 300+ five-minute quizzes | ~15 |
| Months 7+ | **Play Optimal Poker** 1 then 2 (Brokos) | 60 |

**Explicitly not in year one:** *Modern Poker Theory*, either Janda, *Applications
of NLHE*. The review is blunt that a beginner "will be crushed by the density."
Alternatives exist at every stage in the research report if any of these don't fit.

**Three findings that change the product, not just the reading list:**

1. ***Daily Dose of GTO* is free, current, and already 300+ five-minute quizzes.**
   It maps one-to-one onto the drill scheduler — the obvious first external
   integration.
2. **The modern canon shifted from treatises to workbooks.** Little's *Complete
   Poker Workout* is 100 hands and 392 questions. The book market is independently
   converging on retrieval practice, which is strong evidence the card design is
   right and means good modern books ingest almost directly.
3. ***The Course* organises itself as numbered skills gated by stake** — the best
   progression structure in poker literature. **The platform's stage model should
   steal it.**

**The honest limit, stated in-product rather than hidden:** a books-only path tops
out around NL50 and past that becomes an active handicap, because opponents study
with tools that answer questions books cannot pose. Books build the model, a solver
populates it, volume and review turn it into instinct. **Around month seven the
curriculum should say plainly that it is time to add a solver subscription.**

### The reader — the design that makes it worth building

A generic "read in-app, auto-generate flashcards" reader would be weak, and it is
worth being precise about why. LLM questions generated from a chapter default to
testing definitions — *"what is a c-bet?"* — which is not the skill. A poker book
is not information to memorise; it is a set of **decision procedures**. What has to
survive is "in situation X, weigh Y," not "chapter 4 said Z."

**The insight the whole reader is built on: a poker book's claims are testable
against your own hands.** Almost no other subject gives you that. A chapter makes a
claim; your hand history holds the evidence for how you actually play it. That is
what turns reading from consumption into practice, and it is only available because
the leak engine already exists.

**Six design decisions that follow:**

**1. Concepts are the atoms, not paragraphs or chapters.** On ingest, Claude
extracts the discrete *claims* a section makes — "c-bet more on dry boards in
position", "BB defence should be wider than intuition suggests" — as testable
propositions tagged with the shared concept vocabulary. Propositions link to leaks
and to drill nodes. Chapter and page become metadata, not structure.

**2. Every concept gets grounded in real hands.** When the c-betting chapter is
read, the app pulls *his own* c-bet spots from the history and asks: *"Clarke says
this. Here are five of your hands from that spot — which ones violate it?"* That is
retrieval, application and personal relevance in one question, and it is the
strongest thing this platform can do that no book, course or SRS app can. Where
history is thin it synthesises a spot of the same shape instead.

**3. A three-layer question ladder, not cloze soup.** In order, matching the
evidence on what works:
- **Free recall**, unaided, before any prompt is shown — the strongest effect.
- **Applied** — a real or synthesised hand testing the concept in a decision.
- **Self-explanation** — explain it in your own words, graded by Claude against the
  source passage. Cloze is reserved for definitions and lists, because after a few
  repetitions cloze gets answered by pattern-matching the sentence shape rather
  than by understanding.

**4. Reading order is linear for foundations, leak-indexed for reference.** A first
read of *Crushing the Microstakes* should be linear — a beginner does not know
enough to jump around. But *The Grinder's Manual* is a 540-page reference, and
front-to-back is exactly how people fail to finish it. Once foundations are done,
the reader serves chapters **in the order his leaks demand**: bleeding in blind
defence surfaces the blind-defence chapter next. The book becomes an index into his
own errors.

**5. Outdated content is flagged inline, at the moment it is read.** The curriculum
data already knows *The Grinder's Manual* has pre-solver ranges and single-size
c-bet trees, and that *Poker's 1%* is worth reading for the reframe and wrong on
the numbers. So when those sections come up the reader says so in place: *"this
chapter's ranges are tighter than modern solutions, especially BB defence — take
the reasoning, not the numbers."* No reader does this, and it is only possible
because the outdated-verdict research was done per book.

**6. Progress is concepts mastered, not pages read.** Page count is vanity.

Underneath, the mechanical loop:

```
CAPTURE    highlight a passage — the ONLY job of highlighting
   ↓
EXTRACT    Claude pulls testable propositions, tagged with concepts
   ↓
CONVERT    propositions → Items (recall / applied / self-explanation)
           and, where they map to a node, a DRILL item
   ↓
SCHEDULE   Items → FSRS. Topics (things to read) → separate priority queue.
   ↓
REVIEW     one interleaved session: Topics + Items + poker drills
   ↓
FEEDBACK   show the source passage immediately
```

**The reading budget is enforced, not suggested.** The 60% rule is a real
constraint: if four hours went to reading this week and none to drills or hand
review, the app says so and pushes him to the table. Reading that does not convert
is the failure mode the whole curriculum is designed against.

The evidence this rests on, from the Dunlosky et al. review: **practice testing and
distributed practice are the only two high-utility techniques.** Interleaving,
elaborative interrogation and self-explanation are moderate. **Highlighting and
rereading are low utility, and highlighting can actively hurt** when the task
requires inference. Hence: highlighting is a card-authoring gesture, never the
study action. Two further specifics worth honouring — **elaborative interrogation
is weak for novices**, so recall the range before explaining it; and the
"Feynman technique" has no real evidence base under that name, though its mechanism
(self-explanation, g≈0.55) does — so build it and name it correctly.

**Two failure modes to design against from v1, both named in the research:**

1. **The blank-card problem** — people quit because authoring cards by hand is
   unsustainable. **The generator must be automatic.** For poker this is the unfair
   advantage: a range chart *is* a card generator.
2. **Queue explosion** — unbounded extraction buries the user. **Ship priority and
   a per-session intake cap from the start**, not as a later fix.

*Curriculum caveats to carry:* community-sentiment claims are second-hand (Reddit
and 2+2 were unreachable), and the *Modern Poker Theory* ToC circulating on AI
summary sites is generated, not real — it must not be seeded. Verified chapter data
does exist for *The Grinder's Manual* and *The Course*.

### Cross-linking — the thing no other tool does

Book sections and leaks share one concept vocabulary. So a diagnosed leak surfaces
the chapter that addresses it, and finishing a section offers to drill the related
spots. Leak → chapter → drill, in a loop, possible only because all three pillars
share one card table.

### Tilt

A post-session rating plus an optional note, correlated against that session's
results and error rate — so the cost of tilt is shown in chips rather than asserted.
The *Mental Game of Poker* stage gives the vocabulary once it is read.

### Routes

```
app/(app)/today       daily drill queue — the default landing page
app/(app)/preflop     chart viewer + trainer
app/(app)/hands       session list, hand browser, replayer
app/(app)/leaks       ranked leaks with evidence and linked study
app/(app)/library     curriculum, reader, section review
app/api/*             the few model-backed endpoints, one per action
watcher/              standalone Node uploader for this PC
```

## How this scales as you improve

The plan above is deliberately scoped to a beginner at NL2, and the fair question
is whether that scoping becomes a ceiling. Every simplification below is a
**swappable component behind a stable interface**, not a shortcut that has to be
torn out later. Concretely, here is where each one ends and what replaces it.

### The growth spine: skill drives the app, not the calendar

The single design idea that makes this scale is that **the platform's stage is
derived from measured skill, not from time elapsed or chapters finished.** A
`skill_state` is computed from three things the app already has — drill accuracy by
node, the current leak profile and its costs, and hand volume — and it drives
everything that would otherwise need manual reconfiguration:

- which **chart complexity** is shown (pure strategies → mixed with RNG)
- which **curriculum stage** is unlocked
- how strict the **hand-review budget** is
- when the app says **it is time to buy a solver**
- how tight the **close-decisions filter** is set

This steals *The Course*'s stake-gated skill progression, which the research
identified as the best structure in poker literature — except that where Miller
gates on the stake you play, this gates on **what your own hands demonstrate**.
That is the version of the idea only a platform with your hand history can build,
and it is the honest answer to "will it grow with me": the app does not have a
beginner mode you outgrow, it has a difficulty that tracks you.

### The specific ceilings, and what lifts each one

| Ceiling in v1 | When it binds | What replaces it |
| --- | --- | --- |
| **20 chart nodes, pure strategies** | Around NL10–25, when opponents stop paying off simple value | Expand to the full ~85-node tree; enable mixed frequencies and the RNG die, both already built. Chart sets are **versioned and swappable**, with cards keyed to `(node, chart_version)` — so upgrading charts re-grades history rather than destroying SRS state |
| **No postflop truth beyond heuristics + MDF** | NL25+, where postflop is most of the edge | The verdict layer is an **interface from day one** — `getVerdict(decision) → {action, ev, confidence, source}` with sources `chart \| mdf \| heuristic \| llm \| solver`. Adding a solver is adding a source, not a rewrite |
| **Authored charts, not solver-derived** | When mixed frequencies start mattering | Generate owned ranges with `rs-poker` (Apache-2.0, has a CFR solver), or import a set you have personally licensed. The schema already carries per-action frequency and EV |
| **Per-hand LLM review of flagged hands** | Around 5–10k hands/week, where it stops being affordable | The flagging screen tightens as volume rises: a fixed weekly review budget, spent on the hands where the heuristic is *most uncertain* rather than on a fixed rule. Review quality per hand stays constant; selectivity increases |
| **Sample-gated stats mostly locked** | Solves itself — this one improves with no work | Gates open automatically as samples accumulate. At 8,000 hands WWSF/WTSD/W$SD unlock and the frequency-statistics engine switches on beside the per-decision engine |
| **Curriculum stops at Stage 2** | Month 7–12 | The curriculum data file holds **all seven researched stages** from the start, including the exploitative and MTT tracks. Only the gating is beginner-shaped |
| **100bb 6-max cash only** | If you ever add MTT or move stack depths | Stack depth and tree convention are **dimensions in the schema from day one**, even though only one combination is populated |

### What this means for the build

Three things get built in stage 1 that a beginner-only app would skip, purely
because retrofitting them is expensive: the **RNG die**, the **verdict-source
interface**, and **chart versioning**. They cost little now and are the difference
between a tool you outgrow in six months and one that follows you up.

The one genuinely honest limit: this platform will not replace a solver at NL50+,
and it should not pretend to. Its durable edge is not solver accuracy — it is that
it knows **your** hands, **your** errors and **your** reading, and schedules against
them. That edge gets *stronger* as you improve and your history deepens.

## Build order

Sequenced so something is usable at the end of every stage.

1. **Scaffold** — Next.js 16 + Supabase + Tailwind, auth, `requireUser()`, the
   three SRS tables and the `ts-fsrs` wrapper with tests. The **verdict-source
   interface** is defined here, before anything implements it. Nothing user-facing.
2. **Preflop trainer** — the authored chart set for the 20-node beginner core,
   **versioned**; the 13×13 grid viewer; drill mode with the **RNG die** and the
   close-decisions filter; cards flowing into the scheduler. **Usable and valuable
   on its own — this is the milestone that already improves results.**
3. **Daily queue** — the Today page, the 5–10 minute session, streaks.
4. **Hand ingest** — parser with a strong fixture suite, then the watcher with
   client detection, then the hand browser and replayer.
5. **Leak engine** — deterministic preflop classification, flagged-hand LLM review,
   the ranked leaks page, drill generation. Tilt check-in lands here, since it needs
   sessions and results to correlate against.
6. **Books** — curriculum data for all seven stages, EPUB ingest, concept
   extraction, the reader and the three-layer question ladder.
7. **Cross-linking and growth** — the concept vocabulary joining leaks to chapters
   to drills, hand-grounded book questions, `skill_state` and the gating it drives,
   and expanding the chart tree from 20 nodes toward 85.

## Verification

- **Unit** — Vitest over pure logic, colocated as in `life-os`. Priority targets:
  `lib/ranges.ts` (chart lookups are the ground truth everything rests on), the
  FSRS wrapper and grade mapping, and the hand parser.
- **Parser** — a fixtures directory of real PokerStars files covering cash,
  multi-way pots, all-ins, side pots, run-it-twice and the missing-`Dealt to` case,
  each with an expected parse, seeded from the `hhp` and `pokerdf` corpora. **This
  is where bugs will actually live** — test against reality, not assumptions.
- **Idempotency** — re-ingest the same file, assert no duplicate hands.
- **Watcher safety** — assert it does not upload while a mock PokerStars process is
  detected. This one is worth a test because the cost of being wrong is the account.
- **Leak-engine honesty check** — feed it hands played deliberately *correctly* and
  assert it reports no leaks. A detector that finds leaks in good play is the
  specific failure mode to guard against.
- **Sample-size gating** — assert a stat below its threshold cannot generate a card,
  and that it unlocks on its own once the sample crosses.
- **Chart versioning** — publish a revised chart set and assert SRS history survives
  and is re-graded, rather than cards being orphaned. This is the test that proves
  the platform can grow without resetting your progress.
- **Scheduler** — assert intervals lengthen on `Good`, collapse on `Again`, that the
  review log is append-only, and that `enable_fuzz` actually spreads due dates.
- **End to end** — play a real short session, close PokerStars, confirm hands
  import, a leak is identified with hands as evidence, a drill card is generated,
  and it appears in the next day's queue.
- **Deploy** — Vercel, same as `life-os`.

## Open questions, deferred deliberately

- **`ts-fsrs` default weights** — read `constant.ts` directly at build time; the
  researched array looked like FSRS-5 weights with the v6 decay appended. Never
  hardcode regardless.
- **PokerBench provenance** — read the paper before using it as anything but an
  eval bank.
- **Whether to expand past 20 chart nodes**, and whether to invest in generating
  owned solver ranges (`rs-poker`, Apache-2.0, has a CFR solver). Both are decided
  after the trainer is in daily use, not before.
