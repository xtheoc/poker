/**
 * Parsing PokerStars hand histories.
 *
 * We write this ourselves because there is nothing to depend on: the only real
 * JavaScript parser has been untouched since 2020, the package most often
 * recommended for the job does not support PokerStars at all, and the best
 * Python option warns in its own documentation that it fails on certain hands.
 * The format is line-oriented and small, so owning it costs less than working
 * around someone else's gaps — and a format change becomes a fix here rather
 * than a wait on a maintainer.
 *
 * Three rules shape the implementation, each learned from how the abandoned
 * parsers break:
 *
 * 1. **A state machine over section markers, never one large regex.** The
 *    `*** STREET ***` lines are the only reliable structure in the file.
 * 2. **Anchor player lines on the seat roster, longest name first.** Names
 *    legitimately contain spaces, colons, dots and brackets, so `^(\w+):` finds
 *    the wrong boundary the moment someone is called `a: b`. Matching against
 *    names already known is the single biggest source of correctness here.
 * 3. **Never drop a hand.** PokerStars changed this format twice in the year
 *    before this was written. Anything unparseable comes back as an error with
 *    its raw text intact, because a hand we cannot read today is one a fixed
 *    parser can read tomorrow — but only if we kept it.
 */

import type { Position } from "../poker/charts";
import type {
  Action,
  ActionType,
  ParseResult,
  ParsedHand,
  Seat,
  Street,
  StreetActions,
  UnparsedHand,
} from "./types";

/**
 * Position names by how many players were dealt in.
 *
 * Read as the order of action preflop, starting from the seat after the button.
 * Beyond six-handed the naming convention is genuinely contested — whether the
 * seat after the blinds is UTG or UTG+1 depends who you ask — so those tables
 * get null positions rather than a guess that would quietly file hands under
 * the wrong chart node.
 */
const POSITIONS_BY_COUNT: Record<number, Position[]> = {
  3: ["SB", "BB", "BTN"],
  4: ["SB", "BB", "CO", "BTN"],
  5: ["SB", "BB", "HJ", "CO", "BTN"],
  6: ["SB", "BB", "UTG", "HJ", "CO", "BTN"],
};

/** Split a hand-history file into individual hands. */
export function splitHands(text: string): string[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const hands: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (isHeaderLine(line)) {
      if (current.some((l) => l.trim())) hands.push(current.join("\n").trim());
      current = [line];
    } else if (current.length > 0) {
      current.push(line);
    }
  }
  if (current.some((l) => l.trim())) hands.push(current.join("\n").trim());

  return hands;
}

function isHeaderLine(line: string): boolean {
  return /^PokerStars\s+(Zoom\s+|Home\s+)?(Hand|Game)\s+#\d+/.test(line.trim());
}

/** Parse every hand in a file, keeping failures rather than discarding them. */
export function parseFile(text: string): {
  hands: ParsedHand[];
  errors: UnparsedHand[];
} {
  const hands: ParsedHand[] = [];
  const errors: UnparsedHand[] = [];

  for (const chunk of splitHands(text)) {
    const result = parseHand(chunk);
    if (result.ok) hands.push(result.hand);
    else errors.push(result.error);
  }

  return { hands, errors };
}

