import { describe, expect, it } from "vitest";
import type { ChartNode } from "./charts";
import { BEGINNER_6MAX } from "./charts/beginner-6max";
import { type Hand, handGrid } from "./hands";
import { type MarkAction, gradeSelection, rangeOf } from "./range-quiz";

function seat(position: string): ChartNode {
  const node = BEGINNER_6MAX.nodes.find(
    (n) => n.key.position === position && !n.key.villain,
  );
  if (!node) throw new Error(`no node for ${position}`);
  return node;
}

describe("the hand grid", () => {
  it("lays out 13 by 13 in the conventional order", () => {
    const grid = handGrid();

    expect(grid).toHaveLength(13);
    expect(grid.every((row) => row.length === 13)).toBe(true);

    // Pairs on the diagonal, strongest first.
    expect(grid[0][0]).toBe("AA");
    expect(grid[12][12]).toBe("22");
    // Suited above it, offsuit below.
    expect(grid[0][1]).toBe("AKs");
    expect(grid[1][0]).toBe("AKo");
    expect(grid[0][12]).toBe("A2s");
    expect(grid[12][0]).toBe("A2o");
  });

  it("contains all 169 classes exactly once", () => {
    const flat = handGrid().flat();
    expect(flat).toHaveLength(169);
    expect(new Set(flat).size).toBe(169);
  });
});

/** Every hand on the grid, marked the same way. */
function wholeGrid(action: MarkAction): Map<Hand, MarkAction> {
  return new Map(handGrid().flat().map((hand) => [hand, action]));
}

describe("marking a drawn range", () => {
  it("calls a perfect copy perfect", () => {
    const node = seat("UTG");
    const result = gradeSelection(node, rangeOf(node));

    expect(result.perfect).toBe(true);
    expect(result.missed).toEqual([]);
    expect(result.extra).toEqual([]);
    expect(result.wrongAction).toEqual([]);
    expect(result.combosWrong).toBe(0);
    expect(result.hit).toBe(result.total);
  });

  it("separates hands left out from hands wrongly added", () => {
    // The two errors cost differently — a fold gives up what the hand would
    // have won, a loose open loses money outright — so they never merge into
    // one percentage.
    const node = seat("UTG");
    const marks = rangeOf(node);
    marks.delete("AA");
    marks.set("72o", "raise");

    const result = gradeSelection(node, marks);

    expect(result.missed).toEqual(["AA"]);
    expect(result.extra).toEqual(["72o"]);
    expect(result.perfect).toBe(false);
  });

  it("counts a right hand played the wrong way as its own mistake", () => {
    // Under the gun limps 22-66 and raises everything above. Raising 44 is not
    // "44 is in the range" and therefore correct — it is precisely the error
    // the limping rule exists to stop, so it can neither pass nor be reported
    // as a hand that should have been folded.
    const node = seat("UTG");
    const marks = rangeOf(node);
    expect(marks.get("44")).toBe("call");
    marks.set("44", "raise");

    const result = gradeSelection(node, marks);

    expect(result.wrongAction).toEqual(["44"]);
    expect(result.missed).toEqual([]);
    expect(result.extra).toEqual([]);
    expect(result.perfect).toBe(false);
    expect(result.combosWrong).toBe(6);
  });

  it("counts an empty grid as missing the whole range", () => {
    const node = seat("BTN");
    const result = gradeSelection(node, new Map());

    expect(result.hit).toBe(0);
    expect(result.missed).toHaveLength(result.total);
    expect(result.extra).toEqual([]);
    expect(result.wrongAction).toEqual([]);
  });

  it("counts a grid raised end to end as folds added and limps missed", () => {
    const node = seat("UTG");
    const result = gradeSelection(node, wholeGrid("raise"));

    expect(result.missed).toEqual([]);
    expect(result.extra).toHaveLength(169 - result.total);
    // The small pairs are in the range and were raised, not limped.
    expect(result.wrongAction).toEqual(["66", "55", "44", "33", "22"]);
    expect(result.hit).toBe(result.total - result.wrongAction.length);
  });

  it("weighs an offsuit mistake heavier than a pair", () => {
    // Twelve combinations against six. Counting hand classes would call these
    // the same error, and they are not.
    const node = seat("UTG");

    const droppedPair = rangeOf(node);
    droppedPair.delete("22");
    const droppedOffsuit = rangeOf(node);
    droppedOffsuit.delete("AKo");

    expect(gradeSelection(node, droppedPair).combosWrong).toBe(6);
    expect(gradeSelection(node, droppedOffsuit).combosWrong).toBe(12);
  });

  it("returns mistakes strongest first", () => {
    const node = seat("UTG");
    const result = gradeSelection(node, new Map());

    // `allHands` runs pairs, then suited, then offsuit, each descending — so a
    // list of what you missed reads the way a chart does.
    expect(result.missed[0]).toBe("AA");
  });

  it("reports every seat the chart covers as gradeable", () => {
    for (const node of BEGINNER_6MAX.nodes) {
      expect(rangeOf(node).size, node.key.position).toBeGreaterThan(0);
    }
  });

  it("hands back the right answer so a mistake can be shown as one", () => {
    const node = seat("UTG");
    const result = gradeSelection(node, new Map());

    expect(result.expected.get("AA")).toBe("raise");
    expect(result.expected.get("44")).toBe("call");
    expect(result.expected.has("72o")).toBe(false);
  });
});
