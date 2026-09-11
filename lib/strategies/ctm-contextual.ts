/**
 * Contextual preflop decisions for the CTM strategy.
 *
 * Opening ranges are an exact chart. Facing action is not: stack depth,
 * position and a known opponent can turn the same hand from a fold into a
 * justified call or raise. These spots are deliberately curated from the
 * strategy's executable source rules rather than generated from a made-up
 * light-three-bet range.
 */

import { cardsFor, type Card } from "../poker/cards";
import {
  type ActionKind,
  isInPosition,
  nodeId,
  type ChartNode,
  type Position,
} from "../poker/charts";
import {
  decide,
  type PlayerType,
  type Rule,
  type RuleSpot,
} from "../poker/rules";
import {
  SQUEEZE_RULES,
  VS_3BET_RULES,
  VS_4BET_RULES,
  VS_OPEN_RULES,
} from "../poker/rules/preflop";

type ContextTemplate = Omit<RuleSpot, "inPosition" | "callers"> & {
  id: string;
  hint?: string;
  /** Seats that cold-called the open before the hero's squeeze decision. */
  callers?: readonly Position[];
};

/** Every template is a source rule and one useful contrast to that rule. */
const TEMPLATES: readonly ContextTemplate[] = [
  { id: "value-3bet", scenario: "vs-rfi", position: "BTN", villain: "CO", hand: "AKo", stackBb: 100 },
  { id: "flat-strong", scenario: "vs-rfi", position: "BTN", villain: "UTG", hand: "AQs", stackBb: 100 },
  { id: "set-mine-ip", scenario: "vs-rfi", position: "BTN", villain: "CO", hand: "55", stackBb: 50 },
  { id: "set-mine-oop", scenario: "vs-rfi", position: "BB", villain: "BTN", hand: "55", stackBb: 70 },
  { id: "set-mine-shallow", scenario: "vs-rfi", position: "BTN", villain: "CO", hand: "55", stackBb: 40 },
  {
    id: "fish-speculative-ip",
    scenario: "vs-rfi",
    position: "BTN",
    villain: "CO",
    hand: "67s",
    stackBb: 100,
    villainType: "fish",
    fishInPot: true,
  },
  {
    id: "fish-speculative-oop",
    scenario: "vs-rfi",
    position: "BB",
    villain: "CO",
    hand: "67s",
    stackBb: 100,
    villainType: "fish",
    fishInPot: true,
  },
  {
    id: "light-3bet-ip",
    scenario: "vs-rfi",
    position: "BTN",
    villain: "CO",
    hand: "K5o",
    stackBb: 100,
    villainType: "nit",
    foldsTooMuch: true,
    hint: "F3B 74% · 140 hands",
  },
  {
    id: "light-3bet-oop",
    scenario: "vs-rfi",
    position: "BB",
    villain: "CO",
    hand: "K5o",
    stackBb: 100,
    villainType: "nit",
    foldsTooMuch: true,
    hint: "F3B 74% · 140 hands",
  },
  { id: "default-fold", scenario: "vs-rfi", position: "BTN", villain: "CO", hand: "J4o", stackBb: 100 },
  {
    id: "squeeze-value-ip",
    scenario: "squeeze",
    position: "BTN",
    villain: "HJ",
    callers: ["CO"],
    hand: "AKo",
    stackBb: 100,
  },
  {
    id: "squeeze-value-oop",
    scenario: "squeeze",
    position: "BB",
    villain: "CO",
    callers: ["BTN"],
    hand: "QQ",
    stackBb: 100,
  },
  {
    id: "squeeze-bb-jj-two-callers",
    scenario: "squeeze",
    position: "BB",
    villain: "UTG",
    callers: ["HJ", "CO"],
    hand: "JJ",
    stackBb: 100,
  },
  {
    id: "squeeze-fold",
    scenario: "squeeze",
    position: "BB",
    villain: "UTG",
    callers: ["CO"],
    hand: "AJs",
    stackBb: 100,
  },
  { id: "four-bet-value", scenario: "vs-3bet", position: "CO", villain: "BTN", hand: "QQ", stackBb: 100 },
  { id: "call-3bet", scenario: "vs-3bet", position: "CO", villain: "BTN", hand: "AQo", stackBb: 100 },
  { id: "short-stack-no-call", scenario: "vs-3bet", position: "CO", villain: "BTN", hand: "TT", stackBb: 50 },
  { id: "four-bet-continue", scenario: "vs-4bet", position: "BTN", villain: "CO", hand: "KK", stackBb: 100 },
  { id: "four-bet-fold", scenario: "vs-4bet", position: "BTN", villain: "CO", hand: "QQ", stackBb: 100 },
  {
    id: "deep-nit-kings",
    scenario: "vs-4bet",
    position: "BTN",
    villain: "CO",
    hand: "KK",
    stackBb: 200,
    villainType: "nit",
  },
];

