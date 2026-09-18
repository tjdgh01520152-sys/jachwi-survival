"use client";

import { MealPlanItem } from "@/lib/types";

const SOURCE_LABEL: Record<string, string> = {
  eatout: "외식",
  convenience: "편의점",
  cooking: "요리",
};

interface Props {
  meal: MealPlanItem;
  isExcluded: boolean;
  busy: boolean;
  onReroll: () => void;
  onTooFar: () => void;
  onTooExpensive: () => void;
  onNotAppealing: () => void;
  onExclude: () => void;
}

export default function MealCard({
  meal,
  isExcluded,
  busy,
  onReroll,
  onTooFar,
  onTooExpensive,
  onNotAppealing,
  onExclude,
}: Props) {
  if (meal.isEmpty) {
    return (
      <div className="flex flex-col gap-2 rounded-[18px] border-4 border-dashed border-ink/30 bg-[#EDEAD8] p-[14px]">
        <p className="text-xs font-extrabold text-[#6B7360]">{meal.mealIndex}번째 끼니</p>
        <p className="font-heading text-lg text-ink/60">비어 있는 끼니</p>
        <p className="text-sm font-bold text-[#6B7360]">예산 부족으로 추천 불가</p>
        <p className="text-sm font-medium text-[#6B7360]">{meal.reason}</p>
      </div>
    );
  }

  return (
    <div className="panel-sm flex flex-col gap-[9px] p-[14px]">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-black text-ramen">
          {meal.mealIndex}번째 끼니 · {SOURCE_LABEL[meal.source]}
        </span>
        <span className="shrink-0 rounded-full border-2 border-ink bg-[#EDEAD8] px-[9px] py-[3px] text-[11px] font-extrabold text-ink">
          {meal.category}
        </span>
      </div>

      <p className="font-heading leading-[1.2] text-ink" style={{ fontSize: "22px" }}>
        {meal.menuName}
      </p>
      <p className="text-[13px] font-bold text-[#4A5140]">{meal.placeName}</p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-black text-ink">{meal.priceLabel}</span>
        {meal.isCurated && (
          <span
            className="rounded-full border-2 border-ink bg-[#CDEBC8] px-[9px] py-[3px] text-[11px] font-extrabold text-ink"
            title="매장/배달/프로모션에 따라 실제 가격은 달라질 수 있어요."
          >
            프랜차이즈 기준가
          </span>
        )}
        {meal.mealMode === "share" && (
          <span className="rounded-full border-2 border-ink bg-[#D3E7F8] px-[9px] py-[3px] text-[11px] font-extrabold text-ink">
            나눠먹기 · 같이 먹을 사람 필요
          </span>
        )}
        {!meal.isCurated && meal.mealMode !== "share" && (
          <span className="rounded-full border-2 border-ink bg-[#CDEBC8] px-[9px] py-[3px] text-[11px] font-extrabold text-ink">
            {SOURCE_LABEL[meal.source]}
          </span>
        )}
        {meal.distanceMeters !== null && (
          <span className="text-[13px] font-bold text-[#4A5140]">· {Math.round(meal.distanceMeters)}m</span>
        )}
      </div>

      <p className="text-[13px] font-medium leading-[1.55] text-[#3C4633]">{meal.reason}</p>

      {meal.sideSuggestion && (
        <p className="text-xs font-bold text-[#6B7360]">
          추가 사이드 후보: {meal.sideSuggestion.menuName}{" "}
          {meal.sideSuggestion.price.toLocaleString("ko-KR")}원
        </p>
      )}

      {meal.placeUrl && (
        <a
          href={meal.placeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-black text-[#1B7F3B] underline underline-offset-2"
        >
          카카오맵에서 보기
        </a>
      )}

      {isExcluded && (
        <p className="text-xs font-bold text-ramen">숨긴 곳이었지만 대안이 없어 다시 표시됐어요.</p>
      )}

      <div className="h-0.5 bg-[#DDD9C6]" />

      <div className="flex flex-wrap gap-[7px]">
        <ActionButton onClick={onReroll} disabled={busy} label="이것만 바꾸기" />
        {meal.source !== "cooking" && (
          <>
            <ActionButton onClick={onTooFar} disabled={busy} label="너무 멀어요" />
            <ActionButton onClick={onTooExpensive} disabled={busy} label="비싸요" />
          </>
        )}
        <ActionButton onClick={onNotAppealing} disabled={busy} label="안 끌려요" />
        {meal.source !== "cooking" && (
          <ActionButton onClick={onExclude} disabled={busy} label="이곳 제외하기" tone="danger" />
        )}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`press rounded-full border-2 bg-white px-[11px] py-[6px] text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "danger" ? "border-ramen text-ramen" : "border-ink text-ink"
      }`}
    >
      {label}
    </button>
  );
}
