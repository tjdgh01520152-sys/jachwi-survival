"use client";

import { MinimalSurvivalResult } from "@/lib/types";

function won(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

interface Props {
  result: MinimalSurvivalResult;
  budget: number;
  shareableOn: boolean;
  onIncreaseBudget: () => void;
  onEnableShareable: () => void;
  onSwitchToCheapestMode: () => void;
}

export default function ShortfallPanel({
  result,
  budget,
  shareableOn,
  onIncreaseBudget,
  onEnableShareable,
  onSwitchToCheapestMode,
}: Props) {
  return (
    <section className="mt-3.5 flex flex-col gap-3.5">
      <div className="panel flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className="inline-block rounded-full border-[3px] border-ink bg-ramen px-4 py-2 font-heading text-[#FFF8EC]"
            style={{ fontSize: "20px" }}
          >
            텅장 경보
          </span>
          <span className="text-[13px] font-extrabold text-[#3C4633]">
            인간은 음식 없이 3주 생존 가능합니다. 그래도 이 플랜은 위험해요. 몇 끼는 요리나 편의점으로
            돌려야 합니다.
          </span>
        </div>

        <div className="flex flex-col gap-1.5 text-sm font-bold text-ink">
          <p>
            현재 예산으로는 {result.mealsRequested}끼 중{" "}
            <span className="font-black text-ramen">{result.affordableCount}끼만</span> 해결
            가능해요.
          </p>
          <p>
            최저 생존 메뉴로만 구성해도{" "}
            <span className="font-black text-ramen">{result.shortfallCount}끼</span>가 비어요.
          </p>
          <p className="font-bold text-[#6B7360]">
            현실적으로는 예산을 늘리거나, 집에 있는 재료/무료 식사/나눠먹기를 추가해야 합니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="해결해야 할 끼니" value={`${result.mealsRequested}끼`} />
          <StatTile label="예산" value={won(budget)} />
          <StatTile label="최저 생존 메뉴 평균" value={won(result.avgMinPrice)} />
          <StatTile label="가능한 끼니" value={`${result.affordableCount}끼`} alert />
        </div>
      </div>

      <div className="panel-sm flex flex-col gap-2.5 p-4">
        <p className="text-sm font-black text-ink">이렇게 하면 나아져요</p>
        <div className="flex flex-col gap-2">
          <ActionRow
            label={`예산을 5,000원 늘리면 ${result.extraMealsPerExtraBudget}끼 더 해결할 수 있어요.`}
            buttonLabel="예산 5,000원 늘리기"
            onClick={onIncreaseBudget}
            disabled={result.extraMealsPerExtraBudget === 0}
          />
          {!shareableOn && (
            <ActionRow
              label={`나눠먹기 가능 옵션을 켜면 ${result.extraMealsWithShareable}끼 더 해결할 수 있어요.`}
              buttonLabel="나눠먹기 가능 켜기"
              onClick={onEnableShareable}
              disabled={result.extraMealsWithShareable === 0}
            />
          )}
          <ActionRow
            label="가장 저렴한 요리·편의점 위주로 다시 짤 수도 있어요."
            buttonLabel="편의점/최저가 모드로 전환"
            onClick={onSwitchToCheapestMode}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="text-sm font-black text-ink">최저 생존 플랜</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {result.meals.map((meal) =>
            meal.isEmpty ? (
              <div
                key={meal.mealIndex}
                className="flex flex-col gap-2 rounded-[18px] border-4 border-dashed border-ink/30 bg-[#EDEAD8] p-[14px]"
              >
                <p className="text-xs font-extrabold text-[#6B7360]">{meal.mealIndex}번째 끼니</p>
                <p className="font-heading text-lg text-ink/60">비어 있는 끼니</p>
                <p className="text-sm font-bold text-[#6B7360]">예산 부족으로 추천 불가</p>
                <p className="text-sm font-medium text-[#6B7360]">이 끼니는 추가 예산이 필요해요.</p>
              </div>
            ) : (
              <div key={meal.mealIndex} className="panel-sm flex flex-col gap-2 p-[14px]">
                <p className="text-[13px] font-black text-ramen">{meal.mealIndex}번째 끼니</p>
                <p className="font-heading text-lg text-ink">{meal.menuName}</p>
                {meal.placeName && (
                  <p className="text-[13px] font-bold text-[#4A5140]">{meal.placeName}</p>
                )}
                <p className="text-sm font-black text-ink">{meal.priceLabel}</p>
                <p className="text-[13px] font-medium text-[#3C4633]">{meal.reason}</p>
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
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}

function StatTile({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex flex-col gap-[3px] rounded-xl border-[3px] border-ink bg-white px-2.5 py-2.5">
      <span className="text-[11px] font-bold text-[#6B7360]">{label}</span>
      <span className={`text-[15px] font-black ${alert ? "text-ramen" : "text-ink"}`}>{value}</span>
    </div>
  );
}

function ActionRow({
  label,
  buttonLabel,
  onClick,
  disabled,
}: {
  label: string;
  buttonLabel: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-ink bg-[#EDEAD8] px-3.5 py-2.5">
      <p className="text-sm font-bold text-ink">{label}</p>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="press shrink-0 rounded-full border-2 border-ink bg-coin px-3 py-1.5 text-xs font-extrabold text-ink disabled:cursor-not-allowed disabled:border-[#C9CDBD] disabled:bg-transparent disabled:text-[#C9CDBD]"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
