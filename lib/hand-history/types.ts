/**
 * The shape a PokerStars hand becomes once parsed.
 *
 * Deliberately close to the text it came from. The temptation with a hand
 * history is to normalise aggressively — collapse blinds into the action list,
 * convert everything to big blinds, drop the seats nobody acted from — and each
 * of those makes some later question unanswerable. Amounts stay in the currency
 * the hand was played in, and the raw text is kept alongside, so a parser bug
 * found in six months can be fixed and replayed without needing the files again.
 */

import type { Position } from "../poker/charts";

export type Street = "preflop" | "flop" | "turn" | "river";

export const STREETS: readonly Street[] = ["preflop", "flop", "turn", "river"];

/**
 * Everything a player can do in a hand history line.
 *
 * Blind and ante posts are actions rather than metadata because they move
 * money, and any pot arithmetic that ignores them is wrong.
 */
export type ActionType =
  | "post-sb"
  | "post-bb"
  | "post-bb-and-sb" // a returning player posting both at once
  | "post-ante"
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise"
  | "show"
  | "muck"
  | "collect"
  | "uncalled-return"
  | "timeout"
  | "disconnect"
  | "sit-out";

export interface Action {
  player: string;
  type: ActionType;
  /**
   * Money moved by this action, in table currency.
   *
   * For a raise this is the **total** the player has put in on this street —
   * the "to" number in "raises $0.05 to $0.10" — not the increment. The
   * increment is nearly always the wrong number to reason with, and storing the
   * total means pot arithmetic never has to reconstruct it.
   */
  amount?: number;
  /** Cards revealed, for shows. */
  cards?: string[];
  allIn?: boolean;
}

export interface Seat {
  seat: number;
  player: string;
  /** Chips at the start of the hand. */
  stack: number;
  /**
   * Table position, when it can be determined.
   *
   * Null rather than guessed for table sizes where the naming convention is
   * genuinely ambiguous. A wrong position silently maps a hand to the wrong
   * chart node, which is worse than admitting we do not know.
   */
  position: Position | null;
  /** Present when the player sat out and was dealt no cards. */
  sittingOut?: boolean;
}

export interface StreetActions {
  street: Street;
  /** Cards turned on this street — three for the flop, one each after. */
  cards: string[];
  actions: Action[];
}

export interface ParsedHand {
  /** The PokerStars hand number. The natural key that makes ingest idempotent. */
  id: string;
  gameType: "cash" | "tournament";
  /** True for the fast-fold pool, where opponents change every hand. */
  fastFold: boolean;
  tournamentId?: string;
  tableName: string;
  maxSeats: number;
  buttonSeat: number;
  smallBlind: number;
  bigBlind: number;
  ante?: number;
  /** Null for tournaments, which are played in chips rather than money. */
  currency: string | null;
  playedAt: Date;
  seats: Seat[];
  /** The player whose hole cards are known — you. */
  hero?: { player: string; cards: string[] };
  streets: StreetActions[];
  board: string[];
  totalPot?: number;
  rake?: number;
  /**
   * Boards beyond the first, when a hand was run more than once.
   *
   * Rare, but silently dropping the second board would make the result of the
   * hand look wrong, so it is captured even though nothing reads it yet.
   */
  extraBoards?: string[][];
  /** The original text, kept so a parser fix can be replayed over old imports. */
  raw: string;
}

/**
 * A hand that could not be parsed.
 *
 * Stored rather than discarded. PokerStars changed its format twice in the year
 * before this was written, so unparseable hands are an expected condition, and
 * dropping them would lose history a later parser could have read.
 */
export interface UnparsedHand {
  raw: string;
  /** The hand id, if it was at least readable. */
  id?: string;
  reason: string;
}

export type ParseResult =
  | { ok: true; hand: ParsedHand }
  | { ok: false; error: UnparsedHand };
