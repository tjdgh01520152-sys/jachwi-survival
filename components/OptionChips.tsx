"use client";

import { useState } from "react";
import { OptionKey } from "@/lib/types";
import { OPTION_META, isSingleSelectGroup } from "@/lib/optionLabels";

interface Props {
  selected: Set<OptionKey>;
  onToggle: (key: OptionKey) => void;
}

export default function OptionChips({ selected, onToggle }: Props) {
  const groups = Array.from(new Set(OPTION_META.map((o) => o.group)));
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  function toggleGroup(group: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const items = OPTION_META.filter((o) => o.group === group);
        const hasProgressive = items.some((o) => o.core);
        const isExpanded = expandedGroups.has(group);
        const visibleItems = !hasProgressive || isExpanded ? items : items.filter((o) => o.core);
        const hiddenCount = items.length - visibleItems.length;

        return (
          <div key={group}>
            <p className="mb-1.5 text-xs font-medium text-neutral-400">
              {group}
              {isSingleSelectGroup(group) && <span className="ml-1 text-neutral-300">(하나만 선택)</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {visibleItems.map((opt) => {
                const on = selected.has(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => onToggle(opt.key)}
                    className={`chip ${on ? "chip-on" : "chip-off"}`}
                    aria-pressed={on}
                  >
                    {opt.label}
                  </button>
                );
              })}
              {hasProgressive && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="chip chip-off border-dashed text-neutral-400"
                >
                  {isExpanded ? "접기" : `더 보기 +${hiddenCount}`}
                </button>
              )}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-neutral-400">
        선택하지 않아도 기본값으로 추천이 돌아가요.
      </p>
    </div>
  );
}
