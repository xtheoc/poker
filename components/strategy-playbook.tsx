import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleDot,
  EyeOff,
  Target,
  X,
  type LucideIcon,
} from "lucide-react";
import type { PlaybookEntry } from "@/lib/strategies/learning";
import { cn } from "@/lib/utils";

type Action = "fold" | "call" | "raise" | "check";

const ACTION_STYLE: Record<Action, string> = {
  fold: "border-rose-500 bg-rose-500/[0.04] text-rose-600 dark:text-rose-400",
  call: "border-emerald-500 bg-emerald-500/[0.04] text-emerald-700 dark:text-emerald-400",
  raise: "border-amber-500 bg-amber-500/[0.04] text-amber-700 dark:text-amber-400",
  check: "border-zinc-400 bg-zinc-500/[0.04] text-zinc-600 dark:border-zinc-600 dark:text-zinc-300",
};

function ActionMark({ action, children }: { action: Action; children: React.ReactNode }) {
  const Icon = action === "fold" ? X : action === "call" ? Check : action === "raise" ? ArrowUpRight : EyeOff;
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 border-l-2 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]",
        ACTION_STYLE[action],
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
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
    <div className="grid gap-2 border-t border-zinc-200/90 py-3.5 first:border-t-0 dark:border-zinc-800 sm:grid-cols-[8.5rem_1fr] sm:items-center">
      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
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
    <section className="overflow-hidden border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3 border-b border-zinc-100 bg-zinc-50/60 px-5 py-4 dark:border-zinc-900 dark:bg-zinc-900/30 sm:px-6">
        <span className="flex size-7 items-center justify-center bg-zinc-900 text-white dark:bg-white dark:text-zinc-950">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="px-5 sm:px-6">{children}</div>
    </section>
  );
}

