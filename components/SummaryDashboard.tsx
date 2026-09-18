"use client";

import { PlanSummary } from "@/lib/types";

// 등급 심각도에 따라 팔레트 안에서 색을 골라 기존 "위험할수록 눈에 띄게" 정보를 유지한다.
const GRADE_BADGE: Record<string, string> = {
  "텅장 경보": "bg-ramen text-[#FFF8EC]",
  "냉장고 파먹기 계급": "bg-coin text-ink",
  "생계형 편의점 계급": "bg-coin text-ink",
  "국밥마스터 계급": "bg-moss text-ink",
  "귀족 자취생 계급": "bg-cool text-ink",
};

function won(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

export default function SummaryDashboard({ summary }: { summary: PlanSummary }) {
  const badgeClass = GRADE_BADGE[summary.survivalGrade] ?? "bg-moss text-ink";

  return (
    <div className="panel flex flex-col gap-3 p-4">
      <p className="text-xs font-extrabold text-[#6B7360]">생존 등급</p>

      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className={`inline-block rounded-full border-[3px] border-ink px-4 py-2 font-heading ${badgeClass}`}
          style={{ fontSize: "20px" }}
        >
          {summary.survivalGrade}
        </span>
        <span className="text-[13px] font-extrabold text-[#3C4633]">{summary.survivalMessage}</span>
      </div>

      {summary.survivalSubtitle && (
        <p className="text-xs font-bold text-[#6B7360]">칭호 · {summary.survivalSubtitle}</p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="총 예산" value={won(summary.totalBudget)} />
        <StatTile label="예상 지출" value={won(summary.estimatedSpend)} />
        <StatTile
          label="예산 사용률"
          value={`${summary.budgetUsageRatio}%`}
          highlight={summary.budgetUsageRatio > 100}
        />
        <StatTile label="남은 돈" value={won(summary.remaining)} alert={summary.remaining < 0} />
        <StatTile label="한 끼 평균" value={won(summary.avgPerMeal)} />
        <StatTile label="평균 거리" value={`${summary.averageDistance}m`} />
      </div>

      <div className="flex flex-wrap gap-[7px]">
        <SummaryChip label={`메뉴 다양성 ${summary.diversityScore}점`} />
        <SummaryChip label={`외식 ${summary.eatoutCount}끼`} />
        <SummaryChip label={`편의점 ${summary.convenienceCount}끼`} />
        <SummaryChip label={`요리 ${summary.cookingCount}끼`} />
      </div>

      <p className="text-xs font-bold text-[#6B7360]">추천 성향 · {summary.personaLine}</p>
    </div>
  );
}

function StatTile({
  label,
  value,
  highlight,
  alert,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  alert?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-[3px] rounded-xl border-[3px] border-ink px-2.5 py-2.5 ${
        highlight ? "bg-coin" : "bg-white"
      }`}
    >
      <span className={`text-[11px] font-bold ${highlight ? "text-[#4A5140]" : "text-[#6B7360]"}`}>
        {label}
      </span>
      <span className={`text-[15px] font-black ${alert ? "text-ramen" : "text-ink"}`}>{value}</span>
    </div>
  );
}

function SummaryChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border-2 border-ink bg-[#EDEAD8] px-[11px] py-[5px] text-xs font-extrabold text-ink">
      {label}
    </span>
  );
}
