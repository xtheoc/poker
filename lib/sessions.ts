/**
 * Sittings, and the statistics that describe one.
 *
 * The hard part of a session review is not the arithmetic — it is refusing to
 * report numbers that do not mean anything yet. Every conventional poker stat
 * needs a sample before it is a fact rather than a coin flip, and the
 * thresholds are not close together: VPIP and PFR settle around 300 hands,
 * three-bet around 1,000, and the showdown family (WWSF, WTSD, W$SD) needs
 * roughly 8,000. At under a thousand hands a week the last group is the better
 * part of a year away.
 *
 * So each stat carries its own sample size and whether that sample is enough.
 * A number below its threshold is still shown — it is a true description of
 * what happened in this session — but it is labelled as description rather than
 * diagnosis, and it may never generate a drill. A tool that reports a leak from
 * forty hands is pointing at randomness, and drilling randomness is worse than
 * not drilling.
 *
 * The one stat here that needs no gate is preflop chart accuracy, because it is
 * not an estimate at all: each decision was either in the chart's range or it
 * was not. That is why it leads the review.
 */

/** One hand, reduced to what a session review needs from it. */
export interface SessionHand {
  psHandId: string;
  /** Your two-card class, when the imported history contained hole cards. */
  handClass?: string | null;
  playedAt: Date;
  /** Profit or loss in big blinds. */
  netBb: number;
  vpip: boolean;
  pfr: boolean;
  sawFlop: boolean;
  wentToShowdown: boolean;
  wonAtShowdown: boolean;
  /** Collected the pot, with or without a showdown. */
  won: boolean;
  /** Preflop decisions in this hand the chart set covers. */
  chartedDecisions: number;
  /** How many of those the chart disagreed with. */
  mistakes: number;
  /** The seat you played it from. Null for a hand you were not dealt into. */
  position: string | null;
}

/**
 * A gap longer than this starts a new sitting.
 *
 * Matches the leak engine's definition, and for the same reason: three errors
 * across three evenings is a habit, while three in ten minutes may be one bad
 * table. An hour survives a coffee break and still separates an afternoon from
 * an evening.
 */
export const SESSION_GAP_MINUTES = 60;

export interface PlaySession {
  /**
   * The first hand's PokerStars id.
   *
   * Used as the session's identity because it is stable, readable in a URL, and
   * needs no table of its own. Sessions are derived from gaps rather than
   * stored, so importing an old file re-groups history correctly instead of
   * leaving rows that disagree with the hands they claim to summarise.
   */
  id: string;
  startedAt: Date;
  endedAt: Date;
  hands: SessionHand[];
}

/** Split hands into sittings, newest sitting first. */
export function groupSessions(hands: readonly SessionHand[]): PlaySession[] {
  const ordered = [...hands].sort(
    (a, b) => a.playedAt.getTime() - b.playedAt.getTime(),
  );

  const sessions: PlaySession[] = [];
  const gapMs = SESSION_GAP_MINUTES * 60_000;

  for (const hand of ordered) {
    const current = sessions[sessions.length - 1];
    if (current && hand.playedAt.getTime() - current.endedAt.getTime() <= gapMs) {
      current.hands.push(hand);
      current.endedAt = hand.playedAt;
      continue;
    }
    sessions.push({
      id: hand.psHandId,
      startedAt: hand.playedAt,
      endedAt: hand.playedAt,
      hands: [hand],
    });
  }

  return sessions.reverse();
}

/** Find the sitting a given hand belongs to. */
export function sessionContaining(
  sessions: readonly PlaySession[],
  psHandId: string,
): PlaySession | undefined {
  return sessions.find(
    (s) => s.id === psHandId || s.hands.some((h) => h.psHandId === psHandId),
  );
}

/** A week of sittings, newest first. */
export interface PlayWeek {
  /** Monday of that week, as an ISO date. */
  id: string;
  startedAt: Date;
  sessions: PlaySession[];
}

/**
 * Group sittings into weeks, starting Monday.
 *
 * At under a thousand hands a week, the week is the unit that carries signal: a
 * single sitting is too small to say much, and "all time" hides whether last
 * month was better than this one. It is also how anyone thinks about their own
 * volume — "I played three times this week", never "I played sitting 47".
 */
