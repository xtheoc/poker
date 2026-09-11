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
            when: "No top pair or better",
            then: "Give up. Don't put another penny in the pot unless they bet very small (under 1/4 pot) and you have a chance to improve.",
          },
        ],
      },
      {
        heading: "Betting for value",
        lines: [
          {
            when: "Top pair or small overpair vs fish or SLP (passive caller)",
            then: "Bet 75% of the pot.",
            act: "bet",
          },
          {
            when: "Top pair or small overpair vs TAG (good regular)",
            then: "Control the pot size. Check, or check and fold to a bet.",
            act: "check",
          },
          {
            when: "Two pair or better",
            then: "Bet 75%+ against everyone. Play for their whole stack.",
            act: "bet",
          },
        ],
      },
      {
        heading: "Facing a raise or bet",
        lines: [
          {
            when: "They raise or bet into you",
            then: "Fold often, even with an overpair. A turn raise usually means they have a huge hand.",
            act: "fold",
          },
          {
            when: "General rule",
            then: "If your hand can't beat two pair, strongly consider folding.",
            act: "fold",
          },
        ],
        note: "Microstakes players rarely bluff-raise the turn. It costs too much.",
      },
      {
        heading: "Betting as a bluff",
        lines: [
          {
            when: "You picked up a good draw",
            then: "Bet again.",
            act: "bet",
          },
          {
            when: "Against a fish (plays too many hands, calls too much)",
            then: "Never bluff. Keep the pot small if you only have a draw.",
            act: "fold",
          },
          {
            when: "Flop checked through, you have a hand",
            then: "Bet for value now. If they raise, fold.",
            act: "bet",
          },
          {
            when: "Flop checked through, you have nothing, in position",
            then: "Always bet. Nobody checks twice with a good hand.",
            act: "bet",
          },
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
          { when: "Default", then: "Give up.", act: "fold" },
          {
            when: "A fish bets small (1/4 pot) and obvious draws missed",
            then: "Call with AJ-high or better.",
            act: "check",
          },
        ],
      },
      {
        heading: "Value betting",
        lines: [
          { when: "Top pair", then: "Bet about 2/3 of the pot.", act: "bet" },
          { when: "Top pair vs fish or SLP", then: "Bet big.", act: "bet" },
          {
            when: "Middle pair vs fish or SLP",
            then: "Bet for value. They will call with worse.",
            act: "bet",
          },
          {
            when: "Middle pair, board has no draws, vs a fish",
            then: "Bet half pot to invite a hero call.",
            act: "bet",
          },
          {
            when: "Middle pair vs a good regular (TAG)",
            then: "Check, unless you have a great kicker.",
            act: "check",
          },
          {
            when: "Third pair and below",
            then: "Check it down against everyone.",
            act: "check",
          },
        ],
      },
      {
        heading: "Calling a bet (Check their Aggression Factor / AF)",
        lines: [
          {
            when: "AF 1 or less (Passive)",
            then: "Fold. They only bet good hands.",
            act: "fold",
          },
          {
            when: "AF 2",
            then: "Call if the river card is safe. Fold if it completes draws.",
            act: "check",
          },
          {
            when: "AF 3+",
            then: "Call if safe. A scary card is a close decision.",
            act: "check",
          },
          {
            when: "They bet pot-size or an overbet",
            then: "Usually a real hand. Fold.",
            act: "fold",
          },
        ],
      },
      {
        heading: "They raise your bet",
        lines: [
          {
            when: "Any real raise (3x or more)",
            then: "Fold instantly. Nobody bluffs here.",
            act: "fold",
          },
          {
            when: "A fish mini-raises a small pot",
            then: "Call with top pair, good kicker or better.",
            act: "check",
          },
        ],
      },
    ],
  },

  {
    id: "big",
    title: "Big hands",
    groups: [
      {
        lines: [{ act: "bet", when: "Sets and overpairs", then: "Bet flop, bet turn, shove river." }],
        note: "This is where your win rate comes from. Bad players call big bets. Don't get tricky.",
      },
      {
        heading: "Sets (Three of a kind)",
        lines: [
          {
            when: "You called preflop",
            then: "Raise big if they bet. Check-raise big if they check to you.",
            act: "bet",
          },
          {
            when: "You raised preflop",
            then: "Bet big (cbet). If they lead into you, raise big.",
            act: "bet",
          },
          {
            when: "What big means",
            then: "3–4x their bet. Even more against bad players or tiny bets.",
            act: "bet",
          },
          {
            when: "Board gets scary (four to a straight or flush)",
            then: "Slow down. Consider folding the river.",
            act: "fold",
          },
        ],
      },
      {
        heading: "Other big hands",
        lines: [
          {
            when: "Two pair on a safe board",
            then: "Bet big on all three streets.",
            act: "bet",
          },
          {
            when: "Two pair, but straight and flush draws hit",
            then: "Check/call or check/fold.",
            act: "check",
          },
          {
            when: "Four of a kind or better",
            then: "The only time you slowplay. Shove the river.",
            act: "check",
          },
          {
            when: "You have the absolute best hand (nuts) against a bad player on the flop",
            then: "Raise huge (like 6x).",
            act: "bet",
          },
        ],
      },
      {
        heading: "Overpair facing a raise",
        lines: [
          {
            when: "A good player (TAG/Nit) raises you",
            then: "Fold. Easiest decision you'll make.",
            act: "fold",
          },
          {
            when: "A fish or SLP raises you",
            then: "Call down. Their bets are usually small.",
            act: "check",
          },
          {
            when: "Flop raise vs Turn raise",
            then: "Flop raises can be draws. Turn raises are almost always huge hands.",
            act: "read",
          },
        ],
      },
    ],
  },

  {
    id: "spots",
    title: "Common situations",
    groups: [
      {
        heading: "Limped pots (nobody raised preflop)",
        lines: [
          {
            when: "Getting heavily involved",
            then: "You need two pair or better. Playing big pots here is a huge leak.",
            act: "fold",
          },
          {
            when: "Top pair, bad kicker, out of position",
            then: "Check and call. Don't build a big pot.",
            act: "check",
          },
          {
            when: "Checked to you twice",
            then: "Bet any two cards. Nobody has anything.",
            act: "bet",
          },
        ],
      },
      {
        heading: "Draws (waiting for a straight or flush)",
        lines: [
          {
            when: "Drawing to a hand that isn't the best possible (non-nut draw)",
            then: "Be careful. Hitting it might just cost you a huge pot against a better flush.",
            act: "fold",
          },
          { when: "12 outs or more (e.g. straight + flush draw)", then: "Raise.", act: "bet" },
          {
            when: "Fewer than 12 outs",
            then: "Call, keep the pot small.",
            act: "check",
          },
          {
            when: "A big draw against a bad player",
            then: "Play passively. Don't flip coins for your whole stack.",
            act: "check",
          },
        ],
      },
      {
        heading: "Maniacs (crazy aggressive players)",
        lines: [
          { when: "Calling their open shove", then: "66+ and A9o+.", act: "check" },
          {
            when: "Splashy but not shoving",
            then: "Make a pair or a draw and let them bet into you.",
            act: "check",
          },
          {
            when: "You pick up a big hand",
            then: "Limp, then re-raise when they inevitably bet.",
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
          { when: "Bankroll", then: "20–30 buy-ins.", act: "read" },
          {
            when: "Buy in for",
            then: "100bb. Always top up.",
            act: "read",
          },
          { when: "A deep fish at the table", then: "Match his stack size if you can cover it.", act: "read" },
          {
            when: "Adding tables",
            then: "One at a time. Stop when you start making worse decisions.",
            act: "read",
          },
          {
            when: "Table average VPIP under 20",
            then: "Leave the table. No bad players to win money from.",
            act: "fold",
          },
          {
            when: "Sitting down or leaving",
            then: "Always wait for the big blind.",
            act: "check",
          },
          {
            when: "Stop-loss (losing 3–5 buy-ins)",
            then: "Close everything. Done for the day.",
            act: "fold",
          },
          { when: "Feeling tilt or frustration", then: "Leave immediately.", act: "fold" },
          {
            when: "The short run",
            then: "Under 100k hands is just luck. Focus on good decisions, not the money.",
            act: "read",
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
            when: "Fast-fold pools (Zoom)",
            then: "Deep-stack and table-selection rules don't apply there.",
            act: "read",
          },
          {
            when: "Cbet frequency against thinking opponents",
            then: "75% is high today, but against NL2 fish it is still correct.",
            act: "read",
          },
          {
            when: "Blind defence",
            then: "Modern players defend the big blind wider. The book's tight ranges are safer while learning.",
            act: "read",
          },
        ],
      },
    ],
  },
];
