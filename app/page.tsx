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
    <main
      className="min-h-screen bg-moss px-3 pb-10 pt-3.5 font-body text-ink"
      style={{
        backgroundImage: "radial-gradient(#9BBE72 1.5px, transparent 1.6px)",
        backgroundSize: "18px 18px",
      }}
    >
      <div className="mx-auto flex max-w-[460px] flex-col gap-3.5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-ink px-3 py-1.5 text-xs font-black tracking-[0.14em] text-coin">
              SURVIVAL MODE
            </span>
          </div>

          <div className="relative rounded-[22px] border-4 border-ink bg-coin p-[22px] pb-5 shadow-hardLg">
            <div
              className="font-heading leading-[0.92] tracking-tight text-ink"
              style={{
                fontSize: "clamp(46px,15vw,68px)",
                textShadow: "4px 4px 0 #FAF6E8",
              }}
            >
              자취생
              <br />
              생존기
            </div>
            <div
              className="mt-3.5 font-black leading-[1.35]"
              style={{ fontSize: "clamp(17px,5vw,21px)" }}
            >
              아슬아슬한 식비,
              <br />
              끝까지 버틸 수 있을까?
            </div>
            <div className="absolute -right-2 -top-3.5 rounded-full border-[3px] border-ink bg-ramen px-[13px] py-[7px] text-[13px] font-black text-white [transform:rotate(7deg)]">
              EP.1 개강
            </div>
          </div>

          <div className="flex items-end gap-3 rounded-[20px] border-4 border-ink bg-paper p-3.5 shadow-hard">
            <div className="flex-none animate-bob" style={{ width: 108 }}>
              <svg
                viewBox="0 0 120 140"
                width="108"
                height="126"
                fill="none"
                stroke="#12140F"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M36 132 L42 84 Q60 74 78 84 L84 132 Z" fill="#7FB8E8" />
                <circle cx="60" cy="48" r="30" fill="#FFE2C4" />
                <path
                  d="M30 46 Q32 12 60 12 Q88 12 90 46 Q76 32 60 34 Q44 36 30 46 Z"
                  fill="#12140F"
                />
                <circle cx="50" cy="50" r="3.6" fill="#12140F" stroke="none" className="animate-blink" />
                <circle cx="70" cy="50" r="3.6" fill="#12140F" stroke="none" className="animate-blink" />
                <path d="M44 40 L53 43" />
                <path d="M76 40 L67 43" />
                <path d="M51 63 q4.5 5 9 0 q4.5 -5 9 0" strokeWidth="4" />
                <path d="M42 96 L26 112" strokeWidth="5" />
                <path d="M78 96 L96 108" strokeWidth="5" />
                <path d="M82 104 L110 104 L105 128 L87 128 Z" fill="#E5533D" />
                <path d="M82 110 L108 110" />
              </svg>
            </div>
            <div className="relative flex-1 rounded-2xl border-[3px] border-ink bg-white p-3 text-sm font-extrabold leading-[1.45]">
              라면만 먹고 버티긴
              <br />좀 그렇잖아요?
              <div className="absolute -left-[9px] bottom-3.5 h-3 w-3 rotate-45 border-b-[3px] border-l-[3px] border-ink bg-white" />
            </div>
          </div>

          <p className="text-[15px] font-semibold leading-[1.6]">
            위치, 예산, 끼니 수만 입력하면 근처 식당, 편의점, 직접요리를 섞어 현실적인 생존 루트를
            짜드려요.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="flex flex-col gap-4"
          >
            <SentenceForm
              location={location}
              budget={budget}
              meals={mealsInput}
              onLocationChange={setLocation}
              onBudgetChange={setBudget}
              onMealsChange={setMealsInput}
            />

            <div className="panel flex flex-col gap-3.5 p-4">
              <p className="text-[15px] font-black text-ink">더 정확한 추천을 원한다면 (선택 사항)</p>
              <OptionChips selected={selectedOptions} onToggle={toggleOption} />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="press w-full rounded-[18px] border-4 border-ink bg-ramen px-4 py-5 font-heading text-[26px] text-[#FFF8EC] shadow-hardBtn disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "생존 루트 계산 중..." : "생존 루트 뽑기"}
            </button>
          </form>

          <div className="flex flex-wrap justify-center gap-2">
            <Tag label="근처 식당" />
            <Tag label="편의점 조합" />
            <Tag label="직접요리" />
          </div>
        </div>

        {error && (
          <p className="rounded-xl border-[3px] border-ink bg-white px-4 py-3 text-sm font-bold text-ramen">
            {error}
          </p>
        )}

        {pool?.isFallback && (
          <p className="rounded-xl border-[3px] border-ink bg-coin px-4 py-3 text-sm font-bold text-ink">
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
          <section className="flex flex-col gap-3.5">
            <SummaryDashboard summary={activeEntry.summary} />

            <SurvivalMap
              center={pool?.center ? { lat: pool.center.y, lng: pool.center.x } : null}
              meals={activeEntry.plan.meals}
            />

            <div className="flex flex-wrap gap-2">
              <PlanTabs plans={generated} activePlanId={activePlanId} onSelect={setActivePlanId} />
              <button
                type="button"
                onClick={handleFullRegenerate}
                className="press shrink-0 rounded-[14px] border-[3px] border-ink bg-coin px-3.5 py-[11px] text-[13px] font-black text-ink"
              >
                전체 다시 추천
              </button>
            </div>

            {activeEntry.plan.shareShortfall && (
              <p className="rounded-xl border-[3px] border-ink bg-[#D3E7F8] px-4 py-3 text-sm font-bold text-ink">
                나눠먹기 메뉴를 넣고 싶었지만, 현재 예산/거리 조건에 맞는 후보가 부족했어요.
              </p>
            )}

            <div className="flex flex-col">
              {activeEntry.plan.meals.map((meal) => (
                <div key={meal.mealIndex} className="mb-3">
                  <MealCard
                    meal={meal}
                    isExcluded={!!meal.placeId && prefs.excludedPlaceIds.includes(meal.placeId)}
                    busy={busyMealKey === `${activePlanId}:${meal.mealIndex}`}
                    onReroll={() => handleMealFeedback(activePlanId, meal, "reroll")}
                    onTooFar={() => handleMealFeedback(activePlanId, meal, "tooFar")}
                    onTooExpensive={() => handleMealFeedback(activePlanId, meal, "tooExpensive")}
                    onNotAppealing={() => handleMealFeedback(activePlanId, meal, "notAppealing")}
                    onExclude={() => handleMealFeedback(activePlanId, meal, "exclude")}
                  />
                </div>
              ))}
            </div>

            <div className="panel-sm p-[15px]">
              <button
                type="button"
                onClick={() => setShowExcluded((s) => !s)}
                className="text-sm font-black text-ink"
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
      </div>
    </main>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-full border-[3px] border-ink bg-paper px-3 py-1.5 text-xs font-extrabold text-ink">
      {label}
    </span>
  );
}
