"use client";

import { PlanSummary } from "@/lib/types";

const GRADE_COLOR: Record<string, string> = {
  "텅장 경보": "bg-red-100 text-red-700 border-red-300",
  "냉장고 파먹기 계급": "bg-orange-100 text-orange-700 border-orange-300",
  "생계형 편의점 계급": "bg-amber-100 text-amber-700 border-amber-300",
  "동네 맛집 탐험 계급": "bg-lime-100 text-lime-700 border-lime-300",
  "귀족 자취생 계급": "bg-violet-100 text-violet-700 border-violet-300",
};

function won(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

export default function SummaryDashboard({ summary }: { summary: PlanSummary }) {
  const colorClass = GRADE_COLOR[summary.survivalGrade] ?? "bg-neutral-100 text-neutral-700 border-neutral-300";

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">생존 등급</p>
          <span
            className={`mt-1 inline-block rounded-full border px-4 py-1.5 text-lg font-extrabold ${colorClass}`}
          >
            {summary.survivalGrade}
          </span>
          {summary.survivalSubtitle && (
            <p className="mt-1 text-xs font-semibold text-neutral-400">
              칭호 · <span className="text-neutral-600">{summary.survivalSubtitle}</span>
            </p>
          )}
        </div>
        <p className="max-w-xs text-right text-sm font-medium text-neutral-600">
          {summary.survivalMessage}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="총 예산" value={won(summary.totalBudget)} />
        <Stat label="예상 지출" value={won(summary.estimatedSpend)} />
        <Stat
          label="예산 사용률"
          value={`${summary.budgetUsageRatio}%`}
          highlight={summary.budgetUsageRatio > 100 ? "text-red-600" : undefined}
        />
        <Stat
          label="남은 돈"
          value={won(summary.remaining)}
          highlight={summary.remaining < 0 ? "text-red-600" : undefined}
        />
        <Stat label="한 끼 평균" value={won(summary.avgPerMeal)} />
        <Stat label="평균 거리" value={`${summary.averageDistance}m`} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">
          메뉴 다양성 {summary.diversityScore}점
        </span>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">
          외식 {summary.eatoutCount}끼
        </span>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">
          편의점 {summary.convenienceCount}끼
        </span>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">
          요리 {summary.cookingCount}끼
        </span>
      </div>

      <p className="mt-4 text-xs text-neutral-400">
        추천 성향 · <span className="text-neutral-600">{summary.personaLine}</span>
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className={`mt-0.5 text-base font-bold ${highlight ?? "text-neutral-800"}`}>{value}</p>
    </div>
  );
}
