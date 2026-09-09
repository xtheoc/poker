/**
 * The reading progression.
 *
 * Kept as versioned data in the repo rather than rows in a database, because it
 * is content: it gets edited, reviewed and argued with like code. Only progress
 * through it belongs to the user.
 *
 * Three principles it encodes, each of which cost real research to establish:
 *
 * **Stages unlock on demonstrated skill, not on time served.** The structure is
 * borrowed from Ed Miller's *The Course*, which organises itself as numbered
 * skills gated by the stake you play — the best progression structure in poker
 * literature. The difference here is that the gate is what your own hands show,
 * which only a platform holding your history can check.
 *
 * **Every book carries an honest verdict on what has aged.** Preflop content
 * published before roughly 2016 is not slightly dated, it is a different
 * strategy — solvers changed it categorically. A reading list that hides this
 * sends people off to memorise ranges that are wrong.
 *
 * **The path has an end.** Books build the model; a solver populates it. Saying
 * so is the difference between a study plan and nostalgia.
 */

export interface BookOption {
  id: string;
  title: string;
  author: string;
  year: number;
  pages?: number;
  /** Hours of genuine active study — annotating and working problems. */
  activeHours: [number, number];
  /** Why it belongs at this stage. */
  teaches: string;
  /** What it deliberately does not cover. */
  notCovered?: string;
  /** What has aged, stated plainly. Absent when nothing has. */
  aged?: string;
  /** The default pick for this stage. */
  recommended?: boolean;
  free?: boolean;
  url?: string;
}

export interface Stage {
  id: string;
  number: number;
  name: string;
  goal: string;
  /** What demonstrates you are ready to move on. */
  moveOnWhen: string;
  options: BookOption[];
}

