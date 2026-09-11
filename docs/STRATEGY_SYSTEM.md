# Strategy System

## Identity

Poker is a personal learning platform, not a generic chart viewer. A strategy
is a complete, source-backed system for playing a defined game format. It owns
the teaching sequence, playbook, drills, hand filters, metrics and grading
rules. It does **not** own a second copy of the player's hand histories.

The product rule is simple: teach one decision until it is demonstrably known,
then add the next one. A learner never receives a new lesson because a calendar
changed; it unlocks after mastery evidence satisfies the lesson map.

## Learning Loop

Each lesson contains four distinct things:

1. A concise rewrite for the learner, with its source pages attached.
2. Original excerpts, figures, charts or graphs when they materially carry the
   meaning. A graph is never replaced with a text-only summary.
3. One or more mastery checks: recall, scored quiz, accuracy drill or timed
   drill.
4. Playbook takeaways, revealed only after the lesson is mastered.

The daily experience promotes one available lesson, then mixes due material
from older lessons and recent hand mistakes. New content is therefore bounded;
review grows through spaced repetition rather than by rereading whole books.

The first release of a strategy may not grade a rule until the hand parser can
observe every fact that rule needs. In that case it can teach and drill the
rule, but hand review must say it is not yet verifiable.

## Source Fidelity

Strategy source material stays private to the user. A strategy manifest lists
stable source IDs such as `main-book`; a per-user binding connects that ID to a
private uploaded reader book. Lesson assets and playbook entries cite source
pages by source ID.

Rewrites are allowed because they reduce unnecessary reading and remove dated
or irrelevant material. They must keep the cited source visible and must not
silently create strategy rules. When the source contains a graph, chart or
table, the learning asset must reference the actual source page and preserve it
beside the explanation.

## Layout

```
Home
  Strategy catalog
    Strategy dashboard
      Setup       required hardware, account and source checks
      Learn       mastery-gated lesson map and lesson reader
      Drill       strategy-specific drill formats and due review
      Playbook    only mastered table-use takeaways
      Hands       automatically assigned hands, metrics and evidence
```

The current Hands, Drill and Library pages remain as the legacy workspace until
the first complete strategy is installed. They are not deleted during the
transition.

## Strategy Definition

A learner-facing strategy must define all of the following in code:

- Identity: stable ID, name, tagline, visual direction.
- Sources: books, notes or other material, with source IDs.
- Setup: required and optional checks before lesson one can open.
- Lessons: prerequisite graph, source-backed assets, mastery requirements and
  playbook entries.
- Drills: interaction family and exact content source.
- Tracking: versioned automatic hand filter and dashboard metrics.
- Grading: only deterministic, source-supported rules; every uncertain case
  returns no verdict rather than a fabricated mistake.

`validateLearningSystem()` rejects duplicate IDs, missing sources, unknown
drills, unknown prerequisites and circular dependencies at registration time.

## Data Model

`played_hand` remains canonical. `strategy_hand_assignment` maps a hand to one
or more strategies together with the filter version and assignment source. A
revised filter creates a new interpretation; it does not rewrite the imported
hand.

`strategy_setup_check` stores completed setup items.
`strategy_lesson_progress` stores start and mastery milestones.
`strategy_mastery_attempt` is append-only evidence for drills, quizzes and
recall. Locked and available status is derived from the strategy's lesson graph
and that evidence, never stored as a stale flag.

`strategy_source_binding` links a source in a strategy manifest to the user's
private reader book.

All four tables are created by `supabase/migrations/0009_strategies.sql` and
have user-owned RLS policies.

## Automatic Hand Import

The website cannot observe a local PokerStars folder continuously. Automatic
import is therefore a later Windows companion application. It will:

1. Watch only the user's configured hand-history folder.
2. Pause whenever PokerStars is running.
3. Resume after it closes, parse only the user's own histories, and sync them.
4. Apply each strategy's versioned automatic filter.

It must never screen scrape, inspect memory, add a table overlay, or collect
opponent data outside the user's own saved histories.

## Adding a Strategy

1. Collect source material, target format, stake, hardware requirements and
   desired outcome.
2. Make a source map: identify every rule, graph, chart and contradiction.
3. Decide which rules are teachable, drillable, mechanically gradeable, or
   intentionally ungraded.
4. Define the setup checklist and automatic hand filter before writing lessons.
5. Build the prerequisite map. Each lesson gets source-backed reading,
   takeaways and mastery evidence.
6. Build drills and hand verdicts from the same rule source; never maintain a
   second unlinked version of the rules.
7. Test source mapping, lesson unlocks, filter boundaries and representative
   hand histories before registering the strategy in the catalog.

## Current State

The generic contracts, learning-map evaluator, hand-filter evaluator, strategy
catalog, dashboard routes and Supabase schema now exist. No strategy is
registered in the learner-facing catalog yet. The current BlackRain material is
deliberately left as draft source material until it is rebuilt against this
system.
