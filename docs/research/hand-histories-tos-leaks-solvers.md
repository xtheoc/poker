# Poker Study Platform — Hand History Research Report

Research date: 2026-09-01. Research-only; no code written.

> **Note on file location:** I was asked to write to
> `...\scratchpad\research-handhistory.md`, but this session is in plan mode,
> which permits editing only this plan file. Report is here instead.

---

## 1. PokerStars hand history format & local files

### 1.1 Where the files live (Windows)

**Modern (correct) path — verified by three independent third-party sources:**

```
C:\Users\<WindowsLogin>\AppData\Local\PokerStars\HandHistory\<PokerStarsScreenName>\
```

i.e. `%LOCALAPPDATA%\PokerStars\HandHistory\<ScreenName>\`. PokerStars creates a
subfolder named after the **PokerStars screen name**, not the Windows user.
Tournament summaries go to a sibling `TournamentSummary` folder.

Sources: [Holdem Manager KB — PokerStars setup](https://kb.holdemmanager.com/knowledge-base/article/pokerstars),
[SitNGo Wizard](https://sngwiz.com/wp/question/where-are-my-pokerstars-hand-histories/).

**⚠️ Conflict flagged:** PokerStars' own help article still states the default is
`C:\Program Files\PokerStars\HandHistory\`
([source](https://www.pokerstars.fr/en/help/articles/save-hand-histories/)). This is
**stale documentation** — Program Files is write-protected on modern Windows and
PokerStars' own troubleshooting article tells users to move the folder out of
Program Files if saving fails
([source](https://www.pokerstars.fr/help/articles/win-hh-not-saving-initial/)).
**Do not hardcode either path.** Both HM3 and PT4 ship an "Auto Detect", and
PokerStars shows the live path under **Settings → Playing History → Hand History →
"Where To Save"**. Design the importer as a folder-picker with a best-guess default.

**Regional clients:** *Unverified.* PokerStars ships separate installs per
jurisdiction (PokerStars.EU, PokerStarsFR, PokerStarsES, PokerStarsIT, PokerStars
MI/NJ/PA). It is highly likely each writes to its own `%LOCALAPPDATA%\<ClientName>\
HandHistory\` tree, but I could **not** find an authoritative source enumerating
these paths. Neither the PT4 nor HM3 configuration guides mention regional folders.
Treat as an open question; the folder-picker approach sidesteps it.

### 1.2 Enabling "Save My Hand History"

Verified menu path (PokerStars.com desktop client, confirmed by PokerStars help +
PT4 + HM3):

1. Main lobby → **Settings** → **Playing History** → **Hand History**
2. Check **Save My Hand History**
3. Check **Save in English** — *critical*; non-English HHs break every parser
4. Note the folder under **Where To Save** (or **Change Folder**)
5. **Apply Changes**

Tournament summaries: **Settings → Playing History → Tournament Summaries** →
check **Save My Tournament Summaries** + **Save in English**.

Also worth setting: **Options → Global → Language → Play in: English**.

Sources: [PokerTracker 4 PokerStars configuration guide](https://docs.pokertracker.com/pt4/site-configuration/pokerstars-configuration-guide/),
[Holdem Manager KB](https://kb.holdemmanager.com/knowledge-base/article/pokerstars).

**Two gotchas for onboarding UX:**
- **Not retroactive.** Only hands played *after* enabling are saved.
- **Retention setting.** The client has a "how long to keep files" option that can
  silently delete old HHs.

### 1.3 Retroactive retrieval (email request)

**Tools → History & Stats → Get Hand History**. Options: last X hands, all hands
from past X hours/days, a specific hand number, or a specific tournament number.
Language must be set to English. Results arrive **by email**, as a text blob
beginning with `# 1`, not as files — so a paste-a-blob import path is worth
building alongside folder import.
Sources: [Poker Copilot](https://pokercopilot.com/userguide/7/en/topic/how-to-request-and-save-hand-history-files-from-pokerstars),
[SharkScope](https://www.sharkscope.com/SharkScope/Desktop-Manual/1/en/topic/how-to-request-recent-hand-history-files-from-pokerstars).

### 1.4 Recent changes (2022–2026) — this matters a lot

| Date | Change | Impact |
|---|---|---|
| Jul 2022 | Bug: `*** HOLE CARDS ***` emitted with **no `Dealt to` line** | Parser must tolerate a missing hero-cards line. Reported as a PokerStars bug; workaround was re-requesting hands by email. [source](https://forums.holdemmanager.com/showthread.php?t=544841&p=2520215) |
| **May 2025** | **Login now required to view any table**; lobby screen names hidden to logged-out observers. `.com`, Ontario, EU networks. US (NJ/MI/PA) unaffected at the time. | Kills anonymous observation-based datamining |
| **May 2025** | **You can only see hands in which you were dealt cards** (a preflop fold counts) | Kills observed-table datamining entirely. Confirms the platform must be **your-own-hands-only** |
| Oct 2025 | pokerkit patched its "winnings pattern" for PokerStars compatibility | Format drift in the summary/collected lines |
| Jan 2026 | pokerkit 0.7.1 "updated to accept latest logs"; 0.7.2 tournament logs; 0.7.3 bounty logs | **Confirms the format changed in late 2025 / early 2026** |

Sources: [RakeRace, 2025-05-06](https://rakerace.com/news/poker-rooms/2025/05/06/pokerstars-tightens-access-to-tables-and-hand-histories-here-s-what-it-means),
[pokerkit CHANGELOG](https://raw.githubusercontent.com/uoftcprg/pokerkit/main/CHANGELOG.rst).

**Strategic read:** the May 2025 change is *good news* for this project. It removes
the datamining competitors and makes "post-session study of your own hands" the only
legitimate product shape — which is what you're building anyway.

### 1.5 Verbatim sample — NLHE 6-max cash (Zoom)

This is the **only full verbatim modern cash hand I could source**. It is from 2017
(hhp test fixture). **Flagged:** I could not verify a 2025/2026 cash-game sample
verbatim; per the pokerkit changelog above, assume minor drift and do not treat this
as byte-exact for 2026.

```
PokerStars Zoom Hand #164150709626:  Hold'em No Limit ($0.02/$0.05) - 2017/01/06 17:15:11 ET
Table 'Donati' 6-max Seat #1 is the button
Seat 1: Mr.BinAlik ($0.96 in chips) 
Seat 2: B0GEYMAN ($23.69 in chips) 
Seat 3: held ($5 in chips) 
Seat 4: pfckfdcrbq ($10 in chips) 
Seat 5: Lobster01RUS ($5 in chips) 
Seat 6: moreno627 ($9.61 in chips) 
B0GEYMAN: posts small blind $0.02
held: posts big blind $0.05
*** HOLE CARDS ***
Dealt to held [Ac 4h]
pfckfdcrbq: folds 
Lobster01RUS: folds 
moreno627: raises $0.05 to $0.10
Mr.BinAlik: calls $0.10
B0GEYMAN: folds 
held: calls $0.05
*** FLOP *** [6c Jd 6d]
held: checks 
moreno627: checks 
Mr.BinAlik: checks 
*** TURN *** [6c Jd 6d] [2h]
held: checks 
moreno627: checks 
Mr.BinAlik: checks 
*** RIVER *** [6c Jd 6d 2h] [5d]
held: bets $0.15
moreno627: folds 
Mr.BinAlik: folds 
Uncalled bet ($0.15) returned to held
held collected $0.31 from pot
held: doesn't show hand 
*** SUMMARY ***
Total pot $0.32 | Rake $0.01 
Board [6c Jd 6d 2h 5d]
Seat 1: Mr.BinAlik (button) folded on the River
Seat 2: B0GEYMAN (small blind) folded before Flop
Seat 3: held (big blind) collected ($0.31)
Seat 4: pfckfdcrbq folded before Flop (didn't bet)
Seat 5: Lobster01RUS folded before Flop (didn't bet)
Seat 6: moreno627 folded on the River
```

Source: [thlorenz/hhp fixture](https://raw.githubusercontent.com/thlorenz/hhp/master/test/fixtures/holdem/pokerstars/cash.zoom.2017.txt)

### 1.6 Verbatim sample — MTT (2020)

```
PokerStars Hand #219372022626: Tournament #3026510091, $1.84+$0.16 USD Hold'em No Limit - Level I (10/20) - 2020/10/14 10:33:59 BRT [2020/10/14 9:33:59 ET]
Table '3026510091 1' 3-max Seat #1 is the button
Seat 1: VillainA (500 in chips) 
Seat 2: garciamurilo (500 in chips) 
Seat 3: VillainB (500 in chips) 
garciamurilo: posts small blind 10
VillainB: posts big blind 20
*** HOLE CARDS ***
Dealt to garciamurilo [6h Ks]
VillainB is disconnected 
VillainA: folds 
garciamurilo: calls 10
VillainB: checks 
*** FLOP *** [4d Qs Qd]
garciamurilo: checks 
VillainB: checks 
*** TURN *** [4d Qs Qd] [3s]
garciamurilo: checks 
VillainB: bets 20
garciamurilo: folds 
Uncalled bet (20) returned to VillainB
VillainB collected 40 from pot
VillainB: doesn't show hand 
*** SUMMARY ***
Total pot 40 | Rake 0 
Board [4d Qs Qd 3s]
Seat 1: VillainA (button) folded before Flop (didn't bet)
Seat 2: garciamurilo (small blind) folded on the Turn
Seat 3: VillainB (big blind) collected (40)
```

Source: [pokerdf README](https://github.com/murilogmamaral/pokerdf)

### 1.7 Format deltas to build the parser against

**Cash vs tournament:**
- Cash header: `PokerStars Hand #<id>:  Hold'em No Limit ($sb/$bb) - <local ts> [ET ts]`
  (note the **double space** after the colon in the Zoom sample)
- Zoom header: `PokerStars Zoom Hand #<id>: ...`
- MTT header: `PokerStars Hand #<id>: Tournament #<tid>, $buyin+$fee <CUR> Hold'em No Limit - Level <ROMAN> (sb/bb) - <ts>`
- Cash amounts carry `$`; tournament amounts are bare chip integers → **two different
  money lexers**
- Cash `Total pot $X | Rake $Y`; MTT `Total pot N | Rake 0`
- MTT adds antes, bounties, `Level`, and `TS...` summary files

**Edge cases confirmed present in real fixtures** (from the hhp fixture filenames —
a good free test-case checklist): `2008-tournament`, `actiononall`, `allin-preflop`,
`call-allin`, `cash.2010`, `cash.zoom.2017.muck-cards`,
**`cash.zoom.2017.parens-in-playername`**, `collect-on-flop`,
`collected-on-showdown`, `freeroll.tny`, `player-sitting-out`, `posts-allin`,
`timezone-costarica.sng`, `uncalled-bet-returned`.

Additional edge cases to plan for: side pots / chopped pots, `is disconnected` /
`has timed out`, `posts small & big blinds` (returning player), dead blinds,
straddles, `sits out`, `Cash Out` (all-in insurance), `*** FIRST FLOP ***` /
`*** SECOND FLOP ***` (run-it-twice), missing `Dealt to` line (2022 bug), and
timezone suffixes (ET / CET / BRT / WET…) with a bracketed ET translation.

**Practical advice:** parse line-by-line with a state machine keyed on the
`*** SECTION ***` markers, not with one mega-regex. Player names can contain spaces,
parentheses, colons and dots — anchor on the **known seat roster** parsed from the
header, then match `^<name>: <verb>`, longest-name-first. This is the single biggest
source of parser bugs.

---

## 2. Open-source parsers — survey (skeptical)

**Headline conclusion: there is no actively-maintained, battle-tested PokerStars
hand-history parser in JS/TypeScript. You will be writing your own.** The best
Python option (pokerkit) is real but explicitly warns its PokerStars parser is
under-tested.

### JavaScript / TypeScript

| Project | URL | Last release / push | License | PokerStars? | Verdict |
|---|---|---|---|---|---|
| **thlorenz/hhp** | [github](https://github.com/thlorenz/hhp) | **last push 2020-04-03**; 21★ | MIT | ✅ Yes — PokerStars, Ignition, PartyPoker, 888. Cash + MTT + SNG | **Abandoned (6 yrs).** But the *most useful artifact here*: its `test/fixtures/holdem/pokerstars/` directory is a free, curated edge-case corpus. **Mine the fixtures, don't depend on the code.** |
| **@poker-apprentice/hand-history-parser** | [github](https://github.com/poker-apprentice/hand-history-parser) / [npm](https://www.npmjs.com/package/@poker-apprentice/hand-history-parser) | repo pushed 2026-06-16, but **last npm publish v6.6.0 on 2023-12-17**; 4★ | MIT | ❌ **No.** Bodog / Bovada / Ignition only | Frequently mis-recommended as a PokerStars parser. **It is not.** Repo activity is dependency churn, not feature work. Good *architecture* reference (TS, cash+MTT, side pots, antes/bounties, `isFastFold`). |
| `hand-history-parser` (unscoped) | [npm](https://www.npmjs.com/package/hand-history-parser) | **2016** | — | PokerStars USD only | Dead. Ignore. |
| lucataglia/poker-hist-cli-parser | [github](https://github.com/lucataglia/poker-hist-cli-parser) | hobby CLI | — | PokerStars, basic stats | Toy. Not a library. |
| victr/hhstats | [github](https://github.com/victr/hhstats) | hobby | — | PokerStars **Home Games** only | Niche. Ignore. |
| homanp/ohh | [github](https://github.com/homanp/ohh) | TS lib for Open Hand History spec v1.4.6 | — | Not a PokerStars parser — an OHH *writer* | Possibly useful as your **internal canonical format** target |

### Python

| Project | URL | Status | License | Verdict |
|---|---|---|---|---|
| **pokerkit** (UofT Computer Poker Research Group) | [github](https://github.com/uoftcprg/pokerkit) | **Actively maintained**: 490★, pushed 2026-08-22, 0 open issues, v0.7.5 | MIT | **Best-in-class option.** `HandHistory.from_pokerstars()` / `PokerStarsParser` added **v0.6.0, Jan 2025**; patched Oct 2025 (winnings), Jan 2026 (latest logs, tournament logs, bounty logs). Also gives you a full game-state engine + hand evaluator + the PHH standard. **⚠️ Docs explicitly state: "The testing has been limited to old data and is known to fail to parse certain hands."** So: real, current, backed by academics — but *not* battle-tested on 2026 PokerStars. |
| **pokerregion/poker** | [github](https://github.com/pokerregion/poker) | **ARCHIVED.** 355★, last push 2024-02-21 | MIT | Widely cited (`poker.readthedocs.io`), nice API (`PokerStarsHandHistory`, deferred `parse_header()`/`parse()`), supports PokerStars/Full Tilt/PKR. **Archived = dead.** Read it for API design ideas only. |
| **murilogmamaral/pokerdf** | [github](https://github.com/murilogmamaral/pokerdf) | Created May 2025, pushed 2026-08-12, **2★** | MIT | PokerStars-only → Pandas DataFrames. Brand new, near-zero adoption, so **not battle-tested** — but it has a genuinely large test suite (`test_regex_patterns.py` is 27 KB, `test_modeling.py` 30 KB). **Highest-value artifact: its regex corpus.** Best single reference for "what do 2025/2026 PokerStars lines actually look like." |

### Other languages
- **HHSmithy/PokerHandHistoryParser** — [github](https://github.com/HHSmithy/PokerHandHistoryParser). C#, 82★, **last push 2020-05-04**, **no license file** (= legally unusable). Historically the reference impl behind several trackers. Dead + unlicensed.
- **JoakimMich/opensolver**, **exinori/DCFR-SOLVER** — solvers, not parsers (see §5).

### PokerTracker / HM3 ecosystem — **this is the underrated path**

- **PT4 stores everything in a local PostgreSQL database you can connect to directly.**
  Confirmed by PokerTracker's own docs and forums: use pgAdmin or any PG client. Schema
  is documented (the PT3 schema doc is public and PT4 is similar). Advice from
  PT staff/forums: query the `*_cache` tables for precomputed stats;
  `*_hand_player_statistics` holds most of it; the non-cache tables are raw per-hand data.
  Sources: [PT3 schema doc](https://www.pokertracker.com/guides/PT3/databases/pokertracker-3-database-schema-documentation),
  [PT4 databases](https://docs.pokertracker.com/pt4/category/databases/),
  [PT forum: DB access](https://pokertracker.com/forums/viewtopic.php&p=145002).
- **PT4 has an "Export Database" function**, and PT4↔HM3 conversion works both ways
  (HM3 `File > Import Folder` on PT4's archived HH folder;
  PT4 can convert an HM database). Sources:
  [PT4 exporting](https://www.pokertracker.com/guides/PT4/tutorials/exporting-your-database),
  [HM3 import PT4](https://kb.holdemmanager.com/knowledge-base/article/import-poker-tracker-4-database-into-hm3).
- **Both trackers archive the raw HH text** they import. So "point at my PT4/HM3
  archive folder" is a *far* richer import source than "point at PokerStars' live
  folder" — years of history instead of days.
- ⚠️ **No official API.** A forum thread literally titled "PT4 API for SQL queries
  available?" exists; the answer is direct-to-Postgres. Schema is undocumented-as-contract
  and can change between PT4 releases. Also: users must have PT4/HM3 installed (paid).

**Recommended architecture:** write your own TypeScript parser (it's ~1–2 days of
work for NLHE cash + MTT; the format is simple and line-oriented). Seed the test
suite from hhp's fixtures and pokerdf's regex tests. Optionally add a PT4-Postgres
importer later as a power-user path. Do **not** take a runtime dependency on any
of the JS packages above.

---

## 3. Legal / ToS — PokerStars Third Party Tools & Services Policy

Retrieved verbatim from PokerStars' live policy page (fetched 2026-09-01 via
[pokerstars.fr/en/poker/room/prohibited/](https://www.pokerstars.fr/en/poker/room/prohibited/) —
`pokerstars.com` geo-redirects; a June 2026 archive snapshot corroborates).

The policy has **three** categories. Note the middle one is the crucial one for you.

### Category A — Permitted

> 1. Tools and services that simply report basic game state information, such as pot odds or absolute hand strength.
> 2. Reference material that is static and basic in nature, such as simple table-based starting hand charts advising on what hands to play or not in unopened pots.
> 3. Tools or services that monitor and display numerical-based statistics in-game, but make use of only information that you have accumulated through your own play. Furthermore, there are qualitative limitations on any statistics displayed in-game, such as not being able to be split based on card values. There are also feature limitations of tools and services displaying statistics in-game, such as not being able to automatically change displayed statistics based on game state or opponent tendencies.
> 4. Macros and Hotkey programs for gameplay efficiency that do not reduce the requirement of a player having to make a decision. The player must decide what action to take and the exact relative size of any bet or raise, with the macro or hotkey merely executing this decision. For example, a hotkey that bets half the pot is permitted. A hotkey that bets a randomised amount between half and three quarters of the pot is prohibited.

### Category B — Permitted, but Prohibited While PokerStars Software Is Running

> - Reference material that provides advice that goes beyond a basic level, such as a large collection of tables offering recommendations beyond whether to play certain hands or not in unopened pots.
> - Tools or services designed specifically to ease referral to reference material.
> - Tools or services that compute advanced equity calculations, such as range vs range simulators, ICM or Nash Equilibrium-based programs.

### Category C — Prohibited at All Times

> - Any tool or service that plays without human intervention (a 'bot') or reduces the requirement of a human to make decisions.
> - Any tool or service that offers real-time advice on what action to take through reading of the current game state (a 'bot').
> - Any tool or service that delays a player's decision by either a specific or randomised amount of time.
> - Any tool or service that shares hole card data with other players or services.
> - The practice of datamining hands or private results; the use of hands or private results acquired through datamining; the mass sharing of hands, private results or playing statistics.
> - Any tool or service that is targeted towards the manipulation of opponents in games in which you are unable to choose a specific table to play on, such as Spin & Go's.
> - Any tool or service for table selection efficiency that filters or sorts available tournaments, or automates/semi-automates the process of joining available tournaments, based on opponent gameplay statistics or notes.
> - Any tool or service for ring game selection efficiency.

### Applied to this platform

**(a) Parsing/analysing your own hand histories away from the table — permitted.**
⚠️ **Important nuance, flag this:** the policy contains **no explicit affirmative
clause saying "you may analyse your own hand histories."** The permission is
*structural and by omission*: Category C bans datamining and bots; Category B bans
solvers/deep reference material **only while the client is running**; nothing
restricts offline analysis of hands you played yourself. That Category B exists at
all is the strongest evidence — it presupposes that heavy analytical tooling is fine
away from the tables. This is also how GTO Wizard's own Hand History Analyzer
operates commercially, which is a de facto acceptance signal. But it is an inference,
not a quotation.

**(b) RTA — the hard line.** Category C bullets 1–2. The disqualifying property is
**"reading of the current game state"** and offering advice on **"what action to
take."** Design rules that follow:
- No screen scraping, window hooking, OCR, memory reading, or client-log tailing
  **while the client is running**.
- No live folder-watching that surfaces advice on a hand still in progress. A
  watcher that ingests completed hands is technically fine but is a *very* bad look
  and edges toward Category B; **safest posture is explicit user-initiated import
  after the session.**
- If you ever ship a desktop agent, it must refuse to run while the PokerStars
  client is detected. A pure web app that takes file uploads sidesteps all of this.
- Enforcement is real: permanent ban + **confiscation of funds**. In 2025 PokerStars
  extended the ban to solvers and preflop charts during live play.
  ([PokerNews 2025 roundup](https://www.pokernews.com/news/2025/12/top-stories-of-2025-cheating-technology-fears-rise-50115.htm),
  [WPT Global RTA rules 2026](https://wptglobal.com/blog/online-poker-rta-rules-2026))

**(c) Datamining — flatly banned, including *possession and use*.** Read the bullet
carefully: it bans "the practice of datamining", "**the use of hands or private
results acquired through datamining**", *and* "the mass sharing of hands, private
results or playing statistics." Three separate prohibitions.
→ **Hard product constraints:** no shared/pooled hand database; no cross-user
opponent stats; no "look up player X"; no public leaderboards built on other people's
results; each user's data siloed to that user. Note this is also *moot* since the
May 2025 change: you can no longer obtain hands you weren't dealt into anyway.

**(d) HUDs — permitted with sharp limits** (Category A.3). If you ever build an
in-game HUD: your own play data only; **no splitting stats by card values**; **no
dynamically changing displayed stats based on game state or opponent tendencies**;
numerical only (the 2015 policy change added "no non-numerical data, no player
categorisation" — [PokerNews 2015](https://www.pokernews.com/news/2015/10/pokerstars-announces-changes-to-third-party-tools-policy-22920.htm)).
Colour-coded player-type icons and dynamic situational stats are out.
**Recommendation: don't build a HUD.** It's the highest-regulatory-risk, lowest-moat
part of the space, and it drags you from "study tool" into "in-game tool."

**Caveats:** the prohibited-programs list "is not exhaustive" and PokerStars
"reserves the right to add to or modify it at any time." Policy text also varies
slightly by jurisdiction (.com vs .FR vs US states vs the FanDuel-operated
`pokerstars.bet` estate, which now redirects to `poker.fanduel.com`). Get a lawyer
if this becomes a commercial product; the above is research, not legal advice.

---

## 4. Leak detection without a solver

### 4.1 Standard stat set + accepted healthy ranges (6-max NLHE, micro/low)

Primary source: [Upswing Poker — "What is a HUD & What Stats Should You Include?"](https://upswingpoker.com/poker-hud-stats/),
cross-checked against [BlackRain79 on WTSD](https://www.blackrain79.com/2019/10/what-is-good-wtsd-in-poker.html)
and [Poker Copilot](https://pokercopilot.com/essential-poker-statistics).

| Stat | Definition | Healthy 6-max range | Sample needed |
|---|---|---|---|
| **VPIP** | Voluntarily put $ in pot preflop | **20–30%**, ~25% norm (winners cluster 21–26) | 300 |
| **PFR** | Entered pot by raising preflop | **15–25%**, ~19% norm | 300 |
| **VPIP−PFR gap** | Passivity indicator | **≤ 8**; >8 reads as "fishy". TAG PFR ≈ 75%+ of VPIP | 300 |
| **3-Bet** | 3-bet frequency preflop | **6–10%**, ~8% avg | 1,000 |
| **Fold to 3-Bet (as PF raiser)** | | **40–45% IP / 45–50% OOP** — must be split by position | 1,500 |
| **Squeeze** | 3-bet after raise + cold-call | **7–9%** | 3,000 |
| **Flop C-Bet** | Bet flop after raising PF | Varies by position & pot type (see 4.2) | several thousand |
| **Fold to Flop C-Bet** | | **< 50%** | several thousand |
| **WWSF** | Won when saw flop | **45–53%**, ~48% good | 8,000 |
| **WTSD** | Went to showdown (having seen flop) | **27–32%**, ~30% target (BlackRain: ~27 for 6-max, ~25 FR; ≥30 = recreational) | 8,000 |
| **W$SD** | Won money at showdown | **49–55%** | 8,000 |
| **Postflop Agg Freq (AFq)** | (bets+raises)/(bets+raises+calls+folds) | **~50–60%** overall at VPIP 15–20. Flop **>35** = aggressive; turn **<30** and river **<27** = passive/exploitable | several thousand |

Notes on AFq: `AFq = (bet + raise) / (bet + raise + call + fold) × 100`. It is more
useful than Aggression Factor for leak detection because it counts more actions.
Normal players' AFq declines street-by-street (flop > turn > river); a *flat or
rising* profile is unusual.
Source: [myholdempokertips](https://www.myholdempokertips.com/hud-stats-aggression).

### 4.2 C-bet by board texture (solver benchmarks, for the "texture" dimension)

⚠️ **Weaker sourcing** — these come from secondary aggregator sites, not from a
solver I ran. Treat as directional, label them as heuristics in-product.
- In position, solvers c-bet flop **60–70%** on most textures; OOP **45–55%**.
- Dry/static boards push c-bet frequency **above 80%**; connected/wet boards drop it
  to **40–50%**.
- Sizing heuristic: **33% pot** on dry/static, **66–75% pot** on dynamic.
Sources: [RiverOdds c-bet guide](https://riverodds.app/cbet-frequency-guide/),
[GTO Wizard — Flop Heuristics: IP C-Betting in Cash Games](https://blog.gtowizard.com/flop-heuristics-ip-c-betting-in-cash-games/).

### 4.3 River overfold / MDF

`MDF = 1 − Alpha`, `Alpha = bet / (bet + pot)`. MDF is the defence frequency that
makes a bluff exactly break even. Key methodological point for your product: **MDF is
a valid yardstick primarily on the river**, where bluffs are zero-equity; on flop/turn
bluffs retain equity so pure MDF over-states required defence.
→ A **river fold-vs-bet frequency significantly above MDF for that sizing** is a
clean, solver-free, mathematically defensible leak signal. This is probably the single
best "no-solver truth source" you have.
Sources: [GTO Wizard — MDF & Alpha](https://blog.gtowizard.com/mdf-alpha/),
[PLO Mastermind](https://plomastermind.com/mdf-poker/).

### 4.4 Which leaks to fix first — prioritisation (well-sourced)

From GTO Wizard's [Understanding Which Mistakes Cost You the Most Money](https://blog.gtowizard.com/understanding-which-mistakes-cost-you-the-most-money/)
and [Fixing a Poker Leak Part 1](https://blog.gtowizard.com/fixing-a-poker-leak-part-1-spotting-and-correcting-errors/):

1. **Prioritise by frequency × per-hand cost, not by per-hand cost alone.** Their
   worked example: BTN vs BB single-raised pots are ~23% of all postflop situations,
   so a small error there outranks a large error in a rare UTG-vs-UTG1 4-bet spot.
   **This is the core algorithm your leak-ranker should implement.**
2. **Calling mistakes >> betting mistakes.** "A calling mistake is much, much more
   costly" — you can't force a fold, you must win a bigger pot at showdown.
3. **Later streets cost more.** River > turn > flop, because the pot is bigger.
   Their measured examples: same sizing error with KJs costs **0.31bb on the flop
   vs 0.87bb on the turn** (31 vs 87 bb/100).
4. **At low stakes ($1/$2–$5/$10 and below), preflop errors drive most total EV loss**
   — bad opens, missed 3-bets, loose blind calls. High frequency × moderate cost.
   Measured preflop examples: opening A9o instead of ATo = **0.14bb**; HJ calling ATo
   instead of folding = **0.18bb**; HJ calling A9o instead of AJo = **0.49bb**.
5. **One mistake ≠ a structural leak.** Require a trend across sessions before
   flagging. This should be an explicit confidence gate in your UI.

**Suggested product ordering for micro/low 6-max**, synthesising the above:
1. Preflop opening ranges by position (highest frequency, cheapest to fix, and the
   one thing you can grade with zero solver via published charts)
2. Blind defence / BB over-folding and over-calling
3. Fold-to-3bet by position (IP vs OOP split)
4. River call/fold vs MDF (over-folding) — mathematically groundable
5. WWSF / postflop aggression profile (barrelling frequency turn & river)
6. C-bet frequency vs board texture
7. WTSD/W$SD interaction: high WTSD + low W$SD = calling station; low WTSD + high
   W$SD = over-folding, exploitable by bluffs

### 4.5 Methodology caveat to build into the product

The sample-size column above is not decoration. WWSF/WTSD/W$SD need **~8,000 hands**
to be meaningful; preflop stats stabilise by 300–1,000. A study tool that shows a
"leak" off 400 hands of WTSD is actively harmful. **Gate every stat behind its
sample-size threshold and show a confidence indicator.** This is a real product
differentiator — most tools don't do it.

Also: several of the "healthy range" numbers above trace to forum consensus and
coaching-site convention rather than published research. They are the *accepted*
industry ranges (which is what was asked) but they are not empirically derived from
a public dataset I could verify.

---

## 5. Solver / GTO oracles with programmatic access

### GTO Wizard — **no solver API. Verified.**

- GTO Wizard does have a public API, but it is the **GTO Wizard Benchmark** — an
  AI-leaderboard API where you connect *your* bot to play HUNL hands against their AI
  for benchmarking. [gtowizard.com/benchmark](https://gtowizard.com/benchmark)
- Their own docs state it "provides access to playing hands and observing the results
  of hands (chips won/lost), but **does not give access to solver capabilities, and
  any requests for such features will be automatically refused.**"
- The [Terms](https://gtowizard.com/benchmark/terms) additionally prohibit "scrape,
  harvest, or systematically query the API to extract the underlying strategy" and
  ban using benchmark data to train competing solvers. Liability capped at $100.
- **Their Hand History Analyzer is a manual web upload, not an API.** Drag-and-drop
  .txt files; produces per-hand EV loss + "GTO score"; sort by EV loss to find
  blunders. Notably: **single-hand analysis is PokerStars-only and NLHE 6-max cash
  only.** ([help docs](https://help.gtowizard.com/how-to-use-the-hand-history-analyzer/))
- Pricing (2026, after an early-2026 restructure that raised Premium/Elite by
  $10–20/mo): **Starter ~$26/mo, Premium ~$44/mo, Elite ~$116/mo, Ultra up to
  ~$206/mo.** ([PokerNews pricing change](https://www.pokernews.com/news/2026/03/gto-wizard-subscription-plans-new-features-pricing-50908.htm),
  [deepfold breakdown](https://deepfold.co/en/blog/solver/gto-wizard-pricing-explained-2026))

**Verdict: not embeddable. Scraping it would breach their ToS.** GTO Wizard is your
closest competitor on the analyzer feature, not your supplier.

### DeepSolver — **the only real commercial solver API. Verified, but expensive.**

[deepsolver.com/api](https://deepsolver.com/api) — a genuine HTTP API for NLH.

- **Endpoints:** `POST /task/treebuilder` (define tree: bet sizes, stacks, streets,
  arbitrary sizings, donk grids) → `POST /task/cfr/schedule` (queue a solve with
  iteration count + ranges) → `GET /task/cfr/result/{task_id}` (poll).
- **Output:** JSON, per-hand EQ and EV in 1326-hand format for both players, optional
  strategy matrices. Two formats: `HOLDEM` (detailed) and `HOLDEM_binary` (compact
  arrays). NumPy arrays supported.
- **Latency: 2–20 seconds per solve.** Queues 10,000+ jobs, FIFO per tenant. GPU-bound:
  1 GPU = 1 concurrent solve.
- **Pricing:**

  | Plan | Monthly | Included calls | Overage |
  |---|---|---|---|
  | Builder | $1,875 | 50,000 | $0.05/call |
  | Production | $2,625 | 100,000 | $0.04/call |
  | Scale | $4,875 | 300,000 | $0.025/call |
  | Enterprise | $6,750 | Unlimited | — |

  Plus **$2,000 one-time setup** and GPU hosting (NVIDIA L4 ~$650/mo US, H100
  ~$2,300/mo EU). Demo: **$500 for 20,000 calls**, credited toward a subscription.
  Annual contracts −25%.
- **Licensing: "no restrictions" on reselling / white-label.** That's unusually
  permissive and makes it the only credible "correct action oracle" for a commercial
  product — *if* you can carry ~$2.5k+/mo.
- DeepSolver also sells B2C plans (Recreational ~$10–19/mo, Regular ~$76/mo,
  GTO Pro ~$209/mo) but those are the web app, not the API.

### Ruse / PokerCoaching — **no public API found**

I searched specifically and found **no developer/API documentation** for either.
**Flagged as unverified-negative:** absence of evidence, though for consumer training
products a public solver API would be unusual and I'd have expected to find it.

### Open-source solvers — **the licence is the blocker, not the tech**

| Project | Status | Licence | Notes |
|---|---|---|---|
| **bupticybee/TexasSolver** | **Active**: 2,531★, pushed 2026-08-26, C++ | **AGPL-3.0** | Most popular OSS solver. Holdem + short deck. One report claims it "returned different solutions which are presumably incorrect" vs Pio/GTO+ — **unverified, single secondary source, treat sceptically**. An MCP server wrapper exists (`texas-solver-mcp-server`). |
| **b-inary/postflop-solver** | **"[Development suspended]"**, 364★, last push 2024-07-09, Rust | **AGPL-3.0** | Discounted CFR; author claims performance surpassing PioSOLVER and GTO+. Explicitly designed as a *backend for GUIs*, "direct use by developers is not a critical purpose by design." |
| **b-inary/wasm-postflop** | **"[Development suspended]"** | AGPL-3.0 | **Runs in the browser via WASM.** Reported to return "nearly identical solutions to PioSOLVER and GTO+." Architecturally the most interesting for a web app — solve client-side, zero server GPU cost. |
| JoakimMich/opensolver | Rust, DCFR, UPI-compatible | check | Smaller |
| exinori/DCFR-SOLVER | Rust, from scratch | check | Smaller |

**🚨 The critical finding: TexasSolver and postflop-solver/wasm-postflop are all
AGPL-3.0.** AGPL's §13 network clause means that if you run them as part of a hosted
web service, **you must offer the complete corresponding source of your service to
its users.** For a commercial SaaS study platform this is usually a deal-breaker.
Options: (a) accept it and open-source, (b) negotiate a commercial licence with the
authors — both projects are "development suspended", making this uncertain,
(c) ship as a downloadable desktop/local component where the network clause doesn't
trigger, (d) use wasm-postflop client-side — **⚠️ note this does *not* clearly escape
AGPL, since you'd still be conveying the software to users; get legal advice**,
(e) pay DeepSolver, (f) don't use a solver.

### Feasibility verdict for an embedded "correct action" oracle

- **Realtime per-hand solving in a web app is not economically viable at v1.**
  2–20 s per solve, GPU-bound, ~$2.5k+/mo minimum for the only clean commercial API.
- **The pragmatic v1:** ship *without* a solver. Build on (i) published preflop
  charts as the preflop oracle, (ii) MDF/pot-odds/equity math as the river-and-facing-bet
  oracle, (iii) population-baseline stat deviation for everything else. This is
  cheap, fast, defensible, and covers the highest-frequency leaks per §4.4 — which
  at micro/low stakes are *preflop* anyway.
- **The v2 upgrade path:** precompute a **finite library of canonical spots**
  (position × pot type × board-texture bucket × SPR bucket) offline once, using
  TexasSolver on your own hardware, and ship the results as a static lookup table.
  This turns an unaffordable per-request GPU cost into a one-time compute cost and
  a few GB of storage. **⚠️ AGPL still applies to the solver binary; but if you only
  distribute the *output data* and never convey or network-serve the solver itself,
  the position is much better — confirm with a lawyer.**
- **v3:** DeepSolver API for genuinely arbitrary user-defined spots, gated behind a
  premium tier that covers the $2.5k/mo floor.

---

## 6. Things I could NOT verify — explicit list

1. **A verbatim 2025/2026 PokerStars cash hand history.** Best available is the 2017
   Zoom fixture in §1.5. The pokerkit changelog proves the format drifted in late
   2025/early 2026, so treat §1.5 as structurally right but not byte-exact.
2. **Regional client folder paths** (PokerStars.EU/FR/ES/IT, US states). No
   authoritative source found.
3. **Hand history filename convention** (the `HH<date> <table> - <stakes> - <game>.txt`
   pattern). Widely assumed but I found no authoritative confirmation of the current
   template.
4. **Tournament summary (`TS…`) file internal format.** Not sourced. Note some
   summaries arrive as `.htm` by email.
5. **Whether PokerStars' policy explicitly permits own-HH analysis.** It does not say
   so explicitly; permission is inferred structurally (§3a). Flagged as inference.
6. **Ruse / PokerCoaching APIs** — searched, none found; unverified negative.
7. **The claim that TexasSolver produces incorrect solutions.** Single secondary
   source, not independently confirmed.
8. **C-bet-by-texture percentages in §4.2.** Secondary aggregator sites only.
9. **Whether client-side WASM execution escapes AGPL §13.** Legal question, not
   answerable by research.
10. **PT4 database schema stability across versions.** The public schema doc is for
    PT3; PT4 is "similar" per forums, not per an official contract.

---

## Sources

- [PokerStars Third Party Tools policy](https://www.pokerstars.fr/en/poker/room/prohibited/)
- [PokerStars — save hand histories](https://www.pokerstars.fr/en/help/articles/save-hand-histories/)
- [PokerStars — hand history not saving (Windows)](https://www.pokerstars.fr/help/articles/win-hh-not-saving-initial/)
- [RakeRace — PokerStars tightens access, May 2025](https://rakerace.com/news/poker-rooms/2025/05/06/pokerstars-tightens-access-to-tables-and-hand-histories-here-s-what-it-means)
- [Holdem Manager KB — PokerStars setup](https://kb.holdemmanager.com/knowledge-base/article/pokerstars)
- [PokerTracker 4 — PokerStars configuration guide](https://docs.pokertracker.com/pt4/site-configuration/pokerstars-configuration-guide/)
- [PokerTracker 4 — databases](https://docs.pokertracker.com/pt4/category/databases/)
- [PokerTracker 3 schema documentation](https://www.pokertracker.com/guides/PT3/databases/pokertracker-3-database-schema-documentation)
- [SitNGo Wizard — where are my hand histories](https://sngwiz.com/wp/question/where-are-my-pokerstars-hand-histories/)
- [Poker Copilot — requesting hand histories](https://pokercopilot.com/userguide/7/en/topic/how-to-request-and-save-hand-history-files-from-pokerstars)
- [SharkScope — requesting hand histories](https://www.sharkscope.com/SharkScope/Desktop-Manual/1/en/topic/how-to-request-recent-hand-history-files-from-pokerstars)
- [HM forums — missing hole cards, July 2022](https://forums.holdemmanager.com/showthread.php?t=544841&p=2520215)
- [thlorenz/hhp](https://github.com/thlorenz/hhp) · [fixture used](https://raw.githubusercontent.com/thlorenz/hhp/master/test/fixtures/holdem/pokerstars/cash.zoom.2017.txt)
- [poker-apprentice/hand-history-parser](https://github.com/poker-apprentice/hand-history-parser) · [npm](https://www.npmjs.com/package/@poker-apprentice/hand-history-parser)
- [uoftcprg/pokerkit](https://github.com/uoftcprg/pokerkit) · [CHANGELOG](https://raw.githubusercontent.com/uoftcprg/pokerkit/main/CHANGELOG.rst) · [notation docs](https://pokerkit.readthedocs.io/en/stable/notation.html)
- [pokerregion/poker (archived)](https://github.com/pokerregion/poker) · [docs](https://poker.readthedocs.io/en/latest/handhistory.html)
- [murilogmamaral/pokerdf](https://github.com/murilogmamaral/pokerdf)
- [HHSmithy/PokerHandHistoryParser](https://github.com/HHSmithy/PokerHandHistoryParser)
- [Open Hand History spec](https://hh-specs.handhistory.org/) · [homanp/ohh](https://github.com/homanp/ohh)
- [uoftcprg/phh-std](https://github.com/uoftcprg/phh-std)
- [Upswing — HUD stats](https://upswingpoker.com/poker-hud-stats/)
- [BlackRain79 — good WTSD](https://www.blackrain79.com/2019/10/what-is-good-wtsd-in-poker.html)
- [Poker Copilot — essential statistics](https://pokercopilot.com/essential-poker-statistics)
- [myholdempokertips — aggression stats](https://www.myholdempokertips.com/hud-stats-aggression)
- [GTO Wizard — which mistakes cost the most](https://blog.gtowizard.com/understanding-which-mistakes-cost-you-the-most-money/)
- [GTO Wizard — fixing a poker leak, part 1](https://blog.gtowizard.com/fixing-a-poker-leak-part-1-spotting-and-correcting-errors/)
- [GTO Wizard — the 3 biggest leaks](https://blog.gtowizard.com/the_3_biggest_leaks_killing_your_winrate/)
- [GTO Wizard — MDF & Alpha](https://blog.gtowizard.com/mdf-alpha/)
- [GTO Wizard — flop heuristics, IP c-betting](https://blog.gtowizard.com/flop-heuristics-ip-c-betting-in-cash-games/)
- [GTO Wizard Benchmark](https://gtowizard.com/benchmark) · [Terms](https://gtowizard.com/benchmark/terms)
- [GTO Wizard — hand history analyzer help](https://help.gtowizard.com/how-to-use-the-hand-history-analyzer/)
- [PokerNews — GTO Wizard 2026 pricing changes](https://www.pokernews.com/news/2026/03/gto-wizard-subscription-plans-new-features-pricing-50908.htm)
- [DeepSolver API](https://deepsolver.com/api) · [pricing](https://deepsolver.com/pricing)
- [bupticybee/TexasSolver](https://github.com/bupticybee/TexasSolver)
- [b-inary/postflop-solver](https://github.com/b-inary/postflop-solver) · [wasm-postflop](https://github.com/b-inary/wasm-postflop)
- [PokerNews — 2015 third-party tools policy change](https://www.pokernews.com/news/2015/10/pokerstars-announces-changes-to-third-party-tools-policy-22920.htm)
- [PokerNews — 2025 cheating technology roundup](https://www.pokernews.com/news/2025/12/top-stories-of-2025-cheating-technology-fears-rise-50115.htm)
- [WPT Global — online poker RTA rules 2026](https://wptglobal.com/blog/online-poker-rta-rules-2026)
- [RiverOdds — c-bet frequency guide](https://riverodds.app/cbet-frequency-guide/)
