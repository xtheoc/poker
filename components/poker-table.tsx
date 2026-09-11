import { type Card, SUIT_PIPS } from "@/lib/poker/cards";
import { BB_POST, POSITIONS, type Position } from "@/lib/poker/charts";
import type { PlayerType } from "@/lib/poker/rules";
import { cn } from "@/lib/utils";

/**
 * The table, from your seat.
 *
 * The drill used to state the spot in words — "UTG opens", "BB" — which is
 * correct and asks you to do a translation the table does for free. At a real
 * table you never read your position; you see where the button is and where the
 * action came from, and that recognition is part of what is being trained. Two
 * lines of text train reading two lines of text.
 *
 * **You are always at the bottom.** Your position changes every hand, your seat
 * on screen does not — same as every poker client, and for the same reason: a
 * fixed viewpoint lets you read the situation by shape rather than by parsing
 * labels. So the labels rotate around you and the dealer button moves, which is
 * exactly the information you actually use at a table.
 *
 * Seats run clockwise from yours, in order of action: the seat immediately
 * clockwise from you acts after you.
 */

/** Where each seat sits, as a percentage of the frame. Index 0 is the hero. */
const SEATS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 50, y: 88 }, // you, bottom centre
  { x: 11, y: 68 },
  { x: 11, y: 26 },
  { x: 50, y: 7 },
  { x: 89, y: 26 },
  { x: 89, y: 68 },
];

