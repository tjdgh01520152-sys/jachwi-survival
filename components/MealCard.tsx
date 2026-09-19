"use client";

import { useState } from "react";
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
  isActive: boolean;
  showChangedBadge: boolean;
  onSelect: () => void;
  onReroll: () => void;
  onTooFar: () => void;
  onTooExpensive: () => void;
  onNotAppealing: () => void;
  onExclude: () => void;
}

/** 큰 가격 숫자 옆에 붙는 보조 설명 — 실제 계산에 쓰는 가격(priceValue)은 그대로 두고, 표시 문구만 상황별로 고른다. */
function priceNote(meal: MealPlanItem): string {
  if (meal.mealMode === "share" && meal.shareInfo) {
    return `총 ${meal.shareInfo.totalPrice.toLocaleString("ko-KR")}원 · ${meal.shareInfo.servings}명 기준`;
  }
  if (meal.isCurated) {
    return "매장·배달·프로모션에 따라 달라질 수 있어요";
  }
  if (meal.source === "cooking") {
    return "장보기 재료비 기준";
  }
  return "예상 가격대";
}

export default function MealCard({
  meal,
  isExcluded,
  busy,
  isActive,
  showChangedBadge,
  onSelect,
  onReroll,
  onTooFar,
  onTooExpensive,
  onNotAppealing,
  onExclude,
}: Props) {
  const [fbOpen, setFbOpen] = useState(false);

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
    <div
      onClick={onSelect}
      className="flex cursor-pointer flex-col gap-[9px] rounded-[18px] border-4 bg-paper p-[14px]"
      style={{
        borderColor: isActive ? "#E5533D" : "#12140F",
        boxShadow: `5px 5px 0 ${isActive ? "#E5533D" : "#12140F"}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-[7px]">
          <span className="text-[13px] font-black text-ramen">
            {meal.mealIndex}번째 끼니 · {SOURCE_LABEL[meal.source]}
          </span>
          {showChangedBadge && (
            <span className="rounded-full border-2 border-ink bg-coin px-2 py-[2px] text-[11px] font-black text-ink">
              변경됨
            </span>
          )}
        </div>
        <span className="shrink-0 rounded-full border-2 border-ink bg-[#EDEAD8] px-[9px] py-[3px] text-[11px] font-extrabold text-ink">
          {meal.category}
        </span>
      </div>

      <p className="font-heading leading-[1.2] text-ink" style={{ fontSize: "22px" }}>
        {meal.menuName}
      </p>
      <p className="text-[13px] font-bold text-[#4A5140]">{meal.placeName}</p>

      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-heading leading-none text-ink" style={{ fontSize: "24px" }}>
          {meal.priceValue.toLocaleString("ko-KR")}원
        </span>
        <span className="text-[13px] font-bold text-[#4A5140]">
          내 부담{meal.distanceMeters !== null ? ` · ${Math.round(meal.distanceMeters)}m` : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-[7px]">
        <span
          className={`rounded-full border-2 border-ink px-[9px] py-[3px] text-[11px] font-extrabold text-ink ${
            meal.mealMode === "share" ? "bg-[#D3E7F8]" : "bg-[#CDEBC8]"
          }`}
        >
          {meal.isCurated
            ? "프랜차이즈 기준가"
            : meal.mealMode === "share"
              ? "나눠먹기 · 같이 먹을 사람 필요"
              : SOURCE_LABEL[meal.source]}
        </span>
        <span className="text-[11px] font-semibold text-[#6B7360]">{priceNote(meal)}</span>
      </div>

      <p className="text-[13px] font-medium leading-[1.55] text-[#3C4633]">{meal.reason}</p>

      {meal.sideSuggestion && (
        <p className="text-xs font-bold text-[#6B7360]">
          추가 사이드 후보: {meal.sideSuggestion.menuName}{" "}
          {meal.sideSuggestion.price.toLocaleString("ko-KR")}원
        </p>
      )}

      {isExcluded && (
        <p className="text-xs font-bold text-ramen">숨긴 곳이었지만 대안이 없어 다시 표시됐어요.</p>
      )}

      <div className="flex items-center justify-between gap-2.5">
        {meal.placeUrl ? (
          <a
            href={meal.placeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-black text-[#1B7F3B] underline underline-offset-2"
          >
            카카오맵에서 보기
          </a>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setFbOpen((v) => !v);
          }}
          className="min-h-[44px] shrink-0 rounded-full border-2 border-ink bg-white px-3.5 text-[13px] font-black text-ink"
        >
          {fbOpen ? "닫기" : "···"}
        </button>
      </div>

      {fbOpen && (
        <div className="flex flex-col gap-2.5">
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
      )}
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
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className={`min-h-[44px] rounded-full border-2 bg-white px-3.5 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "danger" ? "border-ramen text-ramen" : "border-ink text-ink"
      }`}
    >
      {label}
    </button>
  );
}