export interface ContextualPreflopSpot {
  id: string;
  node: ChartNode;
  spot: RuleSpot;
  expected: ActionKind;
  /** Plain rule data only: this crosses the Server Component boundary. */
  ruleId: string;
  ruleSummary: string;
  cards: [Card, Card] | null;
  playerTypes: Partial<Record<Position, PlayerType>>;
  hint?: string;
}

function rulesFor(scenario: RuleSpot["scenario"]): readonly Rule[] {
  if (scenario === "vs-rfi") return VS_OPEN_RULES;
  if (scenario === "vs-3bet") return VS_3BET_RULES;
  if (scenario === "squeeze") return SQUEEZE_RULES;
  return VS_4BET_RULES;
}

function makeSpot(template: ContextTemplate, rng: () => number): ContextualPreflopSpot {
  const spot: RuleSpot = {
    ...template,
    callers: template.callers?.length,
    inPosition: isInPosition(template.position, template.villain!),
  };
  const rule = decide(rulesFor(spot.scenario), spot, { useReads: true })?.rule;
  if (!rule) throw new Error(`No contextual rule for ${template.id}`);

  const node: ChartNode = {
    key: {
      scenario: spot.scenario,
      position: spot.position,
      villain: spot.villain,
      callers: template.callers,
      stackBb: spot.stackBb,
      treeId: "ctm-nl2-contextual",
    },
    strategies: { [spot.hand]: { [rule.then]: { freq: 1 } } },
  };

  return {
    id: template.id,
    node,
    spot,
    expected: rule.then,
    ruleId: rule.id,
    ruleSummary: rule.summary,
    cards: cardsFor(spot.hand, rng),
    playerTypes: spot.villainType && spot.villain
      ? { [spot.villain]: spot.villainType }
      : {},
    hint: template.hint,
  };
}

/** Build one named teaching situation, useful for tests and future review links. */
export function contextualPreflopSpot(
  id: string,
  rng: () => number = Math.random,
): ContextualPreflopSpot {
  const template = TEMPLATES.find((candidate) => candidate.id === id);
  if (!template) throw new Error(`Unknown contextual preflop spot: ${id}`);
  return makeSpot(template, rng);
}

/** Deal without immediately repeating the same teaching contrast. */
export function dealContextualPreflopSession(
  count: number,
  scenario?: RuleSpot["scenario"],
  rng: () => number = Math.random,
): ContextualPreflopSpot[] {
  const templates = scenario
    ? TEMPLATES.filter((template) => template.scenario === scenario)
    : TEMPLATES;
  const spots: ContextualPreflopSpot[] = [];
  let previous: string | undefined;

  for (let index = 0; index < count; index++) {
    let template = templates[Math.floor(rng() * templates.length)] ?? templates[0];
    if (!template) throw new Error(`No contextual templates for ${scenario ?? "this drill"}`);
    if (templates.length > 1 && template.id === previous) {
      template = templates[(templates.indexOf(template) + 1) % templates.length]!;
    }
    spots.push(makeSpot(template, rng));
    previous = template.id;
  }

  return spots;
}

export function contextualItemKey(spot: ContextualPreflopSpot): string {
  return `${nodeId(spot.node.key)}/${spot.id}`;
}

export function contextualRuleLabel(spot: ContextualPreflopSpot): string {
  return spot.ruleSummary;
}

export const CONTEXTUAL_TEMPLATE_IDS = TEMPLATES.map((template) => template.id);
