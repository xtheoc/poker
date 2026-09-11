# Crushing the Microstakes: NL2 6-Max Strategy Audit

## Scope

This is the source audit for the first strategy in the app: Nathan Williams
(BlackRain79), *Crushing the Microstakes*, applied to regular NL2 six-max cash
games. It is not a claim that one fixed strategy is universally optimal. It is
a deliberately simple, exploitative starting system which the learner can
execute, review, and refine against their own data.

The book is copyrighted source material. Lessons may paraphrase it, point to
the user's private copy by printed page, and show a referenced figure from
that copy. They must not reproduce the book wholesale.

## Evidence Ledger

| Status | Meaning | Treatment in the app |
| --- | --- | --- |
| Durable | Game logic that does not depend on the pool | Teach and drill as a rule. |
| Author-revised | The book itself later corrects an earlier recommendation | Use the correction, retain the history in a source note. |
| Current author guidance | The author continues to position this approach for NL2/NL5 in 2026 | Teach as the first strategy, while identifying the original page it came from. |
| Pool-dependent | A claim about what opponents currently do | Teach as an adjustment, never as a guaranteed fact. Validate from the user's own hands later. |
| Deferred | A decision the current history parser cannot reliably reconstruct | Teach and drill now; do not score it as a hand-history mistake yet. |

## What Survives Intact

- Position and initiative determine the baseline plan. Opening tighter early
  and wider in late position is a durable structural rule. Book pp. 61, 65-75.
- The default preflop response to an open is usually three-bet or fold; calls
  need a reason: set mining with sufficient stack depth, a strong but
  non-three-bet hand versus a tight early open, or position plus a recreational
  player. Book pp. 91-97.
- Plan the later streets on the flop instead of calling to "see what happens."
  Book pp. 130-131.
- Bet strong value hands against opponents who call too widely; do not attempt
  to bluff players who do not fold. Book pp. 139-151, 168-180, 195.
- A HUD number requires a sample. The book uses roughly 20 hands for overall
  VPIP/PFR and 100 hands for broader postflop tendencies. Book pp. 28-34,
  101, 153, 164, 193.

## Author Revisions That Override the Original Text

1. **Early-position small pairs:** the original EP limp of 22-66 was later
   revised by the author. For NL2, open them; for NL5 and above, fold them.
   Book p. 70, 2015 note. The first strategy is NL2, so its opening range must
   raise them, not limp them.
2. **Premium over-raises:** the original 5x-8x premium opening ladder was
   explicitly withdrawn for ordinary NL2 games. Use the normal 4bb early/
   middle and 3bb late opening scheme unless a documented table-specific
   exploit warrants an exception. Book p. 77, 2015 note.

## 2026 Context

