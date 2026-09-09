/**
 * The playstyle, as conditions rather than ranges.
 *
 * The charts answer "which hands". This answers everything else: when to size
 * up, when to give up, which reads change the answer, and the handful of things
 * never to do. Those are the parts that cannot be drawn on a 13x13 grid, and
 * they are most of the strategy.
 *
 * **Ranges are deliberately absent.** They live in the chart viewer, they are
 * drilled, and repeating them here would create two places to disagree with
 * each other. The exception is the short hand lists that *are* rules — "call a
 * 3-bet only with 88+, AQ, AK" is a decision, not a range chart.
 *
 * Content rather than code, so it is edited like prose and rendered by one dumb
 * component. Kept as data rather than markup so the page can be re-laid out,
 * searched, or turned into drill prompts later without the sentences moving.
 */

/**
 * What kind of action a line prescribes, which is the whole colour scheme.
 *
 * The eye reaches these before it reads them, which is the point of a sheet you
 * check mid-hand: at a glance a section is mostly green or mostly red, and that
 * alone is often the answer.
 */
export type PlayAct = "bet" | "check" | "fold" | "read";

export interface PlayLine {
  /** The condition. Absent for a line that always applies. */
  when?: string;
  /** What to do. */
  then: string;
  act: PlayAct;
}

export interface PlayGroup {
  heading?: string;
  lines: PlayLine[];
  /** A caveat printed under the group, in smaller type. */
  note?: string;
}

export interface PlaySection {
  id: string;
  title: string;
  groups: PlayGroup[];
}