export function PokerTable({
  position,
  villain,
  limpers = [],
  callers = [],
  wagers,
  cards,
  revealed = true,
  playerTypes = {},
}: {
  /** Your seat this hand. */
  position: Position;
  /** Whoever made the last aggressive action. Absent means an unopened pot. */
  villain?: Position;
  /**
   * Seats that limped in.
   *
   * Drawn as one blind of chips each. Without this a limped pot would look
   * exactly like a folded-round one, and since the seat labels are gone there
   * would be nothing left to tell them apart.
   */
  limpers?: readonly Position[];
  /** Players who called an open in a squeeze spot. */
  callers?: readonly Position[];
  /**
   * Money in front of each seat, in big blinds.
   *
   * Passed in rather than derived here. Once a pot has been raised and
   * re-raised the amounts depend on each other — a 4-bet is a multiple of a
   * 3-bet, which is a multiple of the open — and that arithmetic belongs with
   * the betting tree, not in a component drawing circles.
   */
  wagers: ReadonlyMap<Position, number>;
  cards: [Card, Card] | null;
  /** False shows the cards face down, for the moment before a spot begins. */
  revealed?: boolean;
  /** Read badges shown as the same colour rings used at the poker table. */
  playerTypes?: Partial<Record<Position, PlayerType>>;
}) {
  // Rotate the position list so the hero is first. Everyone else keeps their
  // order, which is what makes the button land in the right place on its own.
  const start = POSITIONS.indexOf(position);
  const seated =
    start < 0
      ? POSITIONS
      : [...POSITIONS.slice(start), ...POSITIONS.slice(0, start)];

  return (
    <div className="relative mx-auto aspect-[16/11] w-full max-w-sm">
      {/* The felt. A ring rather than a filled shape: a solid green oval would
          dominate a screen whose real subject is two cards and three buttons. */}
      <div className="absolute inset-[9%] rounded-[50%] border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50" />

      {seated.map((seat, i) => {
        const at = SEATS[i];
        const isHero = i === 0;
        const isVillain = seat === villain;
        const wager = wagers.get(seat) ?? null;
        const inHand = isHero || isVillain || limpers.includes(seat) || callers.includes(seat);
        const playerType = playerTypes[seat];

        return (
          <div key={seat}>
            {/* Chips sit between the seat and the pot, the way money actually
                lies on a table. Placed by interpolating toward the centre so
                they follow the seat rather than needing a second layout table
                that could drift out of step with the first. */}
            {wager !== null && (
              <Chips
                amount={wager}
                raise={isVillain}
                x={at.x + (50 - at.x) * 0.42}
                y={at.y + (50 - at.y) * 0.36}
              />
            )}

            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${at.x}%`, top: `${at.y}%` }}
            >
              <div className="relative flex flex-col items-center gap-1">
                {/* An empty seat, not a label.
                    The name of the position used to be printed here, which
                    answered the question before it was asked — no client shows
                    it, and reading the button is the skill. What is left is
                    what a real table gives you: where the button sits, who has
                    money out, and which seat is yours. */}
                <span
                  className={cn(
                    "flex h-7 w-11 items-center justify-center rounded-lg border transition",
                    isHero &&
                      "border-sky-500 bg-sky-500 shadow-sm shadow-sky-500/30",
                    isVillain &&
                      "border-amber-500 bg-amber-500 shadow-sm shadow-amber-500/30",
                    // Everyone not in the hand recedes. They are not part of
                    // this decision and should not compete for attention.
                    !inHand && "border-zinc-200 dark:border-zinc-800",
                    // A limper is in the hand but has done nothing to respect.
                    limpers.includes(seat) &&
                      "border-zinc-400 dark:border-zinc-500",
                    callers.includes(seat) &&
                      "border-zinc-400 dark:border-zinc-500",
                  )}
                  aria-label={seat}
                >
                  {playerType && (
                    <span
                      title={playerType}
                      className={cn(
                        "size-4 rounded-full border-2 bg-zinc-100 dark:bg-zinc-950",
                        playerType === "fish" && "border-blue-500",
                        playerType === "nit" && "border-emerald-500",
                        playerType !== "fish" &&
                          playerType !== "nit" &&
                          "border-zinc-400 dark:border-zinc-500",
                      )}
                    />
                  )}
                </span>

                {/* The button, on whoever has it. This is how you read your own
                    position without being told it. */}
                {seat === "BTN" && (
                  <span className="absolute -top-1.5 -right-2 flex size-4 items-center justify-center rounded-full bg-white text-[8px] font-bold text-zinc-900 shadow ring-1 ring-zinc-300 dark:ring-zinc-600">
                    D
                  </span>
                )}

                </div>
            </div>
          </div>
        );
      })}

      {/* Your cards, in the middle of the felt, close to the seat that acted so
          both can be read without moving your eyes. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex gap-1.5">
          {cards ? (
            cards.map((card, i) => (
              <PlayingCard key={i} card={card} revealed={revealed} />
            ))
          ) : (
            <>
              <PlayingCard card={null} revealed={false} />
              <PlayingCard card={null} revealed={false} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Money in front of a seat.
 *
 * Chips *and* the number. The chips are what make the table readable at a
 * glance — you see there is action before you read anything — and the number is
 * what makes it correct, because three discs cannot distinguish a 2.5bb open
 * from a 3bb one and that difference is the whole reason the small blind opens
 * larger. Neither alone does the job.
 *
 * The count is illustrative, not a denomination: one disc for the small blind,
 * two for the big, a small stack for a raise. Chips at a real table are not a
 * unary count either.
 */
function Chips({
  amount,
  raise,
  x,
  y,
}: {
  amount: number;
  /** A raise reads warm, a posted blind stays neutral. */
  raise: boolean;
  x: number;
  y: number;
}) {
  const count = raise ? 3 : amount >= BB_POST ? 2 : 1;

  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <span className="flex">
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-2.5 rounded-full border",
              // Overlapped rather than spaced: a stack, not a row of dots.
              i > 0 && "-ml-1",
              raise
                ? "border-amber-600 bg-amber-500"
                : "border-zinc-400 bg-zinc-300 dark:border-zinc-500 dark:bg-zinc-600",
            )}
          />
        ))}
      </span>
      <span
        className={cn(
          "text-[9px] font-medium tabular-nums",
          raise
            ? "text-amber-600 dark:text-amber-400"
            : "text-zinc-400 dark:text-zinc-500",
        )}
      >
        {amount}bb
      </span>
    </div>
  );
}

/**
 * One card.
 *
 * Rank above pip rather than the four-corner layout of a real card: at this
 * size corner indices would be illegible, and the pip is doing the work of
 * saying suited-or-not at a glance.
 */
function PlayingCard({
  card,
  revealed,
}: {
  card: Card | null;
  revealed: boolean;
}) {
  if (!card || !revealed) {
    return (
      <span className="flex h-16 w-12 items-center justify-center rounded-md border border-zinc-300 bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800">
        <span className="size-6 rounded-sm bg-zinc-300 dark:bg-zinc-700" />
      </span>
    );
  }

  const { pip, red } = SUIT_PIPS[card.suit];

  return (
    <span
      className={cn(
        "flex h-16 w-12 flex-col items-center justify-center rounded-md border border-zinc-300 bg-white shadow-sm dark:border-zinc-300",
        // Red and black, because that is the distinction the eye uses first.
        // The card stays white in dark mode: a card is a white object, and
        // inverting it would make the pips harder to read, not easier.
        red ? "text-rose-600" : "text-zinc-900",
      )}
    >
      <span className="text-xl leading-none font-bold">{card.rank}</span>
      <span className="text-base leading-none">{pip}</span>
    </span>
  );
}
