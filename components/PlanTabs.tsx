"use client";

import { MealPlan, PlanSummary } from "@/lib/types";

interface Props {
  plans: { plan: MealPlan; summary: PlanSummary }[];
  activePlanId: string;
  onSelect: (id: string) => void;
}

export default function PlanTabs({ plans, activePlanId, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {plans.map(({ plan, summary }) => {
        const active = plan.planId === activePlanId;
        return (
          <button
            key={plan.planId}
            type="button"
            onClick={() => onSelect(plan.planId)}
            className={`rounded-xl border px-4 py-2.5 text-left transition-colors ${
              active
                ? "border-brand-500 bg-brand-50 shadow-sm"
                : "border-neutral-200 bg-white hover:border-brand-300"
            }`}
          >
            <p className={`text-sm font-bold ${active ? "text-brand-700" : "text-neutral-700"}`}>
              {plan.planName}
            </p>
            <p className="text-xs text-neutral-500">
              {summary.estimatedSpend.toLocaleString("ko-KR")}원 · 평균 {summary.averageDistance}m
            </p>
          </button>
        );
      })}
    </div>
  );
}