export const PLAYSTYLE: readonly PlaySection[] = [
  {
    id: "types",
    title: "The five players",
    groups: [
      {
        heading: "VPIP / PFR at 6-max",
        lines: [
          {
            when: "Nit · 16/14",
            then: "Steal his blinds and cbet him relentlessly. When he raises you back, he has it — let it go.",
            act: "bet",
          },
          {
            when: "TAG · 21/18",
            then: "The good player. Stay out of his way without a big hand.",
            act: "fold",
          },
          {
            when: "SLP · 30/8",
            then: "Calls far too much, almost never raises. Bet your decent hands wide. Never bluff him.",
            act: "bet",
          },
          {
            when: "Fish · 55/4",
            then: "Plays everything and does nothing with it. Bet big for value, go for his stack. Never bluff him.",
            act: "bet",
          },
          {
            when: "Maniac · both very high",
            then: "Wait for a real hand and let him do the betting. Never bluff him.",
            act: "check",
          },
        ],
        note: "The colour bands and how many hands each stat needs are on the Players drill, under Types & ranges.",
      },
    ],
  },

  {
    id: "sizing",
    title: "How much to raise",
    groups: [
      {
        heading: "Opening the pot",
        lines: [
          { when: "Early or middle position", then: "4bb", act: "bet" },
          { when: "Late position", then: "3bb", act: "bet" },
          { when: "For each limper already in", then: "Add 1bb", act: "bet" },
          {
            when: "For each limper, when you are in the blinds",
            then: "Add 2bb",
            act: "bet",
          },
          {
            when: "The small blind limps into your big blind",
            then: "Raise to 4bb, with about half your hands",
            act: "bet",
          },
        ],
        note: "Smaller in late position on purpose: your range is junkier there, you have position and want a caller, and you want to fold cheaply if someone re-raises.",
      },
      {
        heading: "Re-raising",
        lines: [
          {
            when: "3-bet — re-raising someone's open",
            then: "3x their raise in position, 4x out of position",
            act: "bet",
          },
          {
            when: "4-bet — re-raising their 3-bet",
            then: "3x their 3-bet, or just shove",
            act: "bet",
          },
          {
            when: "Whoever you are raising has 50bb or less",
            then: "2.5x instead, or just click it back",
            act: "bet",
          },
        ],
        note: "Which hands to do this with is in the next section — the size and the decision live together there.",
      },
    ],
  },

  {
    id: "exceptions",
    title: "When not to raise",
    groups: [
      {
        lines: [
          {
            when: "Three or more players have limped in and you are on the button, holding A3s, 44 or 56s",
            then: "Limp in behind them instead. The pot is already too crowded to win with a raise, and these hands want a cheap flop.",
            act: "check",
          },
          {
            when: "Both blinds are nits",
            then: "Open wider than the chart from the button. They fold too much for the extra hands to cost you anything.",
            act: "bet",
          },
        ],
      },
    ],
  },

  {
    id: "facing",
    title: "Someone raised before you",
    groups: [
      {
        heading: "Step 1 — do you 3-bet?",
        lines: [
          {
            when: "AA, KK, QQ, AK",
            then: "3-bet for value. 3x their raise in position, 4x out of position.",
            act: "bet",
          },
          {
            when: "Anything else",
            then: "Never 3-bet it. Go to step 2.",
            act: "fold",
          },
        ],
        note: "One exception, and it needs both halves: you are in position, and he folds to 3-bets or to cbets more than 70% of the time over 100+ hands. Then a junk hand that folds easily to a 4-bet — 67s, A4s, KJo — can 3-bet as a bluff.",
      },
      {
        heading: "Step 2 — do you call? Only these three",
        lines: [
          {
            when: "Any pocket pair",
            then: "Call to set-mine, as long as you both have 50bb or more behind.",
            act: "check",
          },
          {
            when: "AQ, JJ or TT",
            then: "Call. Too good to fold, not good enough to survive a 4-bet.",
            act: "check",
          },
          {
            when: "A suited connector or suited ace, in position, with a fish already in the pot",
            then: "Call. Never from the blinds, and never without the fish.",
            act: "check",
          },
          {
            when: "Everything else",
            then: "Fold. This is most hands, including AJ and KQ.",
            act: "fold",
          },
        ],
        note: "Set-mining has one follow-up: if the flop misses you completely — no set, no open-ended draw — the hand is over. Fold it.",
      },
      {
        heading: "They 3-bet you",
        lines: [
          {
            when: "AA, KK, QQ, JJ, AK",
            then: "4-bet. 3x their 3-bet, or just shove.",
            act: "bet",
          },
          { when: "TT, 99, 88, AQ", then: "Call.", act: "check" },
          {
            when: "Everything else, at 100bb",
            then: "Fold — especially out of position.",
            act: "fold",
          },
          {
            when: "At 50bb or less",
            then: "Fold or shove. Never call: there is not enough behind to play the flop.",
            act: "fold",
          },
        ],
        note: "Calling a 3-bet is hard to make money with. You miss the flop, check-fold, and give up 10–12bb — ten of those is a buy-in.",
      },
      {
        heading: "They 4-bet you",
        lines: [
          {
            when: "AA or KK",
            then: "Get the money in. At 100bb kings are never a fold — someone actually holds aces about 3% of the time.",
            act: "bet",
          },
          {
            when: "Everything else, including QQ, JJ and AK",
            then: "Fold. Almost nobody at these stakes 4-bets without the nuts.",
            act: "fold",
          },
        ],
        note: "The one exception: 200bb+ deep against a nit who cold 4-bets — a raise, your 3-bet, then a fourth player coming over the top. That is aces, and the kings can go.",
      },
    ],
  },

  {
    id: "flop",
    title: "Flop",
    groups: [
      {
        heading: "1 · He bets into you first",
        lines: [
          {
            when: "What it is",
            then: "A donk bet. He is supposed to check to the preflop raiser, so betting instead is him asking where he stands. It means weakness.",
            act: "read",
          },
          {
            when: "He does it a lot — donk bet 45%+",
            then: "Raise 3x. Better with a gutshot or two overcards behind it.",
            act: "bet",
          },
          {
            when: "He bets the minimum",
            then: "Treat it as a check. Bet as normal.",
            act: "bet",
          },
        ],
      },
      {
        heading: "2 · When to check instead of betting",
        lines: [
          {
            when: "Nothing at all, out of position, draws on the board, versus a fish or SLP",
            then: "Check, fold to a real bet. He will not fold and you cannot win it.",
            act: "check",
          },
          {
            when: "Same, versus a maniac or a TAG who plays back",
            then: "Check.",
            act: "check",
          },
          {
            when: "He then bets a third of the pot or less",
            then: "Do not fold to that. Only a real bet folds you.",
            act: "check",
          },
          {
            when: "Middle pair, or top pair with a bad kicker",
            then: "Check, call, bet the turn. Same value, smaller pot.",
            act: "check",
          },
          {
            when: "Two or more opponents",
            then: "Only bet top pair or a strong draw. Someone has hit it.",
            act: "fold",
          },
        ],
        note: "Bet for value at fish. Bluff at nits. A fish will not fold, so betting at him with nothing is a donation.",
      },
      {
        heading: "3 · How much to bet",
        lines: [
          {
            when: "55%",
            then: "You missed. Ace or king high with two low cards, no flush draw — he missed too.",
            act: "bet",
          },
          {
            when: "60%",
            then: "Default. You missed, but there are high cards out there.",
            act: "bet",
          },
          {
            when: "75%",
            then: "Good hand, and he does not fold. Make him pay.",
            act: "bet",
          },
          {
            when: "100%",
            then: "Top pair good kicker or better, versus a fish or SLP. They call anyway.",
            act: "bet",
          },
          {
            when: "150%",
            then: "A monster against someone who will not fold. Usually a stuck fish.",
            act: "bet",
          },
        ],
        note: "Small works because you raised preflop: an ace on the flop scares him more than it helps you.",
      },
      {
        heading: "4 · He raises your bet",
        lines: [
          {
            when: "Any real raise",
            then: "Fold. They do not bluff-raise. Even top pair good kicker.",
            act: "fold",
          },
          {
            when: "A min-raise",
            then: "Cheap. Call in position with top pair or middle pair. Fold air.",
            act: "check",
          },
        ],
      },
      {
        heading: "5 · He calls your bet",
        lines: [
          {
            when: "He folds a lot — fold to cbet 70%+",
            then: "The call is real: top pair or a big draw. Slow down.",
            act: "read",
          },
          {
            when: "He is sticky — fold to cbet 59% or less",
            then: "Means little. Bottom pair, a gutshot, overcards. Keep value betting.",
            act: "bet",
          },
        ],
      },
    ],
  },

  {
    id: "turn",
    title: "Turn",
    groups: [
      {
        lines: [
          {
            act: "fold",
            then: "No top pair or better by the turn — not another penny in the pot.",
          },
          {
            act: "check",
            then: "Unless they bet a quarter pot or less and you have any equity at all.",
          },
        ],
      },
      {
        heading: "With a hand",
        lines: [
          {
            when: "Top pair or a small overpair, vs fish or SLP",
            then: "Bet again, around 75%",
            act: "bet",
          },
          {
            when: "Top pair or a small overpair, vs regs",
            then: "Pot control. Check, and check/fold against some.",
            act: "check",
          },
          {
            when: "Two pair or better",
            then: "Bet 75%+ against everyone. Play for stacks.",
            act: "bet",
          },
        ],
      },
      {
        heading: "Facing action",
        lines: [
          {
            when: "They raise or lead the turn",
            then: "Fold — including an overpair, a fair bit of the time",
            act: "fold",
          },
          {
            when: "Rule of thumb",
            then: "If you can't beat two pair, strongly consider folding",
            act: "fold",
          },
          {
            when: "Exceptions",
            then: "A live dynamic where you've been running them over, or a maniac",
            act: "check",
          },
        ],
        note: "A turn raise is far stronger than a flop raise. Bluffing there costs a big chunk of a stack, and micro players call down with mediocre hands rather than raising them.",
      },
      {
        heading: "Betting without a hand",
        lines: [
          {
            when: "Sticky reg who floats, broadway turn",
            then: "Fire 60–70%. One bullet — give up on the river.",
            act: "bet",
          },
          { when: "You picked up a good draw", then: "Fire again", act: "bet" },
          {
            when: "A fish, any card",
            then: "Never. Pot control even with a draw.",
            act: "fold",
          },
          {
            when: "Flop checked through and you have a hand",
            then: "Delayed cbet — bet for value",
            act: "bet",
          },
          { when: "Your delayed cbet gets raised", then: "Fold", act: "fold" },
          {
            when: "Flop checked through, you have nothing, in position",
            then: "Always stab. Nobody checks twice with anything good.",
            act: "bet",
          },
          {
            when: "Same but out of position, broadway turn",
            then: "Stab around 60%",
            act: "bet",
          },
          { when: "Same but a middling turn", then: "Give up", act: "fold" },
        ],
      },
    ],
  },

  {
    id: "river",
    title: "River",
    groups: [
      {
        heading: "No pair",
        lines: [
          { when: "Default", then: "Give up", act: "fold" },
          {
            when: "A fish leads about a quarter pot and the draws missed",
            then: "Call with AJ-high or better only",
            act: "check",
          },
          { when: "The same but half pot or more", then: "Fold", act: "fold" },
        ],
      },
      {
        heading: "Value betting",
        lines: [
          { when: "Top pair", then: "About two thirds of the pot", act: "bet" },
          { when: "Top pair vs fish or SLP", then: "Bet big", act: "bet" },
          {
            when: "Middle pair vs fish or SLP",
            then: "Value bet, right down to the bottom of the range",
            act: "bet",
          },
          {
            when: "Middle pair, dry board, vs a fish",
            then: "Half pot — it invites the hero call",
            act: "bet",
          },
          {
            when: "Middle pair vs a reg",
            then: "Only with a good kicker or better",
            act: "check",
          },
          {
            when: "Third pair and below",
            then: "Check it down against everyone",
            act: "check",
          },
        ],
      },
      {
        heading: "Value calling — read their AF",
        lines: [
          {
            when: "AF 1 or less",
            then: "Fold on any river, safe or scary",
            act: "fold",
          },
          {
            when: "AF about 2",
            then: "Call a safe river. Fold a scary one.",
            act: "check",
          },
          {
            when: "AF 3–4",
            then: "Call a safe river. A scary one is close.",
            act: "check",
          },
          { when: "AF 5+", then: "Call either", act: "check" },
          {
            when: "Smaller than half pot",
            then: "Call lighter — the price justifies it",
            act: "check",
          },
          { when: "Pot-sized", then: "Usually value. Lean fold.", act: "fold" },
          {
            when: "An overbet",
            then: "Fold without a specific dynamic in play",
            act: "fold",
          },
        ],
        note: "The ladder assumes a bet of 50–75% of the pot. Safe or scary is about the river card, not about your hand.",
      },
      {
        heading: "They raise the river",
        lines: [
          {
            when: "Any legitimate raise, 3x or more",
            then: "Fold. Fast, without tanking. Every player type.",
            act: "fold",
          },
          {
            when: "A fish mini-raises a small pot",
            then: "Call with top pair good kicker or better",
            act: "check",
          },
        ],
      },
    ],
  },

  {
    id: "big",
    title: "When you have it",
    groups: [
      {
        lines: [{ act: "bet", then: "Sets and overpairs: bet, bet, shove." }],
        note: "This is where the win rate actually comes from. Bad players do not need coaxing — they call. If they fold they had nothing and you were never getting paid.",
      },
      {
        heading: "Sets — the four lines",
        lines: [
          {
            when: "In position, you called preflop",
            then: "Raise their cbet big. If they don't cbet, bet close to pot.",
            act: "bet",
          },
          {
            when: "In position, you raised preflop",
            then: "Cbet big. Raise big if they lead.",
            act: "bet",
          },
          {
            when: "Out of position, you called",
            then: "Check-raise big",
            act: "bet",
          },
          { when: "Out of position, you raised", then: "Cbet big", act: "bet" },
          {
            when: "What big means",
            then: "3–4x their bet. More against bad players when deep, far more against a min-bet.",
            act: "read",
          },
          { when: "Turn", then: "Lead big. Never a second check-raise.", act: "bet" },
          {
            when: "You get raised on the flop",
            then: "Re-raise 3x or shove. Get it in now.",
            act: "bet",
          },
          {
            when: "Four to a straight, or a flush you have no part of",
            then: "Slow down, and possibly fold the river",
            act: "fold",
          },
        ],
      },
      {
        heading: "Other big hands",
        lines: [
          {
            when: "Two pair on a dry board",
            then: "Three big streets against every type",
            act: "bet",
          },
          {
            when: "Two pair, two draws complete",
            then: "Check/call, check behind, or check/fold",
            act: "check",
          },
          {
            when: "Top pair top kicker on a paired low board",
            then: "Three big streets against fish, SLPs and most regs",
            act: "bet",
          },
          {
            when: "Quads or better",
            then: "The one slowplay. Shove the river on an action card.",
            act: "check",
          },
          {
            when: "Nut hand, bad player, flop",
            then: "Raise around 6x — deliberately ludicrous",
            act: "bet",
          },
        ],
      },
      {
        heading: "An overpair facing aggression",
        lines: [
          {
            when: "A nit or TAG fights back",
            then: "Fold. The easiest laydown there is.",
            act: "fold",
          },
          {
            when: "A fish or SLP",
            then: "Get away much less. Their bets are small — call down.",
            act: "check",
          },
          {
            when: "Flop raise versus turn raise",
            then: "A flop raise can be a draw. A turn raise is the nuts.",
            act: "read",
          },
        ],
      },
      {
        heading: "Fish tells",
        lines: [
          {
            when: "Min bet, donk bet, probe bet",
            then: "Weakness. Raise wide, especially in position.",
            act: "bet",
          },
          {
            when: "Bet size doesn't change street to street",
            then: "The hand didn't improve. Rarely better than top pair.",
            act: "read",
          },
          {
            when: "They bluff missed draws",
            then: "For a quarter pot. A pot-sized bet is a real hand.",
            act: "read",
          },
          {
            when: "They read a big bet as a bluff",
            then: "So show up with the nuts, every time",
            act: "bet",
          },
        ],
      },
    ],
  },

  {
    id: "spots",
    title: "Named spots",
    groups: [
      {
        heading: "Limped pots",
        lines: [
          {
            when: "Getting heavily involved",
            then: "Two pair or better only. This is one of the biggest sources of routine spew.",
            act: "fold",
          },
          {
            when: "Top pair no kicker, out of position",
            then: "Check/call. Don't build a pot.",
            act: "check",
          },
          {
            when: "Checked to you twice",
            then: "Bet regardless of the card. Nobody checks twice with anything good.",
            act: "bet",
          },
        ],
      },
      {
        heading: "Draws",
        lines: [
          {
            when: "A non-nut draw",
            then: "Check the reverse implied odds first — your reward for hitting may be losing a huge pot",
            act: "fold",
          },
          { when: "12 outs or more", then: "Raise", act: "bet" },
          {
            when: "Fewer than 12 outs",
            then: "Call, and play a smaller pot",
            act: "check",
          },
          {
            when: "A big draw against a bad player",
            then: "Play it passively. Worth a percent to avoid a monstrous flip and the tilt after it.",
            act: "check",
          },
        ],
      },
      {
        heading: "Maniacs",
        lines: [
          { when: "Calling their open shove", then: "66+ and A9o+", act: "check" },
          {
            when: "Early position, full ring, many left to act",
            then: "Fold AJ and 99 anyway",
            act: "fold",
          },
          {
            when: "Splashy but not shoving",
            then: "Get a pair or a draw and let them bet",
            act: "check",
          },
          {
            when: "You pick up a big hand",
            then: "Limp re-raise — unless they min-3-bet everything",
            act: "bet",
          },
          {
            when: "Their table",
            then: "Pull it out of the stack and give it your attention",
            act: "read",
          },
        ],
      },
      {
        heading: "Dynamic",
        lines: [
          {
            when: "You just won big pots off a fish without showing",
            then: "Value bet lighter, bluff-catch more, waste fewer cbets",
            act: "bet",
          },
        ],
      },
    ],
  },

  {
    id: "self",
    title: "Table and self",
    groups: [
      {
        lines: [
          { when: "Bankroll", then: "20–30 buy-ins", act: "read" },
          {
            when: "Buy in for",
            then: "100bb while learning, 250bb once you beat it",
            act: "read",
          },
          { when: "A deep fish at the table", then: "Match his stack", act: "read" },
          {
            when: "Tables",
            then: "Add one at a time. Stop when your decisions start degrading.",
            act: "read",
          },
          {
            when: "Table average VPIP under 20 at 6-max",
            then: "Leave. There is no fish bringing it up.",
            act: "fold",
          },
          {
            when: "Anyone with VPIP 40+",
            then: "Tag as a fish, at the end of the session",
            act: "read",
          },
          {
            when: "Sitting down",
            then: "Wait for the big blind. Don't post.",
            act: "check",
          },
          {
            when: "Leaving",
            then: "Play your free hands until the blind comes round",
            act: "check",
          },
          {
            when: "An open-shoving maniac at the table",
            then: "Post and sit immediately",
            act: "bet",
          },
          {
            when: "Stop-loss, 3–5 buy-ins",
            then: "Close every table at once. Leave the room. Done for the day.",
            act: "fold",
          },
          { when: "Tilting at all", then: "Leave all tables now", act: "fold" },
          {
            when: "The short run",
            then: "Under 100k hands. It means nothing — judge decisions, not results.",
            act: "read",
          },
          {
            when: "A small edge against staying off tilt",
            then: "Take the lower variance",
            act: "check",
          },
        ],
      },
    ],
  },

  {
    id: "aged",
    title: "What has aged",
    groups: [
      {
        lines: [
          {
            when: "Fast-fold pools",
            then: "Capped at 100bb with no table selection, so the deep-stack, table-selection and dynamic rules don't apply there",
            act: "read",
          },
          {
            when: "Cbet sizing against regs at NL5+",
            then: "The modern default is much smaller — 25–33% on dry boards. Keep the sizes above for recreational players.",
            act: "read",
          },
          {
            when: "Cbet frequency against thinking opponents",
            then: "75% is high by modern standards. Against fish it is still right.",
            act: "read",
          },
          {
            when: "Blind defence",
            then: "Modern play defends the big blind wider against late-position opens. The 'lose the least' stance is right; the ranges are tighter than current standards.",
            act: "read",
          },
          {
            when: "Regs with solver habits",
            then: "Multiple sizings, small cbets, turn probes. Against those specific players 'their raise is the nuts' softens — against the rest of the pool it holds.",
            act: "read",
          },
        ],
      },
    ],
  },
];
