"use client";

import { CandidatePool } from "@/lib/types";

interface Props {
  excludedIds: string[];
  pool: CandidatePool | null;
  onRestore: (id: string) => void;
}

export default function ExcludedPanel({ excludedIds, pool, onRestore }: Props) {
  if (excludedIds.length === 0) {
    return <p className="text-sm font-bold text-[#6B7360]">아직 숨긴 식당이 없어요.</p>;
  }

  const lookup = new Map<string, string>();
  pool?.restaurants.forEach((r) => lookup.set(r.id, r.place_name));
  pool?.convenience.forEach((r) => lookup.set(r.id, r.place_name));

  return (
    <ul className="flex flex-col gap-2">
      {excludedIds.map((id) => (
        <li
          key={id}
          className="flex items-center justify-between rounded-xl border-2 border-ink bg-[#EDEAD8] px-3 py-2 text-sm"
        >
          <span className="font-bold text-ink">{lookup.get(id) ?? id}</span>
          <button
            type="button"
            onClick={() => onRestore(id)}
            className="press rounded-full border-2 border-ink bg-white px-3 py-1 text-xs font-extrabold text-ink"
          >
            다시 보기
          </button>
        </li>
      ))}
    </ul>
  );
}
