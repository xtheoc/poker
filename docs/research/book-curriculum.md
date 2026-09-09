# NLHE Reading Curriculum — Research Report (valid as of Sept 2026)

> **File-location note:** I was asked to write this to the session scratchpad
> (`...\scratchpad\research-curriculum.md`). Plan mode is active and restricts writes to this
> plan file only, so the report lives here. Copy it to the scratchpad path verbatim if needed.

---

## 0. Method, and what I could NOT verify

**Sources used:** publisher pages (D&B Poker, Simon & Schuster), Goodreads (page counts, first-pub
dates, rating counts, reader criticism), Google Books, Amazon/AbeBooks listings, PokerNews,
CardPlayer Lifestyle, Thinking Poker, GTO Wizard blog, PokerExplore, CardsChat, archive.org.

**Access failures — flag these, don't paper over them:**

- **Reddit is not crawlable by this agent.** `WebSearch` with `allowed_domains: ["reddit.com"]`
  returns a hard API error ("domains are not accessible to our user agent"). Every claim below
  attributed to "Reddit consensus" is therefore *second-hand* — from Goodreads reviews, CardsChat,
  aggregator articles, and 2+2 thread summaries surfaced in search snippets. **A human should
  re-verify the r/poker and r/PokerStrategy sentiment directly.**
- **2+2 (forumserver.twoplustwo.com) returns HTTP 403 to WebFetch.** I have thread *titles* and
  search-engine *summaries* of 2+2 threads, not the raw posts. Treat 2+2 quotes below as
  paraphrase-of-a-summary, not verbatim.
- **Table-of-contents data is only partially verifiable.** I got real, sourced ToCs for 4 books.
  For 2 more I got partial/section-level data. Gaps are marked `[TOC UNVERIFIED]`.
