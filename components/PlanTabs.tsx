"use client";

import { MealPlan, PlanSummary } from "@/lib/types";

interface Props {
  plans: { plan: MealPlan; summary: PlanSummary }[];
  activePlanId: string;
  onSelect: (id: string) => void;
}

export default function PlanTabs({ plans, activePlanId, onSelect }: Props) {
  return (
    <div className="flex flex-1 flex-wrap gap-2">
      {plans.map(({ plan, summary }) => {
        const active = plan.planId === activePlanId;
        return (
          <button
            key={plan.planId}
            type="button"
            onClick={() => onSelect(plan.planId)}
            className={`press flex min-h-[44px] flex-1 basis-[130px] flex-col items-start gap-[3px] rounded-[14px] border-[3px] px-[13px] py-[11px] text-left ${
              active ? "border-ramen bg-[#FFE9E4]" : "border-ink bg-paper"
            }`}
          >
            <p className="text-sm font-black text-ink">{plan.planName}</p>
            <p className="text-xs font-bold text-[#4A5140]">
              {summary.estimatedSpend.toLocaleString("ko-KR")}원 · 평균 {summary.averageDistance}m
            </p>
          </button>
        );
      })}
    </div>
  );
}