/** Parse a single hand. */
export function parseHand(raw: string): ParseResult {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  const lines = text.split("\n");
  const fail = (reason: string): ParseResult => ({
    ok: false,
    error: { raw: text, id: readHandId(lines[0] ?? ""), reason },
  });

  if (lines.length === 0 || !text) return fail("empty hand");

  const header = parseHeader(lines[0]);
  if (!header) return fail(`unrecognised header: ${lines[0].slice(0, 120)}`);

  const table = parseTableLine(lines[1] ?? "");
  if (!table) return fail(`unrecognised table line: ${(lines[1] ?? "").slice(0, 120)}`);

  // Seats first: every later line is matched against these names.
  const seats: Seat[] = [];
  let cursor = 2;
  for (; cursor < lines.length; cursor++) {
    const seat = parseSeatLine(lines[cursor]);
    if (!seat) break;
    seats.push(seat);
  }
  if (seats.length === 0) return fail("no seats found");

  const names = seats.map((s) => s.player).sort((a, b) => b.length - a.length);

  const streets: StreetActions[] = [{ street: "preflop", cards: [], actions: [] }];
  let street: StreetActions = streets[0];
  let board: string[] = [];
  const extraBoards: string[][] = [];
  let hero: ParsedHand["hero"];
  let totalPot: number | undefined;
  let rake: number | undefined;
  let ante: number | undefined;
  let inSummary = false;
  // Run-it-twice: the first board continues the hand, later ones are recorded
  // but must not overwrite it.
  let boardRun = 0;

  for (; cursor < lines.length; cursor++) {
    const line = lines[cursor].trim();
    if (!line) continue;

    const marker = line.match(/^\*\*\* (.+?) \*\*\*(.*)$/);
    if (marker) {
      const name = marker[1].toUpperCase();
      const rest = marker[2];

      if (name === "SUMMARY") {
        inSummary = true;
        continue;
      }
      if (name.includes("HOLE CARDS") || name.includes("SHOW DOWN")) continue;

      const run = name.startsWith("FIRST ")
        ? 1
        : name.startsWith("SECOND ")
          ? 2
          : name.startsWith("THIRD ")
            ? 3
            : 0;
      const streetName = toStreet(name.replace(/^(FIRST|SECOND|THIRD)\s+/, ""));
      if (!streetName) continue;

      // "*** TURN *** [flop] [turn]" repeats the board so far; only the last
      // bracket group is new.
      const groups = readBrackets(rest);
      const fresh = groups.length > 0 ? groups[groups.length - 1] : [];

      if (run > 1) {
        boardRun = run;
        extraBoards[run - 2] = [...(extraBoards[run - 2] ?? []), ...fresh];
        continue;
      }

      boardRun = run;
      board = [...board, ...fresh];
      street = { street: streetName, cards: fresh, actions: [] };
      streets.push(street);
      continue;
    }

    if (boardRun > 1) continue;

    const dealt = line.match(/^Dealt to (.+) \[([^\]]+)\]$/);
    if (dealt) {
      hero = { player: dealt[1], cards: dealt[2].trim().split(/\s+/) };
      continue;
    }

    if (inSummary) {
      const pot = line.match(/^Total pot ([^|]+?)(?:\s*\|\s*Rake (.+?))?\s*$/);
      if (pot) {
        totalPot = readAmount(pot[1]);
        if (pot[2]) rake = readAmount(pot[2]);
        continue;
      }
      const boardLine = line.match(/^Board \[([^\]]+)\]$/);
      if (boardLine && board.length === 0) board = boardLine[1].trim().split(/\s+/);
      continue;
    }

    const uncalled = line.match(/^Uncalled bet \(([^)]+)\) returned to (.+)$/);
    if (uncalled) {
      street.actions.push({
        player: uncalled[2],
        type: "uncalled-return",
        amount: readAmount(uncalled[1]),
      });
      continue;
    }

    const player = names.find(
      (n) => line.startsWith(`${n}: `) || line.startsWith(`${n} `),
    );
    if (!player) continue;

    if (line.startsWith(`${player}: `)) {
      const action = parseAction(player, line.slice(player.length + 2));
      if (action) {
        if (action.type === "post-ante") ante = action.amount;
        street.actions.push(action);
      }
      continue;
    }

    // A handful of lines name the player without a colon: winning the pot, and
    // the connection and sit-out notices the client injects mid-hand.
    const rest = line.slice(player.length + 1);

    const collected = rest.match(
      /^collected \(?([^)\s]+)\)? from (?:the )?(?:main |side )?pot/,
    );
    if (collected) {
      street.actions.push({
        player,
        type: "collect",
        amount: readAmount(collected[1]),
      });
      continue;
    }

    const status = parseStatusLine(player, rest);
    if (status) street.actions.push(status);
  }

  assignPositions(seats, table.buttonSeat);

  return {
    ok: true,
    hand: {
      id: header.id,
      gameType: header.tournamentId ? "tournament" : "cash",
      fastFold: header.fastFold,
      tournamentId: header.tournamentId,
      tableName: table.name,
      maxSeats: table.maxSeats,
      buttonSeat: table.buttonSeat,
      smallBlind: header.smallBlind,
      bigBlind: header.bigBlind,
      ante,
      currency: header.currency,
      playedAt: header.playedAt,
      seats,
      hero,
      streets,
      board,
      totalPot,
      rake,
      extraBoards: extraBoards.length > 0 ? extraBoards : undefined,
      raw: text,
    },
  };
}

function toStreet(name: string): Street | null {
  if (name === "FLOP") return "flop";
  if (name === "TURN") return "turn";
  if (name === "RIVER") return "river";
  return null;
}