export const STAGES: Stage[] = [
  {
    id: "foundations",
    number: 0,
    name: "Foundations",
    goal: "Stop losing. Preflop discipline, position, and not paying people off.",
    moveOnWhen:
      "Your opening ranges hold up in the drill, and hand review stops finding loose opens.",
    options: [
      {
        id: "crushing-microstakes",
        title: "Crushing the Microstakes",
        author: "Nathan 'BlackRain79' Williams",
        year: 2011,
        pages: 253,
        activeHours: [8, 12],
        teaches:
          "A prescriptive tight-aggressive blueprint written for exactly NL2–NL5. No theory, no mathematics — just what to do against players who call too much.",
        notCovered: "Any GTO or solver reasoning, multiway postflop, tournaments.",
        aged:
          "The exploitative logic still works, because micro-stakes populations really have not moved. The operational advice has aged worse — tracking-software rules and table-selection policy have both changed since. Its preflop ranges predate solvers, which barely matters at NL2.",
        recommended: true,
      },
      {
        id: "the-course",
        title: "The Course",
        author: "Ed Miller",
        year: 2015,
        pages: 306,
        activeHours: [20, 25],
        teaches:
          "Ten numbered skills gated by stake, from preflop simplicity through barrelling and board texture to beating pros. The clearest 'what do I do next' progression in poker literature.",
        notCovered: "Online play, tournaments, GTO, solvers.",
        aged:
          "Mildly, and by its own success — the advice spread and live games adjusted. Preflop is pre-solver. Skills 4 to 10 are timeless.",
      },
      {
        id: "mastering-small-stakes",
        title: "Mastering Small Stakes No-Limit Hold'em",
        author: "Jonathan Little",
        year: 2017,
        pages: 480,
        activeHours: [30, 40],
        teaches:
          "A small-stakes baseline covering both cash and tournaments, plus the adjustments once opponents get competent.",
        notCovered: "Deep GTO derivation, ICM depth.",
        aged:
          "Post-solver enough to be structurally safe; the ranges are 2017-vintage and slightly loose against current solutions. Worth knowing it has very few published ratings, so there is no real community consensus on it.",
      },
    ],
  },
  {
    id: "fundamentals",
    number: 1,
    name: "Fundamentals",
    goal: "One coherent strategy across every street and position.",
    moveOnWhen:
      "You can explain why a line is right, not just that it is — and the leak engine stops finding the same postflop pattern.",
    options: [
      {
        id: "grinders-manual",
        title: "The Grinder's Manual",
        author: "Peter 'Carroters' Clarke",
        year: 2016,
        pages: 540,
        activeHours: [45, 60],
        teaches:
          "A complete 6-max online cash syllabus: opening ranges, isolation, c-betting, value betting, blockers, 3-bet pots, stack depth. Fifteen chapters, 152 fully analysed hands, and it insists you know why.",
        notCovered: "Multiway pots, tournaments, ICM, solver operation.",
        aged:
          "Aging but structurally sound. Written before cheap solver access, so bet sizing is simplified — largely single-size c-betting where modern solutions mix small, large and overbet — and the preflop ranges are tighter than current solutions, especially big-blind defence. The reasoning is not outdated.",
        recommended: true,
      },
      {
        id: "excelling-nlhe",
        title: "Excelling at No-Limit Hold'em",
        author: "Jonathan Little (ed.), 17 contributors",
        year: 2015,
        pages: 493,
        activeHours: [25, 35],
        teaches:
          "Seventeen expert essays spanning fundamentals, range analysis, short stacks, final tables and the mental game. Breadth-first, for when you do not yet know which sub-skill is weakest.",
        notCovered: "Anything to depth. It is a sampler by construction.",
        aged:
          "Mixed by chapter. The 2015 GTO chapter is an artifact; the tells and mental-game chapters hold up fully.",
      },
    ],
  },
  {
    id: "modern-theory",
    number: 2,
    name: "Modern theory",
    goal: "Understand equilibrium well enough to interrogate a solver rather than copy it.",
    moveOnWhen:
      "This is where a solver subscription starts paying for itself. Reading past here without one has diminishing returns.",
    options: [
      {
        id: "daily-dose-gto",
        title: "Daily Dose of GTO",
        author: "Tom Boshoff & Daniel Jacobson",
        year: 2024,
        activeHours: [25, 30],
        teaches:
          "Over 300 quizzes in five-minute units covering poker maths, core concepts and format adjustments. Free, current, and already shaped like spaced repetition — start it in month one alongside everything else.",
        free: true,
        url: "https://www.dailydoseofgto.com/",
        recommended: true,
      },
      {
        id: "play-optimal-poker",
        title: "Play Optimal Poker",
        author: "Andrew Brokos",
        year: 2019,
        pages: 245,
        activeHours: [25, 35],
        teaches:
          "Game theory from first principles through toy games — the clairvoyance game, polarised versus condensed ranges, indifference — then bridges to real hold'em. The consensus book to read before any solver subscription.",
        notCovered: "Real preflop ranges, real board-texture solutions.",
        aged:
          "No. Game theory does not rot, so this is the safest long-term buy on the list. The recurring criticism is fair though: the toy games are abstract, and some readers want hands instead.",
      },
      {
        id: "play-optimal-poker-2",
        title: "Play Optimal Poker 2: Range Construction",
        author: "Andrew Brokos",
        year: 2020,
        pages: 245,
        activeHours: [25, 35],
        teaches:
          "Turns the first book's abstractions into actual decisions: leverage, protection, range advantage, turn barrelling, out-of-position c-betting.",
        notCovered: "Preflop solutions, ICM.",
        aged: "No. Rated even higher than the first volume, on a thinner sample.",
      },
    ],
  },
  {
    id: "advanced",
    number: 3,
    name: "Advanced reference",
    goal: "Reference-grade depth. These are lookup books, not read-through books.",
    moveOnWhen: "You are using them as references rather than reading them.",
    options: [
      {
        id: "modern-poker-theory",
        title: "Modern Poker Theory",
        author: "Michael Acevedo",
        year: 2019,
        pages: 480,
        activeHours: [25, 35],
        teaches:
          "The most complete single-volume GTO textbook there is: MDF and alpha, range and nut advantage, then postflop decision trees by texture, stack-to-pot ratio and position.",
        notCovered: "Exploitative adaptation in depth, multiway, three-way spots.",
        aged:
          "Half-obsolete by its own success. Roughly 300 of its 480 pages are preflop charts that a solver subscription strictly dominates, and it has no three-way solutions. Read chapters 1–2 and the postflop half; treat the preflop section as an appendix you never open. Do not budget eighty hours for it.",
      },
      {
        id: "janda-advanced",
        title: "No-Limit Hold'em for Advanced Players",
        author: "Matthew Janda",
        year: 2017,
        pages: 339,
        activeHours: [35, 45],
        teaches:
          "Theoretically sound poker rebuilt on solver output, aimed at games full of competent regulars. The more current of Janda's two books.",
        notCovered: "Preflop comprehensively, tournaments.",
        aged:
          "Mildly — 2017 solver work used simpler trees than current multi-sizing solutions. Where this and his 2013 Applications disagree, trust this one.",
        recommended: true,
      },
    ],
  },
  {
    id: "exploitative",
    number: 4,
    name: "Exploitative play",
    goal: "Deviate from equilibrium profitably against actual humans.",
    moveOnWhen:
      "Most reading lists treat GTO as the summit and put this last. Below high stakes it matters more than stage 3 does.",
    options: [
      {
        id: "beyond-gto",
        title: "Beyond GTO: Poker Exploits Simplified",
        author: "Barry Carter & Dara O'Kearney",
        year: 2024,
        activeHours: [12, 18],
        teaches:
          "Uses node-locking to derive exploits rather than equilibrium — the first book to do this systematically. Won Best Poker Book at the 2024 Global Poker Awards.",
        recommended: true,
      },
      {
        id: "exploitative-edge",
        title: "The Exploitative Edge",
        author: "James Sweeney & Adam Jones",
        year: 2025,
        activeHours: [8, 12],
        teaches:
          "A four-pillar framework for opponent profiling and sizing tells, explicitly against memorising solver output. The shortest and most practical of the exploitative books.",
        aged: "Too new for real consensus — promising rather than proven.",
      },
    ],
  },
  {
    id: "mental",
    number: 5,
    name: "Mental game",
    goal: "The part of the game the strategy books do not touch. Start early, not last.",
    moveOnWhen: "Never finished. Re-read it.",
    options: [
      {
        id: "mental-game-poker",
        title: "The Mental Game of Poker",
        author: "Jared Tendler & Barry Carter",
        year: 2011,
        pages: 250,
        activeHours: [10, 14],
        teaches:
          "A diagnostic system for tilt — seven distinct types — plus variance tolerance, confidence and motivation. Read this in month one: it protects everything that comes after it.",
        aged:
          "No. Format-independent and solver-independent, so it cannot go out of date. It also has by far the largest body of reader consensus of any book here.",
        recommended: true,
      },
      {
        id: "mental-game-poker-2",
        title: "The Mental Game of Poker 2",
        author: "Jared Tendler & Barry Carter",
        year: 2013,
        pages: 204,
        activeHours: [8, 10],
        teaches:
          "The Zone made reproducible, and the learning process itself — including why there is a lag between studying poker and playing better. Arguably the most useful chapters in the canon for anyone building a study system.",
        aged: "No. The first half is the value; the back half is thinner.",
      },
      {
        id: "elements-of-poker",
        title: "Elements of Poker",
        author: "Tommy Angelo",
        year: 2007,
        pages: 268,
        activeHours: [6, 8],
        teaches:
          "Tilt, quitting, table selection and presence, as short aphoristic essays. Reaches people the workbook style does not.",
        aged:
          "Split verdict. The mental content is timeless; the strategy content is limit-flavoured and weak for no-limit. Read it as a mental-game book only.",
      },
    ],
  },
];

