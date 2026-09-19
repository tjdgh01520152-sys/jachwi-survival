"use client";

import { PlanSummary } from "@/lib/types";

const INK = "#12140F";

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

function GradeFace() {
  return (
    <svg
      viewBox="0 0 90 90"
      width="52"
      height="52"
      fill="none"
      stroke={INK}
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <circle cx="45" cy="45" r="30" fill="#FFE2C4" />
      <path d="M15 43 Q17 11 45 11 Q73 11 75 43 Q60 29 45 31 Q30 33 15 43 Z" fill={INK} />
      <circle cx="35" cy="48" r="3.6" fill={INK} stroke="none" />
      <circle cx="55" cy="48" r="3.6" fill={INK} stroke="none" />
      <path d="M28 40 L37 43" />
      <path d="M62 40 L53 43" />
      <path d="M36 62 q4.5 5 9 0 q4.5 -5 9 0" strokeWidth={4} />
    </svg>
  );
}

export default function SummaryDashboard({ summary }: { summary: PlanSummary }) {
  const badgeClass = GRADE_BADGE[summary.survivalGrade] ?? "bg-moss text-ink";

  return (
    <div className="panel flex flex-col gap-3 p-4">
      <p className="text-xs font-extrabold text-[#6B7360]">생존 등급</p>

      <div className="flex items-start gap-3">
        <GradeFace />
        <div className="flex flex-1 flex-col gap-1.5">
          <span
            className={`self-start inline-block rounded-full border-[3px] border-ink px-4 py-2 font-heading ${badgeClass}`}
            style={{ fontSize: "20px" }}
          >
            {summary.survivalGrade}
          </span>
          <span className="text-[13px] font-extrabold text-[#3C4633]">{summary.survivalMessage}</span>
          {summary.survivalSubtitle && (
            <span className="text-xs font-bold text-[#6B7360]">칭호 · {summary.survivalSubtitle}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1 rounded-[14px] border-[3px] border-ink bg-coin px-3.5 py-3">
          <span className="text-xs font-extrabold text-[#4A5140]">예산 사용률</span>
          <span
            className={`font-heading leading-none ${summary.budgetUsageRatio > 100 ? "text-ramen" : "text-ink"}`}
            style={{ fontSize: "30px" }}
          >
            {summary.budgetUsageRatio}%
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[14px] border-[3px] border-ink bg-ink px-3.5 py-3">
          <span className="text-xs font-extrabold text-moss">남은 돈</span>
          <span
            className={`font-heading leading-none ${summary.remaining < 0 ? "text-ramen" : "text-paper"}`}
            style={{ fontSize: "30px" }}
          >
            {won(summary.remaining)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3.5 gap-y-1.5">
        <InfoRow label="총 예산" value={won(summary.totalBudget)} />
        <InfoRow label="예상 지출" value={won(summary.estimatedSpend)} />
        <InfoRow label="한 끼 평균" value={won(summary.avgPerMeal)} />
        <InfoRow label="평균 거리" value={`${summary.averageDistance}m`} />
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs font-bold text-[#6B7360]">{label}</span>
      <span className="text-[13px] font-extrabold text-ink">{value}</span>
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
