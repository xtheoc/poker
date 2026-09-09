# Research: Preflop Range Data + Spaced Repetition (poker study platform)

> **Note on file location:** the requesting agent asked for this at
> `…\scratchpad\research-ranges-srs.md`. This session is in **plan mode**, which permits
> editing only the plan file, so the report lives here instead. Copy it over when plan mode lifts.
>
> Date of research: 2026-09-01/02. Everything below was verified by fetching the cited URL unless
> explicitly marked **[UNVERIFIED]** or **[INFERRED]**.

---

# PART A — Preflop range data

## A1. Free / open-licensed machine-readable preflop range data

### The blunt headline

**There is no high-quality, openly-licensed, solver-accurate NLHE 6-max 100bb preflop range
dataset in machine-readable form.** Every genuinely accurate chart set is either (a) behind a
paywall (GTO Wizard, Simple GTO, GTOBase, Pokerenergy, RangeConverter, MonkerGuy), or (b) a
community re-typing/scrape of one of those, published under a permissive *code* license that its
publisher had no right to grant over the underlying solver output.

Practical conclusion: **generate your own ranges** (see A1.5) and treat scraped repos as
cross-check material only.

### A1.1 Repos with actual data in them

| Repo | Data? | Format | License | Notes |
|---|---|---|---|---|
| [AHTOOOXA/poker-charts](https://github.com/AHTOOOXA/poker-charts) | **Yes** | TS modules, `Record<string, Chart>` | MIT (code) | Best schema I found. See below. |
| [davidt35/preflop_charts](https://github.com/davidt35/preflop_charts) | Yes | Static **HTML pages** (`index.html`, `vsBU.html`…), not data | MIT | RFI / call-vs-open / 3bet / 4bet / CC / 5bet / squeeze, UTG–SB. Would need scraping out of HTML. |
| [bowenzhangdotcom/PreflopPokerAssistant](https://github.com/bowenzhangdotcom/PreflopPokerAssistant) | Frontend only; server separate | — | not verified | HU + 6max viewer with RNG calculator. |
| [jbcazaux/preflop-academy](https://github.com/jbcazaux/preflop-academy) | Next.js + Prisma app | unknown | **[UNVERIFIED]** — README/LICENSE not readable via fetch | Live at preflop-academy.vercel.app. Worth cloning to inspect `schema.prisma`. |
| [lukebhan/memorizePreFlop](https://github.com/lukebhan/memorizePreFlop) | range builder + chart trainer + hand trainer | unknown | **[UNVERIFIED]** | Closest prior art to what you're building. |
| [exinori/DCFR-SOLVER](https://github.com/exinori/DCFR-SOLVER) | **Solver, not data** | emits JSON/HTML | **[UNVERIFIED]** | Advertised as a *6-max preflop solver* using External-Sampling MCCFR. If real, this is the single most interesting lead for generating your own ranges. Verify before trusting. |

**AHTOOOXA/poker-charts schema** (this is the one to copy) —
`src/data/ranges/index.ts` defines:

- `Chart` = sparse map, hand → `Cell`; **unlisted hands default to fold**
- `Cell` = action (`'fold' | 'call' | 'raise' | 'allin'`) with optional weighting; a **mixed
  strategy is an array**, e.g. `'ATo': ['raise','fold']`
- `Position`, `Scenario` (`RFI | vs-open | vs-3bet | vs-4bet | 3bet-defense`), `Provider`
- Functions: `getChart()`, `getCell()`, `computeAggressiveWeight()` (raise+allin frequency 0–100),
  `getParentWeight()`, `getCellWithCascadedWeight()` — **the cascading-weight idea is the good
  part**: a hand's frequency in a vs-3bet node is multiplied by how often it reached that node.
  You want this for correct combo-weighted drilling.

Actual data files:
- `greenline.ts` (38 KB) — header comment: *"Extracted from GreenCharts2024_01.pdf (Greenline Poker)"*.
  So: **a hand-transcription of a third-party PDF.** MIT on the repo does not launder that.
- `pekarstas.ts` (33 KB) — another coach's charts.
- `gtowizard-gg-rc.ts` — **empty stub** (`// TODO: Add GTOWizard GG R&C chart data`).

Raw file:
`https://raw.githubusercontent.com/AHTOOOXA/poker-charts/main/src/data/ranges/greenline.ts`

### A1.2 PokerBench — the one properly-licensed solver dataset

**[RZ412/PokerBench on HuggingFace](https://huggingface.co/datasets/RZ412/PokerBench)** —
**Apache-2.0**. Paper: *PokerBench: Training Large Language Models to become Professional Poker
Players*, [arXiv:2501.08328](https://arxiv.org/abs/2501.08328), AAAI 2025. Code:
[pokerllm/pokerbench](https://github.com/pokerllm/pokerbench).

- **60,000 preflop train + 1,000 preflop test** rows (plus postflop sets), ~11k "most important
  scenarios" curated with pro players.
- Preflop CSV columns: `prev_line`, `hero_pos`, `hero_holding`, `correct_decision`, `num_players`,
  `num_bets`, `available_moves`, `pot_size`.
- Direct file:
  `https://huggingface.co/datasets/RZ412/PokerBench/blob/main/preflop_60k_train_set_game_scenario_information.csv`

**Caveats / what I could NOT verify:** the dataset card and the arXiv abstract page do **not**
state which solver produced the ground truth, the stack depth, the rake model, or the table size.
The abstract only says "optimal decisions computed by solvers" and "developed in collaboration with
trained poker players." **You must read the full PDF before relying on this as 100bb 6-max.** Also
note the labels are **point decisions, not frequency distributions** — a `correct_decision` column
flattens mixed strategies, which is exactly the information a good trainer needs. Useful as a quiz
bank; not sufficient as a range library.

### A1.3 Solver ecosystem (generate your own)

| Project | License | Status | Use for you |
|---|---|---|---|
| [b-inary/postflop-solver](https://github.com/b-inary/postflop-solver) | **AGPL-3.0-or-later** (© Wataru Inariba 2022) | **Development suspended Oct 2023**; author went commercial. Breaking changes without version bumps. | **Postflop only — explicitly not a preflop solver.** But its `Range` type is the best range-parsing reference in any language (see A2). |
| [b-inary/wasm-postflop](https://github.com/b-inary/wasm-postflop) / [desktop-postflop](https://github.com/b-inary/desktop-postflop) | AGPL | suspended | Browser solver, still runs. |
| [bupticybee/TexasSolver](https://github.com/bupticybee/TexasSolver) (+ forks jack9950, sniperHW, 88-degrees) | **AGPL-3.0** | maintained-ish | **Commercial trap:** author states that integrating the code into your software *or providing service over the internet* requires a paid commercial license. AGPL§13 network clause means a SaaS poker trainer built on it must open-source the whole service. **Do not embed in a hosted product without a license.** |
| [exinori/DCFR-SOLVER](https://github.com/exinori/DCFR-SOLVER) | **[UNVERIFIED]** | ? | Claims 6-max *preflop* MCCFR with JSON output. Highest-value lead to validate. |
| [elliottneilclark/rs-poker](https://crates.io/crates/rs-poker) | **Apache-2.0**, v5.1.0, updated **2026-08-13** | **actively maintained** | Has a **CFR solver**, Monte-Carlo equity, **ICM tournament simulation**, arena/multi-agent sim, Omaha. ~8.3k recent downloads. This is the cleanest legal path to home-grown ranges. |
| [skel35/NashEquilibriumCalc](https://github.com/skel35/NashEquilibriumCalc) | **[UNVERIFIED]** | ? | Push/fold Nash for NLHE — the MTT/ICM shortcut. |

**Recommendation:** push/fold and simple ICM ranges are cheap to compute yourself
(2-player jam/fold Nash is a small fictitious-play problem; ICM is a closed-form-ish recursion).
Full 6-max 100bb preflop equilibrium is a genuinely expensive multiway CFR run and is why nobody
gives it away.

### A1.4 Free-to-browse but not free-to-take

- **[GTO Gecko](https://play.gtogecko.com/)** — full preflop range library free on web/iOS/Android/macOS.
  Browsable only; no documented export. Also a free
  [odds calculator](https://gtogecko.com/poker-odds-calculator).
  Their roundup: [Free GTO Poker Resources That Are Actually Free (2026)](https://gtogecko.com/blog/free-gto-resources)
- **[PokerCoaching free preflop charts](https://pokercoaching.com/preflop-charts/)** — 13×13 grids,
  6-max and 8-max 100bb cash, MTT 75/40/25/15/10bb push-fold; both GTO and *exploitative* variants.
  **Email-gated PDF download.** No open license — study aid only.
- **[HoldemResources free tools](https://www.holdemresources.net/free-tools)** +
  [Nash ICM calculator](https://www.holdemresources.net/nashicm) — free web push/fold Nash ICM.
  Generate-and-record is technically possible; ToS **[UNVERIFIED]**.
- **[PokerPro push/fold chart](https://pokerpro.tools/tools/push-fold-chart)** — interactive Nash 1–30bb, no signup.
- **RangeConverter / MonkerGuy** — paid `.rng` / `.txt` (PioViewer + ProPokerTools compatible) /
  `.mkr`. See [monkerguy.com](https://www.monkerguy.com/).
- MonkerSolver tooling if you ever buy sims:
  [OwenQian/MonkerConverter](https://github.com/OwenQian/MonkerConverter) (.rng → Pio/GTO+),
  [OpenHUD/monkerware](https://github.com/OpenHUD/monkerware),
  [ksoeze/PreflopAdvisor](https://github.com/ksoeze/PreflopAdvisor) (Python, PLO/PLO8 Monker
  frequency+EV lookup across multiple trees — good UX reference for "fast action+EV profile
  without loading the whole tree").

### A1.5 What I'd actually do

1. Ship v1 on a **hand-authored, transparently-sourced chart set** you own (write it yourself from
   published aggregate frequencies), stored in the AHTOOOXA schema shape. Zero license risk.
2. In parallel, validate `DCFR-SOLVER` or build a preflop CFR on top of `rs-poker` (Apache-2.0) to
   produce a genuinely owned, frequency-carrying range library at your chosen tree.
3. Use **PokerBench** (Apache-2.0) as an independent quiz/eval bank and a sanity check.
4. Never vendor `greenline.ts` / `pekarstas.ts` into a commercial product.

---

## A2. Range notation, parsers, equity libraries

### A2.1 The notation

**Combinatorics.** 52 cards → **1,326** distinct starting combos, collapsed by isomorphism into the
**169** "hand classes" of the 13×13 grid: 13 pairs (**6 combos** each), 78 suited (**4** each),
78 offsuit (**12** each). 6·13 + 4·78 + 12·78 = 1326. Grid convention: rank descending on both
axes, **suited above the diagonal, pairs on the diagonal, offsuit below**.

**The de-facto standard string grammar** is the **PioSOLVER range format**, and
`postflop-solver`'s `Range: FromStr` documents it precisely
([docs](https://b-inary.github.io/postflop_solver/postflop_solver/struct.Range.html)):

- **singletons** — `AA`, `AKs`, `AKo`, and explicit combos `AsAh`
- **plus ranges** — `TT+`, `ATs+`, `T9o+`
- **dash ranges** — `QQ-88`, `A9s-A6s`, `98o-65o`
- **comma-separated groups**, with an optional **`:weight`** suffix in `[0,1]` —
  `"AA:0.5,AKs"`
- readback via `to_string()`; weight queries via `get_weight_by_cards()`, `get_weight_pair()`,
  `get_weight_suited()`, `get_weight_offsuit()`

**Critical modelling point for a trainer:** a single `:weight` scalar is a *frequency*, not a
*strategy*. A real preflop node needs a **per-hand probability vector over the action set**
(`{fold, call, raise2.5, raise3, allin}` summing to 1), plus **per-action EV**. The PioSOLVER string
grammar cannot express that — it is a per-action range list. Store strategies as
`hand → {action: {freq, ev}}` and *emit* Pio strings only for interop.

Alternative grammar worth knowing: **ProPokerTools / PPT syntax** (`AA-QQ`, `AKs`, plus a much
richer predicate language for Omaha) — the format MonkerGuy exports `.txt` in.

### A2.2 Range-string parsing libraries

| Library | Lang | License | Version / last publish | Verdict |
|---|---|---|---|---|
| [`@poker-apprentice/hand-range-notation`](https://github.com/poker-apprentice/hand-range-notation) | TS | **MIT** | **1.0.0, published 2023-11-20** | Best-typed TS option. Deps: `lodash`, `@babel/runtime`, `@poker-apprentice/types`. Supports `AKs`, `AKo`, `AKs-A2s`, `KQo-KJo`, `AT+`, `ATs+`, multi-range. **Hold'em only (2-card).** Dormant ~3 yrs but the grammar is frozen anyway. |
| [`prange`](https://github.com/thlorenz/prange) | JS | MIT | **0.2.3, published 2017-10-07** | `prange('AKs-ATs, QQ+')` → `['AA','AKs','AQs','AJs','ATs','KK','QQ']`. **Expands to hand classes, not combos, and has no weight support.** Abandoned. |
| `postflop_solver::Range` | Rust | **AGPL-3.0+** | suspended | Most complete & correct semantics. AGPL makes it unusable in a closed SaaS. **Read it, don't link it.** |
| [`poker` (readthedocs)](https://poker.readthedocs.io/en/latest/range.html) | Python | **[UNVERIFIED]** | — | `Range("22+ 54s 76s 98s AQo+")` → `Hand`/`Combo` sets. Good reference implementation. |
| [grwgreg/rangetools](https://github.com/grwgreg/rangetools) | ? | **[UNVERIFIED]** | — | "poker hand range evaluator". |

**Honest recommendation:** the grammar is ~200 lines of parser. Given that every JS option is
either dormant or weight-blind, **write your own** with weights + action vectors as first-class,
and use `@poker-apprentice/hand-range-notation` only as a test oracle. This is a case where the
dependency costs more than the code.

### A2.3 Hand evaluation / equity

| Library | Lang | License | Version / date | Notes |
|---|---|---|---|---|
| [`@pokertools/evaluator`](https://github.com/aaurelions/pokertools) | TS | **MIT** | **1.0.16, 2026-07-03** | 5/6/7-card, perfect-hash + LUT, claims **10–20M evals/sec**. **Most recently maintained JS evaluator I found — default pick.** |
| [`@poker-apprentice/hand-evaluator`](https://github.com/poker-apprentice) | TS | **[UNVERIFIED, likely MIT]** | **4.3.0, 2026-07-27** | Actively maintained; pairs with the range-notation lib above. |
| [`phe`](https://github.com/thlorenz/phe) | JS | **MIT** | **0.6.0**, zero deps | "Poker hand evaluator." Old but dependency-free and battle-tested. |
| [`pokersolver`](https://github.com/goldfire/pokersolver) | JS | **MIT** | **2.1.4, 2020-07-20** | Multi-variant hand solver/comparator. Popular, dormant. |
| [`poker-evaluator-ts`](https://github.com/rorymcgit/poker-evaluator) | TS | **ISC** | **2.0.3, 2020-07-23** | 3/5/7-card TS port. Dormant. |
| [`poker-odds`](https://github.com/cookpete/poker-odds) | JS | MIT | **1.0.1, 2018-01-30** | CLI-oriented, **abandoned 8 yrs**. Skip. |
| [`poker-odds-calc`](https://www.npmjs.com/package/poker-odds-calc) | JS | **[UNVERIFIED]** | 0.0.14, 2020-10-02 | Dormant. |
| [`@cloviz/eq-mc`](https://www.npmjs.com/package/@cloviz/eq-mc) | WASM | **[UNVERIFIED]** | 0.1.7, 2026-06-25 | "Poker equity calculator compiled to WebAssembly." Fresh; worth a look for browser-side range-vs-range. |
| [`rs-poker`](https://crates.io/crates/rs-poker) | Rust | **Apache-2.0** | **5.1.0, 2026-08-13** | ~**20 ns/hand → 50M hands/sec/core**. CFR solver, MC equity, **ICM**, PLO4–PLO7, arena sim. CLI `rsp`. |
| [`zekyll/OMPEval`](https://github.com/zekyll/OMPEval) | C++ | **[UNVERIFIED — check repo]** | reference impl | Perfect hashing shrinks the main LUT **36 MB → 200 kB**. Equity calc uses a **random-walk MC** that avoids full resampling on hole-card collisions and merges narrow ranges. The algorithm everyone copies. |
| [`kmurf1999/rust_poker`](https://github.com/kmurf1999/rust_poker) | Rust | **[UNVERIFIED]** | — | Rust rewrite of OMPEval. |
| [`pokers`](https://docs.rs/pokers) | Rust | **[UNVERIFIED]** | — | Fork of `rust_poker`. **Range-vs-range equity for up to 6 ranges**, exact + Monte Carlo. |

**Architecture note:** for a preflop trainer you barely need an evaluator at runtime — preflop
range-vs-range equity is a **169×169 (or 1326×1326) lookup table you precompute once**. Ship the
table, skip the dependency. Reach for `rs-poker`/`pokers` (WASM-compiled) only if you add postflop.

---

## A3. How existing preflop trainers work (and what to steal)

### A3.1 GTO Wizard — the reference implementation

Sources: [How To Use the Trainer](https://help.gtowizard.com/how-to-use-the-trainer/),
[Measure Performance](https://help.gtowizard.com/measure-performance/),
[Train like a Pro](https://blog.gtowizard.com/train-like-a-pro/).

**Modes:** *Full Hand* (preflop→river), *Spot* (repetitive drilling of one decision point),
*Street* (one street only).

**Spot sampling:** hands are dealt **according to true GTO frequencies**, so you meet common spots
more often. Two crucial filters:
- **exclude trivial decisions** (don't make me fold 72o a hundred times), and
- **"Only Close Decisions"** — restrict to hands where **multiple actions have similar EV**.
  *This is the single highest-leverage feature in the whole product* and the direct analogue of a
  "desirable difficulty."

**Mixed strategies via RNG:** a 1–100 RNG die is shown. In "High RNG" mode the most aggressive
action is correct at the highest rolls; "Low RNG" inverts it. RNG mode activates only when the
node is genuinely mixed (die turns yellow/blue). **This solves the core pedagogical problem of
grading mixed strategies:** without an RNG, a 30%-raise hand can never be graded — with one, the
correct action becomes deterministic given the roll, and the player learns *both* the frequency and
the execution discipline.

**Grading — GTOW Score, −100% … +100% per action:**
- **Best Move** — highest-frequency action (or the RNG-correct one). Marked with a double check.
  Maximum points.
- **Correct Move** — correct at *some* frequency but not "best." Scored **proportionally to its
  frequency**.
- **Inaccuracy** — taken **<3.5%** of the time in GTO but loses little EV.
- **Wrong Move** — never taken in GTO.
- **Blunder** — never taken *and* loses significant EV.
- Mistakes deduct points **according to EV loss as a % of pot**.
- The scale is deliberately **non-linear**: "inaccurate play scored more harshly, correct play
  rewarded more intensely."

**Reported metrics:** total EV loss in bb vs. GTO; **average EV loss per hand**; **average EV loss
per mistake** (they explicitly call out the diagnostic value: few mistakes but huge ones is a
different disease from many tiny ones); frequency deltas vs. solver.

**Study affordances:** "Pause game after [mistake]" freezes the hand; in learning mode the info
panel with the full solver strategy auto-appears. Filters by board texture, position, stack depth,
and preflop action sequence.

### A3.2 Binary vs. EV-loss scoring — the design call

**Use EV loss as the primary signal, but do not show only EV loss.** Rationale:

- Binary right/wrong is *incoherent* at mixed nodes: it either punishes a legitimate 30% action or
  it accepts everything with >0% frequency, which teaches nothing about frequency.
- Pure EV loss is *correctly weighted but poorly calibrated as feedback*: most preflop errors cost
  0.02–0.3 bb, a range humans have no intuition for, and it silently forgives high-frequency
  near-indifference errors that compound.
- GTO Wizard's answer — **classify into 5 buckets by (frequency, EV loss) jointly, score
  non-linearly, and report EV loss separately** — is the right synthesis. The frequency axis teaches
  *what the strategy is*; the EV axis teaches *what it costs*.

**Explicit design recommendation for your platform:**
1. Grade each decision on **EV loss in bb** (the ground truth) **and** on **action frequency**.
2. Show the full solver frequency vector immediately after the answer (this is the *feedback* that
   Rowland 2014 identifies as a moderator that strengthens the testing effect — see B6).
3. Feed **EV loss** into the SRS grade mapping (see B5.4), not a binary correct/incorrect.
4. Implement the **RNG die** for mixed nodes from day one. Retrofitting it later means rewriting
   the grader.
5. Implement **"close decisions only"** as a drill filter — it is a difficulty dial *and* the
   mechanism that stops the queue from being 60% trivial folds.

### A3.3 Existing SRS-flavoured preflop trainers (prior art)

- **[PlusEV Poker](https://plusev.poker/)** — explicitly markets **spaced repetition + an adaptive
  algorithm that surfaces the spots you keep getting wrong** and targets biggest-EV-leak spots.
  Closest direct competitor to your concept.
- **Poker Academy** ([iOS](https://apps.apple.com/us/app/poker-academy-learn-gto-poker/id1626050814)) —
  "mistake replay & spaced repetition," mastery tracking, leak finder, weekly plans.
- **[PreflopAI](https://www.preflopai.com/en)** — weakness identification, trains *similar* ranges
  and situations (i.e. transfer, not just the exact repeated item).
- **[prefloptrainer.com](https://prefloptrainer.com/)** — free; hand + position + stack depth,
  graded against a solver-*approximate* range.
- **[FreeBetRange trainer](https://help.freebetrange.com/Trainer/)**.
- **RangeSharp** — a 2+2-announced preflop trainer built on spaced repetition.
  Thread: `https://forumserver.twoplustwo.com/167/poker-software/new-tool-rangesharp-preflop-range-trainer-spaced-repetition-1858828/`
  — **403s to automated fetch; read it manually, it is the most on-point prior-art discussion I found.**
- **[poker-toolkit.com on SRS for poker](https://poker-toolkit.com/en/spaced-repetition-poker)** —
  argues cards should encode *"the right action here **and why**"* rather than bare facts
  (position × stack × format; MDF/pot-odds computations; "value/bluff mix and why"). Names the key
  failure mode: **the blank-card problem** — people quit because authoring cards by hand is
  unsustainable. **Your generator must author cards automatically.**

---

## A4. Standard preflop tree conventions, 6-max 100bb

### A4.1 GTO Wizard (verified numbers)

From [Status and info about our solutions](https://blog.gtowizard.com/status-and-info-about-our-solutions/):

- **6-max "General" solutions, GTO-preferred opens:**
  **UTG 2.0x · HJ 2.0x · CO 2.3x · BTN 2.5x · SB 3.0x**
- A **uniform 2.5x** variant exists for all positions ("Simple 2.5x": UTG–CO open 2.5bb, **no cold
  calls except BTN, no 4-bet all-ins**).
- 9-max General: EP/MP 2.0x, CO 2.3x, BTN 2.5x, SB 3.0x.
- **Depths:** General 100bb; Simple **20–200bb**; Complex 100bb; HU Simple 20–500bb.
- **Accuracy (exploitability):** General **0.1–0.3% of pot**; Simple/Complex 0.2–0.3%.
- **Rake:** NL50 5% capped 4bb; NL500 5% capped **0.6bb**.
- Elsewhere ([all-you-need-to-know](https://blog.gtowizard.com/all-you-need-to-know-about-our-solutions/)):
  preflop solved in **MonkerSolver** with a tree that **allows calling in all situations**;
  PokerStars 500 Zoom rake, 5% capped 0.6bb.
- **[UNVERIFIED]** GTO Wizard's exact 3-bet/4-bet multipliers are not published on the pages I could
  fetch; they only state "3-bet sizing against a given open size is the same for all positions"
  and that newer solutions offer *smaller* 3-bets.

### A4.2 GTOBase (verified)

[Overview of the New GTO Solutions in the 6-max Cash Library](https://blog.gtobase.com/theory/overview-of-the-new-gto-poker-solutions-in-the-6-max-cash-library/):

- **Depths:** 40 / 50 / 70 / 100 / 150 / 200 bb, stakes NL50–NL1k, **5% rake with varying caps**, plus chipEV.
- **Open sizes for free positions:** **2.00 / 2.25 / 2.50 / 3.00 bb** (four separate trees).
- **SB open depends on the FP size and depth** — e.g. at 70–200bb:
  FP 2.00 → SB **3.50** (limp allowed) · FP 2.25 → SB **3.00** (no limp) ·
  FP 2.50 → SB **3.00** (limp allowed) · FP 3.00 → SB **3.50** (no limp).
- **3-bet sizing is position-independent for a given open size** (deliberate, to reduce memorisation load).
- Methodology worth copying: they ran **"tune trees"** with many sizes, observed which sizes the
  solver actually used, then built the **main trees** from the most-played sizings.

### A4.3 Commonly-cited "one true tree" (community consensus, less rigorously sourced)

From vendor/blog sources — treat as **[INFERRED / weakly sourced]**:
- Opens **2.5bb all positions, SB 3bb** (the classic simplification;
  [preflopwizard](https://www.preflopwizard.app/blog/6-max-preflop-charts)).
- **3-bet: IP ≈ 3.4× the open; OOP ≈ 4.4× + 1bb per cold-caller (squeeze).**
- **4-bet: IP ≈ 2.3× the 3-bet; OOP ≈ 2.75×. 5-bet = all-in.**

### A4.4 Minimum tree your chart set must cover

Positions: **UTG, HJ, CO, BTN, SB, BB** (6-max; UTG=LJ in some naming).

| Node class | Count | Notes |
|---|---|---|
| **RFI** | 5 (UTG, HJ, CO, BTN, SB) | BB has no RFI. SB gets limp/raise if the tree allows limps. |
| **vs RFI** (fold / call / 3-bet) | 15 ordered pairs | Every later position vs. every earlier opener. |
| **Squeeze** (open + caller(s), hero 3-bets) | ~10+ | OOP squeeze needs the +1bb-per-caller size. |
| **Cold 4-bet** | ~10 | Opener folded/called out; a third player 4-bets. |
| **RFI vs 3-bet** (fold / call / 4-bet) | 15 | Opener's response. |
| **3-bettor vs 4-bet** (fold / call / 5-bet-jam) | 15 | |
| **BvB** | SB limp/raise + BB vs limp + BB vs SB raise | A whole sub-tree; usually shipped as its own pack. |

That's **~75–90 distinct decision nodes at one stack depth and one open-size convention** — before
multiplying by 40/50/100/200bb or by rake model. **Scope decision: pick ONE tree
(100bb, 2.5x opens or the GTOW General 2.0/2.0/2.3/2.5/3.0 ladder, one rake model) and cover it
completely.** A complete single tree beats a patchy multi-tree library for a memorisation product,
and it keeps the SRS card count in the low thousands rather than the tens of thousands.

**Card-count math (do this before you design the schema):** 169 hand classes × ~85 nodes ≈ **14,400**
atomic hand-in-node facts. That is far too many cards. See B7 for the grouping strategy.

---

# PART B — Spaced repetition & retention

## B5. SM-2 vs Anki vs FSRS — and how to store it

### B5.1 The three algorithms

**SM-2 (Wozniak, 1987).** Per-card *ease factor* (EF, starts 2.5) and interval. On each review the
grade 0–5 adjusts EF; interval = `prev_interval × EF`. Fixed first two intervals (1 day, 6 days).
No model of forgetting; no notion of retrievability; a lapse resets everything.

**Anki's SM-2 variant** ([Anki FAQ](https://faqs.ankiweb.net/what-spaced-repetition-algorithm)) —
verified specifics:
- Cards graduate at **ease 2.5**; ease **−20 pp on lapse**, **−15 pp on Hard**, **+15 pp on Easy**;
  hard floor at **130%**.
- Fully configurable learning steps (unlike SuperMemo's fixed 1d/6d).
- *Easy bonus* multiplies interval by `ease × easyBonus`; an *interval modifier* scales most answers.
- Lapses may reset to zero or merely shorten the interval.
- Well-known pathology: **"ease hell"** — repeated Hard/Again answers drag EF to the 130% floor and
  the card never escapes.

**FSRS (Free Spaced Repetition Scheduler).** A fitted **DSR** model
([ABC of FSRS](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/ABC-of-FSRS),
[Expertium's technical writeup](https://expertium.github.io/Algorithm.html)):
- **Stability S** — days for retrievability to fall 100% → 90%.
- **Difficulty D** — clamped to **[1,10]**; controls how fast S grows.
- **Retrievability R** — probability of recall now; **power-law** forgetting curve
  `R(t,S) = (1 + factor·t/S)^(−w₂₀)`. (v1–v3 used an exponential; v4 switched to a power function,
  v4.5 to a better one, **FSRS-6 made the decay exponent `w₂₀` a trainable per-user parameter**,
  typically <0.2, allowed range **0.1–0.8**.)
- Scheduling: **`I = S · (R^(1/w₂₀) − 1) / ln(desired_retention)`**; at 90% desired retention the
  interval ≈ S by construction.
- **FSRS-6 has 21 trainable parameters**; FSRS-5 has **19**. Defaults trained on ~700M reviews from
  ~10k Anki users.
- You tune **one knob — desired retention** (sane range 70–97%), *not* the weights.
- Key formulas (from Expertium, reproduce carefully before implementing):
  - `D₀ = w₀ + w₁·(4 − G)`, G ∈ {Again=1, Hard=2, Good=3, Easy=4}, clamped [1,10]
  - difficulty update: linear damping `D' = D·(11−D)/10 + ΔD`, then mean reversion
    `D'' = w₄ + (1−w₄)·D'`
  - success: `S_new = S·(1 + (e^{w₉}−1)·f(D)·f(S)·f(R)·w_grade)` with
    `f(D)=(11−D)/10`, `f(S)=e^{−w₁₀·S}`, `f(R)=(R−1)/(w₁₁R − w₁₁ + 1)`
  - same-day reviews (FSRS-5+): `S' = S·e^{w₁₇·(G−3)·(1 − e^{−w₁₈−S})}`, with `S' ≥ S` when `G ≥ 3`

### B5.2 The evidence

[Expertium's benchmark](https://expertium.github.io/Benchmark.html) — the authoritative comparison:
- **~349.9M reviews across 9,999 collections** ("Anki revlogs 10k"); ~3× the Maimemo dataset, ~56×
  Duolingo's.
- Metrics: **log loss** (calibration), **RMSE(bins)** (custom calibration metric, 0–1), **AUC**
  (discrimination). Time-series split across 5 segments.
- RMSE(bins) ranking, best→worst: **RWKV → FSRS-6 (recency-weighted) → LSTM → RWKV-P → GRU-P
  (short-term) → FSRS-5 → FSRS-4.5 → GRU-P → FSRS-6 (default params) → HLR → DASH → FSRS-v4 →
  Ebisu v2 → ACT-R → FSRS-v3 → DASH[ACT-R] → DASH[MCM] → **SM-2** → AVG baseline.**
- **SM-2 is second-to-last, beaten only by the constant-prediction baseline.**
- Widely-quoted downstream claims **[secondary sources, not the benchmark page itself]**: FSRS needs
  **~20–30% fewer reviews** for equal retention; FSRS-6 beats SM-2 on log loss in **~99.6%** of
  collections; FSRS-5 holds 90% retention to **±5.3%** vs SM-2's **±16.2%**.
- **Honest caveat the benchmark itself states: "RWKV outperforms FSRS according to all 3 metrics,
  and by a very big margin."** Neural sequence models beat hand-crafted FSRS on this data. FSRS is
  the best *practical, deployable, explainable, no-training-pipeline-required* choice — not the
  global optimum.

**Anki's default:** FSRS merged in **23.10** (2023-10-31). Newer installs appear to enable it by
default while older ones opt in — **[UNVERIFIED for the exact version that flipped the default;
the Anki FAQ page does not state which is currently default]**.

**Verdict: use FSRS-6 via `ts-fsrs`.** Do not write an SM-2.

### B5.3 `ts-fsrs` — the maintained TypeScript implementation

**[open-spaced-repetition/ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)** ·
npm [`ts-fsrs`](https://registry.npmjs.org/ts-fsrs) · **MIT** ·
**v5.4.2, published 2026-09-01** (i.e. *today* — very actively maintained) ·
**implements FSRS v6** · ESM + CJS + UMD · **requires Node ≥ 20** (16/18 dropped).

Now a monorepo:
- `ts-fsrs` — the scheduler
- `@open-spaced-repetition/binding` (**v0.5.0, 2026-06-06**) — Node bindings for the **Rust FSRS
  optimizer compiled to WASI**, for training per-user parameters + CSV conversion.

Sibling packages: [`fsrs-browser`](https://www.npmjs.com/package/fsrs-browser) (v6.6.0, 2026-06-13;
optimizer **and** scheduler in the browser), [`fsrs-rs-nodejs`](https://www.npmjs.com/package/fsrs-rs-nodejs)
(v0.9.1, 2026-08-20), `femto-fsrs` (minimal FSRS-5), `fsrs.js` (older, v1.2.2 2024-01-21).

**Verified API (from source):**

```ts
import { createEmptyCard, fsrs, generatorParameters, Rating, State } from 'ts-fsrs'

const scheduler = fsrs()                         // or fsrs(generatorParameters({...}))
const card = createEmptyCard()                   // createEmptyCard<R>(now?, afterHandler?)

const preview = scheduler.repeat(card, new Date())   // RecordLog: all 4 outcomes
const result  = scheduler.next(card, new Date(), Rating.Good)  // RecordLogItem
console.log(preview[Rating.Good].card, result.card, result.log)
```

Other `FSRS` methods: **`rollback()`** (undo a review), **`forget()`** (reset a card),
**`reschedule()`** (recompute a card's schedule from its history — use after re-optimising params).

**Exact types** (`packages/fsrs/src/models.ts`):

```ts
export enum State  { New = 0, Learning = 1, Review = 2, Relearning = 3 }
export enum Rating { Manual = 0, Again = 1, Hard = 2, Good = 3, Easy = 4 }
export type Grade = Exclude<Rating, Rating.Manual>          // 1..4

export interface Card {
  due: Date
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: State
  last_review?: Date
}

export interface ReviewLog {
  rating: Rating
  state: State
  due: Date
  stability: number
  difficulty: number
  elapsed_days: number
  last_elapsed_days: number
  scheduled_days: number
  learning_steps: number
  review: Date
}

export interface FSRSParameters {
  request_retention: number
  maximum_interval: number
  w: number[] | readonly number[]
  enable_fuzz: boolean
  enable_short_term: boolean
  learning_steps: Steps        // e.g. ['1m','10m'] — StepUnit = `${number}${'m'|'h'|'d'}`
  relearning_steps: Steps      // e.g. ['10m']
}

export interface FSRSState { stability: number; difficulty: number }
export type RecordLogItem = { card: Card; log: ReviewLog }
export type RecordLog = { [key in Grade]: RecordLogItem }
```

`CardInput` / `ReviewLogInput` accept `DateInput = Date | number | string` and string enum names
(`'Review'`, `'Good'`) — convenient for hydrating straight out of a DB row.

**Verified defaults** (`packages/fsrs/src/constant.ts`):
`request_retention 0.9` · `maximum_interval 36500` · `enable_fuzz false` · `enable_short_term true` ·
`learning_steps ['1m','10m']` · `relearning_steps ['10m']` ·
stability clamps `min 0.001`, `max 36500.0`, `init max 100.0` ·
`FSRS5_DEFAULT_DECAY = 0.5`, `FSRS6_DEFAULT_DECAY = 0.1542` · `CLAMP_PARAMETERS` gives 21
constraint pairs, short-term exponent ceiling 2.0.

**[FLAG — verify before hardcoding]** the fetch reported `default_w` as
`[0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542]`. The first 19 look like
the **FSRS-4.5/5** defaults with the v6 decay appended, not the published FSRS-6 defaults. This may
be a summarisation artifact of the fetch. **Read `constant.ts` directly rather than trusting these
digits.** In any case: never hardcode `w` — call `generatorParameters()` and let the library own it.

### B5.4 Postgres schema

Store FSRS state **on the card**, and every review **append-only**. The append-only log is not
optional: it is the training set for `@open-spaced-repetition/binding` to fit per-user parameters,
and it is what `reschedule()` replays.

```sql
-- one row per (user, drillable item)
CREATE TABLE srs_card (
  id                BIGSERIAL PRIMARY KEY,
  user_id           UUID        NOT NULL REFERENCES app_user(id),
  item_id           BIGINT      NOT NULL REFERENCES drill_item(id),

  -- verbatim ts-fsrs Card
  due               TIMESTAMPTZ NOT NULL,
  stability         REAL        NOT NULL,
  difficulty        REAL        NOT NULL,
  elapsed_days      INTEGER     NOT NULL DEFAULT 0,
  scheduled_days    INTEGER     NOT NULL DEFAULT 0,
  learning_steps    SMALLINT    NOT NULL DEFAULT 0,
  reps              INTEGER     NOT NULL DEFAULT 0,
  lapses            INTEGER     NOT NULL DEFAULT 0,
  state             SMALLINT    NOT NULL DEFAULT 0,   -- State enum 0..3
  last_review       TIMESTAMPTZ,

  suspended         BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);

-- the hot query: today's queue
CREATE INDEX srs_card_due_idx
  ON srs_card (user_id, due)
  WHERE suspended = FALSE;

-- append-only; never UPDATE
CREATE TABLE srs_review_log (
  id                  BIGSERIAL PRIMARY KEY,
  card_id             BIGINT      NOT NULL REFERENCES srs_card(id),
  user_id             UUID        NOT NULL,
  rating              SMALLINT    NOT NULL,   -- Rating enum 0..4
  state               SMALLINT    NOT NULL,   -- state BEFORE the review
  due                 TIMESTAMPTZ NOT NULL,
  stability           REAL        NOT NULL,
  difficulty          REAL        NOT NULL,
  elapsed_days        INTEGER     NOT NULL,
  last_elapsed_days   INTEGER     NOT NULL,
  scheduled_days      INTEGER     NOT NULL,
  learning_steps      SMALLINT    NOT NULL,
  review              TIMESTAMPTZ NOT NULL,

  -- poker-specific, NOT part of FSRS
  ev_loss_bb          REAL,
  chosen_action       TEXT,
  solver_freq         REAL,        -- frequency of the action the user picked
  rng_roll            SMALLINT,    -- 1..100 if the node was mixed
  duration_ms         INTEGER
);
CREATE INDEX srs_review_log_card_idx ON srs_review_log (card_id, review DESC);

-- per-user trained parameters
CREATE TABLE srs_params (
  user_id            UUID PRIMARY KEY REFERENCES app_user(id),
  w                  REAL[] NOT NULL,          -- 21 floats for FSRS-6
  request_retention  REAL   NOT NULL DEFAULT 0.9,
  maximum_interval   INTEGER NOT NULL DEFAULT 36500,
  enable_fuzz        BOOLEAN NOT NULL DEFAULT TRUE,
  enable_short_term  BOOLEAN NOT NULL DEFAULT TRUE,
  learning_steps     TEXT[] NOT NULL DEFAULT '{1m,10m}',
  relearning_steps   TEXT[] NOT NULL DEFAULT '{10m}',
  trained_at         TIMESTAMPTZ,
  review_count_at_training INTEGER
);
```

Notes:
- `TIMESTAMPTZ` everywhere; do the day-boundary/"next day starts at 4am" logic in app code with the
  user's tz, never in the column type.
- `REAL` (float4) is plenty for stability/difficulty; `w` as `REAL[]` avoids a JSON round-trip.
- **Turn `enable_fuzz` ON in production** (the library default is `false`). Without fuzz, everything
  learned on day 1 comes due on the same days forever and the queue becomes spiky.
- Retrain `w` per user once they cross ~**1,000 reviews** (below that the defaults win); store
  `review_count_at_training` so you know when to retrain.
- **Grade mapping from poker performance** — the design decision that makes or breaks this:

  | Outcome | Rating |
  |---|---|
  | Wrong action, EV loss above blunder threshold | `Again` (1) |
  | Correct-at-some-frequency but not best, or slow/hesitant | `Hard` (2) |
  | Best action (or RNG-correct action), normal latency | `Good` (3) |
  | Best action, fast, and previously stable | `Easy` (4) |

  Use **EV loss thresholds expressed as % of pot**, not raw bb, so they're comparable across nodes.
  Also feed **response latency** in — a hand you get right after 8 seconds of arithmetic is not
  memorised, and FSRS has no latency input, so it must enter through the grade.

---

## B6. Evidence-based retention techniques for dense technical books

### B6.1 The canonical ranking

**Dunlosky, Rawson, Marsh, Nathan & Willingham (2013)**, *Improving Students' Learning With
Effective Learning Techniques*, **Psychological Science in the Public Interest 14(1), 4–58**.
[SAGE](https://journals.sagepub.com/doi/abs/10.1177/1529100612453266) ·
[PubMed 26173288](https://pubmed.ncbi.nlm.nih.gov/26173288/) ·
plain-language version: [AFT American Educator, Fall 2013](https://www.aft.org/ae/fall2013/dunlosky)

Ten techniques, rated by utility:

**HIGH utility**
1. **Practice testing (retrieval practice)** — works across ages, materials, retention intervals;
   gives both a direct memory benefit and a metacognitive signal about what to restudy.
2. **Distributed practice** — spacing beats massing; harder up front, far better long-term.

**MODERATE utility**
3. **Interleaved practice** — mixing problem types; improves *discrimination* and transfer.
   Requires learning to *identify* the problem type, not just execute a known formula.
4. **Elaborative interrogation** — generating "why is this true?" explanations. **Weaker for
   learners without prior domain knowledge.**
5. **Self-explanation** — explaining how new material connects to what you know. Reported ~3× better
   transfer on problem-solving. Needs coaching so it doesn't collapse into paraphrasing.

**LOW utility**
6. **Summarization** — works for trained undergrads; training cost is high (90+ min prep, five
   50-min sessions).
7. **Highlighting / underlining** — *"failed to help students of all sorts"*; can **hurt** when the
   task requires inference across concepts. The most popular technique and one of the worst.
8. **Rereading** — inconsistent; helps recall more than comprehension; benefits don't last.
9. **Keyword mnemonic** — short-lived, narrow.
10. **Imagery for text** — fades; useless for abstract/complex content.

### B6.2 Effect sizes

- **Retrieval practice**: Rowland (2014) **Hedges' g ≈ 0.50**; Adesope, Trevisan & Sundararajan
  (2017), *Rethinking the Use of Tests: A Meta-Analysis of Practice Testing*, **Review of
  Educational Research** — **217 studies, g ≈ 0.61**.
  [SAGE](https://journals.sagepub.com/doi/abs/10.3102/0034654316689306)
- **Rowland's moderators — directly actionable for you:** the effect is **larger** when
  (a) the material is **more complex**, (b) retrieval is **more effortful**, and
  (c) **feedback is given during practice**. All three describe a well-built poker drill.
- **Retrieval > elaborative study:** Karpicke & Blunt (2011), *Retrieval Practice Produces More
  Learning than Elaborative Studying with Concept Mapping*, **Science 331(6018), 772–775**.
  [PubMed 21252317](https://pubmed.ncbi.nlm.nih.gov/21252317/). Retrieval beat concept mapping on a
  **1-week delayed** test. (A published Comment and reply exist —
  [Science](https://www.science.org/doi/10.1126/science.1203698) — the finding survived.)
- **Spacing:** Cepeda, Pashler, Vul, Wixted & Rohrer (2006), *Distributed Practice in Verbal Recall
  Tasks: A Review and Quantitative Synthesis*, **Psychological Bulletin** — **839 assessments across
  317 experiments in 184 articles**. [PDF](https://augmentingcognition.com/assets/Cepeda2006.pdf) ·
  [author page](https://www.yorku.ca/ncepeda/publications/CPVWR2006.html).
  **Key quantitative result: the optimal inter-study gap is ~20% of the retention interval for
  delays of a few weeks, dropping to ~5% at a one-year delay** — and the optimal gap *grows* with
  the retention interval. Follow-up: Cepeda et al. (2008), *Spacing Effects in Learning: A Temporal
  Ridgeline of Optimal Retention*, **Psychological Science 19(11), 1095–1102**
  ([PDF](https://laplab.ucsd.edu/articles/Cepeda%20et%20al%202008_psychsci.pdf)).
  **This is precisely what FSRS's desired-retention knob operationalises — you get the ridgeline for
  free by using FSRS.**
- **Self-explanation:** Bisra et al. (2018) meta-analysis, **64 studies, ~6,000 participants,
  g ≈ 0.55**. Fiorella & Mayer (2013): the **act of actually explaining** produces the benefit —
  merely *expecting* to teach does not. **[Both cited via secondary source — verify the primary
  papers before quoting.]**

### B6.3 Cloze deletion and "Feynman"

- **Cloze**: the honest position is that cloze is **a delivery format, not an independent
  technique** — its benefit is the retrieval it forces. The most useful critique is Andy Matuschak's:
  *"[cloze deletion prompts seem to produce less understanding than question-answer
  pairs](https://notes.andymatuschak.org/zPJt42JTcoAPTTTa2vdDonV)"* — after several reps you
  recall the answer by **pattern-matching the sentence shape** rather than integrating the idea.
  Practical rule: cloze for definitions/lists/processes-in-context; explicit Q&A for anything
  requiring understanding. **[The strongest claims for cloze superiority I found are on vendor blogs
  (Clozemaster, Migaku, smartrecallai) — treat as marketing, not evidence.]**
- **Feynman technique**: **no strong primary evidence base under that name.** The studies that exist
  are small and mostly in low-tier venues. Its *mechanism* is well-supported, though — it is
  self-explanation + the generation effect + a metacognitive gap-detector. **Cite self-explanation
  research (Bisra 2018, Chi's work), not "the Feynman technique."**

### B6.4 What this means for a poker book-reading feature

1. **Retrieval practice is the whole game.** Every feature should end in the user producing an
   answer from memory. Highlighting is *actively counterproductive* per Dunlosky — so if you build
   a highlighter, it must be a **card-authoring gesture**, never the study action itself.
2. **Give feedback immediately** (Rowland's moderator) — show the solver frequency vector /
   the book passage right after the answer.
3. **Interleave positions, stack depths, and node types** in the queue. Do not block by chapter.
   Blocking feels better and teaches worse.
4. **Elaborative interrogation is weak for novices** — don't ask a beginner "why does UTG open 2x?"
   before they have the range knowledge to answer. Sequence: recall the range → then explain it.
5. FSRS's scheduler already implements the Cepeda ridgeline. Don't hand-tune intervals.

---

## B7. Readwise / RemNote / SuperMemo incremental reading — the concrete loop

### B7.1 SuperMemo (the original)

[super-memory.com/help/read.htm](https://www.super-memory.com/help/read.htm) ·
[help.supermemo.org](https://help.supermemo.org/wiki/Incremental_reading)

The five-skill loop:
1. **Import** — `Ctrl+N` paste, `Ctrl+Shift+A` mass web import, `Ctrl+Shift+W` Wikipedia,
   `Ctrl+Shift+Y` YouTube, local files.
2. **Topics vs. Items** — *the load-bearing distinction*. A **Topic** is "what you want to learn"
   (an article, read passively). An **Item** is "what you know" (a Q&A tested by active recall).
   **They are scheduled by different rules**: Topic intervals are user-controlled (`Ctrl+J`,
   `Ctrl+Shift+R`); Item intervals are owned by the SM algorithm and cannot be overridden.
3. **Extract** — `Alt+X` on a selected passage creates a new child mini-article.
4. **Cloze** — `Alt+Z` on a short extract hides a keyword as `[...]`, converting a Topic into an Item.
5. **Prioritise** — every element carries a priority **0% (highest) → 100% (lowest)**, with
   **auto-sort** (daily reorder of outstanding material by priority) and **auto-postpone**
   (low-priority material slides so high-priority work is protected).
   `Alt+P` to change priority. `Ctrl+Shift+Enter` = "Done!" with an article.
   Read-point marker: `Ctrl+F7`.

The philosophy: read **many articles in small portions in parallel**, never one linearly.

### B7.2 RemNote

[bjsi/incremental-everything](https://github.com/bjsi/incremental-everything) plugin ·
[user manual](https://hugomarins.github.io/incremental-everything/)

- Interleaves **reading material, PDFs, websites, video snippets, and writing projects directly
  into the flashcard queue**. The PDF/web reader renders **inside** the queue — you don't leave the
  review session to read.
- Same `Alt+X` extract → `Alt+Z` cloze lineage as SuperMemo.
- Its stated contribution is solving **queue explosion**: **priority inheritance**, a
  **"Priority Shield"** that caps how much low-priority material can enter a session, capacity
  tracking, and an escape hatch (**Priority Review Documents**) when you're buried.
- Also: [mochar/logseq-incremental-blocks](https://github.com/mochar/logseq-incremental-blocks) —
  same idea for Logseq, with a dynamic priority queue. Good small open-source reference.

### B7.3 Readwise

[readwise.io](https://readwise.io/) · [docs](https://docs.readwise.io/readwise) ·
[Reviewing Your Highlights](https://docs.readwise.io/readwise/docs/faqs/reviewing-highlights) ·
[Adding Intention to Spaced Repetition](https://blog.readwise.io/adding-intention-to-spaced-repetition/)

Two layers, and **the distinction matters**:

**Layer 1 — Daily Review (resurfacing, NOT spaced repetition).** A weighted random draw over your
whole highlight library: *"if you have 500 total highlights and a document contains 100, there's a
20% chance your Daily Review contains a highlight from that book."* Once shown, a highlight's
probability of resurfacing **drops sharply**. A "Bonus Highlight" closes each session. A
**Highlight Quality Filter** strips sentence fragments by default. Actions: Discard (soft, reversible),
Keep, **Master**, Favorite, Edit/Note, Share/Tag.

**Layer 2 — Mastery (actual SRS).** Opting a highlight into "Master" starts a
**decaying recall-probability half-life** model:
- **"Soon" = 7-day half-life · "Later" = 14-day · "Someday" = 28-day**
- A highlight **resurfaces when recall probability falls to ≤50%**, prioritised lowest-first.

This is essentially a one-parameter Ebisu/HLR-style model — far simpler than FSRS and, per the
Expertium benchmark, HLR-class models sit well below FSRS. **Readwise's genius is not the algorithm;
it's that capture is free** (highlights sync automatically from Kindle/Reader/web) so the deck
builds itself. Reader is **API-first** and exports to Obsidian/Notion/Roam/Logseq.

### B7.4 The synthesis — the loop I'd build

Combining the above with B6:

```
CAPTURE      highlight a passage while reading in-app  (zero friction; the ONLY job of highlighting)
   ↓
EXTRACT      passage becomes a Topic (an "extract") with a priority 0-100
   ↓
CONVERT      Topic → one or more Items. Never leave a Topic un-converted; a Topic that is
             only ever re-read is Dunlosky's low-utility "rereading."
             - cloze for definitions/lists
             - explicit Q&A for anything conceptual  (Matuschak's warning)
             - for poker: auto-generate a DRILL item (position × node × hand) from the
               concept — this is the bridge between the book and the range trainer
   ↓
SCHEDULE     Items → FSRS-6 via ts-fsrs.
             Topics → a SEPARATE, priority-sorted, user-controllable queue.
             DO NOT put Topics through FSRS: FSRS models recall probability, and re-reading
             an article is not a recall event. This is exactly why SuperMemo separates them.
   ↓
REVIEW       one interleaved session mixing Topics + Items + poker drills.
             Priority shield caps low-priority Topic intake so the retention queue never starves.
   ↓
FEEDBACK     immediately show the source passage / the solver frequency vector  (Rowland moderator)
   ↓
ELABORATE    periodically ask the user to explain a mastered concept in their own words
             (self-explanation, g≈0.55). Grade it with an LLM. This is the "Feynman" feature,
             correctly named as self-explanation.
```

**The two failure modes to design against, both named explicitly in the sources:**

1. **The blank-card problem** (poker-toolkit.com): users quit because authoring cards is
   unsustainable. **Your card generator must be automatic.** For poker this is easy and is your
   unfair advantage — a range chart *is* a card generator. For books, use LLM-assisted cloze/Q&A
   generation with a human confirm step.
2. **Queue explosion** (RemNote's Incremental Everything): unbounded extraction buries the user.
   **Ship priority + a per-session intake cap from v1**, not as a later fix.

**Card granularity for poker — the thing to get right (see A4.4's 14,400-fact problem):**
Do **not** make one FSRS card per (hand × node) — 169 × ~85 ≈ 14,400 cards is unlearnable and
the intervals become meaningless. Instead:

- **One FSRS card ≈ one *node* (position × scenario × villain), not one hand.** ~85 cards for a full
  100bb 6-max tree — a tractable deck.
- Each **review of that card = a short drill of N sampled hands** from that node, sampled by GTO
  frequency, biased toward the hands **this user has previously got wrong** and toward
  **close decisions** (GTO Wizard's filter).
- The FSRS **grade** for the card comes from the session's aggregate EV loss (B5.4's mapping).
- Keep per-hand error statistics in `srs_review_log` **outside** the FSRS state, and use them purely
  for **within-card hand sampling**. This gives you fine-grained leak-finding without exploding the
  scheduler.

---

# Explicit list of what I could NOT verify

| Claim | Status |
|---|---|
| `default_w` digits in `ts-fsrs` `constant.ts` | Reported array looks like FSRS-5 weights + v6 decay. **Read the file directly.** |
| Which Anki version made FSRS the default for new installs | FAQ says only "as of 23.10 Anki offers two algorithms." Secondary sources say "newer installs may have it on." |
| PokerBench: solver used, stack depth, table size, rake | Not on the dataset card or the arXiv abstract. **Must read the full PDF.** |
| GTO Wizard exact 3-bet / 4-bet multipliers | Not published on the fetchable pages; only "same size for all positions vs a given open." |
| Community "IP 3bet 3.4×, OOP 4.4× +1bb/caller, 4bet 2.3×/2.75×" | Single vendor/blog source. Not corroborated by GTOW or GTOBase docs. |
| `exinori/DCFR-SOLVER` — whether it really solves 6-max *preflop* and its license | Only a search-result description. **High-value; verify first.** |
| Licenses for `jbcazaux/preflop-academy`, `lukebhan/memorizePreFlop`, `grwgreg/rangetools`, `skel35/NashEquilibriumCalc`, `poker-odds-calc`, `@cloviz/eq-mc`, `@poker-apprentice/hand-evaluator`, `OMPEval`, `rust_poker`, `pokers` | Not individually fetched. |
| RangeSharp 2+2 thread contents | twoplustwo forum **403s** to automated fetch. Read manually. |
| SuperMemo help pages | `help.supermemo.org` **403s**; used the `super-memory.com` mirror instead. |
| Bisra et al. 2018 (g=0.55) and Fiorella & Mayer 2013 | Cited via secondary source only. Verify primaries. |
| FSRS "20–30% fewer reviews", "99.6% of collections", "±5.3% vs ±16.2%" | From secondary blogs, **not** from the Expertium benchmark page itself. The benchmark page's own ranking (SM-2 second-to-last) is verified. |
| npm weekly download counts for any package | npmjs.com returns **403**; used `registry.npmjs.org` which does not expose download counts. |
| Whether `postflop-solver` v-latest still parses the exact grammar documented | Author warns of "breaking changes without version updates." |
