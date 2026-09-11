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
  FOUR_BET,
  THREE_BET_IP,
  THREE_BET_OOP,
  openSizeBb,
  type ActionKind,
  type ChartSet,
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

/** The decision branch a table spot belongs to. Kept as data so the drill can
 * rotate branches without giving away the answer in advance. */
export type ContextualDecisionFamily =
  | "open"
  | "facing-open"
  | "squeeze"
  | "facing-3bet"
  | "facing-4bet";

const FAMILY_FOR_SCENARIO: Partial<Record<RuleSpot["scenario"], ContextualDecisionFamily>> = {
  rfi: "open",
  "vs-rfi": "facing-open",
  squeeze: "squeeze",
  "vs-3bet": "facing-3bet",
  "vs-4bet": "facing-4bet",
};

export const CONTEXTUAL_FAMILY_LABELS: Record<ContextualDecisionFamily, string> = {
  open: "Unopened pot",
  "facing-open": "Facing an open",
  squeeze: "Open + caller",
  "facing-3bet": "Facing a 3-bet",
  "facing-4bet": "Facing a 4-bet",
};

/**
 * The amount for a raise in a contextual spot, in big blinds.
 *
 * A four-bet response is a stack-off decision at this level, so it returns
 * null rather than pretending a slider can price an all-in. Every other
 * amount is derived from the same tree used to put chips on the table.
 */
export function contextualRaiseSizeBb(
  spot: ContextualPreflopSpot,
  set: ChartSet,
): number | null {
  const { scenario, position, villain } = spot.node.key;
  if (scenario === "rfi") return openSizeBb(set, position);
  if (!villain || scenario === "vs-4bet") return null;

  const open = openSizeBb(set, scenario === "vs-3bet" ? position : villain);
  if (scenario === "vs-rfi") {
    return roundBb(open * (spot.spot.inPosition ? THREE_BET_IP : THREE_BET_OOP));
  }
  if (scenario === "squeeze") {
    const callers = spot.node.key.callers?.length ?? 0;
    return roundBb(open * (spot.spot.inPosition ? THREE_BET_IP : THREE_BET_OOP) + callers);
  }
  if (scenario === "vs-3bet") {
    const villainThreeBet = open * (spot.spot.inPosition ? THREE_BET_OOP : THREE_BET_IP);
    return roundBb(villainThreeBet * FOUR_BET);
  }
  return null;
}

function roundBb(value: number): number {
  return Math.round(value * 2) / 2;
}

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

/** Unopened-pot decisions belong in general practice, even though their range
 * drill has a different answer format. These hands are taken from the active
 * NL2 chart: the sizing slider then tests the 4bb/3bb ladder. */
type OpeningTemplate = {
  id: string;
  position: Position;
  hand: RuleSpot["hand"];
  expected: "raise" | "fold";
  summary: string;
};

const OPENING_TEMPLATES: readonly OpeningTemplate[] = [
  { id: "open-utg-value", position: "UTG", hand: "AKo", expected: "raise", summary: "Open this hand from early position." },
  { id: "open-utg-fold", position: "UTG", hand: "76s", expected: "fold", summary: "Fold this hand from early position." },
  { id: "open-hj-value", position: "HJ", hand: "KJo", expected: "raise", summary: "Open this hand from middle position." },
  { id: "open-co-value", position: "CO", hand: "A5o", expected: "raise", summary: "Open this hand from late position." },
  { id: "open-btn-value", position: "BTN", hand: "Q7s", expected: "raise", summary: "Open this hand on the button." },
  { id: "open-sb-fold", position: "SB", hand: "J7o", expected: "fold", summary: "Fold this hand from the small blind." },
];

export interface ContextualPreflopSpot {
  id: string;
  family: ContextualDecisionFamily;
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
  const family = FAMILY_FOR_SCENARIO[spot.scenario];
  if (!family) throw new Error(`No contextual decision family for ${spot.scenario}`);

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
    family,
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

function makeOpeningSpot(template: OpeningTemplate, rng: () => number): ContextualPreflopSpot {
  const spot: RuleSpot = {
    scenario: "rfi",
    position: template.position,
    hand: template.hand,
    stackBb: 100,
    inPosition: true,
  };
  const node: ChartNode = {
    key: {
      scenario: "rfi",
      position: template.position,
      stackBb: spot.stackBb,
      treeId: "ctm-nl2-contextual",
    },
    strategies: template.expected === "raise"
      ? { [template.hand]: { raise: { freq: 1 } } }
      : {},
  };

  return {
    id: template.id,
    family: "open",
    node,
    spot,
    expected: template.expected,
    ruleId: `open/${template.expected}`,
    ruleSummary: template.summary,
    cards: cardsFor(template.hand, rng),
    playerTypes: {},
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

/**
 * Deal a mixed sequence of at-table decisions.
 *
 * The ordinary lesson drills deliberately stay within one branch so they can
 * prove one rule. General practice is different: it must require recognising
 * the branch before choosing an action. Every group of four contains one spot
 * from each branch, in a shuffled order, so no category gets buried behind a
 * long run of another.
 */
export function dealMixedContextualPreflopSession(
  count: number,
  rng: () => number = Math.random,
): ContextualPreflopSpot[] {
  const families = Object.keys(CONTEXTUAL_FAMILY_LABELS) as ContextualDecisionFamily[];
  const contextualByFamily = new Map<ContextualDecisionFamily, readonly ContextTemplate[]>(
    families.map((family) => [
      family,
      TEMPLATES.filter((template) => FAMILY_FOR_SCENARIO[template.scenario] === family),
    ]),
  );
  const openingByFamily = new Map<ContextualDecisionFamily, readonly OpeningTemplate[]>([
    ["open", OPENING_TEMPLATES],
  ]);
  const spots: ContextualPreflopSpot[] = [];
  let previous: string | undefined;

  while (spots.length < count) {
    const order = [...families];
    for (let index = order.length - 1; index > 0; index--) {
      const swap = Math.floor(rng() * (index + 1));
      [order[index], order[swap]] = [order[swap]!, order[index]!];
    }

    for (const family of order) {
      if (spots.length >= count) break;
      const templates = contextualByFamily.get(family) ?? [];
      const opening = openingByFamily.get(family) ?? [];
      const candidates = [
        ...templates.map((template) => ({ id: template.id, make: () => makeSpot(template, rng) })),
        ...opening.map((template) => ({ id: template.id, make: () => makeOpeningSpot(template, rng) })),
      ];
      if (!candidates.length) throw new Error(`No contextual templates for ${family}`);
      let template = candidates[Math.floor(rng() * candidates.length)]!;
      if (candidates.length > 1 && template.id === previous) {
        template = candidates[(candidates.indexOf(template) + 1) % candidates.length]!;
      }
      spots.push(template.make());
      previous = template.id;
    }
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