function Token({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "sky" | "violet" }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-1 font-mono text-xs font-medium tracking-tight",
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
    ["Nit", "steal · respect", "bg-sky-400"],
    ["TAG", "avoid marginal pots", "bg-violet-400"],
    ["SLP", "value bet", "bg-amber-400"],
    ["Fish", "value bet · no bluff", "bg-emerald-400"],
    ["Maniac", "let value catch", "bg-rose-400"],
  ] as const;
  return (
    <Card title="Player map" Icon={CircleDot}>
      <div className="grid grid-cols-2 divide-x divide-y divide-zinc-100 border-x border-zinc-100 dark:divide-zinc-900 dark:border-zinc-900 sm:grid-cols-5">
        {players.map(([type, plan, color]) => (
          <div key={type} className="px-3 py-3.5">
            <div className="flex items-center gap-2">
              <span className={cn("size-1.5 rounded-full", color)} />
              <p className="text-xs font-semibold">{type}</p>
            </div>
            <p className="mt-1.5 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">{plan}</p>
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

function ActionCell({
  action,
  children,
}: {
  action: Action;
  children?: React.ReactNode;
}) {
  const label = action === "raise" ? "Raise" : action === "call" ? "Call" : "Fold";
  return (
    <div
      className={cn(
        "min-h-24 border p-3",
        action === "raise" && "border-amber-500/30 bg-amber-500/[0.06]",
        action === "call" && "border-emerald-500/30 bg-emerald-500/[0.06]",
        action === "fold" && "border-rose-500/30 bg-rose-500/[0.06]",
      )}
    >
      <ActionMark action={action}>{label}</ActionMark>
      {children ? (
        <div className="mt-3 space-y-1.5 text-xs leading-5 text-zinc-700 dark:text-zinc-300">{children}</div>
      ) : (
        <p className="mt-4 font-mono text-xs text-zinc-400 dark:text-zinc-600">—</p>
      )}
    </div>
  );
}

function RuleLine({ children, emphasis = false }: { children: React.ReactNode; emphasis?: boolean }) {
  return <p className={cn(emphasis && "font-semibold text-zinc-950 dark:text-white")}>{children}</p>;
}

function ActionGrid({
  raise,
  call,
  fold,
}: {
  raise?: React.ReactNode;
  call?: React.ReactNode;
  fold?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <ActionCell action="raise">{raise}</ActionCell>
      <ActionCell action="call">{call}</ActionCell>
      <ActionCell action="fold">{fold}</ActionCell>
    </div>
  );
}

function FacingOpenMap() {
  return (
    <Card title="Facing an open" Icon={ArrowRight}>
      <div className="py-4">
        <ActionGrid
          raise={<><RuleLine emphasis>QQ+ · AK</RuleLine><RuleLine>3× IP · 4× OOP</RuleLine><RuleLine>2.5× or jam vs 50bb−</RuleLine></>}
          call={<><RuleLine emphasis>JJ · TT · AQ</RuleLine><RuleLine>Any pair: 50bb IP</RuleLine><RuleLine>70bb OOP</RuleLine></>}
          fold={<RuleLine emphasis>Everything else</RuleLine>}
        />
      </div>
    </Card>
  );
}

function SqueezeMap() {
  return (
    <Card title="Squeeze" Icon={ArrowRight}>
      <Band label="line"><Token>open</Token><ArrowRight className="size-3.5 text-zinc-400" /><Token>caller</Token><ArrowRight className="size-3.5 text-zinc-400" /><Token tone="sky">you</Token></Band>
      <div className="py-4">
        <ActionGrid
          raise={<><RuleLine emphasis>QQ+ · AK</RuleLine><RuleLine>BB JJ: early open + 2 callers</RuleLine><RuleLine>3× IP · 4× OOP · +1bb/caller</RuleLine></>}
          fold={<RuleLine emphasis>Everything else</RuleLine>}
        />
      </div>
    </Card>
  );
}

function ThreeBetMap() {
  return (
    <Card title="When they three-bet" Icon={Target}>
      <div className="py-4">
        <ActionGrid
          raise={<><RuleLine emphasis>AA · KK · QQ · JJ · AK</RuleLine><RuleLine>4-bet: 3× their 3-bet</RuleLine><RuleLine>50bb−: jam value</RuleLine></>}
          call={<><RuleLine emphasis>88–TT · AQ</RuleLine><RuleLine>100bb only</RuleLine></>}
          fold={<><RuleLine emphasis>Everything else</RuleLine><RuleLine>50bb−: fold or jam</RuleLine><RuleLine>Never call</RuleLine></>}
        />
      </div>
    </Card>
  );
}

function FourBetMap() {
  return (
    <Card title="When they four-bet" Icon={EyeOff}>
      <div className="py-4">
        <ActionGrid
          raise={<><RuleLine emphasis>AA · KK</RuleLine><RuleLine>All-in</RuleLine></>}
          fold={<><RuleLine emphasis>Everything else</RuleLine><RuleLine>KK, 200bb+ vs verified nit</RuleLine></>}
        />
      </div>
    </Card>
  );
}

function PathRow({
  number,
  when,
  action,
  then,
}: {
  number: string;
  when: string;
  action: Action;
  then: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 border-t border-zinc-200 py-4 first:border-t-0 dark:border-zinc-800 sm:grid-cols-[2.25rem_minmax(12rem,0.85fr)_7rem_minmax(18rem,1.35fr)] sm:items-center sm:gap-5">
      <span className="flex size-7 items-center justify-center bg-zinc-100 font-mono text-[10px] font-medium text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        {number}
      </span>
      <p className="text-sm font-semibold leading-5 tracking-tight">{when}</p>
      <ActionMark action={action}>{action === "raise" ? "Bet" : action}</ActionMark>
      <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{then}</p>
    </div>
  );
}

function ProcessRoute({
  answer,
  action,
  label,
  next,
  children,
}: {
  answer: string;
  action?: Action;
  label?: string;
  next?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 border-l-2 border-zinc-200 py-2.5 pl-3 dark:border-zinc-800 sm:grid-cols-[6.5rem_8.5rem_1fr] sm:items-center sm:gap-3">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{answer}</span>
      {action ? (
        <ActionMark action={action}>{label ?? action}</ActionMark>
      ) : (
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">{next}</span>
      )}
      {children && <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">{children}</p>}
    </div>
  );
}

function ProcessStep({
  number,
  question,
  children,
}: {
  number: string;
  question: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3 border-t border-zinc-200 py-5 first:border-t-0 dark:border-zinc-800 sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:gap-5">
      <span className="flex size-7 items-center justify-center bg-zinc-100 font-mono text-[10px] font-medium text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        {number}
      </span>
      <div>
        <h3 className="text-base font-semibold tracking-tight">{question}</h3>
        <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-900">{children}</div>
      </div>
    </section>
  );
}

function FlopMap() {
  return (
    <div className="space-y-4">
      <Card title="Flop · choice map" Icon={ArrowRight}>
        <div className="border-b border-zinc-200 py-4 text-sm leading-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          Use this only when <strong className="font-semibold text-zinc-950 dark:text-white">you raised pre-flop</strong>. Start in the lane that matches what happened on the flop.
        </div>
        <div className="grid divide-y divide-zinc-200 dark:divide-zinc-800 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <section className="py-5 lg:pr-6">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">Lane A · It checks to you</p>
            <ProcessStep number="A1" question="Are three or more players in the pot?">
              <ProcessRoute answer="No" next="→ A3" />
              <ProcessRoute answer="Yes" next="→ A2" />
            </ProcessStep>
            <ProcessStep number="A2" question="Do you have top pair or a strong draw?">
              <ProcessRoute answer="Yes" next="→ A3" />
              <ProcessRoute answer="No" action="check" label="Check" />
            </ProcessStep>
            <ProcessStep number="A3" question="Can you name a reason to bet?">
              <ProcessRoute answer="One worse hand calls" action="raise" label="Value bet → size" />
              <ProcessRoute answer="One better hand folds + one turn helps" action="raise" label="Semi-bluff → size" />
              <ProcessRoute answer="Cannot name either" action="check" label="Check" />
            </ProcessStep>
          </section>
          <section className="py-5 lg:pl-6">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Lane B · Someone bets first</p>
            <ProcessStep number="B1" question="Is their bet tiny?">
              <ProcessRoute answer="Yes" next="→ Use lane A">Treat a tiny donk bet like a check.</ProcessRoute>
              <ProcessRoute answer="No" next="→ B2" />
            </ProcessStep>
            <ProcessStep number="B2" question="Do you have a made hand or a real draw?">
              <ProcessRoute answer="Yes" action="call" label="Call" />
              <ProcessRoute answer="No" action="fold" label="Fold" />
            </ProcessStep>
          </section>
        </div>
      </Card>
      <Card title="05 · c-bet size" Icon={Target}>
        <div className="border-b border-zinc-200 py-4 text-sm leading-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          Use this table only after Lane A ends in <strong className="font-semibold text-amber-700 dark:text-amber-400">BET</strong>. It chooses the amount; it does not decide whether to bet.
        </div>
        <SizingBand size="55%" label="Dry A/K-high" detail="Missed · two low cards · no flush draw" />
        <SizingBand size="60%" label="Default pressure" detail="Missed, but the board has high cards" />
        <SizingBand size="75%" label="Good hand" detail="Sticky regular" />
        <SizingBand size="100%" label="Top pair+" detail="Fish / SLP calls too much" />
        <SizingBand size="150%" label="Monster" detail="Calling station" />
      </Card>
    </div>
  );
}

function SizingBand({
  size,
  label,
  detail,
}: {
  size: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="grid grid-cols-[4.75rem_1fr] gap-x-4 border-t border-zinc-200 py-3.5 first:border-t-0 dark:border-zinc-800 sm:grid-cols-[6rem_minmax(10rem,0.75fr)_1.25fr] sm:items-center sm:gap-x-6">
      <span className="font-mono text-lg font-semibold tabular-nums tracking-tight text-amber-700 dark:text-amber-400">{size}</span>
      <span className="text-sm font-semibold tracking-tight">{label}</span>
      <span className="col-start-2 mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400 sm:col-start-auto sm:mt-0">{detail}</span>
    </div>
  );
}

function CbetResponseMap() {
  return (
    <Card title="After your c-bet" Icon={CircleDot}>
      <PathRow number="01" when="They make a real raise" action="fold" then="Fold, including one-pair hands. NL2 raises are value-heavy." />
      <PathRow number="02" when="They min-raise" action="call" then="Only in position with middle pair or top pair. Air folds." />
      <PathRow number="03" when="They call · fold-to-c-bet 70%+" action="fold" then="Their call is strong: top pair or a big draw. Stop bluffing." />
      <PathRow number="04" when="They call · fold-to-c-bet 59% or less" action="raise" then="They are sticky. Keep value betting; their call alone says little." />
    </Card>
  );
}

function TurnMap() {
  return (
    <Card title="Turn · action order" Icon={ArrowRight}>
      <PathRow number="01" when="No top pair, overpair or good draw" action="fold" then="Stop investing. A tiny bet is the only reason to continue." />
      <PathRow number="02" when="Top pair / small overpair vs fish or SLP" action="raise" then="Bet 75% pot for value." />
      <PathRow number="03" when="Top pair / small overpair vs TAG" action="check" then="Check or check-fold. Keep the pot controlled." />
      <PathRow number="04" when="Two pair or better" action="raise" then="Bet 75%+ against everyone." />
      <PathRow number="05" when="They raise or lead big" action="fold" then="If your hand cannot beat two pair, fold by default." />
    </Card>
  );
}

function RiverMap() {
  return (
    <Card title="River · action order" Icon={ArrowRight}>
      <PathRow number="01" when="No pair" action="fold" then="Give up. Exception: fish bets 1/4 pot, draws miss, AJ-high+ can call." />
      <PathRow number="02" when="Top pair" action="raise" then="Bet about 2/3 pot. Bet bigger against fish / SLP." />
      <PathRow number="03" when="Middle pair" action="raise" then="Value bet fish / SLP. Check against TAG unless your kicker is great." />
      <PathRow number="04" when="Facing a normal river bet" action="call" then="AF 1: fold. AF 2+: call only on a safe card. Pot-size or overbet: fold." />
      <PathRow number="05" when="They raise your bet 3×+" action="fold" then="Fold. A fish min-raising a small pot is the named exception." />
    </Card>
  );
}

function DecisionRow({
  number,
  question,
  raise,
  call,
  fold,
}: {
  number: string;
  question: string;
  raise?: React.ReactNode;
  call?: React.ReactNode;
  fold?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[11rem_repeat(3,minmax(11rem,1fr))] gap-2 border-t border-zinc-200 py-3 first:border-t-0 dark:border-zinc-800">
      <div className="flex gap-3 px-1 py-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 font-mono text-[10px] font-medium text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">{number}</span>
        <p className="pt-1 text-sm font-semibold leading-5 tracking-tight">{question}</p>
      </div>
      <ActionCell action="raise">{raise}</ActionCell>
      <ActionCell action="call">{call}</ActionCell>
      <ActionCell action="fold">{fold}</ActionCell>
    </div>
  );
}

function PreflopAlgorithm({ entries }: { entries: readonly PlaybookEntry[] }) {
  const ids = new Set(entries.map((entry) => entry.id));
  const steps = [
    ids.has("ranges") && ids.has("sizing") ? (
      <DecisionRow key="open" number="01" question="No raise in front"
        raise={<><RuleLine emphasis>Your position range</RuleLine><RuleLine>4bb: UTG · HJ · SB</RuleLine><RuleLine>3bb: CO · BTN</RuleLine><RuleLine>+1bb / limper</RuleLine></>}
        fold={<RuleLine emphasis>Not in your range</RuleLine>}
      />
    ) : null,
    ids.has("facing-open") ? (
      <DecisionRow key="open-facing" number="02" question="One open. No caller."
        raise={<><RuleLine emphasis>QQ+ · AK</RuleLine><RuleLine>3× IP · 4× OOP</RuleLine><RuleLine>2.5× or jam vs 50bb−</RuleLine></>}
        call={<><RuleLine emphasis>JJ · TT · AQ</RuleLine><RuleLine>Any pair: 50bb IP</RuleLine><RuleLine>70bb OOP</RuleLine></>}
        fold={<RuleLine emphasis>Everything else</RuleLine>}
      />
    ) : null,
    ids.has("squeeze") ? (
      <DecisionRow key="squeeze" number="03" question="Open + caller(s)"
        raise={<><RuleLine emphasis>QQ+ · AK</RuleLine><RuleLine>BB JJ: early + 2 callers</RuleLine><RuleLine>3× IP · 4× OOP</RuleLine><RuleLine>+1bb / caller</RuleLine></>}
        fold={<RuleLine emphasis>Everything else</RuleLine>}
      />
    ) : null,
    ids.has("vs-3bet") ? (
      <DecisionRow key="three-bet" number="04" question="You raised. They 3-bet."
        raise={<><RuleLine emphasis>AA · KK · QQ · JJ · AK</RuleLine><RuleLine>4-bet: 3× their 3-bet</RuleLine><RuleLine>50bb−: jam value</RuleLine></>}
        call={<><RuleLine emphasis>88–TT · AQ</RuleLine><RuleLine>100bb only</RuleLine></>}
        fold={<><RuleLine emphasis>Everything else</RuleLine><RuleLine>50bb−: fold or jam</RuleLine><RuleLine>Never call</RuleLine></>}
      />
    ) : null,
    ids.has("vs-4bet") ? (
      <DecisionRow key="four-bet" number="05" question="You 3-bet. They 4-bet."
        raise={<><RuleLine emphasis>AA · KK</RuleLine><RuleLine>All-in</RuleLine></>}
        fold={<><RuleLine emphasis>Everything else</RuleLine><RuleLine>KK: fold 200bb+ vs verified nit</RuleLine></>}
      />
    ) : null,
  ].filter((step): step is React.ReactElement => step !== null);

  return (
    <Card title="Pre-flop · action order" Icon={ArrowRight}>
      <div className="-mx-5 overflow-x-auto px-5 py-4">
        <div className="min-w-[44rem]">
          <div className="grid grid-cols-[11rem_repeat(3,minmax(11rem,1fr))] gap-2 pb-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            <span className="px-1">Situation</span>
            <span className="px-3 text-amber-600 dark:text-amber-400">Raise</span>
            <span className="px-3 text-emerald-600 dark:text-emerald-400">Call</span>
            <span className="px-3 text-rose-600 dark:text-rose-400">Fold</span>
          </div>
          {steps}
        </div>
      </div>
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
      <div className="flex items-center gap-3">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">{title}</h2>
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="mt-4 space-y-4">{children}</div>
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
  if (entry.id === "flop") return <FlopMap />;
  if (entry.id === "cbet-response") return <CbetResponseMap />;
  if (entry.id === "turn") return <TurnMap />;
  if (entry.id === "river") return <RiverMap />;
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
