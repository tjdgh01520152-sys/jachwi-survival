"use client";

import { useEffect, useState } from "react";
import {
  CandidatePool,
  MealPlanItem,
  MinimalSurvivalResult,
  OptionKey,
  UserPreferences,
} from "@/lib/types";
import { COOKING_POOL } from "@/lib/cooking";
import { OPTION_META, isSingleSelectGroup } from "@/lib/optionLabels";
import {
  GeneratedPlan,
  ReplaceFeedback,
  analyzeMinimalSurvival,
  generatePlans,
  replaceMeal,
} from "@/lib/recommend";
import {
  DEFAULT_PREFS,
  FeedbackType,
  applyFeedback,
  loadPrefs,
  removeExcludedPlace,
  saveLastInput,
} from "@/lib/storage";
import SentenceForm from "@/components/SentenceForm";
import OptionChips from "@/components/OptionChips";
import SummaryDashboard from "@/components/SummaryDashboard";
import PlanTabs from "@/components/PlanTabs";
import MealCard from "@/components/MealCard";
import ExcludedPanel from "@/components/ExcludedPanel";
import ShortfallPanel from "@/components/ShortfallPanel";
import SurvivalMap from "@/components/SurvivalMap";

export default function Home() {
  const [location, setLocation] = useState("안암역");
  const [budget, setBudget] = useState("40000");
  const [mealsInput, setMealsInput] = useState("8");
  const [selectedOptions, setSelectedOptions] = useState<Set<OptionKey>>(new Set());

  const [pool, setPool] = useState<CandidatePool | null>(null);
  const [generated, setGenerated] = useState<GeneratedPlan[] | null>(null);
  const [shortfall, setShortfall] = useState<MinimalSurvivalResult | null>(null);
  const [activePlanId, setActivePlanId] = useState<string>("balance");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [showExcluded, setShowExcluded] = useState(false);
  const [busyMealKey, setBusyMealKey] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadPrefs();
    setPrefs(saved);
    if (saved.lastInput) {
      setLocation(saved.lastInput.location);
      setBudget(String(saved.lastInput.budget));
      setMealsInput(String(saved.lastInput.meals));
    }
    if (saved.lastOptions) {
      setSelectedOptions(new Set(saved.lastOptions));
    }
  }, []);

  function toggleOption(key: OptionKey) {
    setSelectedOptions((prev) => {
      const next = new Set(prev);
      const meta = OPTION_META.find((o) => o.key === key);

      if (next.has(key)) {
        next.delete(key);
      } else {
        if (meta && isSingleSelectGroup(meta.group)) {
          for (const o of OPTION_META) {
            if (o.group === meta.group) next.delete(o.key);
          }
        }
        next.add(key);
      }
      return next;
    });
  }

  /** 후보 풀이 이미 있을 때, 예산 초부족부터 확인하고 아니면 일반 3플랜을 생성한다. */
  function runRecommendation(
    targetPool: CandidatePool,
    budgetNum: number,
    mealsNum: number,
    optionsArr: OptionKey[],
    prefsArg: UserPreferences,
    locArg: string,
    seed = 0
  ) {
    const shortfallResult = analyzeMinimalSurvival(targetPool, budgetNum, mealsNum, optionsArr, prefsArg);
    if (shortfallResult.isSevereShortfall) {
      setShortfall(shortfallResult);
      setGenerated(null);
      return;
    }

    setShortfall(null);
    const plans = generatePlans(targetPool, budgetNum, mealsNum, optionsArr, prefsArg, locArg, seed);
    setGenerated(plans);
    setActivePlanId((prev) =>
      plans.some((p) => p.plan.planId === prev) ? prev : plans[1]?.plan.planId ?? plans[0].plan.planId
    );
  }

  async function handleSubmit() {
    const budgetNum = Number(budget) || 0;
    const mealsNum = Number(mealsInput) || 0;
    const loc = location.trim() || "안암역";

    if (budgetNum <= 0 || mealsNum <= 0) {
      setError("예산과 끼니 수를 올바르게 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/restaurants?location=${encodeURIComponent(loc)}&radius=1200`
      );
      const data = await res.json();
      const fullPool: CandidatePool = { ...data, cooking: COOKING_POOL };
      setPool(fullPool);

      const optionsArr = Array.from(selectedOptions);
      const freshPrefs = saveLastInput(loc, budgetNum, mealsNum, optionsArr);
      setPrefs(freshPrefs);

      runRecommendation(fullPool, budgetNum, mealsNum, optionsArr, freshPrefs, loc);
    } catch (e) {
      setError("추천을 불러오는 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  function regenerateAll(nextPrefs: UserPreferences, seed = 0) {
    if (!pool) return;
    const budgetNum = Number(budget) || 0;
    const mealsNum = Number(mealsInput) || 0;
    const optionsArr = Array.from(selectedOptions);
    runRecommendation(pool, budgetNum, mealsNum, optionsArr, nextPrefs, location.trim() || "안암역", seed);
  }

  function handleFullRegenerate() {
    // 매번 다른 시드를 줘서, 같은 조건이라도 버튼을 누를 때마다 다른 조합을 보여준다.
    regenerateAll(prefs, Date.now());
  }

  function handleIncreaseBudget() {
    if (!pool) return;
    const nextBudget = (Number(budget) || 0) + 5000;
    setBudget(String(nextBudget));
    const mealsNum = Number(mealsInput) || 0;
    const optionsArr = Array.from(selectedOptions);
    runRecommendation(pool, nextBudget, mealsNum, optionsArr, prefs, location.trim() || "안암역");
  }

  function handleEnableShareable() {
    if (!pool) return;
    const nextOptions = new Set(selectedOptions);
    nextOptions.add("shareableOk");
    setSelectedOptions(nextOptions);
    const budgetNum = Number(budget) || 0;
    const mealsNum = Number(mealsInput) || 0;
    runRecommendation(pool, budgetNum, mealsNum, Array.from(nextOptions), prefs, location.trim() || "안암역");
  }

  function handleSwitchToCheapestMode() {
    if (!pool) return;
    const nextOptions = new Set(selectedOptions);
    nextOptions.add("styleCheapest");
    nextOptions.add("convenienceOk");
    setSelectedOptions(nextOptions);
    const budgetNum = Number(budget) || 0;
    const mealsNum = Number(mealsInput) || 0;
    runRecommendation(pool, budgetNum, mealsNum, Array.from(nextOptions), prefs, location.trim() || "안암역");
  }

  function handleMealFeedback(planId: string, meal: MealPlanItem, type: ReplaceFeedback) {
    if (!pool || !generated) return;
    const key = `${planId}:${meal.mealIndex}`;
    setBusyMealKey(key);

    let nextPrefs = prefs;
    if (type !== "reroll") {
      nextPrefs = applyFeedback(type as FeedbackType, {
        tags: meal.tags,
        category: meal.category,
        placeId: meal.placeId,
      });
      setPrefs(nextPrefs);
    }

    if (type === "exclude") {
      regenerateAll(nextPrefs);
    } else {
      const budgetNum = Number(budget) || 0;
      const optionsArr = Array.from(selectedOptions);
      const target = generated.find((g) => g.plan.planId === planId);
      if (!target) {
        setBusyMealKey(null);
        return;
      }
      const { plan: newPlan, summary } = replaceMeal(
        target.plan,
        meal.mealIndex,
        type,
        pool,
        budgetNum,
        optionsArr,
        nextPrefs,
        location.trim() || "안암역",
        type === "reroll" ? Date.now() : 0
      );
      setGenerated((prev) =>
        prev
          ? prev.map((g) => (g.plan.planId === planId ? { plan: newPlan, summary } : g))
          : prev
      );
    }
    setBusyMealKey(null);
  }

  function handleRestore(id: string) {
    const nextPrefs = removeExcludedPlace(id);
    setPrefs(nextPrefs);
    regenerateAll(nextPrefs);
  }

  const activeEntry = generated?.find((g) => g.plan.planId === activePlanId) ?? generated?.[0] ?? null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <header className="mb-8 text-center">
        <p className="text-sm font-semibold tracking-wide text-brand-600">
          자취생 생존기
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
          남은 식비로, 며칠을 버틸 수 있을까?
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          예산 · 위치 · 끼니 수를 입력하면 실제 주변 식당과 요리를 섞어 생존 플랜을 짜드려요.
        </p>
      </header>

      <SentenceForm
        location={location}
        budget={budget}
        meals={mealsInput}
        onLocationChange={setLocation}
        onBudgetChange={setBudget}
        onMealsChange={setMealsInput}
        onSubmit={handleSubmit}
        loading={loading}
      />

      <section className="card mt-4 p-6">
        <p className="mb-3 text-sm font-semibold text-neutral-500">
          더 정확한 추천을 원한다면 (선택 사항)
        </p>
        <OptionChips selected={selectedOptions} onToggle={toggleOption} />
      </section>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {pool?.isFallback && (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          {pool.fallbackReason ?? "예시 데이터를 보여드리고 있어요."}
        </p>
      )}

      {shortfall && shortfall.isSevereShortfall && (
        <ShortfallPanel
          result={shortfall}
          budget={Number(budget) || 0}
          shareableOn={selectedOptions.has("shareableOk")}
          onIncreaseBudget={handleIncreaseBudget}
          onEnableShareable={handleEnableShareable}
          onSwitchToCheapestMode={handleSwitchToCheapestMode}
        />
      )}

      {generated && activeEntry && (
        <section className="mt-8 space-y-5">
          <SummaryDashboard summary={activeEntry.summary} />

          <SurvivalMap
            center={pool?.center ? { lat: pool.center.y, lng: pool.center.x } : null}
            meals={activeEntry.plan.meals}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <PlanTabs plans={generated} activePlanId={activePlanId} onSelect={setActivePlanId} />
            <button
              type="button"
              onClick={handleFullRegenerate}
              className="shrink-0 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-600 hover:border-brand-400 hover:text-brand-600"
            >
              전체 다시 추천
            </button>
          </div>

          {activeEntry.plan.shareShortfall && (
            <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700">
              나눠먹기 메뉴를 넣고 싶었지만, 현재 예산/거리 조건에 맞는 후보가 부족했어요.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {activeEntry.plan.meals.map((meal) => (
              <MealCard
                key={meal.mealIndex}
                meal={meal}
                isExcluded={!!meal.placeId && prefs.excludedPlaceIds.includes(meal.placeId)}
                busy={busyMealKey === `${activePlanId}:${meal.mealIndex}`}
                onReroll={() => handleMealFeedback(activePlanId, meal, "reroll")}
                onTooFar={() => handleMealFeedback(activePlanId, meal, "tooFar")}
                onTooExpensive={() => handleMealFeedback(activePlanId, meal, "tooExpensive")}
                onNotAppealing={() => handleMealFeedback(activePlanId, meal, "notAppealing")}
                onExclude={() => handleMealFeedback(activePlanId, meal, "exclude")}
              />
            ))}
          </div>

          <div className="card p-4">
            <button
              type="button"
              onClick={() => setShowExcluded((s) => !s)}
              className="text-sm font-semibold text-neutral-600 hover:text-brand-600"
            >
              내 추천에서 숨긴 식당 보기 ({prefs.excludedPlaceIds.length})
            </button>
            {showExcluded && (
              <div className="mt-3">
                <ExcludedPanel
                  excludedIds={prefs.excludedPlaceIds}
                  pool={pool}
                  onRestore={handleRestore}
                />
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