- **Page counts differ by edition** (Kindle vs paperback vs audio). Where two numbers exist I give
  both. Kindle "page counts" are especially unreliable (Grinder's Manual: 540 print vs 726 Kindle).

---

## 1. The opinionated thesis (read this before the book list)

Four claims that shape everything below:

1. **Preflop content published before ~2016 is dead.** This is the single most solver-affected area.
   Any preflop chart from a pre-solver book is not "slightly off," it is a different strategy. This
   kills the preflop sections of Super System, Theory of Poker, Harrington, Kill Everyone, Small
   Stakes NLHE, and the preflop halves of Poker's 1%.
2. **Postflop *frameworks* from 2013–2019 largely survived; the *numbers* didn't.** Janda's
   thinking about bluff-to-value ratios, Miller's frequency mindset, Brokos's toy games — the
   reasoning is intact. The specific frequencies and sizings have all been superseded.
3. **Books are a *scaffolding* technology, not a *precision* technology.** A book cannot show you
   the strategy for K72r 3-bet pot BTN vs BB at 47bb. A solver can, instantly. Books earn their
   keep by teaching you what question to ask the solver and how to read the answer. **A books-only
   path caps out somewhere around solid small-stakes competence (roughly NL50 online / $2-5 live)
   and is a genuine dead end past that.** See §5.
4. **The best 2020–2026 poker "books" are increasingly workbooks and quiz books, not treatises.**
   Little's *Complete Poker Workout*, SplitSuit's workbooks, the *GTO Poker Gems* format, Matros's
   annual hand collections. This is the market correcting for #3: books moved toward the thing
   books are still uniquely good at — forcing active retrieval. **This is also the single most
   important structural signal for a study app.**

---

## 2. Verified book dossier

Ratings are Goodreads unless noted, captured Sept 2026. `n` = number of ratings (a proxy for how
much community consensus actually exists — note how thin some are).

| Book | Author | Year | Pages | GR rating (n) |
|---|---|---|---|---|
| Crushing the Microstakes | Nathan "BlackRain79" Williams | 2011 | 253 | 4.15 (99) |
| The Course | Ed Miller | 2015 | 306 | 4.40 (264) |
| Poker's 1% | Ed Miller | 2014 | 234 | 4.25 (124) |
| The Grinder's Manual | Peter "Carroters" Clarke | 2016 | 540 print / 726 Kindle | 4.49 (124) |
| Mastering Small Stakes NLHE | Jonathan Little | 2017 | 480 | 4.35 (20) |
| Excelling at NLHE | Jonathan Little (ed.), 17 contributors | 2015 | 493 / 635 (edition-dependent) | 4.05 (168) |
| Applications of NLHE | Matthew Janda | 2013 | 510 (some listings 494) | 4.41 (252) |
| NLHE for Advanced Players | Matthew Janda | 2017 | 339 | 4.47 (122) |
| Play Optimal Poker | Andrew Brokos | 2019 | 245 (PokerNews says 237) | 4.18 (220) |
| Play Optimal Poker 2: Range Construction | Andrew Brokos | 2020 | 245 | 4.69 (58) |
| Modern Poker Theory | Michael Acevedo | 2019 (Aug 9, D&B) | 480 | 4.28 (355) |
| The Mental Game of Poker | Jared Tendler & Barry Carter | 2011 | ~250 `[unverified]` | 4.22 (1,331) |
| The Mental Game of Poker 2 | Jared Tendler & Barry Carter | 2013 | 204 | 4.20 (297) |
| Elements of Poker | Tommy Angelo | 2007 | 268 | mixed; see §4 |
| Ace on the River | Barry Greenstein | 2005 | 328 | 3.59 (824) |
| Positive Poker | Dr. Patricia Cardner & Jonathan Little | Dec 2013 | `[UNVERIFIED]` | thin |
| Poker Therapy | Peter Clarke | Nov 2019 | 207 | 4.56 (16) |
| Kill Everyone | Nelson, Streib, Heston | 2007 (2nd ed. 2009) | 348 | 3.98 (351) |
| Poker Satellite Strategy | O'Kearney & Carter | Feb 2019 | 224 | — |
| PKO Poker Strategy | O'Kearney & Carter | Jun 2020 | 198 | — |
| Endgame Poker Strategy: The ICM Book | O'Kearney & Carter | 2021/22 `[year ambiguous]` | `[unverified]` | — |
| GTO Poker Simplified | O'Kearney & Carter | Nov 2022 | ~362 `[soft]` | — |
| Beyond GTO: Poker Exploits Simplified | O'Kearney & Carter | Jan 21 2024 | `[unverified]` | **Global Poker Awards 2024 Best Poker Book** |
| GTO Poker Gems | Sweeney & Jones (w34z3l) | 2022 | short | — |
| GTO Poker Gems 2 | Sweeney & Jones | Oct 2024 | short | — |
| The Exploitative Edge | James "SplitSuit" Sweeney & Adam "w34z3l" Jones | 2025 | `[unverified]` | — |
| The Complete Poker Workout | Jonathan Little | Dec 5 2025 | 392 | — |
| Daily Dose of GTO | Tom Boshoff (Tombos21) & Daniel Jacobson | 2024 | **free ebook**, 300+ quizzes | — |
| Secrets of Professional Tournament Poker: The Essential Guide | Jonathan Little | Jul 2021 (rewrite of 2011/12 two-volume) | `[unverified]` | — |
| Modern Poker Theory – The Tournament Workbook | Michael Acevedo | 2024/2025 `[year ambiguous]` | `[unverified]` | — |

**Books I was asked to verify that DO exist as described:** all of them. No fabrications found in
the brief. Two title corrections worth noting:
- "Excelling at NLHE" is formally *Jonathan Little's Excelling at No-Limit Hold'em: Leading Poker
  Experts Discuss How to Study, Play and Master NLHE* — Little is **editor**, 17 contributors
  including Hellmuth, Sexton, Moneymaker, Will Tipton, Ed Miller, Tendler, Fitzgerald, Cardner.
- "Modern MTT books" is not a title; the modern MTT canon is the O'Kearney/Carter *Poker Solved*
  series plus Little's 2021 *Secrets* rewrite.

---

## 3. The staged curriculum

Each stage gives real options, not one path.

### STAGE 0 — Foundations (rules → not-losing)
*Goal: preflop discipline, position, pot odds, stop bleeding money.*

**Option A — Crushing the Microstakes** (Williams, 2011, 253pp)
- *Teaches:* a simple TAG blueprint for NL2–NL25 online / $1-2 live. Hand selection by position,
  when to bet/raise, table selection, HUD basics.
- *Belongs here because:* it is prescriptive, not theoretical. "There is no mathematics, only
  targeted advice for NL2 and NL5" (Goodreads reviewer). That is exactly right for stage 0.
- *Prereqs:* none.
- *Does NOT cover:* any GTO, any solver reasoning, multiway postflop depth, tournaments.
- *Outdated?* **Partially.** Core exploitative logic vs. calling stations still works — micros
  populations really have not moved that much. The **online-operational** advice is stale: HUD/
  tracking-software policies, table-selection and seat-scripting rules changed on most sites, and
  Zoom/fast-fold pool dynamics differ. Preflop ranges are pre-solver but at NL2 that is nearly
  irrelevant.
- *Reputation:* the durable micros default; 4.15 (99). Contrarian take: dismissed by theory-first
  players as "nit-fu that stops working at NL25."

**Option B — The Course** (Ed Miller, 2015, 306pp)
- *Teaches:* live cash specifically, structured as 10 numbered Skills gated by stake ($1-2 → $2-5
  → $5-10). Preflop simplicity, don't-pay-people-off, hand-value assessment, then barreling, board
  texture, live reads, emotional numbing, then exploiting aggression / deep play / beating pros.
- *Belongs here because:* it is the best-organized "what do I actually do next" progression in
  poker literature, and it explicitly sequences skills — **ideal spine for an app's stage model.**
- *Prereqs:* knows the rules.
- *Does NOT cover:* online, tournaments, GTO, solvers, multiway theory.
- *Outdated?* **Mildly, and by success.** Reviewers note the strategy became common in live games
  since 2015, eroding edge. Preflop is pre-solver. Skills 4–10 (barreling, board texture, reads,
  emotional control) are timeless. Best-rated Miller book at 4.40 (264).
- *Reputation:* the near-universal live-cash starter recommendation.

**Option C — Mastering Small Stakes NLHE** (Little, 2017, 480pp)
- *Teaches:* a small-stakes baseline covering **both** cash and MTT, plus the adjustments when
  opposition gets competent.
- *Belongs here because:* it is the only stage-0/1 book that services both formats, useful if the
  student hasn't chosen a lane.
- *Prereqs:* rules + some play experience.
- *Does NOT cover:* deep GTO derivation, high stakes, ICM depth.
- *Outdated?* Post-solver-era enough to be safe on structure; ranges are 2017-vintage and now
  slightly loose/simplified vs. current solutions.
- *Reputation:* well-liked but **only 20 Goodreads ratings** — there is no real community consensus
  on this book. Do not present it as canonical.

> **Skip at this stage:** Super System, Theory of Poker, Harrington. See §4.

---

### STAGE 1 — Fundamentals (a complete, coherent NLHE strategy)
*Goal: one internally consistent game across all streets and positions.*

**Option A — The Grinder's Manual** (Clarke, 2016, 540pp) — ***my top pick for this stage.***
- *Teaches:* a genuinely complete 6-max online cash syllabus. 15 chapters climbing from opening
  ranges through isolation, c-betting, value betting, calling opens, facing bets (closed vs. open
  action), combos/blockers, 3-betting and defending, multi-street bluffing, 3-bet pots, stack depth.
  80 figures, 152 fully analysed hands.
- *Belongs here because:* it is the last great pre-solver-native textbook that is nonetheless
  *range-based and reason-first*. Clarke insists you know **why**. Nothing published since covers
  this much ground this coherently.
- *Prereqs:* comfort with basic terms and hand-reading; a stage-0 book first.
- *Does NOT cover:* multiway pots (a named reader complaint), tournaments/ICM, modern
  multi-sizing trees, solver operation.
- *Outdated?* **Aging but structurally sound.** 2016 predates cheap solver access, so bet sizings
  are simplified (largely single-size c-betting where modern solutions use small/large/overbet
  mixes) and preflop ranges are tighter than current solutions, especially BB defense and blind-vs-
  blind. The *logic* is not outdated.
- *Reputation:* 4.49 (124) — highest-rated big cash textbook. "The best poker book for NLHE 6-max
  ever written." Berkeley's poker org lists it as a core recommendation. Contrarian: "dated since
  2016," and it is long enough that many buyers never finish it.

**Option B — Excelling at NLHE** (Little ed., 2015, ~493–635pp)
- *Teaches:* 17 expert essays in 3 parts — Part 1 fundamentals/satellites/lower buy-ins/tells/
  moving up; Part 2 range analysis, GTO intro (Will Tipton), short stacks, value betting, final
  tables; Part 3 mental toughness, psychology, tilt (Tendler, Cardner).
- *Belongs here because:* breadth-first. Good for a student who doesn't yet know which sub-skill
  they're weakest at — you sample everything, then go deep.
- *Prereqs:* stage-0 fluency.
- *Does NOT cover:* anything to depth. It is a sampler by construction.
- *Outdated?* Mixed by chapter; the GTO chapter is a 2015 artifact. Mental-game and tells chapters
  hold up fully.
- *Reputation:* 4.05 (168) — solid, unexciting, "covers almost every aspect an intermediate player
  needs." Contrarian: anthologies are uneven and it's ~600 pages for that.

**Option C — Poker's 1%** (Miller, 2014, 234pp) — *transitional, see §4 warning*
- *Teaches:* thinking in **frequencies** rather than hands. The "one big secret" is that elite
  players maintain consistent betting/checking frequencies across their whole range.
- *Belongs here because:* it is the cheapest, fastest way to install frequency-thinking, which is
  the prerequisite mental move for everything in Stage 2+.
- *Prereqs:* stage-0/1.
- *Does NOT cover:* correct frequencies.
- *Outdated?* **Yes on specifics, valuable on mindset.** Brokos's own critique: the book is
  "flat wrong" that GTO produces the smooth-sided frequency "pyramids" Miller advocates. A 2024
  reader: examples are "WAY off compared to the Pio solves." **Read it for the reframe, then
  immediately discard the numbers.** Realistic 2026 alternative: get the same reframe free from
  *Daily Dose of GTO* or the first chapters of *Play Optimal Poker*.

---

### STAGE 2 — Modern theory (game theory you can actually reason with)
*Goal: understand equilibrium well enough to interrogate a solver.*

**Option A — Play Optimal Poker** (Brokos, 2019, 245pp) — ***the consensus entry point.***
- *Teaches:* game theory from first principles via **toy games** — the Clairvoyance/AKQ game,
  polarized vs. condensed ranges, reciprocal ranges, indifference, then "Get Real!" bridging to
  actual NLHE, exploitative strategy construction, complex ranges, raising.
- *Belongs here because:* this is the book everyone — 2+2, coaches, PokerExplore's MPT review —
  names as the thing you read *before* Modern Poker Theory or a solver subscription.
- *Prereqs:* solid fundamentals; comfort doing arithmetic on paper.
- *Does NOT cover:* real preflop ranges, real board-texture solutions, tournaments.
- *Outdated?* **No.** Game theory doesn't rot. Safest long-term buy on this list.
- *Reputation:* 4.18 (220). Contrarian take is consistent and worth respecting: *"toy games are
  very simple, not very applicable to real-life scenarios"* — some readers want hands, not
  abstractions. If that's your student, jump to Option C.

**Option B — Play Optimal Poker 2: Range Construction** (Brokos, 2020, 245pp)
- *Teaches:* leverage, protection/semi-bluffing, range construction, shallow stacks, c-betting
  with and without range advantage, turn barreling, attacking missed c-bets, OOP c-betting,
  adapting to tournaments. Introduces the two-street clairvoyance game.
- *Belongs here because:* it converts POP1's abstractions into actual NLHE decisions.
- *Prereqs:* POP1, effectively mandatory.
- *Does NOT cover:* preflop solutions, ICM depth.
- *Outdated?* No.
- *Reputation:* **4.69 (58) — the highest-rated strategy book I found**, though on a thin sample.
  Several reviewers rate it above vol. 1.

**Option C — GTO Poker Simplified** (O'Kearney & Carter, 2022, ~362pp)
- *Teaches:* solver conclusions translated into human heuristics, applicable to both cash and MTT.
  Explicitly anti-genius-gatekeeping.
- *Belongs here because:* it's the "I want the takeaways, not the derivation" path. Faster and more
  actionable than Brokos, less rigorous.
- *Prereqs:* fundamentals.
- *Does NOT cover:* why any of it is true. That's the tradeoff.
- *Outdated?* No — 2022 and solver-native.
- *Reputation:* strong and rising; the *Poker Solved* series is the most-cited modern book brand in
  the 2024–2026 forum chatter I could see.

**Option D — Daily Dose of GTO** (Boshoff & Jacobson / GTO Wizard, 2024) — **free**
- 300+ interactive quizzes in five-minute units, covering poker math, advanced concepts and
  format/stack-depth adjustments. `https://www.dailydoseofgto.com/`
- *Belongs here because:* it is free, current, quiz-structured, and maps 1:1 onto a study app's
  spaced-repetition model. **If the app can only integrate one modern GTO resource, this is the one
  with zero cost barrier.**

---

### STAGE 3 — Advanced / GTO reference
*Goal: reference-grade depth. These are lookup books, not read-through books.*

**Option A — Modern Poker Theory** (Acevedo, 2019, 480pp, D&B)
- *Teaches:* three movements — (1) GTO fundamentals: MDF, alpha, range/nut advantage, plus a
  chapter on modern poker software; (2) an enormous preflop section (position-vs-position,
  tournament-oriented, roughly 300pp of charts by one reader's estimate); (3) postflop decision
  trees by board texture, SPR and position across flop/turn/river.
- *Belongs here because:* it's the most complete single-volume GTO NLHE textbook that exists.
- *Prereqs:* PokerExplore's review is blunt — read *Play Optimal Poker* first; beginners "will be
  crushed by the density." Assumes you already grasp ranges.
- *Does NOT cover:* exploitative adaptation in depth; multiway; PLO.
- *Outdated?* **The most contested book on this list.** Consensus split:
  - *Still gold:* the postflop theory chapters ("pure gold" per one reviewer) and the vocabulary/
    framework that makes solver output legible.
  - *Now redundant:* the preflop chart mass. Any modern solver subscription gives you better,
    interactive, stack-depth-specific ranges. Three-way spots — which GTO Wizard added in 2025 —
    are outside the book entirely.
  - *Harshest take found (2024 Goodreads):* "Decent intro for 2019 but in 2024 would be a total
    waste of time. A few YouTube videos from GTOwizard... is much higher yield."
  - **My call:** buy it, read chapters 1–2 and the postflop half, treat the preflop section as an
    appendix you never read. Do not budget 80 hours for it.
- *Reputation:* 4.28 (355) — the largest ratings base of any modern GTO book. D&B calls it their
  best strategy title. PokerExplore 4.6/5, "most complete GTO NLHE textbook available today."

**Option B — Applications of No-Limit Hold'em** (Janda, 2013, 510pp, Two Plus Two)
- *Teaches:* theoretically sound poker derived by hand — bet/bluff ratios, range construction
  across streets, why balanced strategies look the way they do.
- *Belongs here because:* it is the book that taught a generation to think in ranges, and the
  derivations build intuition a solver's output never will.
- *Prereqs:* serious. Janda's own audience note is upper-micro-and-above online, $2-5 to $5-10 live.
- *Does NOT cover:* solver-verified numbers (it predates accessible solvers), preflop by modern
  standards, ICM.
- *Outdated?* **Numerically yes, conceptually no.** 2013 = pre-PioSOLVER-availability. Community
  guidance where the two Janda books disagree: **trust the 2017 book.**
- *Reputation:* 4.41 (252). Criticized for writing/editing quality. Historically enormous.

**Option C — No-Limit Hold'em For Advanced Players: Emphasis on Tough Games** (Janda, 2017, 339pp)
- *Teaches:* the same project rebuilt on **PioSOLVER and PokerSnowie** output, aimed at tough
  regulars' games.
- *Belongs here because:* it is the natural continuation of *Applications* and the more current of
  the two. If you only read one Janda, read this.
- *Prereqs:* *Applications* is the usual precursor but not strictly required.
- *Does NOT cover:* preflop comprehensively, tournaments.
- *Outdated?* Mildly. 2017 solver work used simplified trees vs. 2026 multi-sizing solutions.
- *Reputation:* **4.47 (122) — rated above *Applications*.** Reviewers: "probably better than
  Applications," "might be the best poker book on the market." Contrarian note: more people
  *like* Applications, but Advanced is the more trustworthy where they conflict.

**Option D — Modern Poker Theory: The Tournament Workbook** (Acevedo, 2024/25 `[year ambiguous —
retail listings disagree between 2024 and 2025]`, ISBN 9781912862290, D&B)
- Practical GTO tournament application companion. `[TOC UNVERIFIED]` — verify before shipping.

---

### STAGE 4 — Exploitative play (where the money actually is)
*Goal: deviate from equilibrium profitably against real humans.*

This stage is **more important than Stage 3 for anyone below high stakes**, and most reading lists
get the order wrong by treating GTO as the summit.

**Option A — Beyond GTO: Poker Exploits Simplified** (O'Kearney & Carter, Jan 2024)
- *Teaches:* uses solver technology (node-locking) to derive *exploits* rather than equilibrium —
  the first book to systematically do this.
- *Belongs here because:* it is the current state of the art and the direct sequel-in-spirit to
  *GTO Poker Simplified*.
- *Prereqs:* a GTO baseline; ideally the 2022 book.
- *Outdated?* No — it's the newest serious theory book in the canon.
- *Reputation:* **Global Poker Awards 2024 Best Poker Book.** Strongest credential of any recent
  release.

**Option B — The Exploitative Edge** (Sweeney & Jones, 2025, Red Chip Poker)
- *Teaches:* "four pillars" framework for exploitative play — opponent profiling, sizing tells,
  and step-by-step hand analysis. Explicitly anti-memorization of solver output.
- *Belongs here because:* it's the most recent, most practical, and shortest of the exploitative
  books — described in reviews as a short read with simple explanations.
- *Prereqs:* fundamentals; GTO helpful but not required.
- *Outdated?* No.
- *Reputation:* new (2025); listed among CardPlayer Lifestyle's 10 best books of 2025. `[Not enough
  time in market for real consensus — flag as promising, not proven.]`

**Option C — Exploitative Play in Live Poker** (Alexander Fitzgerald, 2018, D&B)
- *Teaches:* engineering situations where live opponents blunder, then attacking.
- *Prereqs:* explicitly **not for beginners** — reviews say you need solid fundamentals, GTO
  familiarity and poker math first.
- *Reputation:* enthusiastic but polarized. Great writer; some find it anecdote-heavy. His earlier
  *The Myth of Poker Talent* (2016) is frequently cited as good foundational work.

**Option D — GTO Poker Gems 1 (2022) & 2 (2024)** (Sweeney & w34z3l)
- Deliberately short: vol. 1 is 12 solver insights; vol. 2 is 100–125 "solver-approved insights."
  Concept-per-chapter format. Excellent app-chunking material; weak as a standalone education.

---

### STAGE 5 — Mental game
*Goal: the 30–40% of the game that the strategy books don't touch.*

**Option A — The Mental Game of Poker** (Tendler & Carter, 2011, ~250pp) — ***the standard.***
- *Teaches:* a diagnostic + resolution system for tilt (seven distinct types), variance tolerance,
  confidence, fear, motivation. First four chapters build the model, the rest apply it.
- *Belongs here because:* nothing has replaced it in 15 years, and it is **format-independent and
  solver-independent — it cannot go out of date.**
- *Prereqs:* none. Can be read at any stage; best read early and re-read.
- *Does NOT cover:* strategy, learning-process optimization (that's book 2).
- *Outdated?* **No.**
- *Reputation:* **4.22 with 1,331 ratings — by a wide margin the largest consensus base of any book
  in this report.** Cited as "the best book ever written on the mental aspect of poker."

**Option B — The Mental Game of Poker 2** (Tendler & Carter, 2013, 204pp)
- *Teaches:* the Zone (deconstructed and made reproducible), the learning process itself,
  motivation leaks, fear of success, overconfidence, decision fatigue, mental endurance.
- *Belongs here because:* the **learning-process chapters are arguably the most useful content in
  the whole canon for someone building a study system** — including "why there's a delay between
  studying poker and playing poker" (the unconscious-competence lag).
- *Prereqs:* book 1 recommended, not required.
- *Reputation:* 4.20 (297). Consensus: the first half (Zone + learning) is the value; the back half
  is thinner. A minority question the scientific grounding.

**Option C — Elements of Poker** (Tommy Angelo, 2007, 268pp)
- *Teaches:* tilt, "reciprocality," quitting, table selection, presence — as short aphoristic
  essays. A different genre from Tendler: poetic rather than clinical.
- *Belongs here because:* it reaches people Tendler's workbook style doesn't, and it's short.
- *Outdated?* Its *strategy* content is (limit-poker-flavoured, live-etiquette-heavy — the main
  2+2 complaint). Its *mental* content is timeless.
- *Reputation:* genuinely split. "Timeless classic praised by pros worldwide" vs. 2+2 complaints
  that the strategy advice is impractical for NLHE/tournaments. **Recommend it as a mental-game
  book only; warn students off its strategy sections.**

**Option D — Poker Therapy** (Peter Clarke, 2019, 207pp)
- The Grinder's-Manual author's mental-game companion. 4.56 but on only 16 ratings — **too thin a
  sample to call consensus.** Natural pairing for anyone who liked Clarke's voice.

**Option E — Positive Poker** (Cardner & Little, Dec 2013)
- Positive-psychology framing, built on interviews with pros all having $1M+ lifetime winnings.
  Solid, less famous than Tendler. `[Page count unverified.]` I'd make this the 4th choice here.

---

### STAGE 6 — Specialty track: MTT
*Everything above except The Grinder's Manual is cash-biased. This is the tournament lane.*

1. **Secrets of Professional Tournament Poker: The Essential Guide** (Little, Jul 2021) — the
   rewrite of the 2011/12 two-volume set into one updated hardback, in seven sections beginning
   with tournament structure and deep-stacked play (50bb+). The best modern general MTT textbook.
   `[Page count and full section list unverified.]`
2. **Endgame Poker Strategy: The ICM Book** (O'Kearney & Carter, 2021/22) — the first book-length
   treatment of ICM: bubble play, big/short stack dynamics, deal-making, laddering vs. playing to
   win. **ICM is the one MTT topic where a book still genuinely beats a video**, because it's
   conceptual and arithmetic rather than spot-specific.
3. **PKO Poker Strategy** (O'Kearney & Carter, Jun 2020, 198pp) — bounty/progressive-KO format,
   which is now a large share of the online MTT schedule and is covered essentially nowhere else.
4. **Poker Satellite Strategy** (O'Kearney & Carter, Feb 2019, 224pp) — satellites, where equity
   is wildly non-linear. Narrow but near-uncontested as the reference.
5. **The Complete Poker Workout** (Little, Dec 2025, 392pp) — 100 hands / 392 questions grouped by
   stack size, covering preflop ranges, postflop, opponent adjustments, bubble and final table.
   *Newest and most app-shaped MTT resource in existence.*
6. **Matt Matros's annual hand collections** (*Twenty-four NLH Tournament Hands from 2024*, 76pp;
   *25 NLH Tournament Hands From 2025*; *25 Hands From The 2025 WSOP Main Event*) — very short,
   very current, real high-stakes hands with ICM reasoning. Excellent low-friction "keep current"
   habit material.

*Historical only:* **Kill Everyone** (Nelson/Streib/Heston, 2007, 348pp) introduced bubble factors
and endgame equilibrium plays; **Harrington on Hold'em** (2004–06) introduced M and zone play.
Both are now superseded — see §4.

### STAGE 6b — Specialty track: cash
- Online 6-max: **The Grinder's Manual** → **Janda 2017** → **POP 1&2** → solver.
- Live cash: **The Course** → **Exploitative Play in Live Poker** → **The Exploitative Edge**.
- Micros: **Crushing the Microstakes** → **Daily Dose of GTO** → **The Grinder's Manual**.

### STAGE 7 — Culture / meta (optional but recommended)
- **Ace on the River** (Greenstein, 2005, 328pp, 3.59/824) — **not a strategy book**, despite the
  subtitle "An Advanced Poker Guide." It's the professional-life book: money management, family,
  poker society, discipline, with hand puzzles and full-colour photography. Read it to decide
  whether you actually want this life. Its 3.59 rating is largely people who bought it expecting
  strategy. Recommend it honestly labelled and nobody is disappointed.
- **The Mathematics of Poker** (Chen & Ankenman, 2006) — the rigorous math track. Listed by
  Berkeley's poker org alongside Grinder's Manual and MPT. Only for the mathematically motivated;
  most players should skip it.

---

## 4. Outdated verdicts — plain language

| Book | Verdict | Still valuable | Obsolete |
|---|---|---|---|
| **Super System** (Brunson, 1979) | **Historical artifact.** Do not put in a curriculum. | Aggression as a concept; poker-thinking origins | Everything actionable. Famously advises AKo > AKs (solvers say the reverse, decisively). Limit section describes a single-blind structure no longer spread. |
| **Theory of Poker** (Sklansky, 1987) | **Read the vocabulary chapters only, if at all.** | Expected value, semi-bluffing, implied/reverse implied odds, the Fundamental Theorem as a framing device | NLHE-specific technique. Most examples are seven-card stud, five-card draw and razz. The game theory is rudimentary by modern standards. Big-bet poker has moved past it. |
| **Harrington on Hold'em** (2004–06) | **One section survives.** | The **stack-size/M** framework: knowing how many blind rounds you have left and how play changes as that shrinks. Basic ABC discipline vs. weak fields. | Preflop ranges, postflop lines, all frequencies. Written for a pre-solver, far softer field. Community rule of thumb: distrust any strategy book older than ~5 years except for its concepts. |
| **Kill Everyone** (2007/09) | **Mostly superseded.** | Bubble factors and fold-equity framing were genuinely ahead of their time and are ICM's ancestors. | The push/fold charts (now solver-generated and free), the exploits of "current trends" that no longer exist. Goodreads: "a great book in its day, seems old hat now." Replace with *Endgame Poker Strategy*. |
| **Applications of NLHE** (2013) | **Conceptually alive, numerically dead.** | Range-construction reasoning, bet/bluff-ratio derivation, the discipline of deriving rather than memorizing. | Its specific numbers. Predates accessible solvers. Where it conflicts with Janda 2017, trust 2017. |
| **Poker's 1%** (2014) | **Read for the reframe, discard the content.** | Frequency-based thinking as a mental operation; the range-construction *questions* to ask yourself. | The "smooth-sided pyramid" frequency model is, per Brokos, simply wrong about what equilibrium looks like. Examples are far off Pio solutions. |
| **The Course** (2015) | **Aging gracefully.** | Skills 4–10 and the entire stake-gated progression structure. | Preflop simplicity is pre-solver. Edge eroded because the advice worked and spread. |
| **Crushing the Microstakes** (2011) | **Content OK at its stakes, operations stale.** | Exploitative micros logic, mindset, patience. | HUD/tracking and table-selection advice (site policies changed); preflop ranges. |
| **The Grinder's Manual** (2016) | **Best-preserved big textbook.** | Whole reasoning architecture; hand-analysis method. | Single-size bet trees, tight-by-modern-standards preflop (esp. BB defense, BvB), no multiway. |
| **Modern Poker Theory** (2019) | **Half-obsolete by its own success.** | Ch. 1–2 GTO vocabulary; postflop theory; framework for reading solver output. | The ~300pp preflop chart mass (a solver subscription strictly dominates it); no three-way solutions, which GTO Wizard shipped in 2025. |
| **Play Optimal Poker 1 & 2** (2019/20) | **Not outdated and structurally can't be.** | All of it. Game theory is math. | Nothing. Weakness is scope, not currency. |
| **Mental Game of Poker 1 & 2** (2011/13) | **Not outdated.** | All of it. | Nothing. |
| **Elements of Poker** (2007) | **Split verdict.** | Mental/tilt/quitting/presence material — timeless. | Its strategy content: limit-flavoured, live-etiquette-heavy, weak on NLHE and tournaments. |
| **Ace on the River** (2005) | **Never was a strategy book.** | Professional-life realism. | N/A — mis-marketed, not outdated. |

---

## 5. Where books stop being the right tool — the honest answer

**Books are strictly better than video/solvers for exactly four things:**
1. Building a coherent mental model from scratch (a solver has no pedagogy).
2. Concepts that are conceptual rather than spot-specific: ICM, tilt, bankroll, variance, learning
   theory, exploitative frameworks.
3. Forced active engagement — as one commentator put it, books work "exactly because you can't zone
   out," unlike passively-watched video.
4. Cost. Total book spend for this entire curriculum is roughly $200–400 one-time.

**Books are strictly worse — and the gap is not close — for:**
1. **Preflop.** Fully solved, interactive, stack-depth-aware, free-to-cheap. A printed chart in a
   2019 book cannot compete with a queryable database. This alone deletes ~300 pages of MPT.
2. **Postflop precision.** Board texture × SPR × sizing tree is a combinatorial space no book can
   enumerate. GTO Wizard advertises 10M+ pre-solved scenarios.
3. **Multiway / three-way.** Essentially absent from every book listed. GTO Wizard added three-way
   solving in 2025 — capability the entire book canon lacks.
4. **Feedback on your own hands.** Hand-history analyzers, drills and node-locking have no book
   equivalent.

**The hard line — my actual opinion:** a books-only path is sufficient to become a **solid winner at
micro and small stakes** — call it NL2–NL50 online, $1-2 to $2-5 live, and the softer end of live
MTTs. Past that it becomes an active handicap, because your opponents are studying with tools that
answer questions your books cannot even pose. **The correct model is: books build the model, the
solver populates it, video explains the counterintuitive residue, and volume plus review converts
it into instinct.** Anyone selling a books-only path to mid-stakes is selling nostalgia.

The 2+2 view in the 2024 "reading material after a hiatus" thread is even blunter: embrace the
solver era, subscribe to GTO Wizard or buy a cheap solver like GTO+, and read *Play Optimal Poker
vol. 1* only if you don't yet understand game theory. Some posters recommend **no books at all** —
network with players and subscribe to Run It Once. That is a real, defensible position, and a study
app should not pretend it doesn't exist.

**GTO Wizard's own study advice** (worth internalizing, and it argues against passive consumption of
*any* medium): don't memorize solver output — figure out *why* the output looks that way. Study with
the book closed, not open — re-reading is far less effective than retrieval. Passively watching
training videos or staring at solver output is the least effective study mode there is. Prefer
narrow targets ("3-bet pots OOP as SB vs BTN on ace-high boards") over vague ones ("study 3-bet
pots"). Consistency beats intensity.

### Tool landscape, with prices as reported by the sources (verify before publishing — poker SaaS pricing moves constantly)

| Tool | Reported price | Best for | Notes |
|---|---|---|---|
| **GTO Wizard** | $26/mo (CardPlayer Lifestyle 2026); $99/mo Premium tier (other 2026 comparisons) | Intermediate→advanced, cash + MTT | 10M+ pre-solved spots; **three-way solving since 2025**; steeper learning curve. Free blog + free *Daily Dose of GTO* ebook. |
| **PioSolver** | ~€450 one-time | Advanced, custom sims | Desktop; needs i7+ / 16GB RAM. |
| **PeakGTO** | $59/mo (or bundled with PokerCoaching at $1,299/yr) | MTT, ICM | Pre-solved library plus curated drills. |
| **GTO Lab** | $74/mo | MTT/ICM specialists | 14,000+ preflop solutions; simplified postflop. |
| **Octopi Poker** | $16.67/mo | Beginners | "The Vault" database of real pro hands; interactive trainer. Gentlest on-ramp. |
| **PokerSnowie** | $16.66/mo | Solver beginners | AI opponent, cheapest entry. |
| **Run It Once** | $24.99/mo Essential (3,685 videos) / $99–199.99/mo Elite (9,500+ videos) | Cash games | Best content-per-dollar for cash video. |
| **PokerCoaching** | $999/yr Premium | Tournaments | Courses, quizzes, webinars, hand reviews (Jonathan Little). |
| **Upswing** | $99–999 per course; Lucid Poker $49/mo | Advanced | The Lab rebuilt 2024–25 around Uri Peleg with a sequenced "Mastery Path." |
| **Vision GTO Trainer** | $249.75/mo | PLO/PLO5 only | Galfond. Out of scope for NLHE. |

**Cheapest credible modern stack:** *Daily Dose of GTO* (free) + GTO Wizard's free blog + one
mid-tier solver subscription ≈ $16–26/mo + ~$150 of books.

---

## 6. Time and effort

**Estimating rule I used:** dense theory with worked problems ≈ **4–6 pages/hour** of genuine
active study (annotating, redoing the math, not skimming). Narrative/mental-game ≈ 25–30 pp/hr.
Workbooks are measured in problems, not pages. These are *active-study* hours, not reading hours;
a passive read is ~3× faster and worth roughly a quarter as much.

| Book | Pages | Active hours | Notes |
|---|---|---|---|
| Crushing the Microstakes | 253 | **8–12** | Easy prose |
| The Course | 306 | **20–25** | +10 hrs if you actually do the hand quizzes |
| Poker's 1% | 234 | **15–20** | Only if you skip Brokos |
| Elements of Poker | 268 | **6–8** | Read like essays |
| The Mental Game of Poker | ~250 | **10–14** | Plus ongoing exercise practice, indefinitely |
| The Mental Game of Poker 2 | 204 | **8–10** | Front half is the value |
| Poker Therapy | 207 | **7–9** | |
| Mastering Small Stakes NLHE | 480 | **30–40** | |
| Excelling at NLHE | ~493–635 | **25–35** | Skippable by chapter; anthology |
| **The Grinder's Manual** | 540 | **45–60** | The single biggest time commitment here |
| Play Optimal Poker | 245 | **25–35** | Deceptive: 245pp but you must *work* the toy games |
| Play Optimal Poker 2 | 245 | **25–35** | Same |
| GTO Poker Simplified | ~362 | **15–20** | Conclusions-first, faster |
| Beyond GTO | — | **12–18** | |
| The Exploitative Edge | — | **8–12** | Described as a short read |
| GTO Poker Gems 1 + 2 | short | **6–10** total | |
| Modern Poker Theory | 480 | **25–35 targeted** / 70–90 cover-to-cover | **Do not read cover to cover.** Ch. 1–2 + postflop only |
| Applications of NLHE | 510 | **50–70** | |
| NLHE for Advanced Players | 339 | **35–45** | |
| Secrets of Prof. Tournament Poker | — | **35–45** | |
| Endgame Poker Strategy (ICM) | — | **12–18** | |
| PKO Poker Strategy | 198 | **8–12** | |
| Poker Satellite Strategy | 224 | **8–12** | |
| The Complete Poker Workout | 392 (100 hands / 392 Qs) | **25–35** | ~15–20 min per hand done properly |
| Daily Dose of GTO | 300+ quizzes | **25–30** | By design: 5 min/day for a year |
| Ace on the River | 328 | **8–10** | Read it like a memoir |

### Sequencing at 5 hrs/week

Budget: **~22 hrs/month, ~130 hrs / 6 months, ~260 hrs / year, ~520 hrs / 2 years.**

Critical allocation rule: **at most 60% of study hours on books.** The rest goes to hand review,
drills and solver work, or the reading doesn't convert. The plans below reflect that.

**Months 1–6 (~130 hrs → ~78 book hrs)**
| Window | Work | Hrs |
|---|---|---|
| M1 | Crushing the Microstakes **or** The Course (pick by format) | 12–22 |
| M1–2 | The Mental Game of Poker (start early — it protects everything after) | 12 |
| M2–5 | The Grinder's Manual (cash) **or** Mastering Small Stakes NLHE (mixed) | 40–55 |
| M1–6 | Daily Dose of GTO, 5 min/day alongside everything | ~15 |
| M1–6 | Non-book: own-hand review 1.5 hrs/wk, free GTO Wizard blog | ~50 |
- *End state:* a complete, coherent, if slightly dated strategy. Should be beating micros.
- *Do NOT read in this window:* Modern Poker Theory, Janda, POP2. You'll bounce.

**Months 7–12 (~130 hrs → ~70 book hrs)**
| Window | Work | Hrs |
|---|---|---|
| M7–9 | Play Optimal Poker (work every problem) | 30 |
| M9–11 | Play Optimal Poker 2 | 30 |
| M11–12 | The Mental Game of Poker 2 (learning-process chapters especially) | 10 |
| M7–12 | **Start a solver/trainer subscription in month 7.** Non-negotiable inflection point | ~55 |
- *End state:* can interrogate a solver instead of copying it. This is the year's real deliverable.

**Year 2 — Months 13–24 (~260 hrs → ~140 book hrs), split by lane**

*Cash lane:*
| Window | Work | Hrs |
|---|---|---|
| M13–16 | NLHE for Advanced Players (Janda 2017) | 40 |
| M17–18 | Modern Poker Theory — targeted: ch. 1–2 + postflop half only | 30 |
| M19–20 | Beyond GTO **or** The Exploitative Edge | 15 |
| M21–22 | Exploitative Play in Live Poker (if live) / GTO Poker Gems 1+2 (if online) | 12 |
| M23–24 | Ace on the River + re-read MGP1 | 20 |
| all | Solver, drills, database review, coaching | ~120 |

*MTT lane:*
| Window | Work | Hrs |
|---|---|---|
| M13–15 | Secrets of Professional Tournament Poker (2021) | 40 |
| M16–17 | Endgame Poker Strategy (ICM) | 15 |
| M18 | PKO Poker Strategy (if you play bounties) | 10 |
| M19–21 | The Complete Poker Workout | 30 |
| M22 | Poker Satellite Strategy (if relevant) | 10 |
| M23–24 | Matros hand collections + MGP2 | 20 |
| all | ICM trainer, MTT solver work, final-table review | ~120 |

**What's deliberately *not* on the 24-month plan:** *Applications of NLHE* (50–70 hrs for content
mostly superseded by the 2017 book — only worth it if the student loves derivation), *Excelling at
NLHE* (breadth you'll already have), *Poker's 1%* (Brokos does the job better), *Kill Everyone*,
*Harrington*, *Super System*, *Theory of Poker*.

---

## 7. Table-of-contents data for the top 6

### 7.1 The Grinder's Manual — Peter Clarke (2016) ✅ VERIFIED, COMPLETE
**Source:** full-text scan, `https://archive.org/stream/TheGrindersManualACompletPeterClarke/The%20Grinder's%20Manual_%20A%20Complet%20-%20Peter%20Clarke_djvu.txt`
Complete two-level ToC — **the best chapter-tracking data available for any book in this report.**

1. Introduction — 1.1 About The Manual · 1.2 EV: The Currency of Poker · 1.3 The Bottom Up Learning Model · 1.4 The Other Two Aspects of Poker Success
2. Opening the Pot — 2.1 The 6 Handed Table · 2.2 Rating Starting Hands · 2.3 UTG · 2.4 HJ · 2.5 CO · 2.6 BU · 2.7 SB
3. When Someone Limps — 3.1 The ISO Triangle · 3.2 Frequent Strength · 3.3 Fold Equity · 3.4 Position · 3.5 Limping Behind · 3.6 Sizing An ISO · 3.7 Example Hands
4. C-Betting — 4.1 Light C-Bet Factors · 4.2 C-Bet Sizing · 4.3 More C-Bet Spots
5. Value Betting — 5.1 Introducing the Value Bet · 5.2 Relative Hand Strength · 5.3 Building the Pot · 5.4 Slowplaying · 5.5 Thick and Thin Value · 5.6 Sizing and Elasticity
6. Calling Opens — 6.1 Reasons to Call an Open · 6.2 Cold Calling In Position · 6.3 Calling Out of Position · 6.4 Calling Blind vs Blind
7. Facing Bets — End of Action Spots — 7.1 The Two-Part Thought Process · 7.2 Stats and Examples
8. Facing Bets — Open Action Spots — 8.1 Defending the Flop with Made-Hands · 8.2 Defending the Flop with Non-Made-Hands · 8.3 Defending the Turn · 8.4 Dealing with Donk Bets
9. Combos and Blockers — 9.1 Using Combos Pre-Flop · 9.2 Using Combos Post-Flop · 9.3 Blockers
10. 3-Betting — 10.1 Polar 3-Betting · 10.2 Linear 3-Betting · 10.3 Practical Examples · 10.4 Squeezing · 10.5 3-Bet Sizing
11. Facing 3-Bets — 11.1 Flatting 3-Bets · 11.2 Complete Defence Ranges · 11.3 Preemptive Adjustments · 11.4 Example Hands · 11.5 Facing Squeezes · 11.6 Facing a 3-Bet Cold
12. Bluffing the Turn and River — 12.1 Double Barrel Bluffing · 12.2 Triple Barrel Bluffing · 12.3 Delaying The C-Bet · 12.4 Probing The Turn · 12.5 Bluff Raising the Turn and River
13. 3-Bet Pots And Balance — 13.1 C-Betting 3-Bet Pots · 13.2 3-Bet Pots As The Aggressor · 13.3 Strategy As the Defender
14. Stack Depth — 14.1 Playing Deep Pre-Flop · 14.2 Playing Shallow Pre-Flop · 14.3 Playing Deep Post-Flop · 14.4 Dealing with Donk Bets
15. Appendices — App. 1 More About The Author · App. 2 Jargon Handbook (Glossary) · App. 3 List Of Figures

> ⚠️ Note the duplicated "Dealing with Donk Bets" at 8.4 and 14.4. That appears in the scan itself;
> it may be an OCR/scan artifact. Verify against a physical copy before shipping as app data.

### 7.2 The Course — Ed Miller (2015) ✅ VERIFIED, COMPLETE
**Source:** search-surfaced ToC corroborated across `dokumen.pub` and PDF copies; structure also
matches the Goodreads description and the PokerNews review.

- Introduction
- **Part I: The 30,000 Foot View** — The Many Forms of No-Limit Hold'em · Where Does The Money Come From?
- **Part II: Beating Live 1-2 Games** — Skill #1 Play A Simple And Effective Pre-Flop Strategy · Skill #2 Don't Pay People Off · Skill #3 Assess Your Hand Value · 1-2 Hand Quizzes
- **Part III: Beating Live 2-5 Games** — Skill #4 Barreling · Skill #5 Evaluating Board Texture · Skill #6 Making Live Reads · Skill #7 Emotional Numbing · 2-5 Hand Quizzes
- **Part IV: Beating Live 5-10 Games** — Skill #8 Exploiting Aggression · Skill #9 Playing Deep · Skill #10 Taking On The Pros

> **This is the single best structural template for a study app**: explicit skill numbering,
> stake-gated parts, and built-in quiz checkpoints per part.

### 7.3 Play Optimal Poker — Andrew Brokos (2019) ✅ VERIFIED (chapter level)
**Source:** search-surfaced chapter list corroborated by the PokerNews review and 2+2 thread titles
referencing specific chapters (e.g. "Play Optimal Poker – Clairvoyance Game").

- Introduction (Why You Need Game Theory · The Game Theory Approach · How to Use This Book)
- Ch. 1 Understanding Equilibrium
- Ch. 2 Polarized Versus Condensed Ranges *(contains the Clairvoyance / AKQ Game)*
- Ch. 3 Reciprocal Ranges
- Ch. 4 Get Real!
- Ch. 5 Crafting Exploitative Strategies
- Ch. 6 Complex Ranges
- Ch. 7 Raising
- Ch. 8 Putting It All Together
- Ch. 9 Summary of Exploits
- Ch. 10 Conclusion

### 7.4 Play Optimal Poker 2: Range Construction — Andrew Brokos (2020) ✅ VERIFIED (chapter level)
**Source:** same search-surfaced listing; consistent with the publisher description.

- Ch. 1 Leverage
- Ch. 2 Protection And Semi-Bluffing
- Ch. 3 Range Construction
- Ch. 4 Using Leverage
- Ch. 5 Shallow Stacks
- Ch. 6 Continuation Betting Without Range Advantage
- Ch. 7 Continuation Betting With Range Advantage
- Ch. 8 Barreling The Turn
- Ch. 9 Attacking a Missed Continuation Bet
- Ch. 10 Continuation Betting From Out of Position
- Ch. 11 Adapting to Tournament Play
*(also contains The Two-Street Clairvoyance Game)*

### 7.5 Modern Poker Theory — Michael Acevedo (2019) ⚠️ PARTIAL — DO NOT SHIP AS COMPLETE
**Source:** Google Books contents index, `https://books.google.fr/books/about/Modern_Poker_Theory.html?id=fQ6oDwAAQBAJ`
Google's index returned only 10 entries with page numbers. Given the book is 480pp and the entries
jump from p.264 to p.350, **this is clearly an incomplete index, not the real ToC.** The listed
final entry (p.490) also exceeds the stated 480-page count, which suggests either a different
edition's pagination or an indexing error — another reason not to trust it as-is.

Entries returned (with Google's page numbers):
- The Elements of Game Theory — p.48
- Modern Poker Software — p.68
- The Theory of Tournament Play — p.84
- Playing First — p.88
- Defense — p.138
- Playing Versus 3bets — p.264
- The Theory of Flop Play — p.350
- The Flop Continuation-bet — p.380
- GTO Turn Strategies — p.461
- GTO River Strategies — p.490

Independent corroboration of *shape* (not chapter names) from the PokerExplore review: the book is
in three movements — (1) GTO fundamental theory (MDF, alpha, range advantage), (2) preflop ranges
with complete position-vs-position strategies, (3) postflop decision trees by board texture, SPR and
position. That is consistent with the index above.
**Action required:** get the real ToC from a physical copy or the D&B "look inside." Note also that
a widely-circulated 7-chapter "table of contents" for MPT appears on AI book-summary sites
(bookey.app and similar) — **it is a generated summary, not the book's actual ToC. Do not use it.**

### 7.6 Secrets of Professional Tournament Poker: The Essential Guide — Jonathan Little (2021) ⚠️ PARTIAL
**Source:** publisher/retail descriptions. Confirmed to be **seven sections**; only the first two
are named in any source I could reach:
1. How Tournaments Work
2. Playing Deep Stacked (50bb+)
3.–7. `[UNVERIFIED]`
**Action required:** verify from Simon & Schuster's or D&B's look-inside.

### 7.7 Also worth capturing for an app (structure known, ToC not verified)
- **The Complete Poker Workout** (Little, 2025) — **100 hands / 392 questions, grouped by stack
  size.** This is already a perfect progress-tracking schema (hand → questions → stack-size bucket)
  and doesn't need a chapter ToC at all.
- **Daily Dose of GTO** — 300+ quizzes designed as 5-minute daily units. Same observation.
- **The Mental Game of Poker** — Ch. 1 is "Introduction" with sub-sections (Golf Sets the Stage,
  Enter Poker, Client's Story: Dusty 'Leatherass' Schmidt, I'm Not a Poker Player, The Problem with
  Conventional Poker Psychology, Mental Game Fish, Mental Game Strategy, Mental Game Myths, How to
  Use this Book). Chapters 1–4 build the model; later chapters address specific issues (tilt types,
  fear, motivation, confidence). **Full chapter list unverified.**

---

## 8. Things I could not verify — do not ship these as fact

1. **Reddit consensus, entirely.** reddit.com is blocked to this agent. Every "community" claim here
   comes from Goodreads reviews, CardsChat, 2+2 search summaries, and aggregator articles.
2. **2+2 post text.** 403 on direct fetch; only search-engine summaries obtained.
3. **Modern Poker Theory's real ToC** (see §7.5) and **Secrets of Professional Tournament Poker's
   sections 3–7** (§7.6).
4. **Page counts:** Positive Poker, Endgame Poker Strategy, Beyond GTO, The Exploitative Edge,
   GTO Poker Gems 1 & 2, Secrets of Professional Tournament Poker, MPT Tournament Workbook,
   The Mental Game of Poker vol. 1.
5. **Publication years with conflicting listings:** *Endgame Poker Strategy* (2021 vs 2022 across
   retailers); *MPT – The Tournament Workbook* (2024 vs 2025); *GTO Poker Simplified* has two ISBNs
   (9781513699134 and 9781399942959) suggesting a re-issue — **check which edition you're citing.**
6. **BlackRain79's own site lists Crushing the Microstakes as "2026, 254 pages."** Goodreads says
   first published **26 Nov 2011, 253 pages**. Most likely a refreshed/re-issued edition or a site
   metadata artifact. **Treat 2011 as the original publication year and flag the discrepancy** — if
   there is genuinely a 2026 revised edition, that materially changes the "outdated" verdict and is
   worth a direct check with the publisher.
7. **All tool pricing.** CardPlayer Lifestyle's 2026 solver comparison gives GTO Wizard at $26/mo
   while other 2026 comparisons cite $99/mo Premium — these are almost certainly different tiers,
   but I could not reconcile them. Verify on-site before displaying prices to users.
8. **Excelling at NLHE page count:** 493 (retail listings) vs 635 (Goodreads). Different editions.

---

## 9. Implications for the study app (unsolicited, but load-bearing)

- **Chapter-level tracking is only cleanly possible for a minority of these books.** Grinder's
  Manual and The Course have clean, verified, hierarchical structures. Brokos 1 & 2 have clean
  chapter lists. MPT does not have a reliably obtainable ToC. Design for **graceful degradation**:
  book → (optional part) → (optional chapter) → user-defined section.
- **The Course's "Skill #N, gated by stake" model is the best available template** for the app's own
  progression UI. Steal it.
- **Model workbooks as a first-class type, not as books.** *The Complete Poker Workout* (100 hands /
  392 questions / stack-size buckets) and *Daily Dose of GTO* (300+ five-minute quizzes) are
  *already* structured as spaced-repetition content. Treating them as "books with chapters" throws
  away their best property. This is also where the market is heading (§1.4).
- **Ship an "outdated content" flag at the section level, not the book level.** The whole point of
  §4 is that MPT's preflop half is dead while its postflop half is excellent, and that Elements of
  Poker is timeless on tilt and useless on strategy. A book-level "outdated: yes/no" boolean would
  give users actively wrong guidance.
- **Enforce the 60/40 book/non-book budget in the planner.** If the app only tracks reading, it will
  produce well-read losing players. Track solver hours and hand-review hours as first-class study.

---

## 10. Source URLs

**Publisher / retail**
- https://dandbpoker.com/products/modern-poker-theory
- https://dandbpoker.com/products/mastering-small-stakes-no-limit-holdem
- https://dandbpoker.com/collections/new-titles
- https://dandbpoker.com/blogs/news/top-strategy-book-of-2026
- https://www.simonandschuster.com/books/Modern-Poker-Theory-The-Tournament-Workbook/Michael-Acevedo/9781912862290
- https://www.simonandschuster.com/books/Secrets-of-Professional-Tournament-Poker/Jonathan-Little/9781912862245
- https://www.simonandschuster.com/books/The-Complete-Poker-Workout/Jonathan-Little/9781912862436
- https://books.google.fr/books/about/Modern_Poker_Theory.html?id=fQ6oDwAAQBAJ
- https://www.blackrain79.com/p/crushing-microstakes.html
- https://www.thinkingpoker.net/play-optimal-poker/
- https://redchippoker.com/the-exploitative-edge
- https://www.dailydoseofgto.com/
- https://www.splitsuit.com/important-poker-books

**Goodreads (metadata + reader criticism)**
- https://www.goodreads.com/book/show/30314253-the-grinder-s-manual
- https://www.goodreads.com/book/show/46130288-play-optimal-poker
- https://www.goodreads.com/book/show/53485278-play-optimal-poker-2
- https://www.goodreads.com/book/show/51076359-modern-poker-theory
- https://www.goodreads.com/book/show/17897406-applications-of-no-limit-hold-em
- https://www.goodreads.com/en/book/show/35279160-no-limit-hold-em-for-advanced-players
- https://www.goodreads.com/book/show/11397703-the-mental-game-of-poker
- https://www.goodreads.com/en/book/show/17851617 (Mental Game 2)
- https://www.goodreads.com/en/book/show/25459302-the-course
- https://www.goodreads.com/en/book/show/21802212 (Poker's 1%)
- https://www.goodreads.com/book/show/16148819-crushing-the-microstakes
- https://www.goodreads.com/book/show/33509876-mastering-small-stakes-no-limit-hold-em
- https://www.goodreads.com/book/show/25805131-jonathan-little-s-excelling-at-no-limit-hold-em
- https://www.goodreads.com/book/show/551136 (Ace on the River)
- https://www.goodreads.com/en/book/show/1856805.Kill_Everyone
- https://www.goodreads.com/book/show/2416855.Elements_of_Poker
- https://www.goodreads.com/en/book/show/49210084-poker-therapy
- https://www.goodreads.com/book/show/205764755 (Beyond GTO)

**Reviews / community**
- https://pokerexplore.com/en/books/reviews/modern-poker-theory/
- https://cardplayerlifestyle.com/book-review-modern-poker-theory/
- https://cardplayerlifestyle.com/poker/best-poker-books-2025/
- https://cardplayerlifestyle.com/poker/best-poker-books-2024/
- https://cardplayerlifestyle.com/poker-tips-strategy/compare-top-poker-solvers-2026/
- https://cardplayerlifestyle.com/poker-books/poker-book-review-exploitative-play-in-live-poker/
- https://www.pokernews.com/news/2019/06/pokernews-book-review-play-optimal-poker-by-andrew-brokos-34596.htm
- https://www.pokernews.com/news/2015/06/pokernews-book-review-ed-millers-the-course-21913.htm
- https://www.pokernews.com/news/2015/06/pokernews-book-review-jonathan-little-s-excelling-at-no-limi-21842.htm
- https://www.pokernews.com/news/2026/01/jonathan-little-the-complete-poker-workout-review-50412.htm
- https://www.pokernews.com/strategy/gtowizard-daily-dose-of-gto-ebook-46503.htm
- https://www.thinkingpoker.net/2015/03/mini-review-applications-of-no-limit-hold-em/
- https://www.thinkingpoker.net/poker-book-reviews/kill-everyone-poker/
- https://www.thinkingpoker.net/poker-book-reviews/elements-of-poker/
- https://www.casino.us/cardschat/learning-poker-57/what-books-currently-applicable-todays-poker-526097/
- https://forumserver.twoplustwo.com/15/poker-theory-amp-gto/poker-2024-reading-material-after-hiatus-1840015/ *(403 — summary only)*
- https://forumserver.twoplustwo.com/33/books-publications/review-peter-carroters-clarke-grinders-manual-1602843/ *(403 — summary only)*
- https://poker.academy/blog/post/doyle-brunsons-super-system-1979-vs-modern-poker-strategy-2025
- https://poker.studentorg.berkeley.edu/resources.html
- https://www.poker.org/latest-news/okearney-and-carter-release-endgame-poker-strategy-the-icm-book-an0kC6x0Ad8d/
- https://www.vegasslotsonline.com/news/2024/01/24/dara-okearney-the-new-poker-book-that-goes-beyond-gto/

**Study-method / tools**
- https://blog.gtowizard.com/how-to-become-a-winning-poker-player-in-2025-part-2/
- https://blog.gtowizard.com/how-to-study-gto-solutions/
- https://blog.gtowizard.com/the-science-of-learning-applied-to-gto-wizard/
- https://blog.gtowizard.com/kick-off-2025-with-new-cash-and-icm-solutions/
- https://www.deucescracked.com/poker/best-poker-training-sites
- https://elitepokerguide.io/best-poker-training-sites-2026-the-complete-independent-review/

**Primary text**
- https://archive.org/stream/TheGrindersManualACompletPeterClarke/The%20Grinder's%20Manual_%20A%20Complet%20-%20Peter%20Clarke_djvu.txt