export function groupWeeks(sessions: readonly PlaySession[]): PlayWeek[] {
  const weeks = new Map<string, PlayWeek>();

  for (const session of sessions) {
    const monday = startOfWeek(session.startedAt);
    const id = monday.toISOString().slice(0, 10);

    const week = weeks.get(id);
    if (week) week.sessions.push(session);
    else weeks.set(id, { id, startedAt: monday, sessions: [session] });
  }

  return [...weeks.values()].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
  );
}

function startOfWeek(at: Date): Date {
  const monday = new Date(at);
  // getDay() is 0 on Sunday, which belongs to the week that began six days
  // earlier rather than starting a new one.
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** One point on the accuracy trend. */
export interface TrendPoint {
  at: Date;
  /** Charted decisions that matched the chart, 0-100. */
  accuracy: number;
  charted: number;
  hands: number;
}

/**
 * Preflop accuracy per sitting, oldest first.
 *
 * The one question the app could not previously answer: whether you are getting
 * better. Built on accuracy rather than results, because accuracy needs no
 * sample gate — each decision was inside the chart's range or outside it, so
 * even a short sitting says something true, where a short sitting's win rate
 * says almost nothing.
 *
 * Sittings with nothing gradeable are dropped rather than plotted as zero. An
 * evening of limped pots is not an evening where you played badly.
 */
export function accuracyTrend(sessions: readonly PlaySession[]): TrendPoint[] {
  return sessions
    .map((session) => {
      const stats = statsFor(session.hands);
      return {
        at: session.startedAt,
        accuracy: stats.accuracy,
        charted: stats.charted,
        hands: stats.hands,
      };
    })
    .filter((point) => point.charted > 0)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Seats, in order of action. Used to lay results out the way a table sits. */
export const POSITION_ORDER = ["UTG", "HJ", "CO", "BTN", "SB", "BB"] as const;

/** How one seat has treated you. */
export interface PositionResult {
  position: string;
  hands: number;
  netBb: number;
  /** Big blinds per 100 hands from this seat. */
  bbPer100: number;
  /** True once the money here is worth reading as more than noise. */
  reliable: boolean;
  charted: number;
  mistakes: number;
  /** Share of charted decisions from this seat that matched, 0-100. */
  accuracy: number;
}

/**
 * Hands per seat before a win rate from it says anything.
 *
 * Deliberately large, and still generous. A win rate is the slowest-converging
 * number in poker — slower than every stat in `STAT_THRESHOLDS`, because it is
 * driven by rare large pots rather than by frequent small decisions — and
 * splitting a sample six ways makes each seat six times slower again. Published
 * guidance for a *whole-sample* win rate runs into six figures; this threshold
 * is not "now it is proven", it is "now it is worth a second look".
 *
 * It is set here rather than left implicit because the alternative is a table
 * that says "you lose 14bb/100 from the small blind" after ninety hands, which
 * is a sentence about variance wearing the clothes of a diagnosis.
 */
export const POSITION_RESULT_THRESHOLD = 5_000;

/**
 * Results by seat, worst money first.
 *
 * Two numbers per seat, and the difference between them is the point.
 *
 * **The money is a record, not a diagnosis.** It is what happened, which is
 * worth seeing, and at any realistic volume it is mostly variance — so it
 * carries `reliable` and the interface must say so rather than let a big red
 * number imply a leak that is not there.
 *
 * **The accuracy is a fact from the first hand.** Every charted decision from
 * that seat was inside the range or outside it, no sample needed. If you are
 * genuinely playing a seat badly, this is the number that shows it today, and
 * it is why both are reported side by side instead of just the one that was
 * asked for.
 *
 * Seats you have never played are omitted rather than shown as zero: an empty
 * row reads as "breakeven here", which is a claim about a seat you have no
 * evidence about at all.
 */
export function resultsByPosition(
  hands: readonly SessionHand[],
): PositionResult[] {
  const bySeat = new Map<string, SessionHand[]>();

  for (const hand of hands) {
    if (!hand.position) continue;
    const list = bySeat.get(hand.position);
    if (list) list.push(hand);
    else bySeat.set(hand.position, [hand]);
  }

  const results: PositionResult[] = [];
  for (const [position, group] of bySeat) {
    const netBb = group.reduce((sum, h) => sum + h.netBb, 0);
    const charted = group.reduce((sum, h) => sum + h.chartedDecisions, 0);
    const mistakes = group.reduce((sum, h) => sum + h.mistakes, 0);

    results.push({
      position,
      hands: group.length,
      netBb: Math.round(netBb * 100) / 100,
      bbPer100: Math.round((netBb / group.length) * 10_000) / 100,
      reliable: group.length >= POSITION_RESULT_THRESHOLD,
      charted,
      mistakes,
      accuracy: charted > 0 ? ((charted - mistakes) / charted) * 100 : 0,
    });
  }

  // Worst first, which is what the question "where am I losing money" asks.
  // Ties break on volume so the bigger sample leads.
  return results.sort((a, b) => a.netBb - b.netBb || b.hands - a.hands);
}

/**
 * A percentage, with the evidence behind it.
 *
 * `reliable` is the whole point of this type. A stat carrying its own verdict
 * on its sample cannot be rendered as though it were solid by a component that
 * forgot to check.
 */
export interface Stat {
  /** The percentage, 0-100. */
  value: number;
  /** Hands, or opportunities, this was computed from. */
  samples: number;
  /** Sample needed before this stabilises. */
  threshold: number;
  reliable: boolean;
}

/**
 * Sample sizes at which each statistic stops moving around.
 *
 * These are published stabilisation points, not house rules. They are worth
 * stating in code because the temptation to quietly lower them — so the app has
 * something to say on day one — is exactly the failure this platform exists to
 * avoid.
 */
export const STAT_THRESHOLDS = {
  vpip: 300,
  pfr: 300,
  wwsf: 8_000,
  wtsd: 8_000,
  wsd: 8_000,
} as const;

function stat(hits: number, samples: number, threshold: number): Stat {
  return {
    value: samples > 0 ? (hits / samples) * 100 : 0,
    samples,
    threshold,
    reliable: samples >= threshold,
  };
}

export interface SessionStats {
  hands: number;
  netBb: number;
  /** Big blinds won per 100 hands — the standard unit for a win rate. */
  bbPer100: number;
  minutes: number;
  /** Preflop decisions the chart covers. The denominator that is never gated. */
  charted: number;
  mistakes: number;
  /** Share of charted decisions that matched the chart, 0-100. */
  accuracy: number;
  vpip: Stat;
  pfr: Stat;
  /** Won when saw flop. */
  wwsf: Stat;
  /** Went to showdown. */
  wtsd: Stat;
  /** Won money at showdown. */
  wsd: Stat;
}

/**
 * Statistics for a set of hands.
 *
 * Takes hands rather than a session so the same function serves one sitting and
 * a whole history — the second is what eventually unlocks a gated stat.
 */
export function statsFor(hands: readonly SessionHand[]): SessionStats {
  const count = hands.length;
  const netBb = hands.reduce((sum, h) => sum + h.netBb, 0);
  const charted = hands.reduce((sum, h) => sum + h.chartedDecisions, 0);
  const mistakes = hands.reduce((sum, h) => sum + h.mistakes, 0);

  const sawFlop = hands.filter((h) => h.sawFlop);
  const showdowns = hands.filter((h) => h.wentToShowdown);

  const times = hands.map((h) => h.playedAt.getTime());
  const minutes =
    count > 1 ? (Math.max(...times) - Math.min(...times)) / 60_000 : 0;

  return {
    hands: count,
    netBb: Math.round(netBb * 100) / 100,
    bbPer100: count > 0 ? Math.round((netBb / count) * 10_000) / 100 : 0,
    minutes: Math.round(minutes),
    charted,
    mistakes,
    accuracy: charted > 0 ? ((charted - mistakes) / charted) * 100 : 0,
    vpip: stat(hands.filter((h) => h.vpip).length, count, STAT_THRESHOLDS.vpip),
    pfr: stat(hands.filter((h) => h.pfr).length, count, STAT_THRESHOLDS.pfr),
    // Denominated in flops seen, not hands dealt — that is what the stat means,
    // and it is also why it takes so many hands to stabilise.
    wwsf: stat(
      sawFlop.filter((h) => h.won).length,
      sawFlop.length,
      STAT_THRESHOLDS.wwsf,
    ),
    wtsd: stat(showdowns.length, sawFlop.length, STAT_THRESHOLDS.wtsd),
    wsd: stat(
      showdowns.filter((h) => h.wonAtShowdown).length,
      showdowns.length,
      STAT_THRESHOLDS.wsd,
    ),
  };
}
