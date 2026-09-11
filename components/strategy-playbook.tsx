import {
  ArrowDown,
  ArrowRight,
  Check,
  CircleDot,
  EyeOff,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { PlaybookEntry } from "@/lib/strategies/learning";
import { cn } from "@/lib/utils";

type Action = "fold" | "call" | "raise";

const ACTION_STYLE: Record<Action, string> = {
  fold: "border-rose-500/30 bg-rose-500/10 text-rose-500 dark:text-rose-400",
  call: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  raise: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

function ActionMark({ action, children }: { action: Action; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center rounded-md border px-2.5 text-xs font-semibold uppercase tracking-[0.12em]",
        ACTION_STYLE[action],
      )}
    >
      {children}
    </span>
  );
}

function Band({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 border-t border-zinc-200 py-3 first:border-t-0 dark:border-zinc-800 sm:grid-cols-[7.5rem_1fr] sm:items-center">
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Card({
  title,
  Icon,
  children,
}: {
  title: string;
  Icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="border-y border-zinc-200 py-5 dark:border-zinc-800">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Token({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "sky" | "violet" }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-1 font-mono text-xs font-medium",
        tone === "neutral" && "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
        tone === "sky" && "bg-sky-500/10 text-sky-700 dark:text-sky-300",
        tone === "violet" && "bg-violet-500/10 text-violet-700 dark:text-violet-300",
      )}
    >
      {children}
    </span>
  );
}

function PlayerMap() {
  const players = [
    ["Nit", "steal · respect"],
    ["TAG", "avoid without value"],
    ["SLP", "value bet"],
    ["Fish", "value bet"],
    ["Maniac", "let value catch"],
  ] as const;
  return (
    <Card title="Player map" Icon={CircleDot}>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-zinc-200 dark:bg-zinc-800 sm:grid-cols-5">
        {players.map(([type, plan]) => (
          <div key={type} className="bg-white px-3 py-3 dark:bg-zinc-950">
            <p className="text-xs font-semibold">{type}</p>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{plan}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PositionMap() {
  const seats = [
    ["UTG", "w-5"],
    ["HJ", "w-7"],
    ["CO", "w-11"],
    ["BTN", "w-14"],
    ["SB", "w-8"],
  ] as const;
  return (
    <Card title="Position first" Icon={Target}>
      <div className="flex items-end gap-3 overflow-x-auto pb-1">
        {seats.map(([seat, width]) => (
          <div key={seat} className="flex min-w-10 flex-col items-center gap-2">
            <span className={cn("h-1.5 rounded-full bg-sky-500", width)} />
            <span className="font-mono text-[11px] text-zinc-500">{seat}</span>
          </div>
        ))}
        <ArrowRight className="mb-1 size-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
        <span className="mb-0.5 text-xs text-zinc-500">wider late</span>
      </div>
    </Card>
  );
}

function SizingMap() {
  return (
    <Card title="Open sizing" Icon={ArrowRight}>
      <Band label="early / middle"><Token tone="sky">4bb</Token><span className="text-xs text-zinc-500">UTG · HJ · SB</span></Band>
      <Band label="late"><Token tone="sky">3bb</Token><span className="text-xs text-zinc-500">CO · BTN</span></Band>
      <Band label="limpers"><Token tone="violet">+1bb each</Token><span className="text-xs text-zinc-500">+ one more from blinds</span></Band>
      <Band label="SB limps"><Token tone="sky">BB → 4bb</Token></Band>
    </Card>
  );
}

function FacingOpenMap() {
  return (
    <Card title="Facing an open" Icon={ArrowRight}>
      <Band label="value"><Token>AA · KK · QQ · AK</Token><ActionMark action="raise">3-bet</ActionMark></Band>
      <Band label="strong"><Token>JJ · TT · AQ</Token><ActionMark action="call">call</ActionMark></Band>
      <Band label="set mine"><Token>pocket pair</Token><Token tone="sky">50bb IP</Token><Token tone="violet">70bb OOP</Token><ActionMark action="call">call</ActionMark></Band>
      <Band label="everything else"><ActionMark action="fold">fold</ActionMark></Band>
    </Card>
  );
}

function SqueezeMap() {
  return (
    <Card title="Squeeze" Icon={ArrowRight}>
      <Band label="line"><Token>open</Token><ArrowRight className="size-3.5 text-zinc-400" /><Token>caller</Token><ArrowRight className="size-3.5 text-zinc-400" /><Token tone="sky">you</Token></Band>
      <Band label="value"><Token>QQ+ · AK</Token><ActionMark action="raise">squeeze</ActionMark></Band>
      <Band label="exact exception"><Token>BB · JJ · early open · 2 callers</Token><ActionMark action="raise">squeeze</ActionMark></Band>
      <Band label="size"><Token tone="sky">3× IP</Token><Token tone="violet">4× OOP</Token><Token>+1bb / caller</Token></Band>
      <Band label="otherwise"><ActionMark action="fold">fold</ActionMark></Band>
    </Card>
  );
}

function ThreeBetMap() {
  return (
    <Card title="When they three-bet" Icon={Target}>
      <Band label="100bb raise"><Token>AA · KK · QQ · JJ · AK</Token><ActionMark action="raise">4-bet</ActionMark></Band>
      <Band label="100bb call"><Token>88–TT · AQ</Token><ActionMark action="call">call</ActionMark></Band>
      <Band label="50bb or less"><Token tone="violet">never call</Token><ActionMark action="raise">jam value</ActionMark><ActionMark action="fold">fold rest</ActionMark></Band>
    </Card>
  );
}

function FourBetMap() {
  return (
    <Card title="When they four-bet" Icon={EyeOff}>
      <Band label="normal depth"><Token>AA · KK</Token><ActionMark action="raise">all-in</ActionMark></Band>
      <Band label="everything else"><ActionMark action="fold">fold</ActionMark></Band>
      <Band label="one exception"><Token tone="violet">KK · 200bb+ · verified nit</Token><ActionMark action="fold">fold</ActionMark></Band>
    </Card>
  );
}

function FlowStep({
  number,
  question,
  children,
}: {
  number: string;
  question: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 border-t border-zinc-200 py-4 first:border-t-0 dark:border-zinc-800 sm:grid-cols-[2rem_11rem_1fr] sm:items-center">
      <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">{number}</span>
      <p className="text-sm font-semibold">{question}</p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function FlowArrow() {
  return <ArrowDown className="mx-2 size-3.5 text-zinc-300 dark:text-zinc-700" aria-hidden="true" />;
}

function PreflopAlgorithm({ entries }: { entries: readonly PlaybookEntry[] }) {
  const ids = new Set(entries.map((entry) => entry.id));
  return (
    <Card title="Pre-flop · action order" Icon={ArrowRight}>
      {ids.has("ranges") && ids.has("sizing") && (
        <FlowStep number="01" question="No raise in front">
          <Token tone="sky">use your position range</Token>
          <ActionMark action="raise">open</ActionMark>
          <Token>4bb early · 3bb late</Token>
          <Token tone="violet">+1bb / limper</Token>
        </FlowStep>
      )}
      <FlowArrow />
      {ids.has("facing-open") && (
        <FlowStep number="02" question="One open. No caller.">
          <Token>QQ+ · AK</Token><ActionMark action="raise">3-bet</ActionMark>
          <Token>JJ · TT · AQ</Token><ActionMark action="call">call</ActionMark>
          <Token tone="sky">pair: 50bb IP · 70bb OOP</Token>
          <ActionMark action="fold">rest</ActionMark>
        </FlowStep>
      )}
      <FlowArrow />
      {ids.has("squeeze") && (
        <FlowStep number="03" question="Open + caller(s)">
          <Token>QQ+ · AK</Token><ActionMark action="raise">squeeze</ActionMark>
          <Token tone="violet">BB JJ · early + 2 callers</Token>
          <ActionMark action="fold">rest</ActionMark>
        </FlowStep>
      )}
      <FlowArrow />
      {ids.has("vs-3bet") && (
        <FlowStep number="04" question="You raised. They 3-bet.">
          <Token>100bb: AA · KK · QQ · JJ · AK</Token><ActionMark action="raise">4-bet</ActionMark>
          <Token>88–TT · AQ</Token><ActionMark action="call">call</ActionMark>
          <Token tone="violet">50bb−: never call</Token>
        </FlowStep>
      )}
      <FlowArrow />
      {ids.has("vs-4bet") && (
        <FlowStep number="05" question="You 3-bet. They 4-bet.">
          <Token>AA · KK</Token><ActionMark action="raise">all-in</ActionMark>
          <ActionMark action="fold">rest</ActionMark>
          <Token tone="violet">KK · 200bb+ · nit → fold</Token>
        </FlowStep>
      )}
    </Card>
  );
}

function StreetSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">{title}</h2>
      <div className="mt-3 space-y-5">{children}</div>
    </section>
  );
}

function Fallback({ entry }: { entry: PlaybookEntry }) {
  return (
    <Card title={entry.heading} Icon={Check}>
      <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{entry.takeaway}</p>
    </Card>
  );
}

function visualFor(entry: PlaybookEntry): React.ReactNode {
  if (entry.id === "hud") return <PlayerMap />;
  if (entry.id === "ranges") return <PositionMap />;
  if (entry.id === "sizing") return <SizingMap />;
  if (entry.id === "facing-open") return <FacingOpenMap />;
  if (entry.id === "squeeze") return <SqueezeMap />;
  if (entry.id === "vs-3bet") return <ThreeBetMap />;
  if (entry.id === "vs-4bet") return <FourBetMap />;
  return <Fallback entry={entry} />;
}

/** One visual rule map, reused at the top of its lesson and in the reference. */
export function StrategyPlaybookEntry({ entry }: { entry: PlaybookEntry }) {
  return <>{visualFor(entry)}</>;
}

export function StrategyPlaybook({ entries }: { entries: readonly PlaybookEntry[] }) {
  const preflopIds = new Set(["hud", "ranges", "sizing", "facing-open", "squeeze", "vs-3bet", "vs-4bet"]);
  const groups = {
    preflop: entries.filter((entry) => preflopIds.has(entry.id)),
    flop: entries.filter((entry) => entry.id === "flop" || entry.id === "cbet-response"),
    turn: entries.filter((entry) => entry.id === "turn"),
    river: entries.filter((entry) => entry.id === "river"),
  };

  return (
    <div className="mt-8 space-y-10">
      {groups.preflop.length > 0 && (
        <StreetSection title="Pre-flop">
          {groups.preflop.some((entry) => entry.id === "hud") && <PlayerMap />}
          <PreflopAlgorithm entries={groups.preflop} />
        </StreetSection>
      )}
      {groups.flop.length > 0 && (
        <StreetSection title="Flop">
          {groups.flop.map((entry) => <StrategyPlaybookEntry key={entry.id} entry={entry} />)}
        </StreetSection>
      )}
      {groups.turn.length > 0 && (
        <StreetSection title="Turn">
          {groups.turn.map((entry) => <StrategyPlaybookEntry key={entry.id} entry={entry} />)}
        </StreetSection>
      )}
      {groups.river.length > 0 && (
        <StreetSection title="River">
          {groups.river.map((entry) => <StrategyPlaybookEntry key={entry.id} entry={entry} />)}
        </StreetSection>
      )}
    </div>
  );
}
