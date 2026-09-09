"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

/**
 * The settings form.
 *
 * Each field says what it changes rather than what it is called, because every
 * one has a non-obvious consequence somewhere else: a number that stops your
 * reading, a timezone that decides when a day rolls over, a stake that turns
 * chips into big blinds, a screen name without which a hand history cannot tell
 * which seat was yours.
 *
 * One save button for the whole form rather than one per field. Four
 * autosaving inputs would mean four requests while you tab through, and no
 * moment where you know the state is settled.
 */

export interface ProfileValues {
  dailyPages: number;
  timezone: string;
  bigBlind: number;
  pokerstarsAlias: string;
}

export function SettingsForm({ profile }: { profile: ProfileValues }) {
  const router = useRouter();
  const [values, setValues] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ProfileValues>(
    key: K,
    value: ProfileValues[K],
  ) => {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  };

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyPages: values.dailyPages,
          timezone: values.timezone,
          bigBlind: values.bigBlind,
          pokerstarsAlias: values.pokerstarsAlias,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Could not save that.");

      setSaved(true);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save that.",
      );
    } finally {
      setSaving(false);
    }
  }, [router, values]);

  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="space-y-8">
      <Field
        label="Pages a day"
        note="A ceiling, not a target. Past it the reader will not open a new section until tomorrow."
      >
        <input
          type="number"
          min={1}
          max={200}
          value={values.dailyPages}
          onChange={(e) => set("dailyPages", Number(e.target.value))}
          className="w-24 rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-sm tabular-nums dark:border-zinc-700"
        />
      </Field>

      <Field
        label="Timezone"
        note="Decides when your day rolls over — for the reading limit, and for which session a late-night hand belongs to."
      >
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={values.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            className="w-64 rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
          />
          {browserZone && browserZone !== values.timezone && (
            <button
              onClick={() => set("timezone", browserZone)}
              className="text-xs text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Use {browserZone}
            </button>
          )}
        </div>
      </Field>

      <Field
        label="Big blind"
        note="The stake you play. Hand review reports everything in big blinds, and this is what converts them."
      >
        <input
          type="number"
          step="0.01"
          min={0.01}
          value={values.bigBlind}
          onChange={(e) => set("bigBlind", Number(e.target.value))}
          className="w-24 rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-sm tabular-nums dark:border-zinc-700"
        />
      </Field>

      <Field
        label="PokerStars screen name"
        note="How you are named in a hand history. Without it there is no way to tell which seat at the table was yours."
      >
        <input
          value={values.pokerstarsAlias}
          onChange={(e) => set("pokerstarsAlias", e.target.value)}
          placeholder="Not set"
          className="w-64 rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
        />
      </Field>

      <div className="flex items-center gap-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-xs text-emerald-600">Saved.</span>}
        {error && <span className="text-xs text-rose-600">{error}</span>}
      </div>
    </div>
  );
}

function Field({
  label,
  note,
  children,
}: {
  label: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-0.5 mb-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        {note}
      </p>
      {children}
    </div>
  );
}