function readHandId(line: string): string | undefined {
  return line.match(/#(\d+)/)?.[1];
}

interface Header {
  id: string;
  fastFold: boolean;
  tournamentId?: string;
  smallBlind: number;
  bigBlind: number;
  currency: string | null;
  playedAt: Date;
}

function parseHeader(line: string): Header | null {
  const text = line.trim();
  const id = text.match(/^PokerStars\s+(?:Zoom\s+|Home\s+)?(?:Hand|Game)\s+#(\d+):/);
  if (!id) return null;

  const tournamentId = text.match(/Tournament\s+#(\d+)/)?.[1];

  // The stakes are the parenthesised "a/b" immediately before the trailing
  // timestamp — the one thing cash and tournament headers share.
  const stakes = text.match(/\(([^()]*?\/[^()]*?)\)\s+-\s+/);
  if (!stakes) return null;
  const parts = stakes[1].split("/");
  if (parts.length < 2) return null;

  const smallBlind = readAmount(parts[0]);
  const bigBlind = readAmount(parts[1]);
  if (!Number.isFinite(smallBlind) || !Number.isFinite(bigBlind)) return null;

  // Tournaments carry a bracketed Eastern timestamp alongside the local one.
  // Prefer it: one timezone across every hand beats two.
  const bracketed = text.match(/\[([^\]]+)\]\s*$/)?.[1];
  const trailing = text.match(/-\s*([^[]+?)\s*(?:\[[^\]]*\])?\s*$/)?.[1];
  const playedAt = readTimestamp(bracketed ?? trailing ?? "");
  if (!playedAt) return null;

  return {
    id: id[1],
    fastFold: /^PokerStars\s+Zoom/.test(text),
    tournamentId,
    smallBlind,
    bigBlind,
    currency: tournamentId ? null : readCurrency(parts[0]),
    playedAt,
  };
}

function parseTableLine(
  line: string,
): { name: string; maxSeats: number; buttonSeat: number } | null {
  const match = line
    .trim()
    .match(/^Table '(.+)' (\d+)-max.*?Seat #(\d+) is the button/);
  if (!match) return null;
  return {
    name: match[1],
    maxSeats: Number(match[2]),
    buttonSeat: Number(match[3]),
  };
}

function parseSeatLine(line: string): Seat | null {
  const text = line.trim();
  // The greedy name group deliberately backtracks to the *last* " (", so a
  // player called "foo (bar)" keeps their brackets.
  const match = text.match(
    /^Seat (\d+): (.+) \([^\d]*([\d,.]+) in chips(?:,[^)]*)?\)/,
  );
  if (!match) return null;
  return {
    seat: Number(match[1]),
    player: match[2],
    stack: readAmount(match[3]),
    position: null,
    sittingOut: /is sitting out/.test(text) || undefined,
  };
}

/**
 * Turn the text after "<name>: " into an action.
 *
 * Returns null for lines that are not actions — chat especially. A player
 * saying "nice raise" must never be recorded as a raise, and table talk is the
 * one place a hand history carries arbitrary text written by someone else.
 */
function parseAction(player: string, rest: string): Action | null {
  const text = rest.trim();
  const allIn = /and is all-?in/i.test(text);
  const make = (type: ActionType, amount?: number): Action => ({
    player,
    type,
    ...(amount !== undefined ? { amount } : {}),
    ...(allIn ? { allIn: true } : {}),
  });

  if (/^said,/.test(text)) return null;

  let m: RegExpMatchArray | null;

  if ((m = text.match(/^posts small (?:&|and) big blinds? (\S+)/))) {
    return make("post-bb-and-sb", readAmount(m[1]));
  }
  if ((m = text.match(/^posts small blind (\S+)/))) {
    return make("post-sb", readAmount(m[1]));
  }
  if ((m = text.match(/^posts big blind (\S+)/))) {
    return make("post-bb", readAmount(m[1]));
  }
  if ((m = text.match(/^posts the ante (\S+)/))) {
    return make("post-ante", readAmount(m[1]));
  }
  if (/^folds/.test(text)) return make("fold");
  if (/^checks/.test(text)) return make("check");
  if ((m = text.match(/^calls (\S+)/))) return make("call", readAmount(m[1]));
  if ((m = text.match(/^bets (\S+)/))) return make("bet", readAmount(m[1]));
  // The "to" figure is the total wagered this street, which is the number any
  // pot arithmetic actually wants.
  if ((m = text.match(/^raises \S+ to (\S+)/))) {
    return make("raise", readAmount(m[1]));
  }
  if ((m = text.match(/^shows \[([^\]]+)\]/))) {
    return { player, type: "show", cards: m[1].trim().split(/\s+/) };
  }
  if (/^(doesn't show hand|mucks hand)/.test(text)) return make("muck");
  if (/^has timed out/.test(text)) return make("timeout");
  if (/^is disconnected/.test(text)) return make("disconnect");
  if (/^(sits out|is sitting out)/.test(text)) return make("sit-out");
  return null;
}

/**
 * Status notices the client writes without a colon: "VillainB is disconnected".
 *
 * They move no money, so nothing downstream needs them to compute a pot — but
 * they explain *why* a player folded to nothing or timed out of a spot they
 * would obviously have played, which matters when reviewing a hand. Dropping
 * them would make some hands look like inexplicable mistakes.
 */
function parseStatusLine(player: string, rest: string): Action | null {
  const text = rest.trim();
  if (/^has timed out/.test(text)) return { player, type: "timeout" };
  if (/^is disconnected/.test(text)) return { player, type: "disconnect" };
  if (/^(is sitting out|sits out)/.test(text)) return { player, type: "sit-out" };
  return null;
}

/** Every bracketed group in a line, each split into cards. */
function readBrackets(text: string): string[][] {
  return [...text.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim().split(/\s+/));
}

function readCurrency(text: string): string | null {
  if (text.includes("$")) return "USD";
  if (text.includes("€")) return "EUR";
  if (text.includes("£")) return "GBP";
  return null;
}

/** Money to a number, tolerating currency symbols and thousands separators. */
function readAmount(text: string): number {
  return Number(text.replace(/[^\d.-]/g, ""));
}

/**
 * A PokerStars timestamp to an absolute instant.
 *
 * Every hand carries an Eastern time, either as the only stamp or bracketed
 * beside the local one, so Eastern is the single timezone worth implementing.
 * Doing it properly matters: guessing the offset shifts hands by hours, which
 * would put a late-night session on the wrong day and silently corrupt any
 * question asked about when you play.
 */
function readTimestamp(text: string): Date | null {
  const m = text
    .trim()
    .match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(\w+)?$/);
  if (!m) return null;

  const [, y, mo, d, h, mi, s, zone] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);

  if ((zone ?? "ET").toUpperCase() !== "ET") {
    // A non-Eastern stamp with no Eastern counterpart. Read it as UTC rather
    // than inventing an offset — the header prefers the bracketed Eastern stamp
    // whenever one exists, so this is the rare fallback.
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  }

  return new Date(
    Date.UTC(year, month - 1, day, hour + easternOffsetHours(year, month, day, hour), minute, second),
  );
}

/**
 * Hours to add to US Eastern wall-clock time to reach UTC: 4 in summer, 5 in
 * winter.
 *
 * Daylight saving runs from the second Sunday in March to the first Sunday in
 * November, changing at 2am local — the rule in force since 2007, which covers
 * every hand history anyone still has.
 */
function easternOffsetHours(
  year: number,
  month: number,
  day: number,
  hour: number,
): number {
  const start = nthWeekdayOfMonth(year, 3, 0, 2); // second Sunday in March
  const end = nthWeekdayOfMonth(year, 11, 0, 1); // first Sunday in November

  const atOrAfter = (boundary: { month: number; day: number }) =>
    month > boundary.month ||
    (month === boundary.month &&
      (day > boundary.day || (day === boundary.day && hour >= 2)));

  return atOrAfter(start) && !atOrAfter(end) ? 4 : 5;
}

/** The nth given weekday of a month, as {month, day}. */
function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  nth: number,
): { month: number; day: number } {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  return { month, day: 1 + offset + (nth - 1) * 7 };
}

/**
 * Work out who was where, from the button.
 *
 * Preflop action runs from the seat after the button, so ordering the dealt-in
 * seats that way gives the small blind first and the button last. Heads-up is
 * the exception every poker codebase gets wrong at least once: with two players
 * the button posts the small blind rather than acting last preflop.
 */
function assignPositions(seats: Seat[], buttonSeat: number): void {
  const dealtIn = seats.filter((s) => !s.sittingOut);
  const count = dealtIn.length;

  if (count === 2) {
    for (const seat of dealtIn) {
      seat.position = seat.seat === buttonSeat ? "SB" : "BB";
    }
    return;
  }

  const names = POSITIONS_BY_COUNT[count];
  if (!names) return; // Bigger than six-handed: no agreed naming, so no guess.

  const ordered = [...dealtIn].sort((a, b) => a.seat - b.seat);
  const buttonIndex = ordered.findIndex((s) => s.seat === buttonSeat);
  if (buttonIndex === -1) return;

  for (let i = 0; i < count; i++) {
    ordered[(buttonIndex + 1 + i) % count].position = names[i];
  }
}