The author still markets *Crushing the Microstakes* specifically for NL2/NL4/
NL5 six-max, Zoom and full-ring players, and separately positions his more
advanced material at NL10+. That supports using this as the beginner system,
not extrapolating it into a general modern solver course. [Author book page]
(https://www.blackrain79.com/p/crushing-microstakes.html) and [author's 2026
NL2 course description](https://www.blackrain79.com/p/videos.html?m=1).

The current author also explicitly describes six-max as requiring wider blind
defence and more light three-bets than full ring, particularly against late
opens. That is an important warning against treating the book's historical,
very-tight blind model as a permanent truth. It becomes a later, labelled
upgrade lesson after the conservative baseline is mastered. [BlackRain79's
2026 six-max guide](https://www.blackrain79.com/2024/11/full-ring-6max.html).

Modern solver material confirms that sizing is conditional on the actual tree,
not a universal percentage: different flop sizes can be close in value in some
spots and distinct in others. The app will therefore teach Williams' simple
exploitative sizes as the selected strategy, not label them theoretically
optimal. [GTO Wizard on dynamic sizing](https://blog.gtowizard.com/introducing_dynamic_sizing_2/).

There is no reliable public source for today's exact PokerStars NL2 population
frequencies. Claims such as "they never bluff raises" remain opponent and
sample dependent. They must be taught as low-stakes defaults that can be
overridden by evidence, rather than recorded as absolute grading rules.

## Compliance Boundary

PokerStars permits some study tools but prohibits more-than-basic reference
material while its software is running. This product must remain a post-session
study tool and its future local importer must pause while PokerStars is open.
Do not show postflop recommendations, opponent-specific ranges, or a live
decision assistant during play. [PokerStars third-party tools policy]
(https://www.pokerstars.com/poker/room/prohibited/) and [card-room rules]
(https://www.pokerstars.com/poker/card-rules/).

## Strategy Contract

### Game filter

- Cash NLHE only.
- Six-max, regular tables.
- NL2, big blind 0.02 or lower, pending a configurable currency/site mapping.
- Exclude fast-fold, tournament, ante and short-handed sessions from automatic
  assignment until their own variants exist.
- Use 100bb as the standard lesson model. Stack-depth exceptions must be
  visible in the prompt.

### Minimal live HUD

| Stat | Minimum sample | Why it is retained |
| --- | ---: | --- |
| Hands | Always | Tells the learner whether other numbers can be used. |
| VPIP | 20 | Primary loose/tight signal. |
| PFR | 20 | Primary passive/aggressive signal. |
| Fold to flop c-bet | 100 | Distinguishes fold-prone from sticky opponents. |
| Aggression factor | 100 | Helps frame river bluff-catching defaults. |

No other HUD stat belongs in the first live layout. Extra statistics can live
in the detailed popup and become drills only after their sample requirements
are met.

### Initial preflop baseline

- Open 4bb from early and middle position, 3bb from cutoff/button; add 1bb per
  limper.
- From the blinds versus limpers, add a further 1bb per limper; the small-blind
  limp into the big blind is a 4bb iso-raise spot.
- Three-bet 3x in position and 4x out of position. At 50bb or less, use a
  smaller non-all-in size only where it preserves a meaningful decision;
  otherwise use the strategy's shove-or-fold branch.
- Use the source chart and its page references as the authoritative hand set.
  A chart must display whether a hand is a raise, limp/call, or fold. It may
  never silently treat a source omission as a raise.

### Preflop facing action baseline

- Value three-bet AA, KK, QQ and AK. The optional light three-bet is a later
  conditional drill: position plus sufficient sample plus high fold evidence.
- Calling an open must name one of the three permitted reasons. The system
  drills the reason, not just a hand list.
- At 100bb, the book's default response to a normal three-bet is a narrow
  continue range; its four-bet language is source-specific and must be taught
  as an explicit action tree rather than inferred from an opening chart.
- Facing a four-bet is a separate decision. It cannot be graded from the
  app's current first-decision hand parser yet.

### Postflop baseline

- Start each hand with a flop plan: intended value streets, cards that change
  the plan, and the point at which the hand is abandoned.
- C-bet size is a decision: 50-55% on highly favourable dry high-card boards
  when missed; 60% as the ordinary small pressure size; 75% for strong hands
  versus sticky regulars; 100%+ only for value against players who call too
  widely. Book pp. 139-151.
- Multiway, wet-board, out-of-position air, and low-fold opponents are
  explicit check candidates. A "no piece" means no made hand and no meaningful
  draw, not merely a missed pair.
- The default against meaningful late-street aggression is to give credit,
  but this is a pool-dependent default. The learner must be shown the opponent
  evidence and board texture before a drill calls a fold mandatory.

## Learning Map

| Order | Lesson | Mastery evidence | What becomes live |
| ---: | --- | --- | --- |
| 1 | Table and HUD | Player-type classification: 20 correct in a row | Five-stat HUD and type card. |
| 2 | Ranges and position | Range-grid perfect, one position at a time | Open/fold/limp baseline charts. |
| 3 | Opening and iso sizing | Sizing drill at 90%+ | Sizing playbook. |
| 4 | Facing an open | Decision drill at 90%+ | Call-reason and three-bet branches. |
| 5 | Facing a three-bet / four-bet | Action-tree drill at 90%+ | Three-bet response card. |
| 6 | Flop plans | Board/type/position classification at 85%+ | C-bet and check card. |
| 7 | C-bet response | Raised/called/led-into drill at 85%+ | Response card. |
| 8 | Turn discipline | Action-plan drill at 85%+ | Turn card. |
| 9 | River extraction | Value/call/fold drill at 85%+ | River card. |
| 10 | Review and adaptation | Explain three of the user's own hands | Full playbook and adjustment log. |

Each lesson contains: a concise rewrite, source-page links, only the relevant
figures, a worked example, a recall prompt, and the drill that proves it. A
lesson never unlocks solely because it was opened.

## Implementation Sequence

1. Replace the unregistered CTM draft with a validated `StrategyLearningSystem`
   manifest. This makes the strategy appear in the home catalog without
   changing existing global drills.
2. Implement preflop action-tree content and drill data for open, limped,
   facing-open, facing-three-bet and facing-four-bet situations. Keep the
   existing range grid only for the open/limp branch.
3. Add source references and citations to every drill correction. A wrong
   answer should say the action, its reason, and the relevant book page.
4. Extend the hand-history decision extractor one decision at a time: preflop
   opener, then facing open, then facing three-bet/four-bet. Do not pretend
   postflop grading exists until board/action reconstruction and an explicit
   rubric exist.
5. Add a strategy dashboard that reports only unambiguous KPIs first: hands,
   net big blinds, VPIP, PFR, and graded-preflop accuracy.
6. Add postflop drills before postflop automated review. Teaching the plan is
   safe; declaring a complex river mistake from incomplete hand metadata is
   not.
7. Build the local watcher after the learning loop works. It must import only
   when PokerStars is closed, apply the versioned strategy filter, and leave
   every hand reusable by future strategies.

## Known Limits at the Start

- The strategy assignment tables require migration `0009_strategies.sql`.
- The current parser grades only selected preflop nodes. It cannot yet grade
  most three-bet, four-bet, sizing, or postflop decisions.
- The strategy owns a distinct `ctm-nl2-4-3` chart identity: 4bb early/middle,
  3bb cutoff/button, and the author's revised early-pair action. Legacy drill
  history stays on its old chart identity rather than being silently redefined.
- The user's supplied personal notes are useful requirements, not independent
  evidence. Where a note and source differ, the app must identify the source
  choice or label the note as a user override.
