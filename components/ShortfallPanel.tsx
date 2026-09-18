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
    <section className="mt-8 space-y-5">
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-neutral-500">생존 등급</p>
            <span className="mt-1 inline-block rounded-full border border-red-300 bg-red-100 px-4 py-1.5 text-lg font-extrabold text-red-700">
              텅장 경보
            </span>
          </div>
          <p className="max-w-xs text-right text-sm font-medium text-neutral-600">
            이 플랜은 지갑이 먼저 쓰러져요. 몇 끼는 요리나 편의점으로 돌려야 합니다.
          </p>
        </div>

        <div className="mt-5 space-y-1.5 text-sm font-medium text-neutral-700">
          <p>
            현재 예산으로는 {result.mealsRequested}끼 중{" "}
            <span className="font-bold text-red-600">{result.affordableCount}끼만</span> 해결 가능해요.
          </p>
          <p>
            최저 생존 메뉴로만 구성해도 <span className="font-bold text-red-600">{result.shortfallCount}끼</span>가
            비어요.
          </p>
          <p className="text-neutral-500">
            현실적으로는 예산을 늘리거나, 집에 있는 재료/무료 식사/나눠먹기를 추가해야 합니다.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="해결해야 할 끼니" value={`${result.mealsRequested}끼`} />
          <Stat label="예산" value={won(budget)} />
          <Stat label="최저 생존 메뉴 평균" value={won(result.avgMinPrice)} />
          <Stat label="가능한 끼니" value={`${result.affordableCount}끼`} highlight="text-red-600" />
        </div>
      </div>

      <div className="card p-5">
        <p className="mb-3 text-sm font-semibold text-neutral-600">이렇게 하면 나아져요</p>
        <div className="space-y-2">
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

      <div>
        <p className="mb-3 text-sm font-semibold text-neutral-600">최저 생존 플랜</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {result.meals.map((meal) =>
            meal.isEmpty ? (
              <div
                key={meal.mealIndex}
                className="card flex flex-col gap-2 border-dashed border-neutral-300 bg-neutral-50 p-4"
              >
                <p className="text-xs font-semibold text-neutral-400">{meal.mealIndex}번째 끼니</p>
                <p className="text-base font-bold text-neutral-500">비어 있는 끼니</p>
                <p className="text-sm font-medium text-neutral-400">예산 부족으로 추천 불가</p>
                <p className="text-sm text-neutral-400">이 끼니는 추가 예산이 필요해요.</p>
              </div>
            ) : (
              <div key={meal.mealIndex} className="card flex flex-col gap-2 p-4">
                <p className="text-xs font-semibold text-brand-600">{meal.mealIndex}번째 끼니</p>
                <p className="text-base font-bold text-neutral-800">{meal.menuName}</p>
                {meal.placeName && <p className="text-sm text-neutral-500">{meal.placeName}</p>}
                <p className="text-sm font-medium text-neutral-700">{meal.priceLabel}</p>
                <p className="text-sm text-neutral-500">{meal.reason}</p>
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
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className={`mt-0.5 text-base font-bold ${highlight ?? "text-neutral-800"}`}>{value}</p>
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
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-neutral-50 px-4 py-3">
      <p className="text-sm text-neutral-600">{label}</p>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="shrink-0 rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-300 disabled:hover:bg-transparent"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
