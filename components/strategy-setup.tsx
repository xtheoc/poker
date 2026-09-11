"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SetupRequirement } from "@/lib/strategies/learning";

export function StrategySetup({
  strategyId,
  requirements,
  completedIds,
}: {
  strategyId: string;
  requirements: readonly SetupRequirement[];
  completedIds: readonly string[];
}) {
  const router = useRouter();
  const [complete, setComplete] = useState(() => new Set(completedIds));
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(requirementId: string) {
    const next = !complete.has(requirementId);
    setSaving(requirementId);
    setError(null);

    try {
      const response = await fetch(`/api/strategies/${strategyId}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementId, complete: next }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Could not save setup.");

      setComplete((current) => {
        const updated = new Set(current);
        if (next) updated.add(requirementId);
        else updated.delete(requirementId);
        return updated;
      });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save setup.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {requirements.map((requirement) => {
        const checked = complete.has(requirement.id);
        const pending = saving === requirement.id;
        return (
          <label key={requirement.id} className="flex cursor-pointer gap-4 py-5">
            <input
              type="checkbox"
              checked={checked}
              disabled={pending}
              onChange={() => void toggle(requirement.id)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-950 dark:accent-white"
            />
            <span className="min-w-0">
              <span className="block font-medium leading-5">
                {requirement.label}
                {requirement.required && <span className="ml-2 text-[11px] font-normal uppercase tracking-[0.08em] text-zinc-400">required</span>}
              </span>
              {requirement.detail && (
                <span className="mt-1.5 block text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{requirement.detail}</span>
              )}
            </span>
          </label>
        );
      })}
      {error && <p className="py-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
