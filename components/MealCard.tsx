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
      <div className="card flex flex-col gap-2 border-dashed border-neutral-300 bg-neutral-50 p-4">
        <p className="text-xs font-semibold text-neutral-400">{meal.mealIndex}번째 끼니</p>
        <p className="text-base font-bold text-neutral-500">비어 있는 끼니</p>
        <p className="text-sm font-medium text-neutral-400">예산 부족으로 추천 불가</p>
        <p className="text-sm text-neutral-400">{meal.reason}</p>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-brand-600">
            {meal.mealIndex}번째 끼니 · {SOURCE_LABEL[meal.source]}
          </p>
          <p className="mt-1 text-base font-bold text-neutral-800">{meal.menuName}</p>
          <p className="text-sm text-neutral-500">{meal.placeName}</p>
        </div>
        <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-500">
          {meal.category}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-neutral-700">
        <span>{meal.priceLabel}</span>
        {meal.isCurated && (
          <span
            className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
            title="매장/배달/프로모션에 따라 실제 가격은 달라질 수 있어요."
          >
            프랜차이즈 기준가
          </span>
        )}
        {meal.mealMode === "share" && (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
            나눠먹기 · 같이 먹을 사람 필요
          </span>
        )}
        {meal.distanceMeters !== null && <span>· {Math.round(meal.distanceMeters)}m</span>}
      </div>

      {/* 데모용 내부 점수. 카카오 평점이나 별점이 아니라 서비스 자체 지표라는 걸 문구로 명시한다. */}
      {typeof meal.survivalScore === "number" && (
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-semibold text-brand-600">
            생존 적합도 {meal.survivalScore}점
          </p>
          {meal.survivalLabels && meal.survivalLabels.length > 0 && (
            <p className="text-xs text-neutral-400">{meal.survivalLabels.join(" · ")}</p>
          )}
        </div>
      )}

      <p className="text-sm text-neutral-500">{meal.reason}</p>

      {meal.sideSuggestion && (
        <p className="text-xs text-neutral-400">
          추가 사이드 후보: {meal.sideSuggestion.menuName}{" "}
          {meal.sideSuggestion.price.toLocaleString("ko-KR")}원
        </p>
      )}

      {meal.placeUrl && (
        <a
          href={meal.placeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700"
        >
          카카오맵에서 보기
        </a>
      )}

      {isExcluded && (
        <p className="text-xs font-medium text-red-500">
          숨긴 곳이었지만 대안이 없어 다시 표시됐어요.
        </p>
      )}

      <div className="mt-1 flex flex-wrap gap-1.5 border-t border-neutral-100 pt-3">
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
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "danger"
          ? "border-red-200 text-red-500 hover:bg-red-50"
          : "border-neutral-200 text-neutral-600 hover:border-brand-400 hover:text-brand-600"
      }`}
    >
      {label}
    </button>
  );
}
