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
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const items = OPTION_META.filter((o) => o.group === group);
        const hasProgressive = items.some((o) => o.core);
        const isExpanded = expandedGroups.has(group);
        const visibleItems = !hasProgressive || isExpanded ? items : items.filter((o) => o.core);
        const hiddenCount = items.length - visibleItems.length;

        return (
          <div key={group} className="flex flex-col gap-[7px]">
            <p className="text-xs font-extrabold text-[#6B7360]">
              {group}
              {isSingleSelectGroup(group) && <span className="ml-1">(하나만 선택)</span>}
            </p>
            <div className="flex flex-wrap gap-[7px]">
              {visibleItems.map((opt) => {
                const on = selected.has(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => onToggle(opt.key)}
                    aria-pressed={on}
                    className={`press rounded-full border-[3px] px-3.5 py-2 text-[13px] font-extrabold transition-colors ${
                      on
                        ? "border-ink bg-ramen text-[#FFF8EC]"
                        : "border-[#C9CDBD] bg-white text-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
              {hasProgressive && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="press rounded-full border-[3px] border-dashed border-[#B4B9A8] bg-transparent px-3.5 py-2 text-[13px] font-extrabold text-[#6B7360]"
                >
                  {isExpanded ? "접기" : `더 보기 +${hiddenCount}`}
                </button>
              )}
            </div>
          </div>
        );
      })}
      <p className="text-xs font-bold text-[#6B7360]">
        선택하지 않아도 기본값으로 추천이 돌아가요.
      </p>
    </div>
  );
}
