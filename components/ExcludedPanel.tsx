"use client";

import { CandidatePool } from "@/lib/types";

interface Props {
  excludedIds: string[];
  pool: CandidatePool | null;
  onRestore: (id: string) => void;
}

export default function ExcludedPanel({ excludedIds, pool, onRestore }: Props) {
  if (excludedIds.length === 0) {
    return (
      <p className="text-sm text-neutral-400">아직 숨긴 식당이 없어요.</p>
    );
  }

  const lookup = new Map<string, string>();
  pool?.restaurants.forEach((r) => lookup.set(r.id, r.place_name));
  pool?.convenience.forEach((r) => lookup.set(r.id, r.place_name));

  return (
    <ul className="space-y-2">
      {excludedIds.map((id) => (
        <li
          key={id}
          className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm"
        >
          <span className="text-neutral-700">{lookup.get(id) ?? id}</span>
          <button
            type="button"
            onClick={() => onRestore(id)}
            className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600 hover:border-brand-400 hover:text-brand-600"
          >
            다시 보기
          </button>
        </li>
      ))}
    </ul>
  );
}