/** Books deliberately excluded, and why — because the question always comes. */
export const NOT_RECOMMENDED = [
  {
    title: "Super System",
    author: "Doyle Brunson",
    year: 1979,
    why: "A historical artifact. Everything actionable is obsolete — it famously rates AKo above AKs, which solvers reverse decisively.",
  },
  {
    title: "The Theory of Poker",
    author: "David Sklansky",
    year: 1987,
    why: "The vocabulary chapters are still worth knowing — expected value, semi-bluffing, implied odds. The technique is not: most examples are stud and draw, and big-bet poker has moved well past it.",
  },
  {
    title: "Harrington on Hold'em",
    author: "Dan Harrington",
    year: 2004,
    why: "One idea survives — the stack-size framework of knowing how many blind rounds you have left. The ranges, lines and frequencies were written for a pre-solver, far softer field.",
  },
  {
    title: "Applications of No-Limit Hold'em",
    author: "Matthew Janda",
    year: 2013,
    why: "Conceptually alive, numerically dead, and fifty to seventy hours long. His 2017 book covers the same ground on solver-verified numbers.",
  },
  {
    title: "Poker's 1%",
    author: "Ed Miller",
    year: 2014,
    why: "Read it for the reframe into frequency-thinking, then discard the content — the frequency model it advocates is not what equilibrium actually looks like. Play Optimal Poker does the same job properly.",
  },
];

export interface PlanEntry {
  window: string;
  bookId: string;
  hours: string;
  note?: string;
}

/**
 * The first year at roughly five hours a week.
 *
 * The allocation rule matters as much as the order: **at most 60% of study
 * hours go to books.** The rest is hand review and drills, or the reading does
 * not convert into results.
 */
export const YEAR_ONE: PlanEntry[] = [
  {
    window: "Month 1",
    bookId: "crushing-microstakes",
    hours: "8–12",
    note: "Written for exactly the stake you are playing.",
  },
  {
    window: "Months 1–2",
    bookId: "mental-game-poker",
    hours: "10–14",
    note: "Early on purpose — it protects everything after it.",
  },
  {
    window: "Months 2–5",
    bookId: "grinders-manual",
    hours: "45–60",
    note: "The big one: the complete 6-max cash syllabus.",
  },
  {
    window: "Daily, all year",
    bookId: "daily-dose-gto",
    hours: "~15",
    note: "Five minutes a day. Free, and already quiz-shaped.",
  },
  {
    window: "Months 7–9",
    bookId: "play-optimal-poker",
    hours: "25–35",
    note: "Add a solver around here. This is the real inflection point.",
  },
  { window: "Months 9–11", bookId: "play-optimal-poker-2", hours: "25–35" },
];

/** Share of study hours that may go to reading before the app pushes back. */
export const MAX_BOOK_SHARE = 0.6;

/**
 * The limit of a books-only path, stated in the product rather than hidden.
 *
 * A study tool implying that reading alone takes you as far as you want to go
 * is lying to its only user.
 */
export const CEILING_NOTE =
  "A books-only path is enough to become a solid winner at micro and small stakes — call it NL2 to NL50. Past that it becomes an active handicap, because your opponents are studying with tools that answer questions books cannot pose. Books build the model, a solver populates it, and volume plus review turns it into instinct.";

export function findBook(id: string): BookOption | undefined {
  for (const stage of STAGES) {
    const match = stage.options.find((b) => b.id === id);
    if (match) return match;
  }
  return undefined;
}

export function stageOf(bookId: string): Stage | undefined {
  return STAGES.find((s) => s.options.some((b) => b.id === bookId));
}
